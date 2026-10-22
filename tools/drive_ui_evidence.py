"""Drive the real CreatorPulse frontend against studionet with Playwright.

This proves the DApp is not demo only: it fills the real forms, sends real
transactions from burner wallets, waits for each to reach FINALIZED, and captures
screenshots of the create, submit, curate, verify, claim and recovery UI. It
targets a local preview of the freshly built bundle so the page under test carries
the current contract address and the current UI. Each actor uses its own browser
context so the activity log of one page never races another.

Run: python tools/drive_ui_evidence.py [base_url]
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright, Page, TimeoutError as PWTimeout

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "artifacts" / "shots"
EVIDENCE_PATH = ROOT / "artifacts" / "ui_evidence.json"
DEFAULT_URL = "http://127.0.0.1:4181/creator-pulse/"
CHROMIUM = os.environ.get(
    "CREATORPULSE_CHROMIUM",
    r"C:\Users\oveis\AppData\Local\ms-playwright\chromium-1148\chrome-win\chrome.exe",
)
READABLE_PROOF = "https://richeroveis.github.io/creator-pulse/proofs/campaign-1.html"
DEAD_PROOF = "https://richeroveis.github.io/creator-pulse/proofs/dead.html"

# The hook uses these human labels for each lifecycle action, and the Activity panel
# writes "<label> finalized" once the receipt reaches FINALIZED.
record: dict = {"steps": [], "screenshots": [], "base_url": DEFAULT_URL, "error": ""}
contexts = []


def log(name: str, detail: str = "") -> None:
    print(f"[ui] {name}: {detail}", flush=True)
    record["steps"].append({"step": name, "detail": detail, "at": int(time.time())})


def shoot(page: Page, name: str) -> None:
    SHOTS.mkdir(parents=True, exist_ok=True)
    path = SHOTS / f"ui-{name}.png"
    page.screenshot(path=str(path), full_page=True)
    record["screenshots"].append(str(path.relative_to(ROOT)))
    log("screenshot", name)


def open_wallet(pw, url: str) -> Page:
    context = pw.chromium.launch_persistent_context(
        user_data_dir=str(ROOT / "artifacts" / f"pw-{int(time.time()*1000000)}"),
        headless=True,
        executable_path=CHROMIUM,
        args=["--no-sandbox"],
        viewport={"width": 1440, "height": 1400},
    )
    contexts.append(context)
    page = context.pages[0] if context.pages else context.new_page()
    page.goto(url, wait_until="domcontentloaded", timeout=90000)
    return page


def connect_burner(page: Page) -> None:
    page.get_by_role("button", name="1-click burner").click()
    page.wait_for_selector("text=/0x[0-9a-fA-F]{4}\\.\\.\\./", timeout=30000)


def claim_faucet(page: Page) -> str:
    page.get_by_role("button", name="Claim 2,000 CPT faucet").click()
    return wait_for_tx(page, "Faucet claim finalized", timeout_ms=240000)


def wait_for_tx(page: Page, marker: str, timeout_ms: int = 900000) -> str:
    entry = page.get_by_text(marker, exact=False).first
    entry.wait_for(timeout=timeout_ms)
    row = entry.locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]")
    anchor = row.locator("a[title]").first
    return anchor.get_attribute("title") if anchor.count() > 0 else ""


def create_campaign(page: Page, title: str, tag: str, spec: str, base: str, viral: str, bond: str) -> str:
    page.locator("#console").scroll_into_view_if_needed()
    page.locator("#console input[type='text'], #console input:not([type])").nth(0).fill(title)
    page.locator("#console input[type='text'], #console input:not([type])").nth(1).fill(tag)
    page.locator("#console textarea").fill(spec)
    numbers = page.locator("#console input[type='number']")
    numbers.nth(0).fill(base)
    numbers.nth(1).fill(viral)
    numbers.nth(2).fill(bond)
    page.get_by_role("button", name="Fund and create campaign").click()
    return wait_for_tx(page, "Create campaign finalized")


def campaign_card(page: Page, title: str):
    page.locator("#campaigns").scroll_into_view_if_needed()
    page.wait_for_timeout(1500)
    card = page.locator("article").filter(has_text=title).first
    card.wait_for(timeout=60000)
    return card


def main() -> int:
    url = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_URL
    record["base_url"] = url
    stamp = time.strftime("%m%d%H%M%S")
    live_title = f"UI live drop {stamp}"
    dead_title = f"UI dead evidence {stamp}"
    spec = (
        "Publish one short vertical video that shows the product, keeps the sponsor tag on screen, "
        "and reports organic reach in the description."
    )
    exit_code = 0
    with sync_playwright() as pw:
        try:
            # 1. Brand creates a funded campaign with custom inputs.
            brand = open_wallet(pw, url)
            connect_burner(brand)
            log("faucet brand", claim_faucet(brand))
            hash_create = create_campaign(brand, live_title, "#UiLive", spec, "300", "100", "50")
            log("create campaign", hash_create)
            shoot(brand, "console-create")

            # 2. Creator submits a real proof URL.
            creator = open_wallet(pw, url)
            connect_burner(creator)
            claim_faucet(creator)
            card = campaign_card(creator, live_title)
            card.locator("input[type='url']").fill(READABLE_PROOF)
            card.get_by_role("button", name="Accept and submit deliverable").click()
            hash_submit = wait_for_tx(creator, "Deliverable submission finalized")
            log("submit deliverable", hash_submit)
            shoot(creator, "submit-finalized")

            # 3. Curator stakes behind the deliverable.
            curator = open_wallet(pw, url)
            connect_burner(curator)
            claim_faucet(curator)
            ccard = campaign_card(curator, live_title)
            ccard.locator("input[type='number']").fill("25")
            ccard.get_by_role("button", name="Curate").click()
            log("curate", wait_for_tx(curator, "Curation stake finalized"))

            # 4. A keeper runs the consensus audit through the Verify button.
            keeper = open_wallet(pw, url)
            connect_burner(keeper)
            kcard = campaign_card(keeper, live_title)
            kcard.get_by_role("button", name="Verify deliverable").click()
            log("verify clicked, awaiting consensus")
            hash_verify = wait_for_tx(keeper, "Verify deliverable finalized", timeout_ms=900000)
            log("verify finalized", hash_verify)
            shoot(keeper, "verify-finalized")

            # 5. Wait out the 90 second dispute window, then claim settlement.
            keeper.wait_for_timeout(95000)
            keeper.reload(wait_until="domcontentloaded")
            keeper.wait_for_timeout(4000)
            claimcard = campaign_card(keeper, live_title)
            claimbtn = claimcard.get_by_role("button", name="Claim settlement")
            deadline = time.time() + 180
            while time.time() < deadline and claimbtn.is_disabled():
                keeper.wait_for_timeout(6000)
                claimcard = campaign_card(keeper, live_title)
                claimbtn = claimcard.get_by_role("button", name="Claim settlement")
            claimbtn.click()
            log("claim settlement", wait_for_tx(keeper, "Settlement claim finalized", timeout_ms=600000))
            shoot(keeper, "settle-finalized")

            # 6. Recovery path: a campaign whose proof page is genuinely dead.
            b2 = open_wallet(pw, url)
            connect_burner(b2)
            claim_faucet(b2)
            create_campaign(b2, dead_title, "#UiDead", spec, "200", "100", "50")
            log("recovery campaign created")

            c2 = open_wallet(pw, url)
            connect_burner(c2)
            claim_faucet(c2)
            dcard = campaign_card(c2, dead_title)
            dcard.locator("input[type='url']").fill(DEAD_PROOF)
            dcard.get_by_role("button", name="Accept and submit deliverable").click()
            wait_for_tx(c2, "Deliverable submission finalized")
            log("dead deliverable submitted")

            rkeeper = open_wallet(pw, url)
            connect_burner(rkeeper)
            rcard = campaign_card(rkeeper, dead_title)
            shoot(rkeeper, "recovery-buttons")
            recover = rcard.get_by_role("button", name="Recover unreachable")
            deadline = time.time() + 420
            while time.time() < deadline and recover.is_disabled():
                rkeeper.wait_for_timeout(10000)
                rcard = campaign_card(rkeeper, dead_title)
                recover = rcard.get_by_role("button", name="Recover unreachable")
            recover.click()
            log("recovery finalized", wait_for_tx(rkeeper, "Recover unreachable evidence finalized", timeout_ms=900000))
            shoot(rkeeper, "recovery-finalized")
        except PWTimeout as exc:
            record["error"] = f"timeout: {str(exc)[:200]}"
            print("TIMEOUT", str(exc)[:200], file=sys.stderr)
            exit_code = 3
    EVIDENCE_PATH.write_text(json.dumps(record, indent=2), encoding="utf-8")
    for ctx in contexts:
        try:
            ctx.close()
        except Exception:
            pass
    print("wrote", EVIDENCE_PATH)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
