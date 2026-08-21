"""Refresh NSE equity universe into data/symbols.json."""

from __future__ import annotations

import csv
import io
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "symbols.json"


def main() -> None:
    existing = json.loads(DATA.read_text(encoding="utf-8")) if DATA.exists() else {"symbols": []}
    by_key = {(s["exchange"], s["symbol"]): s for s in existing.get("symbols", [])}
    liquid_nse = {
        s["symbol"] for s in existing.get("symbols", []) if s["exchange"] == "NSE" and s.get("liquid")
    }

    url = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        text = resp.read().decode("utf-8", errors="replace")

    reader = csv.DictReader(io.StringIO(text))
    added = 0
    for row in reader:
        fields = {k.strip(): (v or "").strip() for k, v in row.items() if k}
        sym = fields.get("SYMBOL", "")
        name = fields.get("NAME OF COMPANY", "")
        if not sym or not name:
            vals = list(fields.values())
            if len(vals) >= 2:
                sym, name = vals[0], vals[1]
            else:
                continue
        key = ("NSE", sym)
        if key not in by_key:
            by_key[key] = {
                "symbol": sym,
                "name": name,
                "exchange": "NSE",
                "liquid": sym in liquid_nse,
            }
            added += 1
        else:
            by_key[key]["name"] = name
            by_key[key]["liquid"] = bool(by_key[key].get("liquid") or sym in liquid_nse)

    for (ex, _sym), item in list(by_key.items()):
        if ex == "NSE" and item.get("liquid"):
            bkey = ("BSE", item["symbol"])
            if bkey not in by_key:
                by_key[bkey] = {
                    "symbol": item["symbol"],
                    "name": item["name"],
                    "exchange": "BSE",
                    "liquid": True,
                }

    symbols = sorted(by_key.values(), key=lambda x: (x["exchange"], x["symbol"]))
    DATA.write_text(json.dumps({"symbols": symbols, "count": len(symbols)}, indent=2), encoding="utf-8")
    print(f"Wrote {len(symbols)} symbols ({added} new NSE). Liquid={sum(1 for s in symbols if s.get('liquid'))}")


if __name__ == "__main__":
    main()
