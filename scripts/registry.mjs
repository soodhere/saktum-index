// Census v2, discovery from the official MCP Registry. Tolerant of the response shape (the API is young): accepts
// { servers: [ { server: {...}, _meta } ] } or { servers: [ {...} ] }, cursor in metadata.nextCursor or metadata.next_cursor.
// Usage: node scripts/registry.mjs [maxServers=5000]
import { writeFileSync } from "node:fs";
const BASE = process.env.REGISTRY_URL ?? "https://registry.modelcontextprotocol.io/v0/servers";
const max = Number(process.argv[2] ?? 5000);

export function parsePage(j) {
  const items = Array.isArray(j?.servers) ? j.servers : Array.isArray(j) ? j : [];
  const out = [];
  for (const it of items) {
    const s = it?.server ?? it;
    if (!s?.name) continue;
    const meta = it?._meta ?? s?._meta ?? {};
    const official = meta["io.modelcontextprotocol.registry/official"] ?? {};
    const pkgs = (s.packages ?? []).map((p) => ({ type: String(p.registryType ?? p.registry_type ?? p.registry_name ?? "").toLowerCase(), id: p.identifier ?? p.name, version: p.version, transport: p.transport?.type ?? p.transport_type ?? "stdio" })).filter((p) => p.id);
    const remotes = (s.remotes ?? []).map((r) => ({ type: String(r.type ?? r.transport_type ?? "").toLowerCase(), url: r.url })).filter((r) => typeof r.url === "string" && /^https:\/\//.test(r.url));
    out.push({ name: s.name, version: s.version ?? s.version_detail?.version ?? null, isLatest: official.isLatest ?? official.is_latest ?? true, status: s.status ?? official.status ?? "active", packages: pkgs, remotes });
  }
  const cursor = j?.metadata?.nextCursor ?? j?.metadata?.next_cursor ?? j?.next_cursor ?? null;
  return { servers: out, cursor };
}

async function main() {
  const byName = new Map();
  let cursor = null, pages = 0;
  do {
    const url = `${BASE}?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const r = await fetch(url, { headers: { "User-Agent": "saktum-census (+https://github.com/soodhere/saktum-index)" } });
    if (!r.ok) { console.error(`registry: HTTP ${r.status} at page ${pages + 1}`); break; }
    const page = parsePage(await r.json());
    for (const s of page.servers) if (s.isLatest !== false && s.status !== "deleted") byName.set(s.name, s);
    cursor = page.cursor; pages++;
  } while (cursor && byName.size < max && pages < 500);
  const list = [...byName.values()];
  const count = (f) => list.filter(f).length;
  writeFileSync("data/registry.json", JSON.stringify({ fetchedAt: new Date().toISOString(), source: BASE, count: list.length, servers: list }, null, 1));
  console.log(`registry: ${list.length} servers in ${pages} pages; npm ${count((s) => s.packages.some((p) => p.type === "npm"))}, pypi ${count((s) => s.packages.some((p) => p.type === "pypi"))}, oci ${count((s) => s.packages.some((p) => p.type === "oci"))}, remote ${count((s) => s.remotes.length)}`);
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
