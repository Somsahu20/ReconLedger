from pydantic import BaseModel, ConfigDict
from uuid import UUID
from decimal import Decimal
from typing import List

class ValidationCheckBase(BaseModel):
    check_name: str
    expected_value: Decimal
    actual_value: Decimal
    passed: bool
    discrepancy: Decimal

class ValidationCheckCreate(ValidationCheckBase):
    invoice_id: UUID

class ValidationCheckResponse(ValidationCheckBase):
    id: UUID
    
    model_config = ConfigDict(from_attributes=True)

class ValidationResult(BaseModel):
    all_passed: bool
    checks: List[ValidationCheckBase]
    audit_report: str | None = None
