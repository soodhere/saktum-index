// Sealing per-server census results, so artifacts on a public repository reveal nothing about individual servers.
// AES-256-GCM with a random key per bundle; the key is encrypted with the census RSA public key (OAEP, SHA-256).
//   node scripts/sealing.mjs keys                         -> census-public.pem (commit) and census-private.pem (keep secret)
//   node scripts/sealing.mjs seal <dir...> <out.sealed>   -> encrypt every file in the folders
//   node scripts/sealing.mjs unseal <in.sealed> [dest]    -> decrypt (private key from CENSUS_PRIVATE_KEY or census-private.pem)
import { constants, createCipheriv, createDecipheriv, generateKeyPairSync, privateDecrypt, publicEncrypt, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
const OAEP = { padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" };
const walk = (d) => !existsSync(d) ? [] : statSync(d).isFile() ? [d] : readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const [cmd, ...a] = process.argv.slice(2);
if (cmd === "keys") {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 3072, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  writeFileSync("census-public.pem", publicKey); writeFileSync("census-private.pem", privateKey, { mode: 0o600 });
  console.log("Wrote census-public.pem (commit it) and census-private.pem (add it as the CENSUS_PRIVATE_KEY secret, then keep it safe; never commit it).");
} else if (cmd === "seal") {
  const out = a.pop(); const files = {};
  for (const d of a) for (const f of walk(d)) files[relative(".", f)] = readFileSync(f).toString("base64");
  const key = randomBytes(32), iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([c.update(JSON.stringify(files)), c.final()]);
  writeFileSync(out, JSON.stringify({ sealed: "saktum-census/1", key: publicEncrypt({ key: readFileSync("census-public.pem"), ...OAEP }, key).toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), body: body.toString("base64") }));
  console.log(`sealed ${Object.keys(files).length} files into ${out}`);
} else if (cmd === "unseal") {
  const [inp, dest = "."] = a;
  const pem = process.env.CENSUS_PRIVATE_KEY || (existsSync("census-private.pem") ? readFileSync("census-private.pem", "utf8") : "");
  if (!pem) { console.error("No private key: set CENSUS_PRIVATE_KEY or place census-private.pem here."); process.exit(1); }
  const s = JSON.parse(readFileSync(inp, "utf8"));
  const key = privateDecrypt({ key: pem, ...OAEP }, Buffer.from(s.key, "base64"));
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(s.iv, "base64")); d.setAuthTag(Buffer.from(s.tag, "base64"));
  const files = JSON.parse(Buffer.concat([d.update(Buffer.from(s.body, "base64")), d.final()]).toString("utf8"));
  for (const [p, b64] of Object.entries(files)) { const t = join(dest, p); mkdirSync(dirname(t), { recursive: true }); writeFileSync(t, Buffer.from(b64, "base64")); }
  console.log(`unsealed ${Object.keys(files).length} files`);
} else { console.error("usage: keys | seal <dir...> <out> | unseal <in> [dest]"); process.exit(1); }
