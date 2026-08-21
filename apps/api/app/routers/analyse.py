from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.analyse import analyse_stock

router = APIRouter()


class AnalyseRequest(BaseModel):
    exchange: str
    symbol: str
    horizonDays: int = Field(default=14, ge=3, le=30)


@router.post("/analyse")
def analyse(body: AnalyseRequest):
    ex = body.exchange.upper()
    if ex not in {"NSE", "BSE"}:
        return {"error": "exchange must be NSE or BSE"}
    return analyse_stock(ex, body.symbol.upper(), horizon_days=body.horizonDays)
