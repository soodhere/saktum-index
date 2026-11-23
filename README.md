# Saktum MCP Trust Census

A monthly census of the public MCP server ecosystem with [Saktum Check](https://github.com/soodhere/saktum-check),
producing the **State of MCP Trust** report: the Saktum MCP Maturity Model, the trust quadrant, ecosystem statistics and
fixes for maintainers.

## Get your server's report
Open an issue titled **`Scan: your-package-name`** (or `Scan: https://your-server/mcp`). A bot replies with a Saktum Check
report in a few minutes. Or run it yourself: `npx saktum check -- npx -y your-package-name`.

## How the census works
1. **Discovery** (`scripts/discover.mjs`): npm packages tagged `mcp-server`, ranked by weekly downloads.
2. **Broad census** (`scripts/static.mjs`): supply-chain signals from public registry metadata only: provenance, install
   scripts, deprecation, licence, source repository, dependencies, MCP SDK use. No code is executed.
3. **Deep census** (`scripts/deep.mjs`): the most-used runnable servers are installed **with install scripts disabled** and
   checked with Saktum Check in **passive mode** (no tool is called, no credentials supplied), on disposable machines.
4. **Aggregate and render** (`scripts/aggregate.mjs`, `scripts/render.mjs`): maturity levels, quadrant, statistics, and
   the report page. Public output contains aggregates only.

At scale, `.github/workflows/census.yml` runs steps 1 to 4 across up to 20 parallel GitHub Actions runners.

## Saktum MCP Maturity Model
| Level | Name | Evidence |
| --- | --- | --- |
| L1 | Responds | Starts, completes the MCP handshake, lists tools |
| L2 | Conformant | No failed conformance checks |
| L3 | Safe by default | No failed security checks |
| L4 | Agent-ready | Agent readiness A (annotations, descriptions, context cost) |
| L5 | Assured | npm provenance and no install scripts |

## Ethics and safety
- **Passive only:** the census never calls a server's tools and never supplies credentials. Remote servers are never probed
  beyond what an MCP client does when connecting.
- **No naming in public:** published reports contain aggregates only. Individual results are shared only with the
  maintainer, on request. Maintainers can ask for their package to be excluded.
- **Isolation:** packages are installed with install scripts disabled and run on disposable machines with no secrets.
  The scan bot runs untrusted code only in a job with a read-only token; the job that comments never runs untrusted code.
- **Point in time:** results describe each package version at the time of the census and are not a guarantee of security.
