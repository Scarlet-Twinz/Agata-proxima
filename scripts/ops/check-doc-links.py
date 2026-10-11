#!/usr/bin/env python3
"""Validate local Markdown links without requiring third-party packages."""
from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
SKIP_DIRS = {".git", "node_modules", "target", "dist", ".next", "coverage"}
LINK_RE = re.compile(r"!?[[^\]]*\]\(([^)]+)\)")
ROOT_FILE_PREFIXES = (
    "/docs/", "/scripts/", "/tests/", "/control-plane/", "/crates/",
    "/frontend/", "/packages/", "/security/", "/cloud/", "/dashboard/",
    "/benchmarks/", "/examples/", "/tools/",
)


def markdown_files():
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in {".md", ".mdx"}:
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        yield path


def is_external(target: str) -> bool:
    lowered = target.lower()
    return lowered.startswith(("http://", "https://", "mailto:", "tel:", "data:", "javascript:", "//"))


def heading_anchors(path: Path) -> set[str]:
    """Return common GitHub-style Markdown heading and explicit HTML anchors."""
    if not path.exists() or path.suffix.lower() not in {".md", ".mdx", ".html"}:
        return set()

    content = path.read_text(encoding="utf-8", errors="replace")
    anchors = set(re.findall(r"""\bid\s*=\s*["']([^"']+)["']""", content, flags=re.IGNORECASE))
    anchors.update(re.findall(r"""<a\s+[^>]*name\s*=\s*["']([^"']+)["']""", content, flags=re.IGNORECASE))

    counts: dict[str, int] = {}
    for match in re.finditer(r"^#{1,6}\s+(.+?)\s*#*\s*$", content, flags=re.MULTILINE):
        heading = match.group(1).strip()
        heading = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"\1", heading)
        heading = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", heading)
        heading = re.sub(r"[\x60]([^\x60]*)[\x60]", r"\1", heading)
        heading = re.sub(r"<[^>]+>", "", heading).lower()
        heading = re.sub(r"[^\w\- ]", "", heading, flags=re.UNICODE)
        slug = re.sub(r"\s+", "-", heading.strip())
        if not slug:
            continue
        count = counts.get(slug, 0)
        counts[slug] = count + 1
        anchors.add(slug if count == 0 else f"{slug}-{count}")
    return anchors


def resolve_target(source: Path, raw_target: str) -> Path | None:
    target = raw_target.strip()
    if target.startswith("<") and ">" in target:
        target = target[1:target.index(">")]
    else:
        # Markdown allows an optional quoted title after the destination.
        target = target.split()[0] if target.split() else ""
    if not target or is_external(target):
        return None

    parsed = urlsplit(target)
    path_text = unquote(parsed.path)
    if not path_text:
        return source.resolve() if parsed.fragment else None

    if path_text.startswith("/"):
        # Root-relative app routes such as /app/settings are not repository files.
        if not path_text.startswith(ROOT_FILE_PREFIXES) and Path(path_text).suffix == "":
            return None
        candidate = ROOT / path_text.lstrip("/")
    else:
        candidate = source.parent / path_text

    candidate = candidate.resolve()
    try:
        candidate.relative_to(ROOT)
    except ValueError:
        return candidate

    if candidate.exists():
        if candidate.is_dir():
            for name in ("README.md", "index.md", "index.mdx", "index.html"):
                index = candidate / name
                if index.exists():
                    return index
        return candidate

    # Documentation links commonly omit the Markdown extension.
    if not candidate.suffix:
        for suffix in (".md", ".mdx", ".html"):
            with_suffix = candidate.with_suffix(suffix)
            if with_suffix.exists():
                return with_suffix
    return candidate


def main() -> int:
    broken = []
    checked = 0
    for source in markdown_files():
        text = source.read_text(encoding="utf-8", errors="replace")
        for match in LINK_RE.finditer(text):
            destination = match.group(1)
            # A link destination may contain a title; resolve_target handles it.
            target = resolve_target(source, destination)
            if target is None:
                continue
            checked += 1
            try:
                target.relative_to(ROOT)
            except ValueError:
                broken.append((source, text.count("\n", 0, match.start()) + 1, destination, "target escapes repository"))
                continue
            line_number = text.count("\n", 0, match.start()) + 1
            if not target.exists():
                broken.append((source, line_number, destination, "target does not exist"))
                continue

            fragment = unquote(urlsplit(destination.strip().split()[0]).fragment) if destination.strip() else ""
            if fragment and target.suffix.lower() in {".md", ".mdx", ".html"}:
                if fragment not in heading_anchors(target):
                    broken.append((source, line_number, destination, f"fragment '#{fragment}' does not exist in {target.relative_to(ROOT)}"))

    if broken:
        print(f"FAIL: {len(broken)} broken local Markdown link(s) across {checked} checked links:")
        for source, line, destination, reason in broken:
            print(f"{source.relative_to(ROOT)}:{line}: {destination} ({reason})")
        return 1

    print(f"PASS: checked {checked} local Markdown links; no missing targets.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
