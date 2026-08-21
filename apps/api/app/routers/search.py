from fastapi import APIRouter, Query

from app.services.symbols import search_symbols

router = APIRouter()


@router.get("/search")
def search(q: str = Query("", min_length=0), limit: int = Query(25, ge=1, le=50)):
    return {"query": q, "results": search_symbols(q, limit=limit)}
