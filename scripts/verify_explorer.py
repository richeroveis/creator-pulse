"""Re-verify every recorded transaction through the studionet explorer JSON API.

The deployment script polls the RPC while it drives the scenario. This script is
the second, independent look: it reads each transaction back from the explorer
web API, the same data a reviewer sees in the browser, and checks that the
recorded status, execution result, contract address, validator votes and revert
payload are still true. It writes evidence/explorer_verification.json and
prints a PASS or FAIL table. Nothing in the README may claim "verified on
chain" unless this script reports PASS for every row.
"""

from __future__ import annotations

import argparse
import base64
import binascii
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
EVIDENCE = ROOT / "evidence" / "studionet_deployment.json"
OUTPUT = ROOT / "evidence" / "explorer_verification.json"
EXPLORER = "https://explorer-studio.genlayer.com"
TX_ENDPOINT = f"{EXPLORER}/api/transactions/"
APPEAL_FLAGS = (
    "appealed",
    "appeal_failed",
    "appeal_undetermined",
    "appeal_leader_timeout",
    "appeal_validators_timeout",
)


def fetch_tx(tx_hash: str, attempts: int = 4) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(
                f"{TX_ENDPOINT}{tx_hash}", headers={"User-Agent": "creator-pulse-verify"}
            )
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = json.loads(response.read().decode("utf-8"))
            return payload.get("transaction") or {}
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            last_error = error
            time.sleep(2.0 * (attempt + 1))
    raise RuntimeError(f"explorer lookup failed for {tx_hash}: {last_error}")


def leader_of(tx: dict[str, Any]) -> dict[str, Any]:
    receipt = (tx.get("consensus_data") or {}).get("leader_receipt") or []
    if isinstance(receipt, list):
        return receipt[0] if receipt else {}
    return receipt if isinstance(receipt, dict) else {}


ERROR_EXECUTIONS = {"ERROR", "ROLLBACK", "FINISHED_WITH_ERROR"}


def decode_result(value: str) -> str:
    """Turn the explorer leader result blob into readable text.

    The explorer base64 encodes the msgpack payload the leader returned. For a
    revert the interesting part is the UserError string, so decode then keep the
    printable runs. Success payloads are returned as their printable fields too,
    which is how the settlement band and the amounts are cross checked.
    """
    try:
        raw = base64.b64decode(value + "===", validate=False)
    except (binascii.Error, ValueError):
        raw = value.encode("utf-8", "ignore")
    runs = [match.group(0) for match in re.finditer(r"[ -~]{6,}", raw.decode("latin-1"))]
    return " ".join(runs)


def check(record: dict[str, Any], contract_address: str, expect: str = "") -> dict[str, Any]:
    tx = fetch_tx(record["tx"])
    votes = (tx.get("consensus_data") or {}).get("votes") or {}
    agree = sum(1 for vote in votes.values() if vote == "agree")
    disagree = sum(1 for vote in votes.values() if vote == "disagree")
    leader = leader_of(tx)
    raw_execution = str(leader.get("execution_result") or "")
    execution = (
        "FINISHED_WITH_ERROR" if raw_execution in ERROR_EXECUTIONS else raw_execution
    )
    raw_result = leader.get("result")
    payload_text = decode_result(raw_result) if isinstance(raw_result, str) else ""
    appeal_clean = not any(tx.get(flag) for flag in APPEAL_FLAGS)

    # Count validator entries that returned the leader's result byte for byte.
    # This is the part a direct mode test can never show: independent validators
    # reaching the same settlement payload, not just the leader.
    peers = (tx.get("consensus_data") or {}).get("validators") or []
    identical = 0
    for peer in peers:
        value = peer.get("result")
        if isinstance(value, str) and decode_result(value) == payload_text:
            identical += 1

    checks = {
        "found": bool(tx.get("hash")),
        "finalized": tx.get("status") == "FINALIZED",
        "contract_match": str(tx.get("to_address") or "").lower()
        == contract_address.lower(),
        "execution_match": execution == record.get("execution"),
        "majority": agree > 0 and agree > disagree,
        "no_appeal": appeal_clean,
    }
    if record.get("execution") == "FINISHED_WITH_ERROR":
        expected = str(record.get("payload") or "")
        needle = expected.split("] ")[-1] if "] " in expected else expected
        checks["revert_match"] = bool(needle) and needle[:24] in payload_text
    if expect:
        checks["band_match"] = expect in payload_text
        checks["validator_agreement"] = identical >= 2

    return {
        "step": record["step"],
        "tx": record["tx"],
        "explorer_url": f"{EXPLORER}/tx/{record['tx']}",
        "status": tx.get("status"),
        "execution": execution,
        "validators": len(peers) or len(votes),
        "agree": agree,
        "disagree": disagree,
        "identical_results": identical,
        "expected_band": expect,
        "payload_text": payload_text[:160],
        "checks": checks,
        "ok": all(checks.values()),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quiet", action="store_true", help="only print the summary")
    args = parser.parse_args()

    if not EVIDENCE.exists():
        print("evidence/studionet_deployment.json is missing", file=sys.stderr)
        return 2

    evidence = json.loads(EVIDENCE.read_text(encoding="utf-8"))
    contract = evidence["contract"]
    rows: list[dict[str, Any]] = []

    # The band each live audit is expected to have decided, read from the final
    # campaign state recorded by the deployment script.
    bands = {
        int(campaign["campaign_id"]): campaign["campaign_band"]
        for campaign in evidence["final"]["dashboard"]["campaigns"]
    }

    deploy_record = {
        "step": "deploy",
        "tx": contract["deploy_tx"],
        "execution": "SUCCESS",
        "payload": "",
    }
    rows.append(check(deploy_record, contract["address"]))
    for record in evidence["transactions"]:
        if record["step"] == "deploy":
            continue
        expect = ""
        if record["step"].startswith("audit:"):
            expect = bands.get(int(record["step"].split(":")[1]), "")
        rows.append(check(record, contract["address"], expect))

    passed = sum(1 for row in rows if row["ok"])
    report = {
        "explorer": EXPLORER,
        "contract": contract["address"],
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
                f"{flag}  {row['step']:28s} {row['status']:9s} {row['execution']:18s}"
                f" {row['agree']} agree / {row['disagree']} disagree"
                + (f"  [{','.join(failed)}]" if failed else "")
            )
    print(f"explorer verification: {passed}/{len(rows)} rows PASS -> {OUTPUT}")
    return 0 if passed == len(rows) else 1


if __name__ == "__main__":
    raise SystemExit(main())
