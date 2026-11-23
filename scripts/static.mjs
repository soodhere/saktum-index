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
    try { const r = await fetch(`https://registry.npmjs.org/${p.name.replace("/", "%2f")}/latest`); if (!r.ok) { out.push({ name: p.name, error: `HTTP ${r.status}` }); continue; } m = await r.json(); }
    catch (e) { out.push({ name: p.name, error: String(e.message).slice(0, 80) }); continue; }
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
await Promise.all(Array.from({ length: 24 }, worker));
writeFileSync("data/static.json", JSON.stringify(out, null, 1));
const ok = out.filter((x) => !x.error);
const pct = (f) => `${Math.round((100 * ok.filter(f).length) / ok.length)}%`;
console.log(`scanned ${ok.length} of ${packages.length} (${out.length - ok.length} errors)`);
console.log("runnable servers (bin):", ok.filter((x) => x.runnable).length, "| uses an MCP SDK:", pct((x) => x.usesMcpSdk));
console.log("provenance:", pct((x) => x.provenance), "| install scripts:", pct((x) => x.installScripts.length), "| deprecated:", pct((x) => x.deprecated), "| no licence:", pct((x) => !x.license), "| no repository link:", pct((x) => !x.repository));
