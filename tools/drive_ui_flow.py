"""Drive the REAL built CreatorPulse frontend against studionet with Playwright.

This is the live proof the DApp is not demo only. It uses separate funded burner
wallets for brand, creator, curator and keeper, records every browser session to a
webm, and completes the full settlement path and the neutral recovery path purely
through the UI. Each UI signed transaction is written to evidence/ui_flow_verification
.json so scripts/verify_ui_flow.py can re-check every hash on the explorer. Final
status and balances are confirmed with independent contract reads, never inferred from
the page. If a consensus step cannot finalize it is recorded as timed_out and reported
honestly, never faked.

Run (from a shell with the venv):
    python tools/drive_ui_flow.py [base_url]
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright, Page, TimeoutError as PWTimeout

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from genlayer_py import create_account, create_client  # noqa: E402
from genlayer_py.chains import studionet  # noqa: E402
from dotenv import load_dotenv  # noqa: E402

CONTRACT_ADDRESS = "0x6768EAdcFBF13aDEE460Bfd228f6653f3e013016"
DEFAULT_URL = "http://127.0.0.1:4181/creator-pulse/"
CHROMIUM = os.environ.get(
    "CREATORPULSE_CHROMIUM",
    r"C:\Users\oveis\AppData\Local\ms-playwright\chromium-1148\chrome-win\chrome.exe",
)
PROOF_BASE = "https://richeroveis.github.io/creator-pulse/proofs"
READABLE_PROOF = f"{PROOF_BASE}/campaign-1.html"
DEAD_PROOF = f"{PROOF_BASE}/dead.html"
BURNER_LS_KEY = "creatorpulse.burner.v1"

SHOTS = ROOT / "artifacts" / "shots_flow"
VIDEOS = ROOT / "artifacts" / "video"
KEYS_PATH = ROOT / "artifacts" / "_ui_flow_keys.json"  # gitignored, never printed
EVIDENCE_PATH = ROOT / "evidence" / "ui_flow_verification.json"
CPT = 10 ** 18
NONCE = time.strftime("%H%M%S")  # unique per run so leftover profiles never lock

record: dict = {"transactions": [], "screenshots": [], "statuses": {}}
contexts: list = []
video_refs: list = []  # (role, page.video) in session creation order


def save_evidence(base_url: str) -> None:
    payload = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "network": {"name": "studionet", "chain_id": 61999},
        "contract_address": CONTRACT_ADDRESS,
        "base_url": base_url,
        "transactions": record["transactions"],
        "statuses": record["statuses"],
        "final": record.get("final", {}),
        "videos": record.get("videos", []),
        "screenshots": record["screenshots"],
    }
    # Merge across runs so a later retry adds to (never erases) what already landed
    # on chain in an earlier attempt.
    if EVIDENCE_PATH.exists():
        try:
            old = json.loads(EVIDENCE_PATH.read_text(encoding="utf-8"))
        except Exception:
            old = {}
        by_step = {t["step"]: t for t in old.get("transactions", [])}
        by_step.update({t["step"]: t for t in record["transactions"]})
        payload["transactions"] = list(by_step.values())
        status = dict(old.get("statuses", {}))
        status.update(record.get("statuses", {}))
        payload["statuses"] = status
        seen, vids = set(), []
        for video in old.get("videos", []) + record.get("videos", []):
            path = video.get("path")
            if path and path not in seen:
                seen.add(path)
                vids.append(video)
        payload["videos"] = vids
        if not payload["final"]:
            payload["final"] = old.get("final", {})
    EVIDENCE_PATH.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def log(role: str, message: str) -> None:
    print(f"[{role}] {message}", flush=True)


def shoot(page: Page, name: str) -> None:
    SHOTS.mkdir(parents=True, exist_ok=True)
    path = SHOTS / f"{name}.png"
    page.screenshot(path=str(path), full_page=True)
    record["screenshots"].append(str(path.relative_to(ROOT)))


def normalize_key(account) -> str:
    raw = account.key.hex()
    raw = raw[2:] if raw.startswith("0x") else raw
    return "0x" + raw.zfill(64)


def open_wallet(pw, url: str, role: str, private_key: str) -> Page:
    context = pw.chromium.launch_persistent_context(
        user_data_dir=str(ROOT / "artifacts" / f"pwflow-{role}-{NONCE}"),
        headless=True,
        executable_path=CHROMIUM,
        args=["--no-sandbox"],
        viewport={"width": 1440, "height": 1500},
        record_video_dir=str(VIDEOS),
        record_video_size={"width": 1280, "height": 720},
    )
    context.add_init_script(
        f"try {{ window.localStorage.setItem({json.dumps(BURNER_LS_KEY)}, {json.dumps(private_key)}); }} catch (e) {{}}"
    )
    contexts.append(context)
    page = context.pages[0] if context.pages else context.new_page()
    if page.video is not None:
        video_refs.append((role, page.video))
    page.goto(url, wait_until="domcontentloaded", timeout=90000)
    return page


def connect_burner(page: Page) -> None:
    page.get_by_role("button", name="1-click burner").click()
    page.wait_for_selector(f"text=/0x[0-9a-fA-F]{{4}}\\.\\.\\./", timeout=40000)


def wait_tx_hash(page: Page, label: str, timeout_ms: int) -> str:
    # The activity log writes "<label> finalized" on success and "<label> reverted",
    # "<label> failed" or "<label> still pending" otherwise. Stop on any of them so a
    # rejection does not burn the whole ceiling.
    outcomes = [f"{label} finalized", f"{label} reverted", f"{label} failed", f"{label} still pending"]
    deadline = time.time() + timeout_ms / 1000
    while time.time() < deadline:
        for marker in outcomes:
            entry = page.get_by_text(marker, exact=False).first
            if entry.count() > 0:
                row = entry.locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]")
                anchor = row.locator("a[title]").first
                if "finalized" in marker:
                    return anchor.get_attribute("title") or ""
                raise PWTimeout(f"{label} did not finalize ({marker})")
        page.wait_for_timeout(2500)
    raise PWTimeout(f"{label} never resolved within ceiling")


def mark(step: str, role: str, function_name: str, tx: str, expected: str, note: str) -> None:
    record["transactions"].append(
        {
            "step": step,
            "role": role,
            "path": step.split(":", 1)[0],
            "function": function_name,
            "tx": tx,
            "expected": expected,
            "execution": "SUCCESS" if expected == "SUCCESS" else "FINISHED_WITH_ERROR",
            "note": note,
        }
    )
    save_evidence(record.get("base_url", DEFAULT_URL))


def claim_faucet(page: Page, step: str, role: str) -> str:
    page.get_by_role("button", name="Claim 2,000 CPT faucet").click()
    tx = wait_tx_hash(page, "Faucet claim", 900000)
    mark(step, role, "faucet_or_deposit", tx, "SUCCESS", "capped burner credit")
    return tx


def create_campaign(page: Page, step: str, role: str, title: str, tag: str, spec: str, base: str, viral: str, bond: str) -> str:
    page.locator("#console").scroll_into_view_if_needed()
    text_inputs = page.locator("#console input:not([type='number']):not([type='datetime-local'])")
    text_inputs.nth(0).fill(title)
    text_inputs.nth(1).fill(tag)
    page.locator("#console textarea").fill(spec)
    numbers = page.locator("#console input[type='number']")
    numbers.nth(0).fill(base)
    numbers.nth(1).fill(viral)
    numbers.nth(2).fill(bond)
    page.get_by_role("button", name="Fund and create campaign").click()
    tx = wait_tx_hash(page, "Create campaign", 900000)
    mark(step, role, "create_campaign", tx, "SUCCESS", f"custom inputs, base {base} viral {viral} bond {bond}")
    return tx


def find_card(page: Page, title: str):
    page.locator("#campaigns").scroll_into_view_if_needed()
    page.wait_for_timeout(1500)
    # Only refresh when the card is not already visible, to conserve the studionet
    # request quota (500 per hour).
    card = page.locator("article").filter(has_text=title).first
    if card.count() > 0:
        return card
    for _ in range(3):
        page.get_by_role("button", name="refresh").first.click()
        page.wait_for_timeout(5000)
        card = page.locator("article").filter(has_text=title).first
        if card.count() > 0:
            card.wait_for(timeout=30000)
            return card
    raise RuntimeError(f"campaign card for {title!r} never appeared")


def submit_deliverable(page: Page, step: str, role: str, title: str, proof: str) -> str:
    card = find_card(page, title)
    card.locator("input[aria-label='Proof URL']").fill(proof)
    card.get_by_role("button", name="Accept and submit deliverable").click()
    tx = wait_tx_hash(page, "Deliverable submission", 900000)
    mark(step, role, "accept_and_submit_deliverable", tx, "SUCCESS", "custom proof URL, bond locked")
    return tx


def curate(page: Page, step: str, role: str, title: str, stake: str) -> str:
    card = find_card(page, title)
    card.locator("input[aria-label='Curation stake in CPT']").fill(stake)
    card.get_by_role("button", name="Curate").click()
    tx = wait_tx_hash(page, "Curation stake", 900000)
    mark(step, role, "curate_deliverable", tx, "SUCCESS", f"{stake} CPT staked")
    return tx


def main() -> int:
    base_url = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_URL
    record["base_url"] = base_url
    skip_b = "--skip-b" in sys.argv
    skip_a = "--skip-a" in sys.argv
    load_dotenv(ROOT / ".env")

    roles = {
        "brand": create_account(),
        "creator": create_account(),
        "curator": create_account(),
        "keeper": create_account(),
        "brand_b": create_account(),
        "creator_b": create_account(),
        "curator_b": create_account(),
    }
    keys = {name: normalize_key(acct) for name, acct in roles.items()}
    addresses = {name: acct.address for name, acct in roles.items()}
    KEYS_PATH.parent.mkdir(parents=True, exist_ok=True)
    KEYS_PATH.write_text(json.dumps({"keys": keys, "addresses": addresses}, indent=2), encoding="utf-8")
    log("roles", " ".join(f"{n}={a}" for n, a in addresses.items()))

    stamp = time.strftime("%m%d%H%M%S")
    live_title = f"UI flow live {stamp}"
    dead_title = f"UI flow dead {stamp}"
    spec = (
        "Publish one short vertical video that shows the product, keeps the sponsor tag on screen, "
        "and reports organic reach in the description."
    )

    exit_code = 0
    with sync_playwright() as pw:
        # ---- path c: create, submit, then show settlement is disabled pre audit ----
        try:
            if skip_a:
                raise RuntimeError("path a skipped")
            brand = open_wallet(pw, base_url, "brand", keys["brand"])
            connect_burner(brand)
            claim_faucet(brand, "faucet:brand", "brand")
            create_campaign(brand, "create:a", "brand", live_title, "#UiFlowLive", spec, "300", "100", "50")
            shoot(brand, "flow-console-create")

            creator = open_wallet(pw, base_url, "creator", keys["creator"])
            connect_burner(creator)
            claim_faucet(creator, "faucet:creator", "creator")
            submit_deliverable(creator, "submit:a", "creator", live_title, READABLE_PROOF)

            curator = open_wallet(pw, base_url, "curator", keys["curator"])
            connect_burner(curator)
            claim_faucet(curator, "faucet:curator", "curator")
            curate(curator, "curate:a", "curator", live_title, "25")

            # Path c evidence: still SUBMITTED, settlement cannot be claimed.
            submitted_card = find_card(creator, live_title)
            claim_buttons = submitted_card.locator("button", has_text="Claim settlement")
            c_reason = submitted_card.locator("text=/No settlement is possible until the consensus audit/").count()
            record["statuses"]["claim_disabled_pre_audit"] = {
                "claim_button_present": claim_buttons.count() > 0,
                "claim_button_enabled": (claim_buttons.count() > 0 and claim_buttons.first.is_enabled()),
                "reason_shown": c_reason > 0,
            }
            shoot(creator, "flow-claim-disabled")
            log("pathc", f"claim disabled pre audit: button_present={record['statuses']['claim_disabled_pre_audit']}")

            # ---- path a: verify through consensus, wait dispute window, claim ----
            keeper = open_wallet(pw, base_url, "keeper", keys["keeper"])
            connect_burner(keeper)
            kcard = find_card(keeper, live_title)
            kcard.get_by_role("button", name="Verify deliverable").click()
            try:
                vhash = wait_tx_hash(keeper, "Verify deliverable", 4200000)  # 70 min ceiling
                mark("verify:a", "keeper", "verify_campaign_deliverable_live", vhash, "SUCCESS", "live consensus audit")
                shoot(keeper, "flow-verify-finalized")
                # The dispute window is 90s after the audit. Stay on the same page
                # and refresh the board only occasionally to conserve the request
                # quota, then claim once it unlocks.
                keeper.wait_for_timeout(105000)
                claimbtn = None
                for _ in range(6):
                    keeper.locator("#campaigns").scroll_into_view_if_needed()
                    keeper.get_by_role("button", name="refresh").first.click()
                    keeper.wait_for_timeout(8000)
                    claimcard = find_card(keeper, live_title)
                    btns = claimcard.locator("button", has_text="Claim settlement")
                    if btns.count() > 0 and btns.first.is_enabled():
                        claimbtn = btns.first
                        break
                if claimbtn is None:
                    raise PWTimeout("Claim settlement never unlocked after the audit")
                claimbtn.click()
                chash = wait_tx_hash(keeper, "Settlement claim", 900000)
                mark("claim:settled", "keeper", "claim_campaign_settlement", chash, "SUCCESS", "creator + brand paid out")
                shoot(keeper, "flow-settled")
            except PWTimeout:
                record["statuses"]["verify"] = "timed_out"
                log("patha", "verify/settle did not finalize within the ceiling, recorded honestly")

            # ---- curator pulls the stake back from the UI after settlement ----
            try:
                find_card(curator, live_title).get_by_role("button", name="Claim curation refund").click()
                rhash = wait_tx_hash(curator, "Curation refund", 900000)
                mark("refund:settled", "curator", "claim_curation_refund", rhash, "SUCCESS", "curator pulls stake after settlement")
            except Exception as exc:  # refund only exists once settled
                log("patha", f"post settle refund skipped: {str(exc)[:80]}")
        except Exception as exc:
            exit_code = 3
            record["statuses"]["path_a"] = f"error: {str(exc)[:120]}"
            log("patha", f"stopped: {str(exc)[:120]}")

        # ---- path b: neutral recovery from dead evidence ----
        if not skip_b:
            try:
                brand_b = open_wallet(pw, base_url, "brand_b", keys["brand_b"])
                connect_burner(brand_b)
                claim_faucet(brand_b, "faucet:brand_b", "brand_b")
                create_campaign(brand_b, "create:b", "brand_b", dead_title, "#UiFlowDead", spec, "200", "100", "50")

                creator_b = open_wallet(pw, base_url, "creator_b", keys["creator_b"])
                connect_burner(creator_b)
                claim_faucet(creator_b, "faucet:creator_b", "creator_b")
                submit_deliverable(creator_b, "submit:b", "creator_b", dead_title, DEAD_PROOF)

                curator_b = open_wallet(pw, base_url, "curator_b", keys["curator_b"])
                connect_burner(curator_b)
                claim_faucet(curator_b, "faucet:curator_b", "curator_b")
                curate(curator_b, "curate:b", "curator_b", dead_title, "30")

                # wait the 300s unreachable floor, then recover from the UI using an
                # already open wallet (recovery is permissionless, brand_b is funded)
                recoverer = brand_b
                rcard = find_card(recoverer, dead_title)
                recover = rcard.get_by_role("button", name="Recover unreachable")
                deadline = time.time() + 480
                while time.time() < deadline and recover.is_disabled():
                    recoverer.wait_for_timeout(10000)
                    rcard = find_card(recoverer, dead_title)
                    recover = rcard.get_by_role("button", name="Recover unreachable")
                recover.click()
                rec_hash = wait_tx_hash(recoverer, "Recover unreachable evidence", 4200000)
                mark("recover:b", "keeper", "recover_unreachable_deliverable", rec_hash, "SUCCESS", "validators agreed proof unreachable, neutral recovery")
                shoot(recoverer, "flow-recovered")

                find_card(curator_b, dead_title).get_by_role("button", name="Claim curation refund").click()
                refund_b = wait_tx_hash(curator_b, "Curation refund", 900000)
                mark("refund:recovered", "curator_b", "claim_curation_refund", refund_b, "SUCCESS", "curator pulls stake after recovery")
            except PWTimeout:
                record["statuses"]["path_b"] = "timed_out"
                log("pathb", "recovery path did not finalize within the ceiling, recorded honestly")
            except Exception as exc:
                record["statuses"]["path_b"] = f"error: {str(exc)[:120]}"
                log("pathb", f"error: {str(exc)[:120]}")

        # Close every session inside the Playwright block so each webm is flushed and
        # page.video.path() resolves, then record the sessions in creation order.
        for ctx in contexts:
            try:
                ctx.close()
            except Exception:
                pass
        videos = []
        for role, video in video_refs:
            try:
                videos.append({"role": role, "path": str(video.path())})
            except Exception as exc:  # a missing webm must never fail the whole run
                videos.append({"role": role, "path": "", "error": str(exc)[:80]})
        record["videos"] = videos
        save_evidence(base_url)

    # ---- independent contract reads, never inferred from the page ----
    try:
        read_acct = create_account()
        rc = create_client(chain=studionet, account=read_acct)

        def read(function_name: str, args=None):
            return rc.read_contract(address=CONTRACT_ADDRESS, function_name=function_name, args=args or [])

        count = int(read("get_campaign_count"))
        dash = read("get_dashboard", [12])
        by_title = {c["title"]: c for c in dash.get("campaigns", [])}
        live = by_title.get(live_title)
        dead = by_title.get(dead_title)
        balances = {name: int(read("get_token_balance", [addr])) for name, addr in addresses.items()}
        record["final"] = {
            "campaign_count": count,
            "live_state": live.get("state") if live else None,
            "live_band": live.get("campaign_band") if live else None,
            "live_creator_payout_cpt": (int(live["creator_payout_atto"]) // CPT) if live else None,
            "dead_state": dead.get("state") if dead else None,
            "dead_recovered": bool(dead.get("recovered")) if dead else None,
            "invariants": read("check_vault_invariants"),
            "balances_cpt": {name: val // CPT for name, val in balances.items()},
        }
        log("reads", json.dumps(record["final"], default=str)[:400])
    except Exception as exc:
        record["final"] = {"error": str(exc)[:200]}
        log("reads", f"final contract reads failed: {str(exc)[:160]}")

    save_evidence(base_url)
    print("wrote", EVIDENCE_PATH, flush=True)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
