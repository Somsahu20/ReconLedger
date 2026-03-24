from decimal import Decimal, ROUND_HALF_UP
from typing import List, Tuple
from pydantic import BaseModel
from app.config import settings
import uuid
from models.validations import ValidationCheck
from schemas.invoice import LineItemBase
from datetime import datetime, timezone, date

class InvoiceData(BaseModel):
    invoice_number: str
    vendor_name: str 
    line_items: List[LineItemBase]
    subtotal: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    grand_total: Decimal
    date: date
    due_date: date | None = None
    currency: str


def validate_arithmetic(invoice_data: InvoiceData) -> Tuple[List[ValidationCheck], bool]:
    checks = []
    tolerance = Decimal(str(settings.TOLERANCE))
    all_passed = True

    #todo Validate each line item
    for item in invoice_data.line_items:
        item_index = item.item_index
        quantity = Decimal(str(item.quantity))
        unit_price = Decimal(str(item.unit_price))
        line_total = Decimal(str(item.line_total))
        
        expected = (quantity * unit_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        discrepancy = abs(line_total - expected)
        
        passed = (discrepancy <= tolerance)
        if not passed:
            all_passed = False
        
        checks.append(ValidationCheck(
            id=uuid.uuid4(), invoice_id=None,
            check_name=f"line_item_{item_index}",
            expected_value=expected, actual_value=line_total,
            passed=passed, discrepancy=line_total - expected,
            created_at=datetime.now(timezone.utc)
        ))
    
    #todo Validate subtotal
    expected_subtotal = sum(Decimal(str(i.line_total)) for i in invoice_data.line_items).quantize(Decimal("0.01"))
    actual_subtotal = Decimal(str(invoice_data.subtotal))
    sub_passed = abs(actual_subtotal - expected_subtotal) <= tolerance
    if not sub_passed:
        all_passed = False
    checks.append(ValidationCheck(
        id=uuid.uuid4(), invoice_id=None, check_name="subtotal",
        expected_value=expected_subtotal, actual_value=actual_subtotal,
        passed=sub_passed, discrepancy=actual_subtotal - expected_subtotal,
        created_at=datetime.now(timezone.utc)
    ))
    
    #todo Validate tax
    expected_tax = (expected_subtotal * Decimal(str(invoice_data.tax_rate)) / 100).quantize(Decimal("0.01"))
    actual_tax = Decimal(str(invoice_data.tax_amount))
    tax_passed = abs(actual_tax - expected_tax) <= tolerance
    if not tax_passed:
        all_passed = False
    checks.append(ValidationCheck(
        id=uuid.uuid4(), invoice_id=None, check_name="tax_amount",
        expected_value=expected_tax, actual_value=actual_tax,
        passed=tax_passed, discrepancy=actual_tax - expected_tax,
        created_at=datetime.now(timezone.utc)
    ))
    
    #todo Validate grand total
    expected_total = (expected_subtotal + expected_tax).quantize(Decimal("0.01"))
    actual_total = Decimal(str(invoice_data.grand_total))
    total_passed = abs(actual_total - expected_total) <= tolerance
    if not total_passed:
        all_passed = False
    checks.append(ValidationCheck(
        id=uuid.uuid4(), invoice_id=None, check_name="grand_total",
        expected_value=expected_total, actual_value=actual_total,
        passed=total_passed, discrepancy=actual_total - expected_total,
        created_at=datetime.now(timezone.utc)
    ))
    
    return checks, all_passed