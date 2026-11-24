// Census v2, remote servers: passive Saktum Check on each URL (what any MCP client does when connecting: initialize
// without credentials, read sign-in metadata, try an invalid token). One probe set per server; no tools are called.
// Usage: node scripts/remote.mjs <saktum.mjs> [count] [offset=0] [concurrency=8]
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const [saktum, count = "400", offset = "0", conc = "8"] = process.argv.slice(2);
const list = JSON.parse(readFileSync("data/remote-list.json", "utf8")).slice(Number(offset), Number(offset) + Number(count));
mkdirSync("results-remote", { recursive: true });
const fileOf = (u) => join(process.cwd(), "results-remote", `${u.replace(/^https:\/\//, "").replace(/[^a-zA-Z0-9.-]/g, "_").slice(0, 120)}.json`);
let i = 0, done = 0;
async function worker() {
  while (i < list.length) {
    const r = list[i++];
    const file = fileOf(r.url);
    if (existsSync(file) || existsSync(file.replace(/\.json$/, ".failed.json"))) { done++; continue; }
    if (r.type === "sse") { writeFileSync(file.replace(/\.json$/, ".failed.json"), JSON.stringify({ ...r, stage: "transport", error: "legacy SSE transport only" })); done++; continue; }
    const res = await new Promise((resolve) => {
      const p = spawn(process.execPath, [saktum, "check", "--out", file, r.url], { stdio: ["ignore", "ignore", "pipe"] });
      let err = ""; p.stderr.on("data", (d) => (err = (err + d).slice(-400)));
      const t = setTimeout(() => p.kill("SIGKILL"), 90_000);
      p.on("exit", (code) => { clearTimeout(t); resolve({ code, err }); });
    });
    if (!existsSync(file)) writeFileSync(file.replace(/\.json$/, ".failed.json"), JSON.stringify({ ...r, stage: "connect", error: res.err.replace(/\x1b\[[0-9;]*m/g, "").split("\n").filter(Boolean)[0]?.slice(0, 200) ?? "" }));
    else { const j = JSON.parse(readFileSync(file, "utf8")); j._registryName = r.name; writeFileSync(file, JSON.stringify(j)); }
    if (++done % 20 === 0) console.log(`${done}/${list.length}`);
  }
}
await Promise.all(Array.from({ length: Number(conc) }, worker));
console.log(`remote: finished ${done}`);
