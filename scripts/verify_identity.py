"""Check the 4-way sha256 identity of the deployed CreatorPulse contract.

1. contracts/creator_pulse.py on disk
2. evidence/studionet_deployment.json
3. frontend/src/config.ts
4. README.md deployment section

Also checks that the contract address agrees between the evidence file, the
frontend and the README. Exits non zero on any drift.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTRACT = ROOT / "contracts" / "creator_pulse.py"
EVIDENCE = ROOT / "evidence" / "studionet_deployment.json"
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

    print("address identity")
    for label, value in (
        ("contract", contract["address"]),
        ("frontend config", config_address),
        ("readme", readme_address),
    ):
        print(f"  {label:<22} {value}")
    address_ok = contract["address"] == config_address == readme_address

    print(f"deployed code hash matches file: {code_ok}")
    print(f"4-way sha256 identity: {'OK' if hash_ok else 'DRIFT'}")
    print(f"address identity: {'OK' if address_ok else 'DRIFT'}")

    if not (hash_ok and address_ok and code_ok):
        sys.exit(1)


if __name__ == "__main__":
    main()
