# Saktum MCP Maturity Model, version 1.0

**Status:** published 24 November 2026 · **Licence:** CC BY 4.0 (share and adapt with attribution) · **Maintainer:** Saktum

The maturity model describes how ready an MCP server is to be trusted by AI agents and the people who deploy them. Levels are **cumulative** and defined **only by evidence that can be measured** by an independent tool, so anyone can reproduce a level from the same server version.

| Level | Name | Requirement | Evidence |
| --- | --- | --- | --- |
| L1 | Responds | The server starts (or answers at its URL), completes the MCP initialisation handshake, and lists at least one tool. | Saktum Check connects as an MCP client; a trust grade is produced (enough scored checks ran). |
| L2 | Conformant | L1, and no failed conformance check: valid input schemas, valid tool names, and an honest answer to a call for a tool that does not exist. | Scored checks in the conformance pack all pass. |
| L3 | Safe by default | L2, and no failed security check: no hidden instructions to agents, no invisible, bidirectional or terminal-control characters, no secrets in tools or errors, no stack traces or source paths in errors; local HTTP servers refuse foreign web origins. | Scored checks in the security pack all pass. |
| L4 | Agent-ready | L3, and agent readiness A: tools declare danger annotations, have usable descriptions, and keep context cost reasonable. | Agent readiness score of 90 or more (annotations 30%, descriptions 40%, context cost 30%, with partial credit). |
| L5 | Assured | L4, and a verifiable supply chain: the package publishes provenance (for npm, a provenance attestation) and runs no install scripts. | Registry metadata for the exact version checked. |

## Measuring a level

1. Assess a specific version of the server (package version, or the remote endpoint at a point in time) without credentials and without calling its tools (passive), as the Saktum MCP Trust Census does.
2. Record the tool fingerprint (a hash of the tool definitions); a level applies only while the tools match it.
3. Servers that need configuration or credentials to start, or that list no tools without credentials, are **not assessed** rather than given a low level.

## Relation to other measures

- **Assurance levels** describe *who* ran the assessment: L1 self-tested (signed by the person who ran it), L2 independently run, L3 certified. Maturity describes *what* the evidence shows; both are stated together.
- **OWASP MCP Top 10:** L2 and L3 evidence covers parts of MCP01, MCP03, MCP05, MCP06 and MCP07; L5 covers part of MCP04. Coverage is partial and stated in every Saktum report.
- **Trust and agent-readiness grades** are finer-grained measures from the same checks; levels are the coarse, comparable summary.

## Changes

Changes are versioned (1.1, 2.0) and announced with the census that first uses them, with the previous version kept for comparison. Proposals are welcome as issues in this repository.
