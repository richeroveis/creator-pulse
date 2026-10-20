"""Git provenance helpers shared by the deployment and verification scripts.

Recording HEAD in the evidence is not enough: if the working tree is dirty, HEAD
does not contain the bytes that were deployed. These helpers find the commit whose
contract blob is byte identical to the deployed file, so every provenance claim in
the README and the evidence file can be re-checked with plain git commands.
"""

from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
CONTRACT_RELATIVE = "contracts/creator_pulse.py"


def git_output(*arguments: str) -> str:
    try:
        return subprocess.run(
            ["git", *arguments], cwd=ROOT, capture_output=True, text=True, check=True
        ).stdout.strip()
    except subprocess.CalledProcessError:
        return ""


def git_blob(revision_path: str) -> str:
    """Return file content at a revision with the trailing newline preserved.

    Stripping would change the digest and make a committed source look different
    from the deployed file, so this path never trims whitespace.
    """
    try:
        return subprocess.run(
            ["git", "show", revision_path], cwd=ROOT, capture_output=True, text=True, check=True
        ).stdout
    except subprocess.CalledProcessError:
        return ""


def commit_for_source(file_sha256: str) -> str:
    """Newest commit on HEAD whose copy of the contract matches the digest."""
    for commit in git_output("log", "--format=%H", "--", CONTRACT_RELATIVE).split():
        blob = git_blob(f"{commit}:{CONTRACT_RELATIVE}")
        if hashlib.sha256(blob.encode("utf-8")).hexdigest() == file_sha256:
            return commit
    return ""


def resolve_provenance(file_sha256: str) -> dict[str, Any]:
    commit = commit_for_source(file_sha256)
    tags = git_output("tag", "--points-at", commit) if commit else ""
    return {
        "commit": commit or "UNCOMMITTED_SOURCE",
        "commit_tag": (tags.splitlines() or [""])[0],
        "head_at_evidence": git_output("rev-parse", "HEAD"),
        "deployed_file_sha256": file_sha256,
        "contract_committed": bool(commit),
    }
