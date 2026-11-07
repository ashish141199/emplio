import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Logins we hold ourselves (API keys), encrypted at rest with AES-256-GCM under ENCRYPTION_KEY.
// Stored as base64 of iv(12) + tag(16) + ciphertext.
// ponytail: one key, no rotation; add a key version prefix when the key ever has to change.
function key() {
  const k = Buffer.from(process.env.ENCRYPTION_KEY ?? "", "base64");
  if (k.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes, base64 (openssl rand -base64 32)");
  return k;
}

export function encrypt(text: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

export function decrypt(stored: string) {
  const raw = Buffer.from(stored, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

if (import.meta.main) {
  process.env.ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const sealed = encrypt("GLUSR-secret ₹");
  console.assert(sealed !== "GLUSR-secret ₹" && decrypt(sealed) === "GLUSR-secret ₹", "round trip");
  const tampered = Buffer.from(sealed, "base64");
  tampered[tampered.length - 1]! ^= 1;
  let threw = false;
  try {
    decrypt(tampered.toString("base64"));
  } catch {
    threw = true;
  }
  console.assert(threw, "tampering is caught");
  console.log("secrets ok");
}
