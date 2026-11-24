// Step 5, render: the State of MCP Trust report as one self-contained HTML page (aggregates only; no server named).
import { readFileSync, writeFileSync } from "node:fs";
const c = JSON.parse(readFileSync("report/census.json", "utf8"));
const b = c.broad, d = c.deep;
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
const n = (x) => Number(x).toLocaleString("en-US");
const pctOf = (x, t) => (t ? Math.round((100 * x) / t) : 0);
const month = c.edition ?? new Date(c.generatedAt).toLocaleString("en-US", { month: "long", year: "numeric" });
const rm = c.remote;
const remoteSection = rm ? `<h2>Remote servers and sign-in</h2>
<p class="muted">Passive checks on ${n(rm.attempted)} remote MCP servers listed in the official MCP Registry: exactly what an MCP client does when it connects, without credentials. ${n(rm.reached)} answered; ${n(rm.sseOnly)} offer only the legacy SSE transport; ${n(rm.unreachable)} could not be reached.</p>
<div class="cards">
<div class="card"><div class="big">${n(rm.requireSignIn)}</div><div class="sub">require sign-in (${n(rm.public)} are public)</div></div>
<div class="card"><div class="big">${rm.signIn.fullDiscoveryPct}%</div><div class="sub">of those implement full sign-in discovery as the MCP specification requires (RFC 9728 challenge and metadata, server metadata with PKCE, invalid tokens refused)</div></div>
<div class="card"><div class="big">${n(rm.signIn.resourceMetadata)}</div><div class="sub">publish protected resource metadata (RFC 9728)</div></div>
<div class="card"><div class="big">${n(rm.signIn.rejectsInvalidToken)}</div><div class="sub">refuse an invalid token with 401 or 403</div></div>
</div>` : "";
const protoRows = (c.protocolVersions ?? []).filter((x) => x.version !== "unknown").map((x) => `<tr><td>${esc(x.version)}</td><td class="num">${n(x.count)}</td></tr>`).join("");
const protoSection = protoRows ? `<h2>MCP protocol versions in use</h2><p class="muted">The protocol revision each server negotiated with Saktum Check (servers requiring sign-in are not counted, as the census never signs in).</p><div class="panel"><table><tr><th>Revision</th><th class="num">Servers</th></tr>${protoRows}</table></div>` : "";
const kinds = (d.byKind ?? []).filter((k) => k.assessed).map((k) => `${n(k.assessed)} ${k.kind === "pypi" ? "Python" : "npm"}`).join(" and ");
const LEVELS = [
  ["L1", "Responds", "Starts, completes the MCP handshake and lists its tools."],
  ["L2", "Conformant", "No failed conformance checks: valid input schemas, valid names, honest handling of unknown tools."],
  ["L3", "Safe by default", "No failed security checks: no hidden instructions to agents, invisible or control characters, secrets or leaked internals."],
  ["L4", "Agent-ready", "Agent readiness A: tools declare danger annotations, have usable descriptions and a reasonable context cost."],
  ["L5", "Assured", "A verifiable supply chain as well: npm provenance and no install scripts."]
];
const CAP = { "code-execution": "Runs code or commands", network: "Reaches the network", filesystem: "Reads or writes files", "writes-or-deletes": "Changes or deletes data", "sends-messages": "Sends messages", money: "Moves money", "reads-private-data": "Reads private data", "untrusted-content": "Brings in untrusted content" };
const CHECK = { "conf.tools.schema-valid": "Invalid input schemas", "conf.tools.names": "Invalid tool names", "conf.tools.unknown-not-success": "Reports success for a tool that does not exist", "sec.description.hidden-instructions": "Hidden instructions to the agent", "sec.description.invisible-text": "Invisible or bidirectional characters", "sec.description.control-characters": "Terminal control characters", "sec.secrets.exposed": "Secrets in tools or errors", "sec.errors.leakage": "Errors expose internals" };

// Maturity funnel (bars of "at least level N")
const maxAssessed = Math.max(1, d.assessed);
const funnel = d.maturity.map((m, i) => {
  const w = Math.max(2, Math.round((560 * m.atLeast) / maxAssessed));
  return `<g transform="translate(0,${i * 46})"><text x="0" y="22" class="lbl">${LEVELS[i][0]} ${LEVELS[i][1]}</text><rect x="170" y="6" width="${w}" height="26" rx="4" class="bar l${i + 1}"/><text x="${180 + w}" y="25" class="val">${n(m.atLeast)} (${pctOf(m.atLeast, d.assessed)}%)</text></g>`;
}).join("");

// Quadrant scatter (anonymous points), trust on x, readiness on y; small deterministic jitter so overlapping points show
const pts = d.points.map((p, i) => {
  const jx = ((i * 37) % 11) - 5, jy = ((i * 53) % 11) - 5;
  const x = 40 + ((Math.max(0, p.x) / 100) * 520) + jx * 0.8, y = 380 - ((Math.max(0, p.y ?? 0) / 100) * 340) + jy * 0.8;
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" class="pt l${p.level}"/>`;
}).join("");
const q = Object.fromEntries(d.quadrants.map((x) => [x.quadrant, x.count]));
const qx = 40 + 0.9 * 520, qy = 380 - 0.9 * 340;
const quadrant = `<svg viewBox="0 0 600 420" role="img" aria-label="Trust quadrant of assessed MCP servers"><rect x="40" y="40" width="520" height="340" class="frame"/>
<line x1="${qx}" y1="40" x2="${qx}" y2="380" class="div"/><line x1="40" y1="${qy}" x2="560" y2="${qy}" class="div"/>
<text x="${qx + 6}" y="58" class="q">Leaders · ${n(q["Leaders"] ?? 0)}</text><text x="48" y="58" class="q">Agent-friendly but risky · ${n(q["Agent-friendly but risky"] ?? 0)}</text>
<text x="${qx + 6}" y="372" class="q">Safe but hard for agents · ${n(q["Safe but hard for agents"] ?? 0)}</text><text x="48" y="372" class="q">Not ready · ${n(q["Not ready"] ?? 0)}</text>
${pts}<text x="300" y="408" class="axis">Trust score (conformance, sign-in, security) →</text><text x="14" y="210" class="axis" transform="rotate(-90 14 210)">Agent readiness →</text></svg>`;

const capBars = d.capabilities.map((x, i) => `<g transform="translate(0,${i * 34})"><text x="0" y="18" class="lbl">${esc(CAP[x.capability] ?? x.capability)}</text><rect x="230" y="4" width="${Math.max(2, Math.round(3.4 * x.pct))}" height="20" rx="3" class="bar cap"/><text x="${240 + Math.max(2, Math.round(3.4 * x.pct))}" y="19" class="val">${x.pct}%</text></g>`).join("");
const fails = d.failingChecks.slice(0, 6).map((x) => `<tr><td>${esc(CHECK[x.check] ?? x.check)}</td><td class="num">${n(x.count)}</td><td class="num">${x.pct}%</td></tr>`).join("") || `<tr><td colspan="3">No failed trust checks among assessed servers.</td></tr>`;
const levelRows = LEVELS.map((l, i) => `<tr><td><span class="chip l${i + 1}">${l[0]}</span></td><td><b>${l[1]}</b></td><td>${l[2]}</td><td class="num">${n(d.levelExactly[i].count)}</td></tr>`).join("");

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>State of MCP Trust — ${month} · Saktum MCP Trust Census</title>
<style>
:root{--bg:#f7f7fb;--surface:#fff;--ink:#16161d;--muted:#5b5b6e;--line:#e2e2ea;--accent:#5a3fc0;--l1:#c9c3e6;--l2:#a597dc;--l3:#7f6bd0;--l4:#5a3fc0;--l5:#2e7d32;--cap:#8a7ad6;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#101016;--surface:#191922;--ink:#ededf5;--muted:#a3a3b8;--line:#2c2c3a;--l1:#3b3466;--l2:#4d3f8c;--l3:#6a55c4;--l4:#8c78e6;--l5:#5fbf68;--cap:#7d6dd0;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#101016;--surface:#191922;--ink:#ededf5;--muted:#a3a3b8;--line:#2c2c3a;--l1:#3b3466;--l2:#4d3f8c;--l3:#6a55c4;--l4:#8c78e6;--l5:#5fbf68;--cap:#7d6dd0;color-scheme:dark}
html{scroll-padding-top:env(safe-area-inset-top,0px)}*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 "Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:980px;margin:0 auto;padding:28px 18px 60px}h1{font-size:clamp(28px,5vw,44px);line-height:1.15;margin:8px 0 6px}h2{margin:40px 0 10px;font-size:24px}
.kicker{color:var(--accent);font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:13px}.lede{color:var(--muted);font-size:18px;max-width:760px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:22px 0}.card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px}
.card .big{font-size:30px;font-weight:800}.card .sub{color:var(--muted);font-size:14px}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:18px;overflow-x:auto}
svg{max-width:100%;height:auto}.lbl{fill:var(--ink);font-size:14px}.val{fill:var(--muted);font-size:13px}.axis{fill:var(--muted);font-size:12px;text-anchor:middle}.q{fill:var(--muted);font-size:12px;font-weight:600}
.frame{fill:none;stroke:var(--line)}.div{stroke:var(--line);stroke-dasharray:4 4}.bar.cap{fill:var(--cap)}
.l1{fill:var(--l1);background:var(--l1)}.l2{fill:var(--l2);background:var(--l2)}.l3{fill:var(--l3);background:var(--l3)}.l4{fill:var(--l4);background:var(--l4)}.l5{fill:var(--l5);background:var(--l5)}
.pt{opacity:.85}.chip{display:inline-block;color:#fff;border-radius:6px;padding:1px 8px;font-weight:700;font-size:13px}
table{border-collapse:collapse;width:100%}td,th{border-top:1px solid var(--line);padding:9px 8px;vertical-align:top;text-align:left}.num{text-align:right;white-space:nowrap}
.two{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}.muted{color:var(--muted)}ol li{margin:6px 0}code{font-size:14px}
footer{margin-top:44px;color:var(--muted);font-size:14px;border-top:1px solid var(--line);padding-top:16px}
</style></head><body><main>
<div class="kicker">Saktum MCP Trust Census · ${month}</div>
<h1>State of MCP Trust</h1>
<p class="lede">How ready are the MCP servers that AI agents depend on? We examined the ${n(b.scanned)} most-relevant MCP server packages on npm, covering ${n(b.weeklyDownloadsCovered)} weekly downloads, and ran Saktum Check on the ${n(d.attempted)} most-used servers. Here’s what we found, and what maintainers can fix this week.</p>
<div class="cards">
<div class="card"><div class="big">${n(b.scanned)}</div><div class="sub">MCP server packages in the supply-chain census (of ${n(b.npmTaggedMcpServer ?? b.discovered)} tagged on npm)</div></div>
<div class="card"><div class="big">${n(d.assessed)}</div><div class="sub">servers fully assessed with Saktum Check${kinds ? ` (${kinds})` : ""}${d.weeklyDownloadsAssessed ? `, ${n(d.weeklyDownloadsAssessed)} weekly npm downloads` : ""}</div></div>
<div class="card"><div class="big">${pctOf(d.maturity[4].atLeast, d.assessed)}%</div><div class="sub">reach L5 Assured, the top of the maturity model</div></div>
<div class="card"><div class="big">${d.noAnnotations}%</div><div class="sub">declare no danger annotations, so clients can’t warn before risky actions</div></div>
</div>

<h2>The Saktum MCP Maturity Model</h2>
<p class="muted">Five cumulative levels, each defined only by evidence Saktum Check measures. Bars show how many assessed servers reach at least each level.</p>
<div class="panel"><svg viewBox="0 0 860 236" role="img" aria-label="Maturity levels">${funnel}</svg>
<table><tr><th>Level</th><th>Name</th><th>What it takes</th><th class="num">Servers at exactly this level</th></tr>${levelRows}</table></div>

<h2>The trust quadrant</h2>
<p class="muted">Each dot is an assessed server (not named). Trust covers conformance, sign-in and security; agent readiness covers whether agents can choose and use the tools safely and cheaply. Dividers at 90.</p>
<div class="panel">${quadrant}</div>

<h2>What we found</h2>
<div class="two">
<div class="panel"><b>Agent readiness</b><p>${d.noAnnotations}% of servers declare no danger annotations and ${d.partialAnnotations}% declare them on only some tools. ${d.readinessA}% earn agent readiness A. Tool definitions cost a median of ${n(d.tokensMedian)} tokens per agent turn (90th percentile ${n(d.tokensP90)}), and ${n(d.over20k)} servers exceed 20,000 tokens before an agent does any work.</p></div>
<div class="panel"><b>Trust checks that fail most</b><table>${fails}</table><p class="muted">${d.trustA}% of assessed servers earn trust A on these checks: most popular servers handle the basics well.</p></div>
</div>
${remoteSection}
${protoSection}
<h2>What these servers can do</h2>
<p class="muted">Capabilities declared by annotations or conservatively inferred from tool names and descriptions. ${n(d.trifecta)} server${d.trifecta === 1 ? "" : "s"} combine private data, untrusted content and an outbound channel (the “lethal trifecta”).</p>
<div class="panel"><svg viewBox="0 0 640 ${d.capabilities.length * 34}" role="img" aria-label="Capability prevalence">${capBars}</svg></div>

<h2>Supply chain across ${n(b.scanned)} packages</h2>
<div class="cards">
<div class="card"><div class="big">${b.provenance}%</div><div class="sub">publish npm provenance: the rest can’t prove which source and build produced the package</div></div>
<div class="card"><div class="big">${b.installScripts}%</div><div class="sub">run install scripts, code that executes automatically on install</div></div>
<div class="card"><div class="big">${b.noRepository}%</div><div class="sub">link no source repository</div></div>
<div class="card"><div class="big">${b.usesMcpSdk}%</div><div class="sub">build on an official or common MCP SDK</div></div>
</div>

<h2>Five fixes for maintainers</h2>
<ol>
<li><b>Declare danger annotations</b> (<code>readOnlyHint</code>, <code>destructiveHint</code>) on every tool, so clients can ask before an agent deletes something.</li>
<li><b>Trim tool definitions:</b> every token is paid on every agent turn. Shorten descriptions and drop rarely used tools.</li>
<li><b>Publish with npm provenance</b> (<code>npm publish --provenance</code> from CI) and avoid install scripts.</li>
<li><b>Answer unknown tools with an error,</b> never success, and keep errors free of stack traces and file paths.</li>
<li><b>Test what your tools return:</b> declare an <code>outputSchema</code> and run your own test cases in CI (<code>npx saktum test</code>).</li>
</ol>

<h2>Get your server’s report</h2>
<p>Run it yourself in a minute: <code>npx saktum check -- npx -y your-package</code>. Maintainers can also request their server’s census report privately.</p>

<h2>Method, ethics and limits</h2>
<p class="muted">Supply-chain signals come from public npm registry metadata. The deep assessment installed each server with install scripts disabled and ran Saktum Check ${esc(c.method.match(/Saktum Check [0-9.]+/)?.[0] ?? "")} in passive mode on a disposable machine: no tool was called, no credentials were supplied, and nothing was sent to any third-party service. Servers that need configuration to start (${n(d.couldNotStart)} of ${n(d.attempted)}) or that list no tools without credentials (${n(d.noGrade)}) are not graded. This report names no server; individual results are shared only with maintainers on request. Results describe each package at the time of the census and are not a guarantee of security. Capability inference is deliberately conservative and may miss capabilities rather than invent them.</p>
<footer>Saktum MCP Trust Census · generated ${esc(c.generatedAt.slice(0, 10))} with Saktum Check, free and open source (github.com/soodhere/saktum-check).</footer>
</main></body></html>`;
writeFileSync("report/index.html", html);
console.log(`report/index.html written (${Math.round(html.length / 1024)} KB)`);
