"""StockUp FastAPI — market data + analysis for NSE/BSE."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import analyse, market, search

app = FastAPI(
    title="StockUp API",
    description="NSE/BSE market data and historical trend analysis",
    version="1.0.0",
)

_local_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "https://stockup.vercel.app",
]
_extra = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[*_local_origins, *_extra],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search.router, prefix="/api", tags=["search"])
app.include_router(market.router, prefix="/api", tags=["market"])
app.include_router(analyse.router, prefix="/api", tags=["analyse"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
