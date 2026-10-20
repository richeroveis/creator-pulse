"""Report writers shared by the deployment script and the provenance fixer.

Keeping the README evidence block and the frontend config rewrite in one module
means a re-run of the deployment and a re-run of `scripts/record_provenance.py`
produce byte identical text, so the committed evidence cannot drift from the
machine readable record.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
README_PATH = ROOT / "README.md"
CONFIG_PATH = ROOT / "frontend" / "src" / "config.ts"

CPT = 10 ** 18
EXPLORER = "https://explorer-studio.genlayer.com"

EVIDENCE_START = "<!-- DEPLOYMENT_EVIDENCE_START -->"
EVIDENCE_END = "<!-- DEPLOYMENT_EVIDENCE_END -->"


def consensus_tally(record: dict[str, Any]) -> str:
    votes = record.get("votes") or {}
    agree = int(votes.get("agree", 0))
    disagree = int(votes.get("disagree", 0))
    return f"{agree} agree / {disagree} disagree"


def update_frontend_config(address: str, digest: str) -> None:
    source = CONFIG_PATH.read_text(encoding="utf-8")
    source = re.sub(
        r'(export const CONTRACT_ADDRESS =\n\s*\(import\.meta\.env\.VITE_CONTRACT_ADDRESS as string \| undefined\) \?\?\n\s*")[^"]+(")',
        rf"\g<1>{address}\g<2>",
        source,
    )
    source = re.sub(
        r'(export const CONTRACT_SHA256 =\n\s*\(import\.meta\.env\.VITE_CONTRACT_SHA256 as string \| undefined\) \?\? ")[^"]+(")',
        rf"\g<1>{digest}\g<2>",
        source,
    )
    CONFIG_PATH.write_text(source, encoding="utf-8")


def update_readme(
    contract: dict[str, Any],
    transactions: list[dict[str, Any]],
    final: dict[str, Any],
    provenance: dict[str, Any] | None = None,
    explorer: dict[str, Any] | None = None,
) -> None:
    rows = []
    for item in transactions:
        label = item["step"]
        tx = item.get("tx", "")
        link = f"[{tx[:12]}]({EXPLORER}/tx/{tx})" if tx else "skipped"
        rows.append(
            f"| `{label}` | {link} | {item.get('status', '')} | {item.get('result', '')} | "
            f"{item.get('execution', '')} | {consensus_tally(item)} |"
        )
    tx_table = "\n".join(rows)
    campaigns = "\n".join(
        f"| {entry['campaign_id']} | {entry['title']} | `{entry['campaign_band']}` | "
        f"{int(entry['quality_anchor'])} | {int(entry['creator_payout_atto']) // CPT} | "
        f"{int(entry['brand_refund_atto']) // CPT} | {entry['state']} |"
        for entry in final["dashboard"]["campaigns"]
    )
    source_commit = (provenance or {}).get("commit", "UNCOMMITTED_SOURCE")
    source_tag = (provenance or {}).get("commit_tag") or "untagged"
    explorer_line = (
        f"{explorer['passed']}/{explorer['total']} rows PASS, checked {explorer['checked_at']}"
        if explorer
        else "not run yet, run python scripts/verify_explorer.py"
    )
    block = f"""### Deployment identity

| Field | Value |
| --- | --- |
| Network | studionet, chain id 61999 |
| Contract | [`{contract['address']}`]({EXPLORER}/address/{contract['address']}) |
| Deploy transaction | [`{contract['deploy_tx']}`]({EXPLORER}/tx/{contract['deploy_tx']}) |
| Source commit | `{source_commit}` (tag `{source_tag}`) |
| Contract file sha256 | `{contract['file_sha256']}` |
| Runner | `{contract['runner']}` |

The source commit is resolved by hashing the contract blob at every commit that touched
`contracts/creator_pulse.py` and keeping the newest one whose digest equals the deployed file, so
`git show {source_commit}:contracts/creator_pulse.py` reproduces the row above.

Four independent places carry the same code hash: `contracts/creator_pulse.py` on disk,
`evidence/studionet_deployment.json`, `frontend/src/config.ts` and this README. Run
`python scripts/verify_identity.py` to re-check all four, the address in the evidence file and the
frontend, and the source commit provenance.

### Transaction table

studionet does not publish deployed Python source: the explorer has no source field and
`eth_getCode` returns `0x` for this address. Identity therefore rests on the deploy transaction, the
source commit and the file digest above. Every row below was polled to `FINALIZED` over the RPC while
the scenario ran, then re-read independently through the explorer JSON API by
`python scripts/verify_explorer.py`, which also checks the validator votes and the exact revert
payload of each guard probe. Guard probes are expected to finish with `FINISHED_WITH_ERROR`.

Explorer re-verification: {explorer_line}.

| Step | Transaction | Status | Result | Execution | Votes |
| --- | --- | --- | --- | --- | --- |
{tx_table}

### Final campaign state

| Id | Campaign | Band | Anchor | Creator CPT | Brand CPT | State |
| --- | --- | --- | --- | --- | --- | --- |
{campaigns}

Vault invariant at the end of the run:
`vault {int(final['invariants']['vault_custody_balance_atto']) // CPT} CPT == escrow
{int(final['invariants']['campaign_escrow_atto']) // CPT} + curation
{int(final['invariants']['curation_escrow_atto']) // CPT}`, drift
`{int(final['invariants']['drift_atto'])}`.

The raw machine readable record, including every vote tally, payload and final balance, lives in
[`evidence/studionet_deployment.json`](evidence/studionet_deployment.json), and the explorer
re-check lives in [`evidence/explorer_verification.json`](evidence/explorer_verification.json).
"""
    text = README_PATH.read_text(encoding="utf-8")
    replacement = f"{EVIDENCE_START}\n{block}\n{EVIDENCE_END}"
    text = re.sub(
        re.escape(EVIDENCE_START) + r".*?" + re.escape(EVIDENCE_END),
        replacement,
        text,
        flags=re.S,
    )
    README_PATH.write_text(text, encoding="utf-8")
