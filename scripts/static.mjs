// Step 2, broad census: supply-chain and packaging signals from registry metadata only (no code is executed).
import { readFileSync, writeFileSync } from "node:fs";
const { packages } = JSON.parse(readFileSync("data/packages.json", "utf8"));
const SDKS = ["@modelcontextprotocol/sdk", "@modelcontextprotocol/server", "fastmcp", "mcp-framework", "@mastra/mcp", "mcp-use", "@cloudflare/mcp-agent", "xmcp"];
const out = [];
let i = 0;
async function worker() {
  while (i < packages.length) {
    const p = packages[i++];
    let m;
    // npm rate-limits busy shared addresses (such as CI runners): retry 429 and 5xx with exponential back-off.
    for (let attempt = 0; attempt < 6 && !m; attempt++) {
      try {
        const r = await fetch(`https://registry.npmjs.org/${p.name.replace("/", "%2f")}/latest`, { headers: { "User-Agent": "saktum-census (+https://github.com/soodhere/saktum-index)" } });
        if (r.status === 429 || r.status >= 500) { const wait = Number(r.headers.get("retry-after")) * 1000 || 1000 * 2 ** attempt; await new Promise((res) => setTimeout(res, Math.min(wait, 30_000))); continue; }
        if (!r.ok) { out.push({ name: p.name, error: `HTTP ${r.status}` }); break; }
        m = await r.json();
      } catch (e) { if (attempt === 5) out.push({ name: p.name, error: String(e.message).slice(0, 80) }); else await new Promise((res) => setTimeout(res, 1000 * 2 ** attempt)); }
    }
    if (!m) { if (!out.some((x) => x.name === p.name)) out.push({ name: p.name, error: "gave up after retries" }); continue; }
    const deps = { ...(m.dependencies ?? {}) };
    const scripts = m.scripts ?? {};
    const bin = typeof m.bin === "string" ? { [m.name]: m.bin } : (m.bin ?? {});
    out.push({
      name: p.name, version: m.version, weekly: p.weekly, updated: p.updated,
      runnable: Object.keys(bin).length > 0,
      usesMcpSdk: SDKS.some((s) => s in deps),
      installScripts: ["preinstall", "install", "postinstall"].filter((k) => scripts[k]),
      provenance: Boolean(m.dist?.attestations?.provenance),
      deprecated: Boolean(m.deprecated),
      license: m.license ? String(typeof m.license === "object" ? m.license.type : m.license) : null,
      repository: Boolean(m.repository),
      dependencies: Object.keys(deps).length,
      unpackedKb: m.dist?.unpackedSize ? Math.round(m.dist.unpackedSize / 1024) : null
    });
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
writeFileSync("data/static.json", JSON.stringify(out, null, 1));
const ok = out.filter((x) => !x.error);
const pct = (f) => `${Math.round((100 * ok.filter(f).length) / ok.length)}%`;
const errs = out.filter((x) => x.error);
console.log(`scanned ${ok.length} of ${packages.length} (${errs.length} errors${errs.length ? `: ${[...new Set(errs.map((x) => x.error))].slice(0, 5).join(", ")}` : ""})`);
console.log("runnable servers (bin):", ok.filter((x) => x.runnable).length, "| uses an MCP SDK:", pct((x) => x.usesMcpSdk));
console.log("provenance:", pct((x) => x.provenance), "| install scripts:", pct((x) => x.installScripts.length), "| deprecated:", pct((x) => x.deprecated), "| no licence:", pct((x) => !x.license), "| no repository link:", pct((x) => !x.repository));
