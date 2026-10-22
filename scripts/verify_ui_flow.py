"""Independently re-verify every UI signed transaction through the explorer JSON API.

The Playwright driver records each transaction the real frontend sends from a burner
wallet into evidence/ui_flow_verification.json. This script is the second look a
reviewer would take: it reads every one of those hashes back from the studionet
explorer and checks it reached FINALIZED, hit the deployed contract, and returned the
expected leader result. Guard probes are expected to finish with an error. It writes
evidence/ui_flow_verification_report.json and exits non zero if any row fails, so the
claim "driven from the browser" is only ever backed by a chain check.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from verify_explorer import EXPLORER, check  # noqa: E402

EVIDENCE = ROOT / "evidence" / "ui_flow_verification.json"
OUTPUT = ROOT / "evidence" / "ui_flow_verification_report.json"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quiet", action="store_true", help="only print the summary")
    args = parser.parse_args()

    if not EVIDENCE.exists():
        print("evidence/ui_flow_verification.json is missing, run the browser driver first", file=sys.stderr)
        return 2

    data = json.loads(EVIDENCE.read_text(encoding="utf-8"))
    contract_address = data["contract_address"]
    rows: list[dict[str, Any]] = []

    for record in data["transactions"]:
        if not record.get("tx"):
            continue
        expect = record.get("expected_band", "") if record.get("expected") == "SUCCESS" else ""
        rows.append(check(record, contract_address, expect))

    passed = sum(1 for row in rows if row["ok"])
    report = {
        "explorer": EXPLORER,
        "contract": contract_address,
        "base_url": data.get("base_url", ""),
        "checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total": len(rows),
        "passed": passed,
        "failed": len(rows) - passed,
        "rows": rows,
    }
    OUTPUT.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    if not args.quiet:
        for row in rows:
            flag = "PASS" if row["ok"] else "FAIL"
            failed = [name for name, value in row["checks"].items() if not value]
            print(
                f"{flag}  {row['step']:32s} {row['status']:9s} {row['execution']:18s}"
                f" {row['agree']} agree / {row['disagree']} disagree"
                + (f"  [{','.join(failed)}]" if failed else "")
            )
    print(f"ui flow verification: {passed}/{len(rows)} rows PASS -> {OUTPUT.relative_to(ROOT)}")
    return 0 if passed == len(rows) and len(rows) > 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
