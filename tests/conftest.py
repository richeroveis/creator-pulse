"""Shared fixtures for the CreatorPulse direct test suite.

The first block is the Windows file handle workaround: on Windows, pytest
keeps a handle on compiled contract modules, so the unlink performed by the
direct loader raises PermissionError. Retrying after a short sleep and
ignoring a still locked file keeps the suite runnable on every platform.
"""

import json
import os
import time
from datetime import datetime, timezone
from types import SimpleNamespace

if os.name == "nt":  # pragma: no cover - only exercised on Windows
    _original_unlink = os.unlink
    _original_remove = os.remove

    def _safe_unlink(path, *args, **kwargs):
        for attempt in range(10):
            try:
                return _original_unlink(path, *args, **kwargs)
            except PermissionError:
                time.sleep(0.05 * (attempt + 1))
        return None

    def _safe_remove(path, *args, **kwargs):
        for attempt in range(10):
            try:
                return _original_remove(path, *args, **kwargs)
            except PermissionError:
                time.sleep(0.05 * (attempt + 1))
        return None

    os.unlink = _safe_unlink
    os.remove = _safe_remove


import pytest

ATTO = 10 ** 18
CPT = ATTO

CONTRACT_PATH = "contracts/creator_pulse.py"
PROOF_URL = "https://richeroveis.github.io/creator-pulse/proofs/campaign-1.html"

GOOD_SPEC = (
    "Publish one 60 second vertical video that shows the product in use, keeps the "
    "sponsor tag visible on screen for the full runtime, and reports organic reach "
    "and engagement rate in the description."
)

GOOD_PAGE = (
    "NovaGlow creator deliverable report. Disclosure: #NovaGlow is visible on screen "
    "for the full 60 second vertical video. The product is demonstrated three times. "
    "Organic reach is 480000 and the engagement rate is 9.4 percent. Audience "
    "comments are unique accounts and the growth curve is steady."
)

WEAK_PAGE = (
    "NovaGlow creator deliverable report. Disclosure: #NovaGlow appears at second "
    "two. The 60 second vertical video shows the product in use. Organic reach is "
    "120000 and the engagement rate is 3.1 percent."
)

NO_TAG_PAGE = (
    "Budget travel vlog about airport lounges. No sponsor was involved in this upload. "
    "The creator talks about seating and coffee for eight minutes."
)


def good_llm_payload(anchor: int = 100) -> str:
    return json.dumps(
        {
            "quality_anchor": anchor,
            "organic_authenticity": 92,
            "viral_velocity": 88,
            "evidence": "Reach 480000 with 9.4 percent engagement and an on screen tag.",
        }
    )


def weak_llm_payload(anchor: int = 80) -> str:
    return json.dumps(
        {
            "quality_anchor": anchor,
            "organic_authenticity": 71,
            "viral_velocity": 44,
            "evidence": "Reach 120000 with 3.1 percent engagement, spec fully met.",
        }
    )


def mock_audit(direct_vm, page: str, llm_payload: str) -> None:
    direct_vm.mock_web(r".*proofs/.*\.html", {"status": 200, "body": page})
    direct_vm.mock_llm(r"(?s).*independent sponsorship auditor.*", llm_payload)


@pytest.fixture
def pulse(direct_deploy):
    return direct_deploy(CONTRACT_PATH)


@pytest.fixture
def funded(direct_vm, pulse, direct_alice, direct_bob, direct_charlie):
    """Fund three independent signers with the faucet allowance."""
    for account in (direct_alice, direct_bob, direct_charlie):
        direct_vm.sender = account
        pulse.faucet_or_deposit(120000 * CPT)
    return pulse


def epoch_of(iso_text: str) -> int:
    moment = datetime.fromisoformat(iso_text.replace("Z", "+00:00"))
    epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
    delta = moment - epoch
    return delta.days * 86400 + delta.seconds


def set_clock(direct_vm, iso_text: str) -> int:
    """Move the chain clock used by the contract.

    The direct harness patches datetime.now for warp, but gl.message_raw keeps
    the datetime injected at deploy time, and the contract reads the message
    datetime because that is the deterministic clock on a real network. This
    helper keeps both views in sync.
    """
    import genlayer.gl as genlayer_gl

    direct_vm.warp(iso_text)
    genlayer_gl.message_raw["datetime"] = iso_text
    return epoch_of(iso_text)


@pytest.fixture
def clocks(direct_vm):
    """Default chain clock used by every scenario."""
    started = "2026-10-20T12:00:00Z"
    now = set_clock(direct_vm, started)

    class _Clock(SimpleNamespace):
        pass

    clock = _Clock(start_iso=started, now=now, deadline=now + 86400)
    return clock
