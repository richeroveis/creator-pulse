"""Deploy CreatorPulse to studionet, drive the multi signer scenario, write evidence.

Every network call is retried with backoff, every scenario step is checkpointed,
and a resumed run never repeats a finalized transaction. Private keys live only
in evidence/_deploy_state.json, which is gitignored, and are never printed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Callable

from dotenv import load_dotenv
from genlayer_py import create_account, create_client
from genlayer_py.chains import studionet

ROOT = Path(__file__).resolve().parent.parent
CONTRACT_PATH = ROOT / "contracts" / "creator_pulse.py"
EVIDENCE_DIR = ROOT / "evidence"
EVIDENCE_PATH = EVIDENCE_DIR / "studionet_deployment.json"
STATE_PATH = EVIDENCE_DIR / "_deploy_state.json"
CHECKPOINT_PATH = EVIDENCE_DIR / "_checkpoint.json"
CONFIG_PATH = ROOT / "frontend" / "src" / "config.ts"
README_PATH = ROOT / "README.md"

CPT = 10 ** 18
PROOF_BASE = "https://richeroveis.github.io/creator-pulse/proofs"
RPC_URL = "https://studio.genlayer.com/api"
CHAIN_ID = 61999
ZERO = "0x0000000000000000000000000000000000000000"

ACTORS = {
    "brand_nova": "NovaGlow",
    "brand_pulse": "PulseFuel",
    "brand_aurora": "AuroraLab",
    "creator_mira": "Mira Vale",
    "creator_jonas": "Jonas Reed",
    "curator_lin": "Lin Park",
    "curator_ada": "Ada Cruz",
}

CAMPAIGNS = [
    {
        "brand": "brand_nova",
        "creator": "creator_mira",
        "title": "NovaGlow winter ritual launch",
        "tag": "#NovaGlow",
        "spec": (
            "Publish one 60 second vertical video that shows the product in use three times, "
            "keeps the sponsor tag on screen for the full runtime, and reports organic reach "
            "and engagement rate in the description."
        ),
        "base": 1200,
        "viral": 800,
        "bond": 120,
        "proof": f"{PROOF_BASE}/campaign-1.html",
        "expected_band": "VIRAL_BONUS_TIER",
    },
    {
        "brand": "brand_pulse",
        "creator": "creator_jonas",
        "title": "PulseFuel morning stack",
        "tag": "#PulseFuel",
        "spec": (
            "Publish one 45 second vertical video that shows the product in use before and after "
            "a morning run, keeps the sponsor tag on screen for the full runtime, and reports "
            "organic reach and engagement rate in the description."
        ),
        "base": 900,
        "viral": 400,
        "bond": 100,
        "proof": f"{PROOF_BASE}/campaign-2.html",
        "expected_band": "TARGET_MET_TIER",
    },
    {
        "brand": "brand_aurora",
        "creator": "creator_mira",
        "title": "AuroraLab night serum drop",
        "tag": "#AuroraLab",
        "spec": (
            "Publish one 30 second vertical video that demonstrates the night serum, keeps the "
            "sponsor tag visible on screen, and reports organic reach in the description."
        ),
        "base": 1000,
        "viral": 500,
        "bond": 150,
        "proof": f"{PROOF_BASE}/campaign-3.html",
        "expected_band": "BOT_FRAUD_OR_MISSING_DISCLOSURE_SLASH",
    },
]

CURATIONS = [
    ("curator_lin", 1, 120),
    ("curator_ada", 1, 40),
    ("curator_lin", 2, 60),
    ("curator_ada", 3, 30),
]


class Runner:
    def __init__(self, reuse: bool = True, fresh: bool = False) -> None:
        load_dotenv(ROOT / ".env")
        deploy_key = os.environ.get("GENLAYER_PRIVATE_KEY", "").strip()
        if not deploy_key:
            raise SystemExit("GENLAYER_PRIVATE_KEY is missing from this project's .env")
        self.deployer = create_account(deploy_key)
        self.state = self._load_state()
        self.reuse = reuse and not fresh
        self.accounts: dict[str, Any] = {}
        self.clients: dict[str, Any] = {}
        self.transactions: list[dict[str, Any]] = []

    # ----------------------------------------------------------- persistence

    def _load_state(self) -> dict[str, Any]:
        if STATE_PATH.exists():
            return json.loads(STATE_PATH.read_text(encoding="utf-8"))
        return {"accounts": {}, "steps": {}, "contract": {}}

    def save_state(self) -> None:
        EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
        STATE_PATH.write_text(json.dumps(self.state, indent=2), encoding="utf-8")

    # ----------------------------------------------------------- accounts

    def actor(self, name: str):
        if name in self.accounts:
            return self.accounts[name]
        stored = self.state["accounts"].get(name)
        if stored:
            account = create_account(stored)
        else:
            account = create_account()
            self.state["accounts"][name] = account.key.hex()
            self.save_state()
        self.accounts[name] = account
        return account

    def client(self, name: str):
        if name not in self.clients:
            self.clients[name] = create_client(chain=studionet, account=self.actor(name))
        return self.clients[name]

    def deploy_client(self):
        if "deployer" not in self.clients:
            self.clients["deployer"] = create_client(chain=studionet, account=self.deployer)
        return self.clients["deployer"]

    # ----------------------------------------------------------- rpc helpers

    def retry(self, label: str, fn: Callable[[], Any], attempts: int = 6, base: float = 2.0) -> Any:
        last: Exception | None = None
        for attempt in range(attempts):
            try:
                return fn()
            except Exception as exc:  # network and 429 errors are expected on studionet
                last = exc
                wait = base * (attempt + 1)
                print(f"  retry {label} in {wait:.0f}s ({type(exc).__name__})", flush=True)
                time.sleep(wait)
        raise RuntimeError(f"{label} failed after {attempts} attempts: {last}")

    def wait(self, tx_hash: str, timeout: int = 1200) -> dict[str, Any]:
        deadline = time.time() + timeout
        last_status = "UNKNOWN"
        while time.time() < deadline:
            def fetch():
                return self.deploy_client().get_transaction(tx_hash)

            try:
                tx = self.retry(f"get_transaction {tx_hash[:10]}", fetch, attempts=3, base=2.0)
            except RuntimeError:
                time.sleep(3)
                continue
            last_status = str(tx.get("status_name") or tx.get("status") or "UNKNOWN")
            if last_status in {"FINALIZED", "CANCELED", "UNDETERMINED"}:
                return tx
            time.sleep(4)
        raise RuntimeError(f"transaction {tx_hash} did not finalize, last status {last_status}")

    def summarize(self, tx: dict[str, Any], expected: str, note: str = "") -> dict[str, Any]:
        leader = (tx.get("consensus_data") or {}).get("leader_receipt") or [{}]
        if isinstance(leader, list):
            leader = leader[0] if leader else {}
        execution = str(leader.get("execution_result") or "")
        payload = ""
        inner = leader.get("result")
        if isinstance(inner, dict):
            payload = str(inner.get("payload") or "")
            if not execution and inner.get("status") == "rollback":
                execution = "FINISHED_WITH_ERROR"
        if not execution:
            execution = str(tx.get("tx_execution_result_name") or "SUCCESS")
        if execution in {"ERROR", "ROLLBACK", "FINISHED_WITH_ERROR"}:
            execution = "FINISHED_WITH_ERROR"
        votes = ((tx.get("consensus_data") or {}).get("votes") or {})
        tally: dict[str, int] = {}
        for vote in votes.values():
            key = str(vote).lower()
            tally[key] = tally.get(key, 0) + 1
        record = {
            "status": tx.get("status_name"),
            "result": tx.get("result_name"),
            "execution": execution,
            "votes": tally,
            "expected": expected,
            "payload": payload,
            "note": note,
        }
        if expected == "SUCCESS":
            record["ok"] = execution == "SUCCESS" and record["result"] == "MAJORITY_AGREE"
        else:
            record["ok"] = execution == "FINISHED_WITH_ERROR" and expected in payload
        return record

    def send(
        self,
        step: str,
        actor: str,
        function: str,
        args: list[Any],
        expected: str = "SUCCESS",
        timeout: int = 1200,
        note: str = "",
        skip_if: Callable[[], bool] | None = None,
    ) -> dict[str, Any]:
        cached = self.state["steps"].get(step)
        if cached and cached.get("ok"):
            print(f"[skip] {step} already finalized {cached['tx'][:12]}", flush=True)
            self.transactions.append({"step": step, **cached})
            return cached
        if skip_if is not None and skip_if():
            print(f"[skip] {step} not needed in the current state", flush=True)
            record = {"tx": "", "status": "SKIPPED", "result": "", "execution": "", "votes": {},
                      "expected": expected, "payload": "", "note": "already satisfied", "ok": True}
            return record

        address = self.state["contract"]["address"]
        print(f"[tx] {step} -> {function}", flush=True)
        tx_hash = self.retry(
            f"write {function}",
            lambda: self.client(actor).write_contract(
                address=address, function_name=function, args=args
            ),
            attempts=4,
            base=3.0,
        )
        print(f"     hash {tx_hash}", flush=True)
        tx = self.wait(tx_hash, timeout=timeout)
        summary = self.summarize(tx, expected, note)
        record = {"tx": tx_hash, **summary}
        self.state["steps"][step] = record
        self.save_state()
        self.transactions.append({"step": step, **record})
        marker = "ok" if record.get("ok") else "FAIL"
        print(f"     {record['status']} / {record['result']} / {record['execution']} [{marker}]", flush=True)
        if not record.get("ok"):
            print(f"     payload: {record['payload'][:220]}", flush=True)
        return record

    def view(self, function: str, args: list[Any] | None = None, actor: str = "deployer") -> Any:
        address = self.state["contract"]["address"]
        return self.retry(
            f"read {function}",
            lambda: self.client(actor).read_contract(
                address=address, function_name=function, args=args or []
            ),
            attempts=5,
            base=2.0,
        )

    # ----------------------------------------------------------- phases

    def deploy(self) -> None:
        code = CONTRACT_PATH.read_text(encoding="utf-8")
        file_hash = hashlib.sha256(CONTRACT_PATH.read_bytes()).hexdigest()
        code_hash = hashlib.sha256(code.encode("utf-8")).hexdigest()
        stored = self.state.get("contract") or {}

        if self.reuse and stored.get("address") and stored.get("file_sha256") == file_hash:
            print(f"[skip] reusing contract {stored['address']} for sha256 {file_hash[:16]}", flush=True)
            return

        print(f"[deploy] studionet, code sha256 {code_hash[:16]}", flush=True)
        tx_hash = self.retry(
            "deploy_contract",
            lambda: self.deploy_client().deploy_contract(code=code),
            attempts=4,
            base=3.0,
        )
        print(f"[deploy] tx {tx_hash}", flush=True)
        tx = self.wait(tx_hash, timeout=1800)
        summary = self.summarize(tx, "SUCCESS")
        address = tx.get("to_address") or tx.get("recipient")
        if not summary.get("ok") or not address:
            raise RuntimeError(f"deployment failed: {summary}")
        self.state["contract"] = {
            "address": address,
            "deploy_tx": tx_hash,
            "file_sha256": file_hash,
            "code_sha256": code_hash,
            "runner": code.splitlines()[0],
        }
        self.state["steps"] = {}
        self.save_state()
        self.transactions.append({"step": "deploy", "tx": tx_hash, **summary})
        print(f"[deploy] address {address}", flush=True)

    def fund_actors(self) -> None:
        for name in ACTORS:
            def needs_funding(name=name) -> bool:
                balance = self.view("get_token_balance", [self.actor(name).address], actor=name)
                return int(balance) >= 2000 * CPT

            self.send(
                f"faucet:{name}",
                name,
                "faucet_or_deposit",
                [3000 * CPT],
                skip_if=needs_funding,
                note="capped faucet credit for a demo signer",
            )

    def create_campaigns(self) -> None:
        deadline = int(time.time()) + 86400
        for index, campaign in enumerate(CAMPAIGNS, start=1):
            def already(index=index) -> bool:
                return int(self.view("get_campaign_count")) >= index

            self.send(
                f"create:{index}",
                campaign["brand"],
                "create_campaign",
                [
                    campaign["title"],
                    campaign["tag"],
                    campaign["spec"],
                    campaign["base"] * CPT,
                    campaign["viral"] * CPT,
                    campaign["bond"] * CPT,
                    deadline,
                ],
                skip_if=already,
                note=f"locks {campaign['base'] + campaign['viral']} CPT of maximum liability",
            )

    def submit_deliverables(self) -> None:
        for index, campaign in enumerate(CAMPAIGNS, start=1):
            def submitted(index=index) -> bool:
                state = str(self.view("get_campaign", [index]).get("state"))
                return state != "OPEN"

            self.send(
                f"submit:{index}",
                campaign["creator"],
                "accept_and_submit_deliverable",
                [index, campaign["proof"]],
                skip_if=submitted,
                note="creator bond locked into custody",
            )

    def curate(self) -> None:
        for position, (curator, campaign_id, stake) in enumerate(CURATIONS, start=1):
            def already(campaign_id=campaign_id, curator=curator, stake=stake) -> bool:
                current = int(
                    self.view(
                        "get_curator_stake",
                        [campaign_id, self.actor(curator).address],
                        actor=curator,
                    )
                )
                return current >= stake * CPT

            self.send(
                f"curate:{position}",
                curator,
                "curate_deliverable",
                [campaign_id, stake * CPT],
                skip_if=already,
                note=f"{stake} CPT staked behind campaign {campaign_id}",
            )

    def audit(self) -> None:
        for index, campaign in enumerate(CAMPAIGNS, start=1):
            self.send(
                f"audit:{index}",
                "deployer",
                "verify_campaign_deliverable_live",
                [index],
                timeout=1800,
                note=f"live consensus audit, expected {campaign['expected_band']}",
            )
            snapshot = self.view("get_campaign", [index])
            band = snapshot.get("campaign_band")
            if band != campaign["expected_band"]:
                raise RuntimeError(
                    f"campaign {index} settled as {band}, expected {campaign['expected_band']}"
                )
            print(
                f"     band {band} anchor {snapshot['quality_anchor']} "
                f"creator {int(snapshot['creator_payout_atto']) // CPT} CPT",
                flush=True,
            )

    def settle(self) -> None:
        unlock = int(self.view("get_campaign", [1])["settlement_unlock_clock"])
        wait_seconds = max(0, unlock - int(time.time()) + 8)
        if wait_seconds:
            print(f"[wait] dispute window closes in {wait_seconds}s", flush=True)
            time.sleep(wait_seconds)
        self.send("settle:1", "brand_nova", "claim_campaign_settlement", [1], note="viral band releases the full vault")
        self.send("settle:3", "brand_aurora", "claim_campaign_settlement", [3], note="slash band refunds the brand")
        self.send(
            "refund:curation-1",
            "curator_ada",
            "claim_curation_refund",
            [1],
            note="curator pulls the stake back after settlement",
        )

    def collect(self) -> dict[str, Any]:
        dashboard = self.view("get_dashboard", [12])
        invariants = self.view("check_vault_invariants")
        balances = {
            name: int(self.view("get_token_balance", [self.actor(name).address]))
            for name in ACTORS
        }
        return {"dashboard": dashboard, "invariants": invariants, "balances": balances}


def consensus_tally(record: dict[str, Any]) -> str:
    votes = record.get("votes") or {}
    agree = int(votes.get("agree", 0))
    disagree = int(votes.get("disagree", 0))
    return f"{agree} agree / {disagree} disagree"


def git_commit() -> str:
    try:
        return subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True
        ).stdout.strip()
    except Exception:
        return "unknown"


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


def update_readme(contract: dict[str, Any], transactions: list[dict[str, Any]], final: dict[str, Any]) -> None:
    rows = []
    for item in transactions:
        label = item["step"]
        tx = item.get("tx", "")
        link = f"[{tx[:12]}](https://explorer-studio.genlayer.com/tx/{tx})" if tx else "skipped"
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
    block = f"""### Deployment identity

| Field | Value |
| --- | --- |
| Network | studionet, chain id 61999 |
| Contract | [`{contract['address']}`](https://explorer-studio.genlayer.com/address/{contract['address']}) |
| Deploy transaction | [`{contract['deploy_tx']}`](https://explorer-studio.genlayer.com/tx/{contract['deploy_tx']}) |
| Contract file sha256 | `{contract['file_sha256']}` |
| Deployed code sha256 | `{contract['code_sha256']}` |
| Runner | `{contract['runner']}` |

Four independent places carry the same code hash: `contracts/creator_pulse.py` on disk,
`evidence/studionet_deployment.json`, `frontend/src/config.ts` and this README. Run
`python scripts/verify_identity.py` to re-check all four, plus the address that appears in the
evidence file and the frontend.

### Transaction table

Every row below was polled to `FINALIZED` and read back through the explorer RPC. Guard probes are
expected to finish with `FINISHED_WITH_ERROR`; the payload column in the evidence file records the
exact revert string.

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
[`evidence/studionet_deployment.json`](evidence/studionet_deployment.json).
"""
    text = README_PATH.read_text(encoding="utf-8")
    start = "<!-- DEPLOYMENT_EVIDENCE_START -->"
    end = "<!-- DEPLOYMENT_EVIDENCE_END -->"
    replacement = f"{start}\n{block}\n{end}"
    text = re.sub(re.escape(start) + r".*?" + re.escape(end), replacement, text, flags=re.S)
    README_PATH.write_text(text, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fresh", action="store_true", help="deploy a brand new contract")
    parser.add_argument("--no-reuse", action="store_true", help="ignore a previous deployment")
    parser.add_argument("--skip-settle", action="store_true", help="stop after the audits")
    args = parser.parse_args()

    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    runner = Runner(reuse=not args.no_reuse, fresh=args.fresh)

    print("==", "deploy", flush=True)
    runner.deploy()
    print("==", "fund actors", flush=True)
    runner.fund_actors()
    print("==", "create campaigns", flush=True)
    runner.create_campaigns()
    print("==", "submit deliverables", flush=True)
    runner.submit_deliverables()
    print("==", "curate", flush=True)
    runner.curate()
    print("==", "guard probe: clawback while awaiting audit", flush=True)
    runner.send(
        "guard:clawback-submitted",
        "brand_pulse",
        "withdraw_campaign_liquidity",
        [2],
        expected="PAPITO_LIABILITY_LOCK",
        note="brand cannot pull the viral pool while a deliverable awaits audit",
    )
    print("==", "consensus audits", flush=True)
    runner.audit()
    print("==", "guard probe: clawback inside dispute window", flush=True)
    runner.send(
        "guard:clawback-evaluated",
        "brand_pulse",
        "withdraw_campaign_liquidity",
        [2],
        expected="PAPITO_LIABILITY_LOCK",
        note="brand cannot pull funds inside the post audit dispute window",
    )
    if not args.skip_settle:
        print("==", "settle", flush=True)
        runner.settle()
        print("==", "guard probes after settlement", flush=True)
        runner.send(
            "guard:curate-after-settlement",
            "curator_lin",
            "curate_deliverable",
            [1, 5 * CPT],
            expected="already settled",
            note="settled campaigns leave the curated feed",
        )
        runner.send(
            "guard:transfer-overdraw",
            "curator_ada",
            "transfer_tokens",
            [runner.actor("brand_nova").address, 9_000_000 * CPT],
            expected="Insufficient CPT balance",
            note="balance floor holds under an overdraw attempt",
        )
    print("==", "collect final state", flush=True)
    final = runner.collect()
    contract = runner.state["contract"]
    evidence = {
        "project": "CreatorPulse",
        "network": {"name": "studionet", "chain_id": CHAIN_ID, "rpc": RPC_URL},
        "contract": contract,
        "commit": git_commit(),
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "actors": {name: runner.actor(name).address for name in ACTORS},
        "campaigns_configured": CAMPAIGNS,
        "transactions": runner.transactions,
        "final": final,
    }
    EVIDENCE_PATH.write_text(json.dumps(evidence, indent=2, default=str), encoding="utf-8")

    update_frontend_config(contract["address"], contract["file_sha256"])
    update_readme(contract, runner.transactions, final)

    failures = [item for item in runner.transactions if not item.get("ok")]
    print(
        f"done: {len(runner.transactions)} transactions, {len(failures)} unexpected results, "
        f"evidence {EVIDENCE_PATH.relative_to(ROOT)}",
        flush=True,
    )
    if failures:
        for item in failures:
            print(f"  unexpected: {item['step']} -> {item.get('payload', '')[:160]}", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
