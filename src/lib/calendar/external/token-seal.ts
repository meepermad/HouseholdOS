/**
 * AES-256-GCM seal for OAuth refresh tokens at rest.
 * Never expose plaintext tokens to the browser.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

function keyFromEnv(secret: string): Buffer {
  // Derive 32 bytes from the configured secret
  const buf = Buffer.alloc(32);
  Buffer.from(secret, "utf8").copy(buf);
  if (secret.length >= 32) {
    return Buffer.from(secret.slice(0, 32), "utf8");
  }
  // Pad short secrets (dev only); production must set CALENDAR_TOKEN_ENCRYPTION_KEY
  return buf;
}

export function sealSecret(
  plaintext: string,
  encryptionKey: string,
): { ciphertext: string; nonce: string } {
  const key = keyFromEnv(encryptionKey);
  const nonce = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, nonce);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([enc, tag]).toString("base64"),
    nonce: nonce.toString("base64"),
  };
}

export function unsealSecret(
  ciphertextB64: string,
  nonceB64: string,
  encryptionKey: string,
): string {
  const key = keyFromEnv(encryptionKey);
  const nonce = Buffer.from(nonceB64, "base64");
  const raw = Buffer.from(ciphertextB64, "base64");
  const tag = raw.subarray(raw.length - 16);
  const data = raw.subarray(0, raw.length - 16);
  const decipher = createDecipheriv(ALGO, key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

export function redactToken(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}…${value.slice(-2)}`;
}
