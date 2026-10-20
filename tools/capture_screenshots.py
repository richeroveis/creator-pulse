"""Capture live screenshots of the deployed CreatorPulse app with Playwright.

Uses the system Chrome channel, waits for the studionet dashboard, checks the
simulator against the on-chain helper, and writes PNGs into artifacts/shots.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "artifacts" / "shots"
URL = "https://richeroveis.github.io/creator-pulse/"


def main() -> None:
    SHOTS.mkdir(parents=True, exist_ok=True)
    console: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome", headless=True, args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": 1440, "height": 980}, device_scale_factor=1)
        page.on("console", lambda message: console.append(f"{message.type}: {message.text}"))
        page.on("pageerror", lambda error: console.append(f"pageerror: {error}"))
        page.goto(URL, wait_until="networkidle", timeout=60000)
        page.wait_for_selector("text=NovaGlow winter ritual launch", timeout=60000)
        page.wait_for_timeout(2500)

        page.screenshot(path=str(SHOTS / "home.png"))
        print("home.png")

        page.locator("#simulator").scroll_into_view_if_needed()
        page.wait_for_timeout(600)
        page.screenshot(path=str(SHOTS / "simulator.png"))
        print("simulator.png")

        verify = page.get_by_role("button", name="Verify against chain")
        verify.click()
        page.wait_for_timeout(9000)
        result = page.locator("text=on-chain helper agrees").first
        if result.count() == 0:
            drift = page.locator("text=drift detected").first
            if drift.count() > 0:
                print("SIMULATOR DRIFT:", drift.inner_text())
            else:
                print("SIMULATOR: no result text found")
        else:
            print("SIMULATOR OK:", result.inner_text())
        page.screenshot(path=str(SHOTS / "simulator_verified.png"))

        page.locator("#campaigns").scroll_into_view_if_needed()
        page.wait_for_timeout(600)
        page.screenshot(path=str(SHOTS / "campaigns.png"))
        print("campaigns.png")

        page.locator("#feed").scroll_into_view_if_needed()
        page.wait_for_timeout(600)
        page.screenshot(path=str(SHOTS / "feed.png"))
        print("feed.png")

        page.locator("#guardlab").scroll_into_view_if_needed()
        page.wait_for_timeout(600)
        page.screenshot(path=str(SHOTS / "guardlab.png"))
        print("guardlab.png")

        inspect = page.get_by_title("Open consensus inspector").first
        if inspect.count() > 0:
            inspect.click()
            page.wait_for_timeout(900)
            page.screenshot(path=str(SHOTS / "inspector.png"))
            print("inspector.png")

        page.locator("#campaigns").scroll_into_view_if_needed()
        page.wait_for_timeout(400)
        page.screenshot(path=str(SHOTS / "full.png"), full_page=True)
        print("full.png")

        print("console:", json.dumps(console[:10]))
        browser.close()

    if not (SHOTS / "home.png").exists():
        sys.exit(1)


if __name__ == "__main__":
    main()
