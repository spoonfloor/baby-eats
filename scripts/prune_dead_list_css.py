#!/usr/bin/env python3
"""
Remove obviously dead rules from styles.css (Electron, planner off, defunct list pages):
- :root[data-platform='planner'] palette
- selector parts containing data-force-web-mode='on' (web-only; app uses off)
- defunct list/editor page body classes
- .bottom-nav-* (no bottom nav markup in current HTML; JS no-ops if missing)

Substrings are matched per comma-separated selector part (top-level comma only) so
`body.recipes-page, body.shopping-page` keeps the recipes part.

Run from repo root: python3 scripts/prune_dead_list_css.py
"""
from __future__ import annotations

import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
CSS = ROOT / "css" / "styles.css"

# Match against normalized single selector parts. Do not use a bare "force-web-mode"
# substring: it would match data-force-web-mode='off' and nuke real rules.
DROP_SUBSTR: tuple[str, ...] = (
    "data-force-web-mode='on'",
    "data-platform='planner'",
    "body.shopping-page",
    "body.stores-page",
    "body.tags-page",
    "body.units-page",
    "body.sizes-page",
    "body.shopping-list-page",
    "body.shopping-editor-page",
    "body.store-editor-page",
    "body.tag-editor-page",
    "body.unit-editor-page",
    "body.size-editor-page",
    "body.has-top-filter-chip-rail.shopping-page",
    "body.has-top-filter-chip-rail.stores-page",
    "body.has-top-filter-chip-rail.tags-page",
    "body.has-top-filter-chip-rail.sizes-page",
    "body.has-top-filter-chip-rail.units-page",
    "body.has-top-filter-chip-rail.shopping-list-page",
    ".bottom-nav",
    "bottomNavEditorToggle",
    "bottom-nav-",
)


def _skip_string(s: str, i: int) -> int:
    q = s[i]
    i += 1
    n = len(s)
    while i < n:
        c = s[i]
        if c == "\\" and i + 1 < n:
            i += 2
            continue
        if c == q:
            return i + 1
        i += 1
    return n


def _skip_comment(s: str, i: int) -> int:
    if s[i : i + 2] != "/*":
        return i
    j = s.find("*/", i + 2)
    return j + 2 if j != -1 else len(s)


def _next_significant(s: str, i: int) -> int:
    """Skip only whitespace and quoted strings. Keep `/*` for the main loop to copy."""
    n = len(s)
    while i < n:
        if i < n and s[i] in "\n\r\t ":
            i += 1
            continue
        if i < n and s[i] in "\"'":
            i = _skip_string(s, i)
            continue
        break
    return i


def _find_block_end(s: str, open_brace: int) -> int:
    """s[open_brace] == '{', return index of matching '}' (inclusive)"""
    assert s[open_brace] == "{"
    depth = 0
    i = open_brace
    n = len(s)
    while i < n:
        c = s[i]
        if s[i : i + 2] == "/*":
            i = _skip_comment(s, i)
            continue
        if c in "\"'":
            i = _skip_string(s, i)
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return n - 1


def _find_selector_end(s: str, start: int) -> int:
    """Index of '{' that opens declarations for a qualified rule."""
    i = start
    n = len(s)
    while i < n:
        if s[i : i + 2] == "/*":
            i = _skip_comment(s, i)
            continue
        c = s[i]
        if c in "\"'":
            i = _skip_string(s, i)
            continue
        if c == "{":
            return i
        i += 1
    return n


def _split_top_level_comma(prelude: str) -> list[str]:
    parts: list[str] = []
    buf: list[str] = []
    depth = 0
    for c in prelude:
        if c == "(":
            depth += 1
        elif c == ")":
            depth = max(0, depth - 1)
        elif c == "," and depth == 0:
            p = "".join(buf).strip()
            if p:
                parts.append(p)
            buf = []
            continue
        buf.append(c)
    last = "".join(buf).strip()
    if last:
        parts.append(last)
    return parts if parts else [prelude.strip()] if prelude.strip() else []


def _prelude_part_dropped(part: str) -> bool:
    p = " ".join(part.split())
    return any(sub in p for sub in DROP_SUBSTR)


def _prelude_rewritten(prelude: str) -> str | None:
    """
    None = drop entire rule. Otherwise new prelude; may equal the original
    to preserve exact formatting.
    """
    parts = _split_top_level_comma(prelude)
    kept = [p for p in parts if not _prelude_part_dropped(p)]
    if not kept:
        return None
    if len(kept) == len(parts):
        return prelude
    return ",\n".join(kept)


def _process_inner_stylesheet(s: str) -> str:
    return _process_stylesheet(s, 0, len(s))[0]


def _process_stylesheet(s: str, start: int, end: int) -> tuple[str, int]:
    out: list[str] = []
    i = start
    n = end
    while i < n:
        i = _next_significant(s, i)
        if i >= n:
            break
        if s[i : i + 2] == "/*":
            cstart = i
            i = _skip_comment(s, i)
            out.append(s[cstart:i])
            continue
        if s[i] == "@":
            at_start = i
            i += 1
            while i < n and s[i] not in "{;":
                i += 1
            if i < n and s[i] == ";":
                out.append(s[at_start : i + 1])
                i += 1
                continue
            if i < n and s[i] == "{":
                br = _find_block_end(s, i)
                inner = s[i + 1 : br]
                at_header = s[at_start:i]
                filtered = _process_inner_stylesheet(inner)
                out.append(at_header + "{" + filtered + "}")
                i = br + 1
                continue
            out.append(s[at_start:i])
            continue
        qstart = i
        sel_end = _find_selector_end(s, i)
        if sel_end >= n:
            out.append(s[qstart:n])
            break
        prelude = s[qstart:sel_end].strip()
        br_open = sel_end
        br_end = _find_block_end(s, br_open)
        block = s[br_open : br_end + 1]
        new_pre = _prelude_rewritten(prelude)
        if new_pre is None:
            i = br_end + 1
            continue
        if new_pre != prelude:
            out.append(new_pre + block)
        else:
            out.append(s[qstart : br_end + 1])
        i = br_end + 1
    return "".join(out), i


def _remove_planner_root_block(s: str) -> str:
    pat = re.compile(r":root\[data-platform='planner'\]\s*\{")
    m = pat.search(s)
    if not m:
        return s
    br_open = m.end() - 1
    if br_open < 0 or s[br_open] != "{":
        return s
    br_end = _find_block_end(s, br_open)
    return s[: m.start()] + s[br_end + 1 :]


def main() -> None:
    src = CSS.read_text(encoding="utf-8")
    out, _ = _process_stylesheet(src, 0, len(src))
    out = _remove_planner_root_block(out)
    out = re.sub(r"\n{4,}", "\n\n\n", out)
    # Concatenation can drop a newline before the next at-rule or :root; keep it readable/parse-safe.
    out = re.sub(r"\*\/(:root)", r"*/\n\1", out)
    out = re.sub(r"\}(:root\b)", r"}\n\1", out)
    out = re.sub(r"\}(@[a-zA-Z-][^{]*\{)", r"}\n\1", out)
    out = re.sub(r"\}(\/\*)", r"}\n\1", out)
    out = re.sub(r"\*\/(body|@|#)", r"*/\n\1", out)
    out = re.sub(r"(@media[^{]*\{)body\.", r"\1\nbody.", out)
    CSS.write_text(out, encoding="utf-8")
    print("Wrote", CSS, f"new length: {len(out)}")


if __name__ == "__main__":
    main()
