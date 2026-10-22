"""Fail if any contract public write method has no binding in the frontend source.

The DApp is only honest about being "real" if every state changing method on the
deployed contract can actually be reached from the UI. This script parses the
contract for @gl.public.write methods and then greps the frontend source for a
reference to each one. A missing binding exits non zero so CI catches drift.
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTRACT_PATH = ROOT / "contracts" / "creator_pulse.py"
FRONTEND_SRC = ROOT / "frontend" / "src"


def public_write_methods(contract_path: Path) -> list[str]:
    tree = ast.parse(contract_path.read_text(encoding="utf-8"))
    names: list[str] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.FunctionDef):
            continue
        decorators = [ast.unparse(dec) for dec in node.decorator_list]
        if any(dec.endswith("gl.public.write") for dec in decorators):
            names.append(node.name)
    return sorted(set(names))


def frontend_text(source_dir: Path) -> str:
    chunks: list[str] = []
    for path in sorted(source_dir.rglob("*")):
        if path.suffix in {".ts", ".tsx"} and path.is_file():
            chunks.append(path.read_text(encoding="utf-8"))
    return "\n".join(chunks)


def main() -> int:
    if not CONTRACT_PATH.exists():
        print(f"contract not found: {CONTRACT_PATH}", file=sys.stderr)
        return 2
    if not FRONTEND_SRC.exists():
        print(f"frontend source not found: {FRONTEND_SRC}", file=sys.stderr)
        return 2

    methods = public_write_methods(CONTRACT_PATH)
    if not methods:
        print("no public write methods discovered in the contract", file=sys.stderr)
        return 2

    source = frontend_text(FRONTEND_SRC)
    missing = [name for name in methods if name not in source]

    print(f"contract public write methods: {len(methods)}")
    for name in methods:
        marker = "bound" if name not in missing else "MISSING"
        print(f"  [{marker}] {name}")

    if missing:
        print(
            f"\n{len(missing)} write method(s) have no binding in the frontend source: "
            + ", ".join(missing),
            file=sys.stderr,
        )
        return 1

    print(f"\nall {len(methods)} write methods are reachable from the frontend")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
