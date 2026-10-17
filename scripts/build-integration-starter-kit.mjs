import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = path.resolve(import.meta.dirname, "..");
const kit = path.join(root, "download-kit");
const output = path.join(root, "frontend", "public", "downloads", "agata-proxima-integration-starter-kit.zip");
const required = [
  "package.json", "package-lock.json", "README.md",
  "node/agata-client.mjs", "node/example.mjs", "cli/bin/agata.mjs",
  "cli/agata.sh", "cli/agata.ps1", "webhooks/receiver-example.mjs",
  "chatgpt-mcp/server.mjs", "chatgpt-mcp/README.md",
  "integrations/supabase-edge-function.example.ts", "integrations/supabase-membership.sql",
  "integrations/firebase-admin.example.ts", "integrations/firebase-membership.rules",
  "github-actions/agata-smoke.yml", "github-actions/README.md",
  "vercel/README.md", "terraform/README.md",
];
for (const relative of required) {
  if (!fs.statSync(path.join(kit, relative), { throwIfNoEntry: false })?.isFile()) {
    throw new Error("Missing starter-kit source file: " + relative);
  }
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === "node_modules" || entry.name === ".git") return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function header(size) { return Buffer.alloc(size); }
const files = walk(kit).sort().map(full => ({
  name: path.posix.join("download-kit", path.relative(kit, full).split(path.sep).join("/")),
  data: fs.readFileSync(full),
}));
const localParts = [], centralParts = [];
let offset = 0;
const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
for (const file of files) {
  const name = Buffer.from(file.name, "utf8");
  const compressed = zlib.deflateRawSync(file.data, { level: 9 });
  const crc = crc32(file.data);
  const local = header(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(8, 8); local.writeUInt16LE(0, 10); local.writeUInt16LE(dosDate, 12);
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(file.data.length, 22);
  local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
  localParts.push(local, name, compressed);
  const central = header(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(0, 12);
  central.writeUInt16LE(dosDate, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(file.data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32); central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36);
  central.writeUInt32LE((0o100644 << 16) >>> 0, 38); central.writeUInt32LE(offset, 42);
  centralParts.push(central, name);
  const roundTrip = zlib.inflateRawSync(compressed);
  if (crc32(roundTrip) !== crc || !roundTrip.equals(file.data)) throw new Error("ZIP verification failed for " + file.name);
  offset += local.length + name.length + compressed.length;
}
const localData = Buffer.concat(localParts);
const centralData = Buffer.concat(centralParts);
const end = header(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralData.length, 12); end.writeUInt32LE(localData.length, 16); end.writeUInt16LE(0, 20);
const archive = Buffer.concat([localData, centralData, end]);
const names = files.map(file => file.name);
for (const relative of required) if (!names.includes("download-kit/" + relative)) throw new Error("ZIP is missing " + relative);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, archive);
console.log(`PASS: rebuilt and verified integration starter kit (${files.length} files, ${archive.length.toLocaleString()} bytes)`);
