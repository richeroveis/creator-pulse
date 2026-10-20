"""Check the 4-way sha256 identity of the deployed CreatorPulse contract.

1. contracts/creator_pulse.py on disk
2. evidence/studionet_deployment.json
3. frontend/src/config.ts
4. README.md deployment section

Also checks that the contract address agrees between the evidence file, the frontend and the
README, that the recorded source commit really contains the deployed bytes, that the explorer
re-verification passed for every transaction, and that the README transaction table has exactly one
row per recorded transaction. Exits non zero on any drift.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from provenance import commit_for_source  # noqa: E402

CONTRACT = ROOT / "contracts" / "creator_pulse.py"
EVIDENCE = ROOT / "evidence" / "studionet_deployment.json"
EXPLORER_REPORT = ROOT / "evidence" / "explorer_verification.json"
CONFIG = ROOT / "frontend" / "src" / "config.ts"
README = ROOT / "README.md"


def file_digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    if not EVIDENCE.exists():
        raise SystemExit("evidence/studionet_deployment.json is missing, run the deployment first")

    evidence = json.loads(EVIDENCE.read_text(encoding="utf-8"))
    contract = evidence["contract"]
    config_text = CONFIG.read_text(encoding="utf-8")
    readme_text = README.read_text(encoding="utf-8")

    disk_hash = file_digest(CONTRACT)
    evidence_hash = contract["file_sha256"]
    config_hash_match = re.search(r'export const CONTRACT_SHA256 =\n.*?\?\? "([0-9a-f]{64})"', config_text, re.S)
    config_hash = config_hash_match.group(1) if config_hash_match else "missing"
    readme_hash_match = re.search(r"\| Contract file sha256 \| `([0-9a-f]{64})` \|", readme_text)
    readme_hash = readme_hash_match.group(1) if readme_hash_match else "missing"

    config_address_match = re.search(r'export const CONTRACT_ADDRESS =\n.*?\?\?\n\s*"([^"]+)"', config_text, re.S)
    config_address = config_address_match.group(1) if config_address_match else "missing"
    readme_address_match = re.search(r"\| Contract \| \[`(0x[0-9a-fA-F]{40})`\]", readme_text)
    readme_address = readme_address_match.group(1) if readme_address_match else "missing"

    rows = [
        ("contract file on disk", disk_hash),
        ("evidence json", evidence_hash),
        ("frontend config", config_hash),
        ("readme", readme_hash),
    ]
    print("sha256 identity")
    for label, value in rows:
        print(f"  {label:<22} {value}")
    unique = {value for _, value in rows}
    hash_ok = len(unique) == 1 and "missing" not in unique

    code_ok = contract.get("code_sha256") == evidence_hash

    # Provenance: the commit in the evidence must contain these exact bytes.
    provenance = evidence.get("provenance") or {}
    recorded_commit = provenance.get("commit") or evidence.get("commit", "")
    resolved_commit = commit_for_source(disk_hash)
    commit_ok = bool(recorded_commit) and recorded_commit == resolved_commit
    readme_commit = re.search(r"\| Source commit \| `([0-9a-f]{40})`", readme_text)
    readme_commit_ok = bool(readme_commit) and readme_commit.group(1) == recorded_commit

    # Explorer re-verification: every recorded transaction must have passed.
    if EXPLORER_REPORT.exists():
        report = json.loads(EXPLORER_REPORT.read_text(encoding="utf-8"))
        explorer_ok = report["passed"] == report["total"] and all(
            row["ok"] for row in report["rows"]
        )
        explorer_summary = f"{report['passed']}/{report['total']} rows PASS at {report['checked_at']}"
    else:
        explorer_ok = False
        explorer_summary = "evidence/explorer_verification.json is missing"

    # The README evidence table must carry exactly one row per recorded transaction.
    block_match = re.search(
        r"<!-- DEPLOYMENT_EVIDENCE_START -->(.*?)<!-- DEPLOYMENT_EVIDENCE_END -->",
        readme_text,
        flags=re.S,
    )
    block_text = block_match.group(1) if block_match else ""
    readme_steps = re.findall(r"^\| `([^`]+)` \|", block_text, flags=re.M)
    evidence_steps = [item["step"] for item in evidence["transactions"]]
    deploy_link = contract["deploy_tx"] in readme_text
    table_ok = readme_steps == evidence_steps and deploy_link

    print("address identity")
    for label, value in (
        ("contract", contract["address"]),
        ("frontend config", config_address),
        ("readme", readme_address),
    ):
        print(f"  {label:<22} {value}")
    address_ok = contract["address"] == config_address == readme_address

    print(f"deployed code hash matches file: {code_ok}")
    print(f"source commit contains deployed bytes: {commit_ok} ({recorded_commit[:12]})")
    print(f"readme records the same commit: {readme_commit_ok}")
    print(f"explorer re-verification: {explorer_summary} -> {'OK' if explorer_ok else 'FAIL'}")
    print(
        f"readme evidence table matches evidence ({len(readme_steps)} rows,"
        f" deploy tx link {deploy_link}): {table_ok}"
    )
    print(f"4-way sha256 identity: {'OK' if hash_ok else 'DRIFT'}")
    print(f"address identity: {'OK' if address_ok else 'DRIFT'}")

    if not (hash_ok and address_ok and code_ok and commit_ok and readme_commit_ok
            and explorer_ok and table_ok):
        sys.exit(1)


if __name__ == "__main__":
    main()
