// Step 3, deep census: install each top server (install scripts disabled), then run Saktum Check on it directly
// (passive: no tool is called). Run only on a disposable machine (CI runner, container). Resumable.
// Usage: node scripts/deep.mjs <saktum.mjs> <count> [offset=0] [concurrency=6]
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
const [saktum, count = "200", offset = "0", conc = "6"] = process.argv.slice(2);
const stat = JSON.parse(readFileSync("data/static.json", "utf8"));
const pick = stat.filter((s) => !s.error && s.runnable && s.usesMcpSdk && !s.deprecated).sort((a, b) => b.weekly - a.weekly).slice(Number(offset), Number(offset) + Number(count));
mkdirSync("results", { recursive: true });
const run = (cmd, args, opts, ms) => new Promise((res) => {
  const p = spawn(cmd, args, { ...opts, stdio: ["ignore", "ignore", "pipe"] });
  let err = ""; p.stderr.on("data", (d) => (err = (err + d).slice(-600)));
  const t = setTimeout(() => p.kill("SIGKILL"), ms);
  p.on("exit", (code) => { clearTimeout(t); res({ code, err }); });
});
const fail = (file, s, stage, error) => writeFileSync(file.replace(/\.json$/, ".failed.json"), JSON.stringify({ name: s.name, version: s.version, weekly: s.weekly, stage, error: String(error).replace(/\x1b\[[0-9;]*m/g, "").split("\n").filter(Boolean).slice(-1)[0]?.slice(0, 200) ?? "" }));
let i = 0, done = 0, cleaned = 0;
const t0 = Date.now();
async function worker() {
  while (i < pick.length) {
    const s = pick[i++];
    const file = join(process.cwd(), "results", `${s.name.replace(/[@/]/g, "_")}.json`);
    if (existsSync(file) || existsSync(file.replace(/\.json$/, ".failed.json"))) { done++; continue; }
    const dir = join(tmpdir(), "census", s.name.replace(/[@/]/g, "_"));
    try {
      const inst = await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error", "--prefix", dir, `${s.name}@${s.version}`], {}, 240_000);
      if (inst.code !== 0) { fail(file, s, "install", inst.err || "install failed or timed out"); continue; }
      const pkg = JSON.parse(readFileSync(join(dir, "node_modules", s.name, "package.json"), "utf8"));
      const bins = typeof pkg.bin === "string" ? [pkg.bin] : Object.values(pkg.bin ?? {});
      if (!bins.length) { fail(file, s, "install", "no executable"); continue; }
      const entry = join(dir, "node_modules", s.name, bins[0]);
      const chk = await run(process.execPath, [saktum, "check", "--out", file, "--", process.execPath, entry], { cwd: dir }, 120_000);
      if (!existsSync(file)) fail(file, s, "start", chk.err || "did not start");
    } catch (e) { fail(file, s, "runner", e.message); }
    finally {
      rmSync(dir, { recursive: true, force: true });
      // Keep the npm cache from filling small disks (CI runners have limited space too).
      if (++cleaned % 25 === 0) await run("npm", ["cache", "clean", "--force"], {}, 120_000);
      done++; if (done % 10 === 0) console.log(`${done}/${pick.length} in ${Math.round((Date.now() - t0) / 1000)}s`); }
  }
}
await Promise.all(Array.from({ length: Number(conc) }, worker));
console.log(`finished ${done} servers in ${Math.round((Date.now() - t0) / 1000)}s`);
