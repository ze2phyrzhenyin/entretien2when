#!/usr/bin/env python3
"""Check JSON message catalogs for key, type, and ICU placeholder parity."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

PLACEHOLDER_RE = re.compile(r"\{([A-Za-z_][A-Za-z0-9_.-]*)\s*(?:,|\})")
TAG_RE = re.compile(r"</?([A-Za-z][A-Za-z0-9_-]*)>")


def load_catalog(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ValueError(f"catalog does not exist: {path}") from error
    except json.JSONDecodeError as error:
        raise ValueError(f"invalid JSON in {path}: {error}") from error


def flatten(value: Any, prefix: str = "") -> dict[str, Any]:
    if isinstance(value, dict):
        result: dict[str, Any] = {}
        for key, child in value.items():
            if not isinstance(key, str) or not key:
                raise ValueError(f"invalid message key under {prefix or '<root>'}")
            child_prefix = f"{prefix}.{key}" if prefix else key
            result.update(flatten(child, child_prefix))
        return result
    return {prefix: value}


def signature(message: str) -> tuple[frozenset[str], frozenset[str]]:
    return frozenset(PLACEHOLDER_RE.findall(message)), frozenset(TAG_RE.findall(message))


def check(source_path: Path, target_path: Path) -> list[str]:
    source = flatten(load_catalog(source_path))
    target = flatten(load_catalog(target_path))
    errors: list[str] = []

    for key in sorted(source.keys() - target.keys()):
        errors.append(f"missing target key: {key}")
    for key in sorted(target.keys() - source.keys()):
        errors.append(f"orphan target key: {key}")

    for key in sorted(source.keys() & target.keys()):
        source_value = source[key]
        target_value = target[key]
        if not isinstance(source_value, str) or not isinstance(target_value, str):
            errors.append(
                f"non-string message at {key}: "
                f"{type(source_value).__name__}/{type(target_value).__name__}"
            )
            continue
        if signature(source_value) != signature(target_value):
            errors.append(
                f"placeholder/tag mismatch at {key}: "
                f"source={signature(source_value)} target={signature(target_value)}"
            )
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="source-locale JSON catalog")
    parser.add_argument("target", type=Path, help="target-locale JSON catalog")
    args = parser.parse_args()

    try:
        errors = check(args.source, args.target)
    except ValueError as error:
        print(f"catalog check failed: {error}", file=sys.stderr)
        return 2

    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        print(f"catalog parity failed with {len(errors)} error(s)", file=sys.stderr)
        return 1

    source_count = len(flatten(load_catalog(args.source)))
    print(f"catalog parity passed: {source_count} message(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
