#!/usr/bin/env python3

from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
CHINESE_UI_LITERAL = re.compile(r"[\u3400-\u9fff，。、；：！？（）【】《》“”‘’]")
FORBIDDEN_RUNTIME_TRANSLATOR = (
    "MutationObserver",
    "createTreeWalker",
    "createRuntimeTranslator",
    "document.body",
)
FORBIDDEN_ENGLISH_CATALOG_FRAGMENTS = (
    ",common",
    "jump over",
    "not passable",
    "seal up",
    "indivual",
    "high-intensity interview group",
    "return items",
    "candidate placements",
    "schedule a preview",
    "not allowed to pass by default",
    "locked for citations",
    "log in to the background",
    "maximum views per time in a row",
    "modify review reminder",
    "candidate side",
    "inside information",
    "strip;",
    "candidate access link to join the team",
    "citations",
    "no matching items",
    "withdraw authority",
    "commit history",
    "commit version",
    "time granularity",
    "audit principal",
    "operations manager",
    "visit link",
    "interview team:",
    "illustrate:",
    "modification application",
    "opening hours",
    "arrangement number",
    "submission number",
    "backstage view",
    "carbon copy",
    "not filled in",
    "pending applications",
    "operator type",
    "optional interview times",
)
RAW_ACTION_STATE_PATTERNS = (
    re.compile(r"\{\s*state\.(?:message|error)\s*\}"),
    re.compile(r"\berror=\{errors\.[A-Za-z0-9_]+\}"),
)
CLIENT_LOCALE_HOOK = re.compile(r"\buseLocale\s*\(")
USE_CLIENT_DIRECTIVE = re.compile(r'^\s*["\']use client["\'];', re.MULTILINE)

failures: list[str] = []

for file in sorted(SRC.rglob("*.tsx")):
    source = file.read_text(encoding="utf-8")
    if CLIENT_LOCALE_HOOK.search(source) and not USE_CLIENT_DIRECTIVE.match(source):
        failures.append(
            f"{file.relative_to(ROOT)}: useLocale requires a top-level 'use client' directive"
        )
    for line_number, line in enumerate(source.splitlines(), start=1):
        if CHINESE_UI_LITERAL.search(line):
            failures.append(
                f"{file.relative_to(ROOT)}:{line_number}: Chinese UI text or punctuation must use a MessageKey"
            )
    for pattern in RAW_ACTION_STATE_PATTERNS:
        if pattern.search(source):
            failures.append(
                f"{file.relative_to(ROOT)}: action-state messages must use translateKnownSource or a MessageKey"
            )

provider = (SRC / "i18n/locale-provider.tsx").read_text(encoding="utf-8")
for token in FORBIDDEN_RUNTIME_TRANSLATOR:
    if token in provider:
        failures.append(
            f"src/i18n/locale-provider.tsx: forbidden whole-DOM translator token: {token}"
        )

english_catalog_path = SRC / "i18n/messages/en/legacy.json"
english_catalog = json.loads(english_catalog_path.read_text(encoding="utf-8"))
for key, value in english_catalog.items():
    normalized_value = value.lower()
    for fragment in FORBIDDEN_ENGLISH_CATALOG_FRAGMENTS:
        if fragment in normalized_value:
            failures.append(
                f"src/i18n/messages/en/legacy.json: unreviewed translation in {key}: {fragment}"
            )

if failures:
    print("\n".join(failures), file=sys.stderr)
    sys.exit(1)

print(
    "explicit UI i18n boundary passed: no TSX literals, raw action-state messages, "
    "server-invoked locale hooks, or whole-DOM translator"
)
