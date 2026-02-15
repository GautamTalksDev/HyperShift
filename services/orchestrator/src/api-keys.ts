/**
 * API key helpers: generate, hash, and verify. Key format: hs_<prefix>_<secret> (prefix 8 chars, secret 24 chars).
 */
import crypto from "crypto";

const PREFIX_LEN = 8;
const SECRET_LEN = 24;

export function generateApiKey(): {
  key: string;
  prefix: string;
  hash: string;
} {
  const prefix = crypto
    .randomBytes(PREFIX_LEN)
    .toString("hex")
    .slice(0, PREFIX_LEN);
  const secret = crypto
    .randomBytes(SECRET_LEN)
    .toString("hex")
    .slice(0, SECRET_LEN);
  const key = `hs_${prefix}_${secret}`;
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  return { key, prefix, hash };
}

export function parseAndVerifyApiKey(
  raw: string,
): { prefix: string; hash: string } | null {
  if (!raw.startsWith("hs_") || raw.length < 20) return null;
  const parts = raw.split("_");
  if (
    parts.length !== 3 ||
    parts[1].length !== PREFIX_LEN ||
    parts[2].length !== SECRET_LEN
  )
    return null;
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { prefix: parts[1], hash };
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}
