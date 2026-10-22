"""Publish frontend/dist to the gh-pages branch without leaking the token.

The token is read from this project's .env and passed to git through an
ephemeral credential helper in the environment, so it never lands in
.git/config, in a remote URL, or in the terminal output.
"""

from __future__ import annotations

import hashlib
import os
import shutil
import stat
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "frontend" / "dist"
STAGE = ROOT / ".pages-build"
REPO = "https://github.com/richeroveis/creator-pulse.git"


def force_rmtree(path: Path) -> None:
    """Remove a directory tree on Windows where git stores read-only pack files.

    shutil.rmtree raises PermissionError on those, so clear the read-only bit on
    every entry before retrying the unlink.
    """

    def clear(func, target, _exc):
        os.chmod(target, stat.S_IWRITE)
        func(target)

    shutil.rmtree(path, onerror=clear)


def read_token() -> str:
    env_file = ROOT / ".env"
    if not env_file.exists():
        raise SystemExit("This project has no .env file, stop and ask the user.")
    for line in env_file.read_text(encoding="utf-8").splitlines():
        if line.startswith("GITHUB_TOKEN="):
            value = line.split("=", 1)[1].strip()
            if value:
                return value
    raise SystemExit("GITHUB_TOKEN is missing from this project's .env")


def run(args: list[str], env: dict[str, str] | None = None, cwd: Path | None = None) -> str:
    proc = subprocess.run(
        args,
        cwd=str(cwd or ROOT),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        sys.stderr.write(proc.stdout)
        sys.stderr.write(proc.stderr)
        raise SystemExit(f"command failed: {args[0]}")
    return proc.stdout.strip()


def main() -> None:
    if not (DIST / "index.html").exists():
        raise SystemExit("frontend/dist is missing, run npm run build first")

    token = read_token()
    helper = '!f() { echo username=x-access-token; echo password=$GH_TOKEN; }; f'
    env = dict(os.environ)
    env["GH_TOKEN"] = token

    if STAGE.exists():
        force_rmtree(STAGE)
    shutil.copytree(DIST, STAGE)
    (STAGE / ".nojekyll").write_text("", encoding="utf-8")

    index_hash = hashlib.sha256((DIST / "index.html").read_bytes()).hexdigest()
    print(f"staging {len(list(STAGE.rglob('*')))} paths, index sha256 {index_hash[:16]}")

    run(["git", "init", "-q", "-b", "gh-pages"], cwd=STAGE)
    run(["git", "add", "-A"], cwd=STAGE)
    run(
        [
            "git",
            "-c",
            "user.name=richeroveis",
            "-c",
            "user.email=richeroveis@users.noreply.github.com",
            "commit",
            "-q",
            "-m",
            "Deploy CreatorPulse frontend to GitHub Pages",
        ],
        cwd=STAGE,
    )
    commit = run(["git", "rev-parse", "--short", "HEAD"], cwd=STAGE)
    run(
        [
            "git",
            "-c",
            f"credential.helper={helper}",
            "push",
            "-f",
            REPO,
            "gh-pages",
        ],
        env=env,
        cwd=STAGE,
    )
    print(f"gh-pages updated at {commit}")


if __name__ == "__main__":
    main()
