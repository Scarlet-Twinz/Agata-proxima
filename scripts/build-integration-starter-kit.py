#!/usr/bin/env python3
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

root = Path(__file__).resolve().parents[1]
kit = root / "download-kit"
out = root / "frontend/public/downloads/agata-proxima-integration-starter-kit.zip"
required = [
    "package.json", "package-lock.json", "README.md",
    "node/agata-client.mjs", "node/example.mjs", "cli/bin/agata.mjs",
    "cli/agata.sh", "cli/agata.ps1", "webhooks/receiver-example.mjs",
    "chatgpt-mcp/server.mjs", "chatgpt-mcp/README.md",
    "integrations/supabase-edge-function.example.ts",
    "integrations/supabase-membership.sql",
    "integrations/firebase-admin.example.ts",
    "integrations/firebase-membership.rules",
    "github-actions/agata-smoke.yml", "github-actions/README.md",
    "vercel/README.md", "terraform/README.md",
]
for relative in required:
    if not (kit / relative).is_file():
        raise SystemExit(f"Missing starter-kit source file: {relative}")
out.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(out, "w", ZIP_DEFLATED) as archive:
    for file in sorted(kit.rglob("*")):
        if not file.is_file() or "node_modules" in file.parts or ".git" in file.parts:
            continue
        relative = Path("download-kit") / file.relative_to(kit)
        info = ZipInfo(str(relative), date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = (0o100644 & 0xFFFF) << 16
        archive.writestr(info, file.read_bytes())
with ZipFile(out) as archive:
    bad = archive.testzip()
    names = set(archive.namelist())
    if bad:
        raise SystemExit(f"Corrupt archive member: {bad}")
    missing = [f"download-kit/{x}" for x in required if f"download-kit/{x}" not in names]
    if missing:
        raise SystemExit("Archive missing: " + ", ".join(missing))
print(f"PASS: rebuilt and verified {out.relative_to(root)} ({out.stat().st_size:,} bytes, {len(names)} files)")
