import uuid
import json
from decimal import Decimal
from datetime import datetime
from difflib import SequenceMatcher
from dateutil import parser as date_parser #todo parses date in almost any format
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.invoices import Invoice
from models.reconciliation import ReconciliationSession, ReconciliationItem
from app.services.reconLLM_service import GeminiService
from app.config import settings
from utils.log import logger


TOLERANCE = Decimal(str(settings.AMOUNT_TOLERANCE))
TAX_TOLERANCE = Decimal(str(settings.TAX_TOLERANCE))
DATE_TOLERANCE_DAYS = settings.DATE_TOLERANCE_DAYS


def _safe_parse_date(date_val):

    if not date_val or str(date_val) in ("None", "nan", ""):
        return None
    try:
        return date_parser.parse(str(date_val)).date()
    except (ValueError, TypeError):
        return None


def _vendor_similarity(name1: str, name2: str) -> float:

    a = name1.strip().lower()
    b = name2.strip().lower()
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    return SequenceMatcher(None, a, b).ratio()


def _compare_invoice(
    record: dict,
    invoice: Invoice,
) -> list[str]:
    
    discrepancies = []  #? If it stays empty, it is exactly same

    listing_amt = Decimal(str(record["amount"]))
    system_amt = Decimal(str(invoice.grand_total))
    amt_diff = abs(system_amt - listing_amt)

    if amt_diff > TOLERANCE:
        charged = "overcharged" if system_amt > listing_amt else "undercharged"
        discrepancies.append(
            f"Amount mismatch: listing {listing_amt}, "
            f"invoice {system_amt} "
            f"({amt_diff} {charged})"
        )


    listing_tax = Decimal(str(record.get("tax_amount", 0)))
    system_tax = Decimal(str(invoice.tax_amount or 0))
    tax_diff = abs(system_tax - listing_tax)

    if tax_diff > TAX_TOLERANCE:
        discrepancies.append(
            f"Tax mismatch: listing {listing_tax}, "
            f"invoice {system_tax} (diff {tax_diff})"
        )

    similarity = _vendor_similarity(
        record.get("vendor_name", ""),
        invoice.vendor_name or ""
    )
    if similarity < 0.75:
        discrepancies.append(
            f"Vendor mismatch: listing '{record['vendor_name']}', "
            f"invoice '{invoice.vendor_name}' "
            f"(similarity: {similarity:.0%})"
        )

    listing_date = _safe_parse_date(record.get("date"))
    system_date = invoice.date
    if listing_date and system_date:
        day_diff = abs((system_date - listing_date).days)
        if day_diff > DATE_TOLERANCE_DAYS:
            discrepancies.append(
                f"Date mismatch: listing {listing_date}, "
                f"invoice {system_date} ({day_diff} days apart)"
            )

    return discrepancies


def _determine_status(discrepancies: list[str]) -> str:
    
    if not discrepancies or len(discrepancies) == 0:
        return "MATCHED"

    flags = set()

    for d in discrepancies:
        text = d.lower()
    
        if "amount" in text:
            flags.add("AMOUNT_MISMATCH")
        if "vendor" in text:
            flags.add("VENDOR_MISMATCH")
        if "date" in text:
            flags.add("DATE_MISMATCH")
        if "tax" in text:
            flags.add("TAX_MISMATCH")
        
    if not flags:
        return "UNMATCHED"

    priority = ["AMOUNT_MISMATCH", "VENDOR_MISMATCH", "DATE_MISMATCH", "TAX_MISMATCH"]

    for status in priority:
        if status in flags:
            return status

    return "UNMATCHED"


async def parse_listing(file_bytes: bytes, filename: str) -> list[dict]:
    """Wrapper that delegates to listing_parser module."""
    from app.services.listing_parser import parse_listing_file
    return parse_listing_file(file_bytes, filename)


async def run_reconciliation(
    db: AsyncSession,
    session_id: uuid.UUID,
    listing_records: list[dict], #! Origin?
    use_ai: bool = True,
) -> dict:
    """
    Match each listing record against actual invoices in database.
    
    Phase 1: Exact match by invoice number
    Phase 2: Normalized match (strip prefixes, spaces)
    Phase 3: AI fuzzy match (Gemini) for remaining unmatched
    Phase 4: AI summary generation
    """
    try: 

        result = await db.execute(select(Invoice))
        all_invoices = result.scalars().all()

        
        exact_map = {}          # "INV-001" -> Invoice
        normalized_map = {}     # "INV001" -> Invoice
        for inv in all_invoices:
            exact_map[inv.invoice_number.strip()] = inv
            normalized_key = (
                inv.invoice_number
                .strip()
                .replace("-", "")
                .replace(" ", "")
                .replace("_", "")
                .upper()
            )
            normalized_map[normalized_key] = inv

        results = {
            "total": len(listing_records),
            "matched": 0,
            "mismatched": 0,
            "missing": 0,
            "items": [],
        }

        unmatched_records = []     #! Records that failed Phase 1 & 2
        matched_invoice_ids = set()  #! Tracks which system invoices were used

        #! Phase 1 & 2: Rule-Based Matching

        for record in listing_records:
            inv_number = record["invoice_number"].strip()

            #! Phase 1: Exact match
            invoice = exact_map.get(inv_number)

            #! Phase 2: Normalized match
            if not invoice:
                normalized = (
                    inv_number
                    .replace("-", "")
                    .replace(" ", "")
                    .replace("_", "")
                    .upper()
                )
                invoice = normalized_map.get(normalized)

                #? Also try: does any system invoice CONTAIN this number or vice versa
                if not invoice:
                    for norm_key, inv in normalized_map.items():
                        if normalized in norm_key or norm_key in normalized:
                            invoice = inv
                            break

            if not invoice:
                unmatched_records.append(record)

                item = ReconciliationItem(
                    id=uuid.uuid4(),
                    session_id=session_id,
                    listing_invoice_number=record["invoice_number"],
                    listing_vendor_name=record["vendor_name"],
                    listing_date=_safe_parse_date(record["date"]),
                    listing_amount=Decimal(str(record["amount"])),
                    listing_tax_amount=Decimal(str(record.get("tax_amount", 0))),
                    matched_invoice_id=None,
                    status="MISSING",
                    discrepancies="Invoice not found in system",
                )
                db.add(item)
                results["missing"] += 1
                results["items"].append({
                    "invoice_number": record["invoice_number"],
                    "status": "MISSING",
                    "discrepancies": ["Invoice not found in system"],
                })
                continue

            #! Invoice found
            matched_invoice_ids.add(invoice.id)
            discrepancies = _compare_invoice(record, invoice)
            status = _determine_status(discrepancies)

            item = ReconciliationItem(
                id=uuid.uuid4(),
                session_id=session_id,
                listing_invoice_number=record["invoice_number"],
                listing_vendor_name=record["vendor_name"],
                listing_date=_safe_parse_date(record["date"]),
                listing_amount=Decimal(str(record["amount"])),
                listing_tax_amount=Decimal(str(record.get("tax_amount", 0))),
                matched_invoice_id=invoice.id,
                status=status,
                discrepancies=json.dumps(discrepancies) if discrepancies else None,
            )
            db.add(item)

            if status == "MATCHED":
                results["matched"] += 1
            else:
                results["mismatched"] += 1 #! Keep an eye, a bug may be present here 

            results["items"].append({
                "invoice_number": record["invoice_number"],
                "status": status,
                "matched_to": invoice.invoice_number,
                "discrepancies": discrepancies,
            })

    

        #! Phase 3

        if use_ai and unmatched_records:
            ai_results = await _run_ai_matching(
                db, session_id, unmatched_records,
                all_invoices, matched_invoice_ids, results
            )
            results = ai_results ####################

        #! Phase 4

        if use_ai:
            ai_summary = await _generate_summary(db, session_id, listing_records, results)
            results["ai_summary"] = ai_summary

        await db.commit()
        return results
    
    except Exception as err:
        await db.rollback()
        logger.error(f"Error in reconciliation.run_recon. The error is {err}")
        return {
            "result": "There is an error."
        }


async def _run_ai_matching(
    db: AsyncSession,
    session_id: uuid.UUID,
    unmatched_records: list[dict],
    all_invoices: list[Invoice],
    matched_invoice_ids: set,
    results: dict,
) -> dict:
    

    gemini = GeminiService()

    # Candidate invoices = those not already matched
    candidates = [
        inv for inv in all_invoices
        if inv.id not in matched_invoice_ids
    ]

    if not candidates:
        return results

    system_records = [
        {
            "invoice_number": inv.invoice_number,
            "vendor_name": inv.vendor_name or "",
            "date": str(inv.date) if inv.date else "",
            "amount": float(inv.grand_total or 0),
            "tax_amount": float(inv.tax_amount or 0),
        }
        for inv in candidates
    ]

    try:
        ai_result = await gemini.fuzzy_match_invoices(
            unmatched_records, system_records
        )
    except Exception as e:
        logger.error(f"AI matching failed: {e}")
        return results

    for match in ai_result.get("matches", []):
        l_idx = match.get("listing_index")
        s_idx = match.get("system_index")
        confidence = match.get("confidence", 0)

        if (
            l_idx is None
            or s_idx is None
            or confidence < settings.AI_CONFIDENCE_THRESHOLD
            or l_idx >= len(unmatched_records)
            or s_idx >= len(candidates)
        ):
            continue

        record = unmatched_records[l_idx]
        invoice = candidates[s_idx]

        # Update the existing "missing" item in DB
        query = await db.execute(
            select(ReconciliationItem).where(
                ReconciliationItem.session_id == session_id,
                ReconciliationItem.listing_invoice_number == record["invoice_number"],
                ReconciliationItem.status == "MISSING",
            )
        )
        item = query.scalar_one_or_none()
        if not item:
            continue

    
        discrepancies = _compare_invoice(record, invoice)
        ai_note = (
            f"AI-matched with {confidence:.0%} confidence. "
            f"Reason: {match.get('reasoning', 'N/A')}. "
            f"Please verify manually."
        )

        if discrepancies:
            discrepancies.append(ai_note)
            status = "AI_MATCHED_WITH_DISCREPANCIES"
        else:
            discrepancies = [ai_note]
            status = "AI_MATCH"

        item.matched_invoice_id = invoice.id
        item.status = status
        item.discrepancies = json.dumps(discrepancies)

        # Update counts
        results["missing"] -= 1
        if status == "MATCHED":
            results["matched"] += 1
        else:
            results["mismatched"] += 1

        # Update the item in results list
        for r_item in results["items"]:
            if r_item["invoice_number"] == record["invoice_number"]:
                r_item["status"] = status
                r_item["matched_to"] = invoice.invoice_number
                r_item["discrepancies"] = discrepancies
                r_item["ai_confidence"] = confidence
                break

    return results


async def _generate_summary(
    db: AsyncSession,
    session_id: uuid.UUID,
    listing_records: list[dict],
    results: dict,
) -> dict:

    gemini = GeminiService()

    total_listing = sum(float(r["amount"]) for r in listing_records)

    # Get matched system amounts
    db_result = await db.execute(
        select(ReconciliationItem).where(
            ReconciliationItem.session_id == session_id,
            ReconciliationItem.matched_invoice_id.isnot(None),
        )
    )
    matched_items = db_result.scalars().all()
    total_system = sum(
        float(item.listing_amount) for item in matched_items
    )

    # Format top discrepancies
    problem_items = [
        i for i in results["items"]
        if i["status"] != "MATCHED"
    ]



    top_disc_text = "\n".join([
        f"  {item['invoice_number']} | {item['status']} | "
        f"{'; '.join(item.get('discrepancies', []))}"
        for item in problem_items
    ]) or "None"

    report_data = {
        "session_name": "Reconciliation",
        "total": results["total"],
        "matched": results["matched"],
        "mismatched": results["mismatched"],
        "missing": results["missing"],
        "total_listing_amount": total_listing,
        "total_system_amount": total_system,
        "net_difference": total_listing - total_system,
        "top_discrepancies": top_disc_text,
    }

    try:
        summary = await gemini.generate_reconciliation_summary(report_data)
        return summary
    except Exception as e:
        return {
            "executive_summary": f"AI summary generation failed: {str(e)}",
            "risk_level": "Unknown",
            "recommendations": [],
        }