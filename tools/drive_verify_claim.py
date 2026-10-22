"""Minimal, quota light UI pass: verify then claim settlement from the real frontend.

The full multi actor lifecycle repeatedly tripped the studionet 500 requests per hour
limit. Campaign 10 is already SUBMITTED and awaiting an audit, so this script only
opens one burner, clicks Verify (verify_campaign_deliverable_live), waits for FINALIZED,
waits out the 90 second dispute window, then clicks Claim settlement, recording the
session to a webm. Each hash is appended to evidence/ui_flow_verification.json (merged,
by step) so scripts/verify_ui_flow.py can re-check them on the explorer.

Run: python tools/drive_verify_claim.py [campaign_id]
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright, Page

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "tools"))

from genlayer_py import create_account  # noqa: E402

DEFAULT_URL = "http://127.0.0.1:4181/creator-pulse/"
CHROMIUM = os.environ.get(
    "CREATORPULSE_CHROMIUM",
    r"C:\Users\oveis\AppData\Local\ms-playwright\chromium-1148\chrome-win\chrome.exe",
)
BURNER_LS_KEY = "creatorpulse.burner.v1"
SHOTS = ROOT / "artifacts" / "shots_flow"
VIDEOS = ROOT / "artifacts" / "video"
EVIDENCE_PATH = ROOT / "evidence" / "ui_flow_verification.json"
NONCE = time.strftime("%H%M%S")


def normalize_key(account) -> str:
    raw = account.key.hex()
    raw = raw[2:] if raw.startswith("0x") else raw
    return "0x" + raw.zfill(64)


def load_evidence() -> dict:
    if EVIDENCE_PATH.exists():
        return json.loads(EVIDENCE_PATH.read_text(encoding="utf-8"))
    return {"contract_address": "0x6768EAdcFBF13aDEE460Bfd228f6653f3e013016", "transactions": [],
            "statuses": {}, "videos": [], "screenshots": [],
            "network": {"name": "studionet", "chain_id": 61999}, "base_url": DEFAULT_URL}


def save(evidence: dict) -> None:
    evidence["generated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    EVIDENCE_PATH.write_text(json.dumps(evidence, indent=2), encoding="utf-8")


def mark(evidence: dict, step: str, function: str, tx: str, note: str) -> None:
    entry = {"step": step, "role": "keeper", "path": step.split(":", 1)[0], "function": function,
             "tx": tx, "expected": "SUCCESS", "execution": "SUCCESS", "note": note}
    by_step = {t["step"]: t for t in evidence["transactions"]}
    by_step[step] = entry
    evidence["transactions"] = list(by_step.values())
    save(evidence)


def wait_tx_hash(page: Page, label: str, timeout_ms: int) -> str:
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
                raise RuntimeError(f"{label} did not finalize ({marker})")
        page.wait_for_timeout(3000)
    raise RuntimeError(f"{label} never resolved")


def find_card(page: Page, cid: int):
    page.locator("#campaigns").scroll_into_view_if_needed()
    page.wait_for_timeout(2500)
    card = page.locator("article").filter(has_text=f"#{cid}").first
    if card.count() > 0:
        return card
    for _ in range(5):
        page.get_by_role("button", name="refresh").first.click()
        page.wait_for_timeout(6000)
        card = page.locator("article").filter(has_text=f"#{cid}").first
        if card.count() > 0:
            return card
    raise RuntimeError(f"card {cid} never appeared")


def main() -> int:
    cid = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    evidence = load_evidence()
    acct = create_account()
    key = normalize_key(acct)
    ctx_objs = []
    vids = []
    exit_code = 0
    with sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(
            user_data_dir=str(ROOT / "artifacts" / f"pwvc-{NONCE}"),
            headless=True, executable_path=CHROMIUM, args=["--no-sandbox"],
            viewport={"width": 1440, "height": 1500},
            record_video_dir=str(VIDEOS), record_video_size={"width": 1280, "height": 720},
        )
        context.add_init_script(
            f"try {{ window.localStorage.setItem({json.dumps(BURNER_LS_KEY)}, {json.dumps(key)}); }} catch (e) {{}}"
        )
        ctx_objs.append(context)
        page = context.pages[0] if context.pages else context.new_page()
        if page.video is not None:
            vids.append(page.video)
        page.goto(DEFAULT_URL, wait_until="domcontentloaded", timeout=90000)
        try:
            page.get_by_role("button", name="1-click burner").click()
            page.wait_for_selector("text=/0x[0-9a-fA-F]{4}\\.\\.\\./", timeout=40000)
            card = find_card(page, cid)
            card.get_by_role("button", name="Verify deliverable").click()
            vhash = wait_tx_hash(page, "Verify deliverable", 2400000)  # 40 min
            mark(evidence, "verify:a", "verify_campaign_deliverable_live", vhash, "live consensus audit from the UI")
            SHOTS.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(SHOTS / "flow-verify-finalized.png"), full_page=True)
            evidence.setdefault("screenshots", []).append("artifacts/shots_flow/flow-verify-finalized.png")
            save(evidence)

            page.wait_for_timeout(105000)  # 90s dispute window plus margin
            claimbtn = None
            for _ in range(6):
                page.get_by_role("button", name="refresh").first.click()
                page.wait_for_timeout(8000)
                card = find_card(page, cid)
                btns = card.locator("button", has_text="Claim settlement")
                if btns.count() > 0 and btns.first.is_enabled():
                    claimbtn = btns.first
                    break
            if claimbtn is None:
                raise RuntimeError("Claim settlement never unlocked")
            claimbtn.click()
            chash = wait_tx_hash(page, "Settlement claim", 900000)
            mark(evidence, "claim:settled", "claim_campaign_settlement", chash, "creator + brand paid out from the UI")
            page.screenshot(path=str(SHOTS / "flow-settled.png"), full_page=True)
            evidence["screenshots"].append("artifacts/shots_flow/flow-settled.png")
            save(evidence)
        except Exception as exc:
            exit_code = 3
            evidence["statuses"]["verify_claim"] = f"error: {str(exc)[:160]}"
            save(evidence)
            print("FAILED:", str(exc)[:200], file=sys.stderr)
        for ctx in ctx_objs:
            try:
                ctx.close()
            except Exception:
                pass
        paths = []
        for v in vids:
            try:
                paths.append({"role": "keeper", "path": str(v.path())})
            except Exception:
                pass
        existing = {x.get("path") for x in evidence.get("videos", [])}
        for p in paths:
            if p["path"] not in existing:
                evidence.setdefault("videos", []).append(p)
        save(evidence)
    print("wrote", EVIDENCE_PATH)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
