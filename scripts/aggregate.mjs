// Step 4, aggregate: maturity levels, trust quadrant and ecosystem statistics.
// Public output (report/census.json) holds aggregates only; per-server details go to report/servers-private.csv.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
const stat = JSON.parse(readFileSync("data/static.json", "utf8")).filter((s) => !s.error);
const disc = JSON.parse(readFileSync("data/packages.json", "utf8"));
const byName = new Map(stat.map((s) => [s.name, s]));
const files = readdirSync("results");
// Result files are named after the package (scripts/deep.mjs); map them back to package names.
const byFile = new Map(stat.map((s) => [`${s.name.replace(/[@/]/g, "_")}.json`, s.name]));
const failed = files.filter((f) => f.endsWith(".failed.json")).map((f) => JSON.parse(readFileSync(`results/${f}`, "utf8")));
const deep = files.filter((f) => f.endsWith(".json") && !f.endsWith(".failed.json")).map((f) => ({ ...JSON.parse(readFileSync(`results/${f}`, "utf8")), _name: byFile.get(f) }));

const nameOf = (r) => r._name ?? r.target.description;
const failedIn = (r, pack) => r.findings.filter((f) => f.pack === pack && f.status === "fail" && f.scored && !f.suppressed);
const rows = deep.map((r) => {
  const s = byName.get(nameOf(r)) ?? {};
  const assessable = r.grade !== null && r.grade !== undefined && (r.target.toolCount ?? 0) > 0;
  const conf = failedIn(r, "conformance"), sec = failedIn(r, "security");
  let level = 0;
  if (assessable) { level = 1; if (!conf.length) { level = 2; if (!sec.length) { level = 3; if ((r.readiness?.score ?? 0) >= 90) { level = 4; if (s.provenance && !(s.installScripts ?? []).length) level = 5; } } } }
  return { name: nameOf(r), weekly: s.weekly ?? 0, assessable, level, trust: r.scores.overall, trustGrade: r.grade, readiness: r.readiness?.score ?? null, readinessGrade: r.readiness?.grade ?? null,
    tools: r.target.toolCount ?? 0, tokens: r.readiness?.contextTokens ?? null, annotated: r.readiness?.toolsAnnotated ?? null,
    caps: (r.capabilities?.capabilities ?? []).map((c) => c.capability), trifecta: Boolean(r.capabilities?.lethalTrifecta),
    confFails: conf.map((f) => f.check), secFails: sec.map((f) => f.check), provenance: Boolean(s.provenance), installScripts: (s.installScripts ?? []).length > 0,
    topImprovement: r.readiness?.topImprovement ?? (conf[0] ?? sec[0])?.title ?? "", noGradeReason: assessable ? "" : (r.summary?.[0] ?? "") };
});
const A = rows.filter((r) => r.assessable);
const pct = (n, d) => (d ? Math.round((1000 * n) / d) / 10 : 0);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const p90 = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length * 0.9)] : 0; };
const capCount = (c) => A.filter((r) => r.caps.includes(c)).length;
const quadrant = (r) => (r.trust >= 90 ? (r.readiness >= 90 ? "Leaders" : "Safe but hard for agents") : (r.readiness >= 90 ? "Agent-friendly but risky" : "Not ready"));
const checkFailCounts = {};
for (const r of A) for (const c of [...r.confFails, ...r.secFails]) checkFailCounts[c] = (checkFailCounts[c] ?? 0) + 1;
const census = {
  generatedAt: new Date().toISOString(), method: "Saktum Check 0.2 (passive: no tool is called; install scripts disabled), npm registry metadata",
  broad: { discovered: disc.count, npmTaggedMcpServer: disc.totalTaggedMcpServer, scanned: stat.length,
    runnable: stat.filter((s) => s.runnable).length, usesMcpSdk: pct(stat.filter((s) => s.usesMcpSdk).length, stat.length),
    provenance: pct(stat.filter((s) => s.provenance).length, stat.length), installScripts: pct(stat.filter((s) => s.installScripts.length).length, stat.length),
    noRepository: pct(stat.filter((s) => !s.repository).length, stat.length), noLicence: pct(stat.filter((s) => !s.license).length, stat.length),
    weeklyDownloadsCovered: stat.reduce((a, s) => a + (s.weekly ?? 0), 0) },
  deep: { attempted: rows.length + failed.length, assessed: A.length, couldNotStart: failed.length, noGrade: rows.length - A.length,
    weeklyDownloadsAssessed: A.reduce((a, r) => a + r.weekly, 0),
    maturity: [1, 2, 3, 4, 5].map((l) => ({ level: l, atLeast: A.filter((r) => r.level >= l).length })),
    levelExactly: [1, 2, 3, 4, 5].map((l) => ({ level: l, count: A.filter((r) => r.level === l).length })),
    quadrants: ["Leaders", "Safe but hard for agents", "Agent-friendly but risky", "Not ready"].map((q) => ({ quadrant: q, count: A.filter((r) => quadrant(r) === q).length })),
    points: A.map((r) => ({ x: r.trust, y: r.readiness, level: r.level })),
    noAnnotations: pct(A.filter((r) => r.annotated === 0).length, A.length),
    partialAnnotations: pct(A.filter((r) => r.annotated > 0 && r.annotated < r.tools).length, A.length),
    readinessA: pct(A.filter((r) => r.readinessGrade === "A").length, A.length),
    tokensMedian: median(A.map((r) => r.tokens ?? 0)), tokensP90: p90(A.map((r) => r.tokens ?? 0)), over20k: A.filter((r) => (r.tokens ?? 0) > 20000).length,
    toolsMedian: median(A.map((r) => r.tools)), toolsMax: Math.max(0, ...A.map((r) => r.tools)),
    capabilities: ["code-execution", "network", "filesystem", "writes-or-deletes", "sends-messages", "money", "reads-private-data", "untrusted-content"].map((c) => ({ capability: c, count: capCount(c), pct: pct(capCount(c), A.length) })),
    trifecta: A.filter((r) => r.trifecta).length,
    failingChecks: Object.entries(checkFailCounts).sort((a, b) => b[1] - a[1]).map(([check, count]) => ({ check, count, pct: pct(count, A.length) })),
    trustA: pct(A.filter((r) => r.trustGrade === "A").length, A.length),
    deepProvenance: pct(A.filter((r) => r.provenance).length, A.length) }
};
writeFileSync("report/census.json", JSON.stringify(census, null, 1));
const csv = ["name,weekly_downloads,level,trust_grade,trust,readiness_grade,readiness,tools,context_tokens,annotated_tools,provenance,install_scripts,capabilities,trifecta,failing_checks,top_improvement"]
  .concat(rows.sort((a, b) => b.weekly - a.weekly).map((r) => [r.name, r.weekly, r.assessable ? `L${r.level}` : "not assessed", r.trustGrade ?? "", r.trust ?? "", r.readinessGrade ?? "", r.readiness ?? "", r.tools, r.tokens ?? "", r.annotated ?? "", r.provenance, r.installScripts, r.caps.join(" "), r.trifecta, [...r.confFails, ...r.secFails].join(" "), (r.topImprovement || r.noGradeReason).replace(/"/g, "'")].map((v) => `"${String(v)}"`).join(",")));
writeFileSync("report/servers-private.csv", csv.join("\n") + "\n");
console.log(JSON.stringify({ broad: census.broad, deep: { ...census.deep, points: `${census.deep.points.length} points` } }, null, 1));
