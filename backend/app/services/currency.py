import httpx
from app.config import settings
import asyncio
from decimal import Decimal
from datetime import date
from utils.log import logger
import requests

_rate_cache = {}

async def get_xchange_rate(
    from_curr: str,
    to_curr: str,
    txn_date: date
) -> Decimal:

    if not from_curr or not to_curr:
        return Decimal("1.0")

    from_curr = from_curr.strip().upper()
    to_curr = to_curr.strip().upper()

    if from_curr == to_curr:
        return Decimal("1.0")

    cache_key = (from_curr, to_curr, str(txn_date))
    if cache_key in _rate_cache:
        return _rate_cache[cache_key]

    url = f"http://data.fixer.io/api/{txn_date}" 

    params = {
        "access_key": settings.FIXER_API_KEY,
        "base": from_curr,       
        "symbols": to_curr
    }

    try:

        async with httpx.AsyncClient() as client:
            
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            rate = Decimal(str(data["rates"].get(to_curr, 1.0)))
            
            # 3. Save to cache
            _rate_cache[cache_key] = rate
            return rate

    except Exception as e:
        logger.error(f"Failed to fetch exchange rate for {from_curr}->{to_curr} on {txn_date}: {e}")
        return Decimal("1.0")