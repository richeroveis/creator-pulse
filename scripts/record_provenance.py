"""Repair the provenance fields of an existing evidence file and regenerate the README.

The deployment run recorded HEAD at write time. When the working tree was dirty, HEAD did not
contain the deployed bytes, so this script re-resolves the source commit from the contract digest,
rewrites `evidence/studionet_deployment.json`, and regenerates the README evidence block from the
stored transaction table and final state. It only touches provenance and text: no network, no
private keys, no new transactions.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from provenance import resolve_provenance  # noqa: E402
from report import update_readme  # noqa: E402

CONTRACT_PATH = ROOT / "contracts" / "creator_pulse.py"
EVIDENCE_PATH = ROOT / "evidence" / "studionet_deployment.json"
EXPLORER_PATH = ROOT / "evidence" / "explorer_verification.json"


def main() -> int:
    if not EVIDENCE_PATH.exists():
        print("evidence/studionet_deployment.json is missing", file=sys.stderr)
        return 2

    evidence = json.loads(EVIDENCE_PATH.read_text(encoding="utf-8"))
    disk_hash = hashlib.sha256(CONTRACT_PATH.read_bytes()).hexdigest()
    recorded = evidence["contract"]["file_sha256"]
    if disk_hash != recorded:
        print(
            f"contract on disk {disk_hash[:16]} != evidence {recorded[:16]}, refusing",
            file=sys.stderr,
        )
        return 1

    provenance = resolve_provenance(recorded)
    if not provenance["contract_committed"]:
        print(
            "no commit contains the deployed contract bytes, refusing to write provenance",
            file=sys.stderr,
        )
        return 1

    evidence["commit"] = provenance["commit"]
    evidence["provenance"] = provenance
    evidence["contract"]["code_sha256"] = recorded

    explorer = None
    if EXPLORER_PATH.exists():
        report = json.loads(EXPLORER_PATH.read_text(encoding="utf-8"))
        explorer = {
            "total": report["total"],
            "passed": report["passed"],
            "checked_at": report["checked_at"],
        }
        evidence["explorer_verification"] = {
            "total": report["total"],
            "passed": report["passed"],
            "failed": report["failed"],
            "checked_at": report["checked_at"],
            "explorer": report["explorer"],
        }

    EVIDENCE_PATH.write_text(json.dumps(evidence, indent=2, default=str), encoding="utf-8")
    update_readme(
        evidence["contract"],
        evidence["transactions"],
        evidence["final"],
        provenance,
        explorer,
    )

    print(f"provenance commit {provenance['commit']} tag {provenance['commit_tag'] or 'none'}")
    print(f"explorer rows {explorer['passed']}/{explorer['total']}" if explorer else "explorer report absent")
    print("README evidence block regenerated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
