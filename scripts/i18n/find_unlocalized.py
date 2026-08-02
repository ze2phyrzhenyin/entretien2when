#!/usr/bin/env python3
"""Find source-language literals in selected text source files."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

DEFAULT_EXTENSIONS = ".ts,.tsx,.js,.jsx,.html,.cs,.py"
DEFAULT_EXCLUDES = (
    ".git,node_modules,.next,dist,build,coverage,test-results,playwright-report"
)


def iter_files(roots: list[Path], extensions: set[str], excludes: set[str]):
    for root in roots:
        candidates = [root] if root.is_file() else root.rglob("*")
        for path in candidates:
            if not path.is_file() or path.suffix not in extensions:
                continue
            if any(part in excludes for part in path.parts):
                continue
            yield path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("roots", nargs="+", type=Path)
    parser.add_argument(
        "--pattern",
        default=r"[\u3400-\u9fff]",
        help="Python regular expression for source-language text",
    )
    parser.add_argument("--extensions", default=DEFAULT_EXTENSIONS)
    parser.add_argument("--exclude", default=DEFAULT_EXCLUDES)
    parser.add_argument(
        "--allow-file",
        type=Path,
        help="optional UTF-8 file of regexes; matching output lines are allowed",
    )
    args = parser.parse_args()

    try:
        pattern = re.compile(args.pattern)
        allow_patterns = []
        if args.allow_file:
            for raw in args.allow_file.read_text(encoding="utf-8").splitlines():
                value = raw.strip()
                if value and not value.startswith("#"):
                    allow_patterns.append(re.compile(value))
    except (re.error, OSError) as error:
        print(f"literal audit configuration failed: {error}", file=sys.stderr)
        return 2

    extensions = {value.strip() for value in args.extensions.split(",") if value.strip()}
    excludes = {value.strip() for value in args.exclude.split(",") if value.strip()}
    findings: list[str] = []

    for path in sorted(set(iter_files(args.roots, extensions, excludes))):
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except (OSError, UnicodeDecodeError):
            continue
        for number, line in enumerate(lines, start=1):
            if not pattern.search(line):
                continue
            rendered = f"{path}:{number}:{line.strip()}"
            if any(allowed.search(rendered) for allowed in allow_patterns):
                continue
            findings.append(rendered)

    for finding in findings:
        print(finding)
    print(f"unlocalized literal audit: {len(findings)} finding(s)")
    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
