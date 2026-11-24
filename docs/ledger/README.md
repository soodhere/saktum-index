# The Saktum trust ledger

An append-only, hash-chained public log of signed Saktum attestations for MCP servers: Certificate Transparency for the
tools AI agents use.

- **Publish** (providers): `npx saktum check -- <your server>`, then `npx saktum attest saktum-report.json --publish`, and
  open the link. A bot verifies the signature and appends the entry.
- **Verify** (anyone): `npx saktum ledger verify` checks every signature and the whole chain; any edit, deletion or
  reordering is detected.
- **Use** (firewalls, gateways, enterprises): `npx saktum ledger find <server>`, or
  `npx saktum allowlist --from-ledger --trusted-signers signers.txt` to build an allowlist pinned to the exact tools.

Entries are **signed claims**: each states its assurance level (L1 = self-tested by the signer). The bot verifies
signatures and the chain and never runs anyone's code. Independent re-checks (L2) and certification (L3) come later.
