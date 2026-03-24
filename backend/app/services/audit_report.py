from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from app.config import settings
from decimal import Decimal
from typing import List
from app.services.extractor import MODEL

AUDIT_REPORT_PROMPT = """You are an expert financial auditor. Based on the validation failures below, 
generate a clear, concise audit report explaining what is wrong with this invoice.

Invoice Details:
- Vendor: {vendor_name}
- Invoice Number: {invoice_number}
- Grand Total: {grand_total} {currency}

Validation Failures:
{failures}

Generate a human-readable audit report that:
1. Identifies each discrepancy clearly
2. Explains the financial impact (overcharge/undercharge amount)
3. Provides a recommendation for action

Format the report in plain English. Use bold for key numbers.
"""

async def generate_audit_report(
    vendor_name: str,
    invoice_number: str,
    grand_total: Decimal,
    currency: str,
    failed_checks: List[dict]
) -> str:
    """
    Generate a human-readable audit report for flagged invoices.
    """
    # Format failures
    failures_text = []
    total_impact = Decimal("0")
    
    for check in failed_checks:
        if not check["passed"]:
            discrepancy = Decimal(str(check["discrepancy"]))
            total_impact += discrepancy
            failures_text.append(
                f"- {check['check_name']}: Expected {Decimal(check['expected_value'])}, "
                f"found {Decimal(check['actual_value'])}, difference {discrepancy}"
            )
    
    failures_str = "\n".join(failures_text)
    
    llm = ChatGoogleGenerativeAI(
        model=MODEL,
        google_api_key=settings.AUDIT_PDF,
        temperature=0.3,
    )
    

    prompt = PromptTemplate(
        template=AUDIT_REPORT_PROMPT,
        input_variables=["vendor_name", "invoice_number", "grand_total", "currency", "failures"]
    )

    chain = prompt | llm


    response = await chain.ainvoke({
        "vendor_name": vendor_name,
        "invoice_number": invoice_number,
        "grand_total": grand_total,
        "currency": currency,
        "failures": failures_str 
    })
    
    # Add financial impact summary
    impact_direction = "overcharge" if total_impact > 0 else "undercharge"
    final_report = response.content if isinstance(response.content, str) else next(
        (block["text"] for block in response.content if block["type"] == "text"), ""
    )
    final_report += f"\n\n**Total Financial Impact:** {abs(total_impact):.2f} {currency} {impact_direction}."
    
    return final_report
