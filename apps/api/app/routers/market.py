from fastapi import APIRouter, HTTPException, Query

from app.services import market

router = APIRouter()


@router.get("/trending")
def trending(limit: int = Query(12, ge=1, le=30)):
    return market.get_trending(limit=limit)


@router.get("/quote/{exchange}/{symbol}")
def quote(exchange: str, symbol: str):
    if exchange.upper() not in {"NSE", "BSE"}:
        raise HTTPException(status_code=400, detail="exchange must be NSE or BSE")
    return market.get_quote(exchange, symbol)


@router.get("/history/{exchange}/{symbol}")
def history(
    exchange: str,
    symbol: str,
    range: str = Query("1y", alias="range"),
):
    if exchange.upper() not in {"NSE", "BSE"}:
        raise HTTPException(status_code=400, detail="exchange must be NSE or BSE")
    return market.get_history(exchange, symbol, range_key=range)
