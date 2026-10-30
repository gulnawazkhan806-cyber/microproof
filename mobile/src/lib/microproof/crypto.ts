import * as Crypto from "expo-crypto";
import nacl from "tweetnacl";
import type { Identity } from "./types";

function buffer(length: number): Uint8Array {
  return new Uint8Array(length);
}

export function toB64(data: Uint8Array): string {
  const table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < data.length; i += 3) {
    const a = data[i] ?? 0;
    const b = data[i + 1] ?? 0;
    const c = data[i + 2] ?? 0;
    const triple = (a << 16) | (b << 8) | c;
    out += table[(triple >> 18) & 63];
    out += table[(triple >> 12) & 63];
    out += i + 1 < data.length ? table[(triple >> 6) & 63] : "=";
    out += i + 2 < data.length ? table[triple & 63] : "=";
  }
  return out;
}

export function fromB64(value: string): Uint8Array {
  const table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = value.replace(/=+$/, "");
  const out = buffer(Math.floor((clean.length * 3) / 4));
  let cursor = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = table.indexOf(clean[i] ?? "A");
    const b = table.indexOf(clean[i + 1] ?? "A");
    const c = table.indexOf(clean[i + 2] ?? "A");
    const d = table.indexOf(clean[i + 3] ?? "A");
    const triple = (a << 18) | (b << 12) | ((c & 63) << 6) | (d & 63);
    if (cursor < out.length) out[cursor++] = (triple >> 16) & 255;
    if (i + 2 < clean.length && cursor < out.length) out[cursor++] = (triple >> 8) & 255;
    if (i + 3 < clean.length && cursor < out.length) out[cursor++] = triple & 255;
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) throw new Error("Malformed digest.");
  const out = buffer(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const text = new TextEncoder();

export function utf8(value: string): Uint8Array {
  return text.encode(value);
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const copy = new Uint8Array(new ArrayBuffer(data.byteLength));
  copy.set(data);
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, copy);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function generateIdentity(): Identity {
  const pair = nacl.sign.keyPair();
  return {
    publicKey: toB64(pair.publicKey),
    secretKey: toB64(pair.secretKey),
    createdAt: new Date().toISOString(),
  };
}

export function signDigest(digest: Uint8Array, secretKey: string): string {
  return toB64(nacl.sign.detached(digest, fromB64(secretKey)));
}

export function verifyDigest(digest: Uint8Array, signature: string, publicKey: string): boolean {
  try {
    return nacl.sign.detached.verify(digest, fromB64(signature), fromB64(publicKey));
  } catch {
    return false;
  }
}

export function groupHex(hex: string): string {
  return hex.toUpperCase().replace(/(.{4})/g, "$1 ").trim();
}

export function fingerprint(publicKey: string): string {
  try {
    const hex = [...fromB64(publicKey).subarray(0, 6)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    return hex.match(/.{1,4}/g)?.join(" ") ?? "—";
  } catch {
    return "—";
  }
}

export function randomId(): string {
  return Crypto.randomUUID();
}
