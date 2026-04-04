from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.config import settings
from middleware.auth import get_current_user
from models.users import User
from models.invoices import Invoice
from schemas.invoice import InvoiceUploadResponse, InvoiceListResponse, InvoiceResponse
from schemas.review import FlaggedInvoiceItem
from app.services import invoice_service
from app.services.pdf_process import convert_pdf_to_images, extract_text_from_pdf
from app.services.extractor import extract_invoice_data, InvoiceExtractionError
from app.services.validator import validate_arithmetic, InvoiceData
from app.services.audit_report import generate_audit_report
from app.services.vector_store import index_invoice
from utils.log import logger
from starlette.status import HTTP_400_BAD_REQUEST
from utils.lim import limiter
from starlette import status
from uuid import UUID
from sqlalchemy.sql import select, update
from sqlalchemy.orm import selectinload

router = APIRouter(prefix="/invoice", tags=["Invoices"])


def _format_pydantic_errors(err: ValidationError) -> list[str]:
    formatted: list[str] = []
    for issue in err.errors():
        location = ".".join(str(part) for part in issue.get("loc", []))
        message = issue.get("msg", "Invalid value")
        if location:
            formatted.append(f"{location}: {message}")
        else:
            formatted.append(str(message))
    return formatted


@router.post("/upload", response_model=InvoiceUploadResponse)
@limiter.limit("10/minute")
async def upload_invoice(request: Request, file: UploadFile = File(...), current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files accepted")
    
    pdf_bytes = await file.read()

    max_size = (settings.MAX_FILE_SIZE_MB or 10) * 1024 * 1024
    if len(pdf_bytes) > max_size:
        raise HTTPException(
            status_code=HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE_MB}MB"
        )

    images = convert_pdf_to_images(pdf_bytes)
    pdf_str = extract_text_from_pdf(pdf_bytes)
    try:
        extracted = await extract_invoice_data(images)
        invoice_dict = extracted.model_dump()
        invoice_data = InvoiceData(**invoice_dict)
    except InvoiceExtractionError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": err.message, "errors": err.issues},
        ) from err
    except ValidationError as err:
        errors = _format_pydantic_errors(err)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Invoice is missing required fields or contains invalid values.",
                "errors": errors,
            },
        ) from err
    
    validation_checks, all_passed = validate_arithmetic(invoice_data)
    status_value = "CLEAN" if all_passed else "FLAGGED"
    audit_report = None
    
    if not all_passed:
        failed = [{"check_name": c.check_name, "expected_value": str(c.expected_value),
                  "actual_value": str(c.actual_value), "passed": c.passed, "discrepancy": str(c.discrepancy)} for c in validation_checks if not c.passed]
        audit_report = await generate_audit_report(invoice_dict["vendor_name"], invoice_dict["invoice_number"],
                                                   invoice_dict["grand_total"], invoice_dict["currency"], failed)
    
    validation_result = {"all_passed": all_passed, "checks": [
        {"check_name": c.check_name, "expected_value": str(c.expected_value),
        "actual_value": str(c.actual_value), "passed": c.passed, "discrepancy": str(c.discrepancy)}
        for c in validation_checks]}


    # validation_result = {"all_passed": all_passed, "checks":[
    #     c.model_dump() for c in validation_checks
    # ]} #! .model_dump() does not work on SQLAlchemy models

    invoice = await invoice_service.create_invoice(db, invoice_data, validation_result, current_user.id, status_value, audit_report, pdf_str)

    ai_processed, ai_error = await index_invoice(invoice, current_user.id)

    
    try:
        await db.execute(
                update(Invoice).where(Invoice.id == invoice.id).values({"ai_processed": ai_processed, "ai_message": ai_error})
            )

        await db.commit()
    except Exception as err:
        await db.rollback()
    

        # Generate the embeddings

    message = "Invoice processed successfully. " if all_passed else "Invoice flagged for review. "

    message = message + "AI processing is successfully done" if ai_processed else message + "There was an error in AI processing"
    
    validation_result.update({"audit_report": audit_report})
    
    return InvoiceUploadResponse(status=status_value, invoice=InvoiceResponse.model_validate(invoice),
                                validation=validation_result, message=message)
    
    
    
    
    

@router.get("/list", response_model=InvoiceListResponse)
@limiter.limit("100/minute")
async def list_invoices(request: Request, status: str = "all", search: str = "", page: int = 1, per_page: int = 20, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        return await invoice_service.list_invoices(db, current_user, status, search, page=page, per_page=per_page)
    except Exception as err:
        logger.error(f"Error in invoice.py. Error is {str(err)}")
        raise HTTPException(status_code=500, detail="Error in server")

@router.get("/flagged/list", response_model=list[FlaggedInvoiceItem])
@limiter.limit("100/minute")
async def get_flagged_invoices(request: Request, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await invoice_service.get_flagged_invoices(db, current_user)

@router.get("/{invoice_number}", response_model=InvoiceResponse)
@limiter.limit("100/minute")
async def get_invoice(request: Request, invoice_number: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    invoice = await invoice_service.get_invoice_by_number(db, current_user, invoice_number)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return InvoiceResponse.model_validate(invoice)


@router.post("/{invoice_id}/ai-reprocess")
@limiter.limit("3/minute")
async def reprocess(request: Request, invoice_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):

    try:

        res = (await db.execute(
            select(Invoice)
            .where(Invoice.id == invoice_id)
            .options(selectinload(Invoice.line_items))  # eagerly load to avoid lazy-load crash in async
        )).scalar_one_or_none()

        if not res:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="The invoice doesn\'t exist.")

        if res.pdf_data is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invoice exists but the original PDF was not saved. Please re-upload."
            )

        if res.uploaded_by != current_user.id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="You are not authorized to change the invoices state.")

        ai_processed, ai_message = await index_invoice(res, current_user.id)

        #! update the id with new ai_processed and ai_msg

        result = (await db.execute(
            update(Invoice).where(Invoice.id == invoice_id).values({"ai_processed": ai_processed, "ai_message": ai_message})
        ))

        await db.commit()

        # result.ai_processed = ai_processed
        # result.ai_message = ai_message

        return {
            "status": "success" if ai_processed else "failed",
            "ai_processed": ai_processed,
            "ai_message": ai_message
        }


    except HTTPException:
        await db.rollback()
        raise
    except Exception as err:
        await db.rollback()
        logger.error(f"Error at routers.invoice.reprocess. The error is {err}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error.")


