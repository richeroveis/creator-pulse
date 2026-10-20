"""Seed the GenLayer direct test runner tarball into the local cache.

The direct harness downloads a genvm release tarball on first use. Asset naming
changed between releases: v0.2.x published genvm-universal.tar.xz while v0.3.x
publishes the same bytes as genvm-runners-all.tar.xz. This script tries both
names, verifies the digest against the pinned value, and stores the file under
the name the harness expects so pytest never touches the network.

The pinned runner hash is the one declared on line 1 of the contract, and the
pinned tarball digest is what the developer machine used to produce the
deployment evidence. A digest mismatch fails the run instead of silently
testing against different bytecode.
"""

from __future__ import annotations

import hashlib
import os
import sys
import tarfile
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

GENVM_VERSION = os.environ.get("GENVM_VERSION", "v0.3.0-rc7")
TARBALL_SHA256 = "e218a1854214681560351051f76fe2b878545cf3409455ef372d57014a88ca67"
RUNNER_HASH = "1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6"
ASSET_CANDIDATES = ("genvm-universal.tar.xz", "genvm-runners-all.tar.xz")
REPO = "genlayerlabs/genvm"

CACHE_DIR = Path.home() / ".cache" / "gltest-direct"
TARGET = CACHE_DIR / f"genvm-universal-{GENVM_VERSION}.tar.xz"
RUNNER_MEMBER = (
    f"runners/py-genlayer/{RUNNER_HASH[:2]}/{RUNNER_HASH[2:]}.tar"
)


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, dest: Path) -> bool:
    request = urllib.request.Request(url, headers={"User-Agent": "creator-pulse-ci"})
    try:
        with urllib.request.urlopen(request, timeout=600) as response:
            with dest.open("wb") as handle:
                for chunk in iter(lambda: response.read(1024 * 1024), b""):
                    handle.write(chunk)
        return True
    except urllib.error.HTTPError as error:
        print(f"  {url} -> HTTP {error.code}")
        return False


def main() -> int:
    if TARGET.exists():
        digest = sha256_of(TARGET)
        if digest == TARBALL_SHA256:
            print(f"cache hit {TARGET}")
            return 0
        print(f"cached tarball digest mismatch, re-downloading: {digest}")
        TARGET.unlink()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    for asset in ASSET_CANDIDATES:
        url = f"https://github.com/{REPO}/releases/download/{GENVM_VERSION}/{asset}"
        print(f"downloading {url}")
        with tempfile.NamedTemporaryFile(dir=CACHE_DIR, delete=False) as tmp:
            tmp_path = Path(tmp.name)
        try:
            if not download(url, tmp_path):
                tmp_path.unlink(missing_ok=True)
                continue
            digest = sha256_of(tmp_path)
            if digest != TARBALL_SHA256:
                print(f"digest mismatch for {asset}: {digest}", file=sys.stderr)
                tmp_path.unlink(missing_ok=True)
                return 1
            tmp_path.replace(TARGET)
            print(f"verified {TARGET} sha256 {digest[:16]}")
            break
        finally:
            tmp_path.unlink(missing_ok=True)
    else:
        print("no genvm release asset matched the pinned digest", file=sys.stderr)
        return 1

    with tarfile.open(TARGET, "r:xz") as outer:
        names = {member.name for member in outer.getmembers()}
    if RUNNER_MEMBER not in names:
        print(f"pinned runner {RUNNER_HASH} is missing from the tarball", file=sys.stderr)
        return 1
    print(f"pinned runner present: {RUNNER_HASH[:12]}...")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
