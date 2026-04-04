from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from app.config import settings
from decimal import Decimal
from typing import List
from app.services.extractor import MODEL

AUDIT_REPORT_PROMPT = """You are a senior financial auditor with 20 years of experience in accounts payable verification and invoice forensics.

## YOUR TASK
Analyze the validation failures for the invoice below and produce a structured, actionable audit report.

---

## INVOICE UNDER REVIEW
| Field            | Value                          |
|------------------|--------------------------------|
| Vendor           | {vendor_name}                  |
| Invoice Number   | {invoice_number}               |
| Grand Total      | {currency} {grand_total}       |
| Line Item Count  | {line_item_count}              |

## VALIDATION FAILURES DETECTED
{failures}

---

## REPORT REQUIREMENTS

Produce the audit report with EXACTLY these sections:

### 1. EXECUTIVE SUMMARY
- One-paragraph overview of findings
- State the overall risk level: **CRITICAL** (total discrepancy > 5% of grand total), **MODERATE** (1-5%), or **LOW** (<1%)
- State the net financial impact as a single number

### 2. DISCREPANCY DETAILS
For EACH validation failure, provide:
- **What was expected** vs **what was found**
- **Root cause category**: one of [Calculation Error | Unit Price Mismatch | Quantity Mismatch | Tax Error | Duplicate Charge | Missing Line Item | Rounding Error | Currency Error]
- **Financial impact**: the exact overcharge (+) or undercharge (-) amount in {currency}
- **Confidence**: High / Medium / Low that this is a genuine error vs. a data entry issue

### 3. FINANCIAL IMPACT SUMMARY
- Total overcharge amount (sum of all positive discrepancies)
- Total undercharge amount (sum of all negative discrepancies)  
- Net impact on payable amount
- Corrected grand total (if all discrepancies are resolved)

### 4. RECOMMENDED ACTIONS
Provide numbered, specific actions. For each action, assign priority (P1/P2/P3) and responsible party suggestion (e.g., AP Team, Vendor, Procurement). Examples:
- P1: Reject and return to vendor for correction
- P2: Request credit note for specific amount
- P3: Flag for monitoring on future invoices

### 5. VERDICT
State ONE of the following:
- **REJECT** — Do not process. Return to vendor with discrepancy details.
- **HOLD** — Escalate for manager review before processing.
- **APPROVE WITH ADJUSTMENT** — Process at corrected amount of {currency} [corrected_total].
- **APPROVE** — Discrepancies are immaterial. Process as submitted.

---

## FORMATTING RULES
- Use **bold** for all monetary amounts and key figures
- Use exact numbers — do not round unless explicitly a rounding error
- Keep language professional but accessible to non-accountants
- Do NOT fabricate discrepancies beyond what is listed in the validation failures
- If a failure description is ambiguous, state your interpretation before analyzing it
- All monetary values must include the currency symbol ({currency})

## TONE
Professional, objective, evidence-based. No hedging language like "it seems" or "possibly." State findings as facts derived from the validation data provided.
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
