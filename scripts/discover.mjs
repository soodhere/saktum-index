// Step 1, discovery: list npm packages tagged mcp-server, with downloads, ranked by weekly downloads.
// Usage: node scripts/discover.mjs [maxResults=3000]
import { writeFileSync } from "node:fs";
const max = Number(process.argv[2] ?? 3000);
const seen = new Map();
let totalTagged = null;
for (const query of ["keywords:mcp-server", "keywords:mcp server", "mcp server"]) {
  for (let from = 0; from < max; from += 250) {
    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=250&from=${from}`;
    let j;
    try { const r = await fetch(url); if (!r.ok) break; j = await r.json(); } catch { break; }
    if (query === "keywords:mcp-server" && from === 0) totalTagged = j.total;
    if (!j.objects?.length) break;
    for (const o of j.objects) {
      const p = o.package;
      if (seen.has(p.name)) continue;
      seen.set(p.name, { name: p.name, version: p.version, description: (p.description ?? "").slice(0, 200), keywords: (p.keywords ?? []).slice(0, 12),
        weekly: o.downloads?.weekly ?? 0, monthly: o.downloads?.monthly ?? 0, updated: o.updated ?? p.date, publisher: p.publisher?.username ?? null,
        maintainers: (p.maintainers ?? []).length, repository: p.links?.repository ?? null, dependents: Number(o.dependents ?? 0) });
    }
    if (j.objects.length < 250) break;
  }
}
const list = [...seen.values()].sort((a, b) => b.weekly - a.weekly);
writeFileSync("data/packages.json", JSON.stringify({ discoveredAt: new Date().toISOString(), totalTaggedMcpServer: totalTagged, count: list.length, packages: list }, null, 1));
console.log(`discovered ${list.length} packages (npm reports ${totalTagged} tagged mcp-server); top 5 by weekly downloads:`);
for (const p of list.slice(0, 5)) console.log(" ", p.name, p.weekly);
