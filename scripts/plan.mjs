// Census v2, plan: merge npm discovery (data/static.json) and the registry (data/registry.json) into
// data/deep-list.json (npm and Python servers to run) and data/remote-list.json (remote servers to probe).
// Usage: node scripts/plan.mjs [npmTop=800] [pypiTop=300] [remoteTop=400]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
const [npmTop = 800, pypiTop = 300, remoteTop = 400] = process.argv.slice(2).map(Number);
const stat = existsSync("data/static.json") ? JSON.parse(readFileSync("data/static.json", "utf8")).filter((s) => !s.error) : [];
const reg = existsSync("data/registry.json") ? JSON.parse(readFileSync("data/registry.json", "utf8")).servers : [];
const deep = new Map();
for (const s of stat.filter((x) => x.runnable && x.usesMcpSdk && !x.deprecated).sort((a, b) => b.weekly - a.weekly).slice(0, npmTop))
  deep.set(`npm:${s.name}`, { kind: "npm", name: s.name, version: s.version, weekly: s.weekly, source: "npm" });
for (const s of reg) for (const p of s.packages) {
  if (p.type === "npm" && p.version && !deep.has(`npm:${p.id}`)) deep.set(`npm:${p.id}`, { kind: "npm", name: p.id, version: p.version, weekly: 0, source: "registry", registryName: s.name });
}
const pypi = [];
for (const s of reg) for (const p of s.packages) if (p.type === "pypi" && p.version) pypi.push({ kind: "pypi", name: p.id, version: p.version, weekly: 0, source: "registry", registryName: s.name });
for (const p of pypi.slice(0, pypiTop)) deep.set(`pypi:${p.name}`, p);
const remotes = [];
const seen = new Set();
for (const s of reg) for (const r of s.remotes) if (!seen.has(r.url)) { seen.add(r.url); remotes.push({ name: s.name, url: r.url, type: r.type }); }
// Interleave Python servers through the npm list (about one in four), so every run, even a small one, samples both.
const npmList = [...deep.values()].filter((d) => d.kind === "npm"), pyList = [...deep.values()].filter((d) => d.kind === "pypi");
const mixed = [];
while (npmList.length || pyList.length) { for (let k = 0; k < 3 && npmList.length; k++) mixed.push(npmList.shift()); if (pyList.length) mixed.push(pyList.shift()); }
writeFileSync("data/deep-list.json", JSON.stringify(mixed, null, 1));
writeFileSync("data/remote-list.json", JSON.stringify(remotes.slice(0, remoteTop), null, 1));
console.log(`plan: deep ${deep.size} (npm ${[...deep.values()].filter((d) => d.kind === "npm").length}, pypi ${[...deep.values()].filter((d) => d.kind === "pypi").length}); remote ${Math.min(remotes.length, remoteTop)} of ${remotes.length} (streamable-http ${remotes.filter((r) => r.type.includes("streamable")).length}, sse ${remotes.filter((r) => r.type === "sse").length})`);
