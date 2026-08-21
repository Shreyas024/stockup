"""Symbol master loading and search helpers."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

def _resolve_symbols_path() -> Path:
    here = Path(__file__).resolve()
    candidates = [
        here.parents[4] / "data" / "symbols.json",  # monorepo: repo/data
        here.parents[2] / "data" / "symbols.json",  # deploy: apps/api/data
    ]
    for path in candidates:
        if path.exists():
            return path
    return candidates[0]


SYMBOLS_PATH = _resolve_symbols_path()


@lru_cache(maxsize=1)
def load_symbols() -> list[dict[str, Any]]:
    path = _resolve_symbols_path()
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    return data.get("symbols", [])


def yahoo_ticker(exchange: str, symbol: str) -> str:
    suffix = ".NS" if exchange.upper() == "NSE" else ".BO"
    return f"{symbol.upper()}{suffix}"


def find_symbol(exchange: str, symbol: str) -> dict[str, Any] | None:
    ex = exchange.upper()
    sym = symbol.upper()
    for item in load_symbols():
        if item["exchange"] == ex and item["symbol"] == sym:
            return item
    return None


def search_symbols(query: str, limit: int = 25) -> list[dict[str, Any]]:
    q = query.strip().lower()
    if not q:
        return []

    scored: list[tuple[int, dict[str, Any]]] = []
    for item in load_symbols():
        symbol = str(item["symbol"]).lower()
        name = str(item["name"]).lower()
        if q == symbol:
            rank = 0
        elif symbol.startswith(q):
            rank = 1
        elif name.startswith(q):
            rank = 2
        elif q in symbol:
            rank = 3
        elif q in name:
            rank = 4
        else:
            continue
        # Prefer NSE slightly when ranks tie
        tie = 0 if item.get("exchange") == "NSE" else 1
        scored.append((rank * 10 + tie, item))

    scored.sort(key=lambda x: (x[0], x[1]["symbol"]))
    return [item for _, item in scored[:limit]]


def liquid_universe() -> list[dict[str, Any]]:
    """Prefer symbols flagged as liquid/index constituents for trending."""
    symbols = load_symbols()
    liquid = [s for s in symbols if s.get("liquid")]
    return liquid if liquid else symbols[:80]
