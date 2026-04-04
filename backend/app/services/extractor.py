from pydantic import BaseModel, field_validator, ValidationError
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage   
from langchain_core.output_parsers import JsonOutputParser
from datetime import date as DateType
from decimal import Decimal
from app.config import settings
from utils.log import logger
from typing import List


class InvoiceExtractionError(Exception):
    def __init__(self, message: str, issues: list[str] | None = None):
        super().__init__(message)
        self.message = message
        self.issues = issues or []


def _format_validation_issues(err: ValidationError) -> list[str]:
    issues: list[str] = []
    for issue in err.errors():
        location = ".".join(str(part) for part in issue.get("loc", []))
        message = issue.get("msg", "Invalid value")
        if location:
            issues.append(f"{location}: {message}")
        else:
            issues.append(str(message))
    return issues

class ExtractedLineItem(BaseModel):
    item_index: int
    description: str
    quantity: Decimal
    unit_price: Decimal
    line_total: Decimal 

    
    @field_validator("quantity", "unit_price", "line_total", mode="before")
    @classmethod
    def convert_to_decimal(cls, v):
        if isinstance(v, float):
            return Decimal(str(v))   
        if isinstance(v, int):
            return Decimal(str(v))   
        if isinstance(v, str):
            return Decimal(v)         
        return v

#? We need to convert the float to decimal because JSON converts decimal to float 

class ExtractedInvoice(BaseModel):
    invoice_number: str
    vendor_name: str
    date: DateType #! yyyy-mm-dd
    due_date: DateType | None = None #! YYYY-MM-DD format
    currency: str = "INR"
    line_items: list[ExtractedLineItem]
    subtotal: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    grand_total: Decimal

    @field_validator("subtotal", "tax_rate", "tax_amount", "grand_total", mode="before")
    @classmethod
    def convert_to_decimal(cls, v):
        if isinstance(v, float):
            return Decimal(str(v))
        if isinstance(v, int):
            return Decimal(str(v))
        if isinstance(v, str):
            return Decimal(v)
        return v

EXTRACTION_PROMPT = """
You are an expert financial data extraction specialist with deep knowledge 
of invoice formats across industries. Your task is to extract structured 
data from this invoice image with maximum accuracy.

## CRITICAL REQUIREMENT
Return ONLY valid JSON. No explanation, no markdown, no code blocks.
Just the raw JSON object starting with { and ending with }

## OUTPUT STRUCTURE
{
    "invoice_number": "INV-2025-0042",
    "vendor_name": "Exact vendor name as printed",
    "vendor_address": "Full vendor address if visible",
    "bill_to": "Company or person being billed",
    "date": "2025-06-15",
    "due_date": "2025-07-15",
    "currency": "INR",
    "line_items": [
        {
            "item_index": 1,
            "description": "Exact description as printed",
            "quantity": 100,
            "unit_price": 10.50,
            "line_total": 1050.00,
            "computed_line_total": 1050.00
        }
    ],
    "subtotal": 1050.00,
    "tax_details": [
        {
            "tax_name": "GST",
            "tax_rate": 18.0,
            "tax_amount": 189.00
        }
    ],
    "tax_rate": 18.0,
    "tax_amount": 189.00,
    "discount": 0.00,
    "grand_total": 1239.00,
    "computed_grand_total": 1239.00,
    "extraction_confidence": "high",
    "extraction_notes": "Any ambiguities or issues noticed"
}

## FIELD BY FIELD EXTRACTION RULES

### invoice_number
- Look for labels: "Invoice No", "Invoice #", "Bill No", "Ref No", "Document No"
- Include the full number exactly as printed including prefixes (INV-, BILL-)
- If multiple reference numbers exist, pick the primary invoice number
- If genuinely not found → null

### vendor_name
- This is the SELLER — the company issuing the invoice
- Look at the TOP of the invoice — usually the largest text or logo area
- Do NOT confuse with "Bill To" or "Ship To" (that is the buyer)
- Extract the legal company name, not just a logo or tagline
- Example: "Acme Technologies Private Limited" not just "Acme"

### date
- Look for labels: "Invoice Date", "Date", "Issued On", "Bill Date"
- Convert ALL date formats to YYYY-MM-DD
  Examples:
  "15 Jan 2025"     → "2025-01-15"
  "15/01/2025"      → "2025-01-15"
  "Jan 15, 2025"    → "2025-01-15"
  "15-01-25"        → "2025-01-15"
- If year appears as 2 digits, assume 20XX

### due_date
- Look for: "Due Date", "Payment Due", "Pay By", "Valid Until"
- Apply same date conversion rules as above
- If not found → null

### currency
- Look for currency symbols: ₹ = INR, $ = USD, € = EUR, £ = GBP
- Look for explicit currency labels: "Amount in INR", "USD"
- Default to INR if invoice appears to be Indian (has GST, GSTIN, Indian address)
- Default to USD only if clearly an international invoice

### line_items — MOST CRITICAL SECTION
Each line item MUST have:

- item_index: Sequential number starting from 1
- description: Exact text as printed — do not summarize or shorten
- quantity: 
    * Must be a NUMBER not a string
    * Look for: "Qty", "Quantity", "Units", "Nos", "Pcs"
    * If quantity is implied as 1 (services), use 1
    * Watch for decimal quantities: 2.5 hours, 1.5 kg
- unit_price:
    * Must be a NUMBER not a string
    * Look for: "Rate", "Unit Price", "Price", "MRP", "Per Unit"
    * Remove currency symbols before storing
    * Watch for: commas in numbers "1,000.00" → 1000.00
- line_total:
    * Extract EXACTLY as printed on invoice
    * Do NOT recalculate — extract the printed value
- computed_line_total:
    * YOU calculate: quantity × unit_price
    * This helps detect discrepancies
    * Round to 2 decimal places

### subtotal
- Look for: "Subtotal", "Sub Total", "Amount Before Tax", 
  "Taxable Amount", "Net Amount"
- Extract EXACTLY as printed
- Do NOT recalculate

### tax_details
- Indian invoices may have multiple tax components:
  CGST (Central GST) + SGST (State GST) = combined GST
  IGST (Integrated GST) for interstate
  Example: CGST 9% + SGST 9% = effective 18% GST
- Extract each tax line separately in tax_details array
- For tax_rate (top level): use the TOTAL effective tax rate
- For tax_amount (top level): use the TOTAL tax amount

### grand_total
- Look for: "Grand Total", "Total Amount", "Amount Due", 
  "Net Payable", "Total Payable", "Invoice Total"
- Usually the LARGEST and MOST prominently displayed number
- Extract EXACTLY as printed
- computed_grand_total: YOU calculate subtotal + tax_amount - discount

### discount
- Look for: "Discount", "Less:", "Rebate", "Special Discount"
- If no discount → 0.00 (not null)

### extraction_confidence
Use one of these three values only:
- "high"   → Image is clear, all fields found, numbers are readable
- "medium" → Some fields unclear or partially visible
- "low"    → Image is blurry, rotated, or heavily obscured

### extraction_notes
- Note any ambiguities you encountered
- Flag if CGST + SGST were combined into tax_rate
- Flag if any values were difficult to read
- Flag if invoice appears to be a duplicate or draft
- Use null if no issues

## COMMON MISTAKES TO AVOID

### Number formatting mistakes:
WRONG: "quantity": "100"        → RIGHT: "quantity": 100
WRONG: "unit_price": "₹10.50"  → RIGHT: "unit_price": 10.50
WRONG: "grand_total": "1,239"  → RIGHT: "grand_total": 1239.00
WRONG: "tax_rate": "18%"       → RIGHT: "tax_rate": 18.0

### Vendor vs Buyer confusion:
The vendor is WHO SENT the invoice (top of page, issuer)
The buyer is WHO RECEIVES the invoice (Bill To section)
Never swap these two.

### Date mistakes:
WRONG: "date": "15/01/2025"    → RIGHT: "date": "2025-01-15"
WRONG: "date": "Jan 15 2025"   → RIGHT: "date": "2025-01-15"

### Tax mistakes (India specific):
If you see CGST 9% and SGST 9%:
WRONG: "tax_rate": 9.0
RIGHT: "tax_rate": 18.0  (combined)
RIGHT: "tax_amount": combined amount of both

### Missing line items:
- Extract ALL line items — do not skip any
- Even if description is very long, extract it fully
- Even single item invoices must have the line_items array

## HANDLING DIFFICULT INVOICES

### Blurry or low resolution image:
- Extract what you can confidently read
- Set extraction_confidence to "low" or "medium"
- Use extraction_notes to flag specific unreadable fields
- Never guess a number you cannot clearly read → use null

### Handwritten invoices:
- Extract carefully, handwritten numbers are ambiguous
- 1 and 7 are often confused — use context (line total) to verify
- Set extraction_confidence to "medium" at best

### Multi page invoices:
- Focus on page 1 for header info (vendor, date, invoice number)
- Extract all line items across all pages
- Grand total is usually on the last page

### Invoices with crossed out or corrected values:
- Extract the FINAL value (the correction, not the crossed out value)
- Note this in extraction_notes

### Foreign currency invoices:
- Extract exactly as shown
- Do not convert currencies

## SELF VERIFICATION STEP
Before returning JSON, mentally verify:
1. Is grand_total close to subtotal + tax_amount - discount?
2. Does each line_total roughly equal quantity × unit_price?
3. Does sum of all line_totals roughly equal subtotal?
4. Are all monetary values numbers not strings?
5. Are all dates in YYYY-MM-DD format?

If verification fails, re-examine the invoice image before responding.
These checks do NOT mean you should alter extracted values —
they help you catch misreads. Always extract what is PRINTED,
computed fields show what SHOULD be there.

## FINAL REMINDER
Your job is to be a precise data extractor, not an calculator.
Extract what is PRINTED. Compute fields show expected values.
Discrepancies between extracted and computed values are INTENTIONAL —
they are how the system detects fraud and billing errors.
"""

MODEL = "gemini-3-flash-preview"

async def extract_invoice_data(image_base64: List[str]) -> ExtractedInvoice:
    """
    Use Gemini Vision to extract structured invoice data.
    With rate limiting to prevent API exhaustion.
    """
    
    async def _call_gemini():

        try:
            llm = ChatGoogleGenerativeAI(
                model=MODEL,
                google_api_key=settings.PDF_READER,
                temperature=0.0,
            )

            content = [{"type": "text", "text": EXTRACTION_PROMPT}]

            for img in image_base64:
                content.append(
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{img}"}
                    }
                )

            messages = [
                HumanMessage(content=content)
            ]

            parser = JsonOutputParser()

            chain = llm | parser
            result = await chain.ainvoke(messages)

            # logger.info(f"The model is {MODEL}")
            # logger.info(f"Raw Gemini extraction result: {result}")
            
            try:
                return ExtractedInvoice(**result)
            except ValidationError as err:
                issues = _format_validation_issues(err)
                logger.warning(f"Invoice extraction validation failed: {issues}")
                raise InvoiceExtractionError(
                    "Invoice is missing required fields or contains invalid values.",
                    issues,
                ) from err
        except InvoiceExtractionError:
            raise
        except Exception as err:
            logger.error(f"Error in extracting invoice data: {err}")
            raise InvoiceExtractionError(
                "Unable to extract invoice data from the PDF. Please upload a clearer invoice."
            ) from err
    
    # Execute with rate limiting and retry
    result = await _call_gemini()

    return result
