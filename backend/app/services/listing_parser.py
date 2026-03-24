# app/services/listing_parser.py
import pandas as pd
import re
from io import BytesIO
from datetime import datetime
from typing import Optional

COLUMN_ALIASES = {
    "invoice_number": [
        "invoice#", "invoice_no", "inv_no", "inv#",
        "bill_no", "bill_number", "document_number",
        "doc_no", "voucher_no", "invoice_num"
    ],
    "vendor_name": [
        "vendor", "supplier", "supplier_name", "party_name",
        "party", "payee", "company", "from"
    ],
    "date": [
        "invoice_date", "bill_date", "transaction_date",
        "doc_date", "posting_date", "entry_date", "txn_date"
    ],
    "amount": [
        "grand_total", "total", "total_amount", "net_amount",
        "invoice_amount", "bill_amount", "value", "base_amount"
    ],
    "tax_amount": [
        "tax", "gst", "gst_amount", "igst", "cgst_sgst",
        "tax_value", "vat", "total_tax"
    ],
}


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")

    mapped = {}
    for standard_name, aliases in COLUMN_ALIASES.items():
        if standard_name in df.columns:
            continue
        for alias in aliases:
            if alias in df.columns:
                mapped[alias] = standard_name
                break

    if mapped:
        df = df.rename(columns=mapped)
    return df


def _clean_numeric(value) -> str:
    """
    Strip currency symbols, currency codes, commas, whitespace
    from a value so it can be parsed as a number.
    e.g. '$ 12,595.83' -> '12595.83', '14491 Rs' -> '14491', '18%' -> '18'
    """
    if pd.isna(value):
        return ""
    s = str(value).strip()
    # Remove common currency symbols
    s = re.sub(r'[\$£€¥₹₦]', '', s)
    # Remove common currency codes (e.g. USD, INR, AUD, Rs, Rs.)
    s = re.sub(r'\b(USD|EUR|GBP|INR|AUD|CAD|JPY|CNY|Rs\.?|AED|SGD|NZD|ZAR|BRL|MXN|CHF|SEK|NOK|DKK|HKD|KRW|TWD|MYR|THB|PHP|IDR|VND|KES|NGN|EGP|PKR|BDT|LKR|NPR)\b', '', s, flags=re.IGNORECASE)
    # Remove commas (thousands separators)
    s = s.replace(',', '')
    # Remove percent sign (handled separately by caller)
    s = s.replace('%', '')
    # Strip remaining whitespace
    s = s.strip()
    return s


def _parse_date_value(date_val) -> Optional[str]:
    if pd.isna(date_val):
        return None

    date_str = str(date_val).strip()
    formats = [
        "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y",
        "%d-%b-%Y", "%d-%b-%y", "%Y-%m-%d %H:%M:%S",
        "%d.%m.%Y", "%d %b %Y", "%d %B %Y",
        "%dth %b %Y", "%dst %b %Y", "%dnd %b %Y", "%drd %b %Y",
        "%dth %B %Y", "%dst %B %Y", "%dnd %B %Y", "%drd %B %Y",
        "%b %d, %Y", "%B %d, %Y",
    ]

    # Remove ordinal suffixes like "12th" -> "12"
    cleaned_date = re.sub(r'(\d+)(st|nd|rd|th)\b', r'\1', date_str, flags=re.IGNORECASE)

    for fmt in formats:
        try:
            return datetime.strptime(cleaned_date, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue

    try:
        return pd.to_datetime(date_str).strftime("%Y-%m-%d")
    except Exception:
        return date_str


def parse_listing_file(file_bytes: bytes, filename: str) -> list[dict]:
    """
    Parse auditor's Excel/CSV into standardized records.
    
    Returns:
        list of dicts with keys:
        invoice_number, vendor_name, date, amount, tax_amount
    """
    if filename.endswith(".csv"):
        df = pd.read_csv(BytesIO(file_bytes))
    elif filename.endswith((".xlsx", ".xls")):
        df = pd.read_excel(BytesIO(file_bytes))
    else:
        raise ValueError(f"Unsupported file format: {filename}")

    df = df.dropna(how="all")
    df = _normalize_columns(df)

    # Validate required columns
    required = ["invoice_number", "vendor_name", "amount"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        available = ", ".join(df.columns.tolist())
        raise ValueError(
            f"Missing required columns: {missing}. "
            f"Available columns: {available}"
        )

    records = []
    errors = []

    #! We take idx + 2 because pandas start from row 1 and python starts from 0 and also the 

    for idx, row in df.iterrows():
        try:
            # Clean and parse amount
            raw_amount = row.get("amount")
            cleaned_amount = _clean_numeric(raw_amount)
            amount = pd.to_numeric(cleaned_amount, errors="coerce")
            if pd.isna(amount):
                errors.append(f"Row {idx + 2}: Invalid amount '{raw_amount}'")
                continue

            # Clean and parse tax
            raw_tax = row.get("tax_amount", 0)
            raw_tax_str = str(raw_tax).strip() if not pd.isna(raw_tax) else "0"
            is_percentage = "%" in raw_tax_str
            cleaned_tax = _clean_numeric(raw_tax)
            tax = pd.to_numeric(cleaned_tax, errors="coerce")
            if pd.isna(tax):
                tax = 0.0
            elif is_percentage:
                # Convert percentage to actual tax amount
                tax = round(float(amount) * float(tax) / 100, 2)

            inv_number = str(row.get("invoice_number", "")).strip()
            if not inv_number or inv_number == "nan" or inv_number == "null":
                errors.append(f"Row {idx + 2}: Empty invoice number")
                continue

            records.append({
                "invoice_number": inv_number,
                "vendor_name": str(row.get("vendor_name", "")).strip(),
                "date": _parse_date_value(row.get("date")),
                "amount": float(amount),
                "tax_amount": float(tax),
            })

        except Exception as e:
            errors.append(f"Row {idx + 2}: {str(e)}")

    if not records:
        raise ValueError(
            f"No valid records found. Errors: {'; '.join(errors[:5])}"
        )

    return records