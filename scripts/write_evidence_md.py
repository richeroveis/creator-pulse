"""Render docs/evidence.md from evidence/studionet_deployment.json.

Keeping the markdown generated means the human readable evidence can never
drift from the machine readable transaction table.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EVIDENCE = ROOT / "evidence" / "studionet_deployment.json"
EXPLORER_FILE = ROOT / "evidence" / "explorer_verification.json"
TARGET = ROOT / "docs" / "evidence.md"
CPT = 10 ** 18


def tx_link(tx: str) -> str:
    return f"[{tx[:14]}](https://explorer-studio.genlayer.com/tx/{tx})"


def main() -> None:
    data = json.loads(EVIDENCE.read_text(encoding="utf-8"))
    contract = data["contract"]
    final = data["final"]
    inv = final["invariants"]
    explorer_report = None
    if EXPLORER_FILE.exists():
        explorer_report = json.loads(EXPLORER_FILE.read_text(encoding="utf-8"))
    explorer_rows = {row["step"]: row for row in (explorer_report or {}).get("rows", [])}

    rows = []
    for item in data["transactions"]:
        votes = item.get("votes") or {}
        rows.append(
            f"| `{item['step']}` | {tx_link(item['tx'])} | {item['status']} | {item['result']} | "
            f"{item['execution']} | {votes.get('agree', 0)} agree / {votes.get('disagree', 0)} disagree | "
            f"{item['note']} |"
        )

    campaigns = []
    for campaign in final["dashboard"]["campaigns"]:
        campaigns.append(
            f"| {campaign['campaign_id']} | {campaign['title']} | `{campaign['campaign_band']}` | "
            f"{campaign['quality_anchor']} | {campaign['creator_payout_atto'] // CPT} | "
            f"{campaign['brand_refund_atto'] // CPT} | {campaign['state']} |"
        )

    guard_rows = []
    for item in data["transactions"]:
        if not item["step"].startswith("guard:"):
            continue
        row = explorer_rows.get(item["step"], {})
        guard_rows.append(
            f"| `{item['step']}` | `{item.get('expected', item['note'])}` | "
            f"`{item['execution']}` by explorer row check "
            f"{'PASS' if row.get('ok') else 'MISSING'}, payload `{item.get('payload', '')[:80]}` |"
        )

    audit_lines = []
    for item in data["transactions"]:
        if not item["step"].startswith("audit:"):
            continue
        row = explorer_rows.get(item["step"], {})
        audit_lines.append(
            f"- `{item['step']}`: {row.get('agree', 0)} validator votes agreed, "
            f"{row.get('identical_results', 0)} of {row.get('validators', 0)} validators returned the "
            f"leader result byte for byte, expected band "
            f"`{row.get('expected_band', '')}` present in the payload."
        )

    provenance = data.get("provenance") or {}
    explorer_line = (
        f"{explorer_report['passed']}/{explorer_report['total']} rows PASS at {explorer_report['checked_at']}"
        if explorer_report
        else "not run yet"
    )

    body = f"""# Live studionet evidence

CreatorPulse was deployed to GenLayer studionet and driven through a full multi signer scenario. This
file is a human readable companion to the machine readable record in
[`evidence/studionet_deployment.json`](../evidence/studionet_deployment.json).

## Method

- Every transaction was submitted by a distinct signing account and polled until `status_name == FINALIZED`
  over the studionet RPC while the scenario ran.
- Afterwards every transaction was re-read independently through the explorer JSON API
  (`GET https://explorer-studio.genlayer.com/api/transactions/{{hash}}`) by `scripts/verify_explorer.py`,
  which checks `FINALIZED`, the contract address, the execution result, the validator vote tally, the
  absence of any appeal flag, and for guard probes the exact revert string. Result: {explorer_line}.
- `result_name` and the leader receipt `execution_result` were recorded for every row. Guard probes are
  expected to finish with `FINISHED_WITH_ERROR`, and the exact revert payload is stored in the JSON.
- Final state was read with `get_dashboard`, `check_vault_invariants` and `get_token_balance`, not inferred
  from the transaction log.
- The deployed code identity is the sha256 of `contracts/creator_pulse.py`: `{contract['file_sha256']}`.
  The same digest is published in the evidence JSON, `frontend/src/config.ts` and `README.md`, and
  re-checked by `scripts/verify_identity.py`. GenLayer does not expose deployed Python source: the
  explorer has no source field and `eth_getCode` returns `0x` for this address, so the source commit
  below is the reproducible link between the repository and the deployed bytes.

## Validator agreement on the live audits

Direct mode tests only exercise the leader path. These rows come from the explorer and show what the
independent validators actually returned for each consensus audit:

{chr(10).join(audit_lines)}

## Deployment

| Field | Value |
| --- | --- |
| Network | studionet, chain id 61999 |
| Contract | [`{contract['address']}`](https://explorer-studio.genlayer.com/address/{contract['address']}) |
| Deploy transaction | {tx_link(contract['deploy_tx'])} |
| Runner | `{contract['runner']}` |
| Code sha256 | `{contract['file_sha256']}` |
| Deployed at commit | `{data['commit']}` |
| Commit tag | `{provenance.get('commit_tag') or 'untagged'}` |
| Explorer re-verification | {explorer_line} |

## Transactions

| Step | Transaction | Status | Result | Execution | Votes | Note |
| --- | --- | --- | --- | --- | --- | --- |
{chr(10).join(rows)}

## Final campaign state

| Id | Campaign | Band | Anchor | Creator CPT | Brand CPT | State |
| --- | --- | --- | --- | --- | --- | --- |
{chr(10).join(campaigns)}

Vault invariant: `{inv['vault_custody_balance_atto'] // CPT} CPT ==
{inv['campaign_escrow_atto'] // CPT} escrow + {inv['curation_escrow_atto'] // CPT} curation`, drift
`{inv['drift_atto']}`, `ok = {inv['ok']}`.

Campaign 2 was intentionally left in `EVALUATED` state so the settlement claim stays available in the
live app for anyone who wants to exercise `claim_campaign_settlement` after the dispute window.

## Guard probes

| Probe | Expected guard | On chain observation |
| --- | --- | --- |
{chr(10).join(guard_rows)}
| Missing disclosure tag | forced slash band | campaign 3 settled as `BOT_FRAUD_OR_MISSING_DISCLOSURE_SLASH` with creator payout 0 |

## Reproduce

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
genvm-lint check contracts/creator_pulse.py
pytest tests/ -q
python scripts/deploy_studionet.py
python scripts/verify_explorer.py
python scripts/record_provenance.py
python scripts/write_evidence_md.py
python scripts/verify_identity.py
```
"""
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(body, encoding="utf-8")
    print(f"wrote {TARGET.relative_to(ROOT)} ({len(body.splitlines())} lines)")


if __name__ == "__main__":
    main()
