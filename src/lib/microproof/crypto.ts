import nacl from "tweetnacl";

export type Identity = {
  publicKey: string;
  secretKey: string;
  createdAt: string;
};

function buffer(length: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new ArrayBuffer(length));
}

export function toBytes(view: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = buffer(view.byteLength);
  out.set(view);
  return out;
}

export function toB64(data: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < data.length; i++) bin += String.fromCharCode(data[i]!);
  return btoa(bin);
}

export function fromB64(value: string): Uint8Array<ArrayBuffer> {
  const bin = atob(value);
  const out = buffer(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) throw new Error("Malformed digest.");
  const out = buffer(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function groupHex(hex: string): string {
  return hex.toUpperCase().replace(/(.{4})/g, "$1 ").trim();
}

const text = new TextEncoder();

export function utf8(value: string): Uint8Array<ArrayBuffer> {
  return toBytes(text.encode(value));
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toBytes(data));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
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
  return toB64(nacl.sign.detached(toBytes(digest), fromB64(secretKey)));
}

export function verifyDigest(digest: Uint8Array, signature: string, publicKey: string): boolean {
  try {
    return nacl.sign.detached.verify(toBytes(digest), fromB64(signature), fromB64(publicKey));
  } catch {
    return false;
  }
}

export function fingerprint(publicKey: string): string {
  try {
    const hex = [...fromB64(publicKey).subarray(0, 6)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    return hex.match(/.{1,4}/g)?.join(" ") ?? "—";
  } catch {
    return "—";
  }
}

export async function runtimeCryptoOk(): Promise<boolean> {
  const id = generateIdentity();
  const digest = hexToBytes(await sha256Hex(utf8("microproof")));
  const sig = signDigest(digest, id.secretKey);
  return verifyDigest(digest, sig, id.publicKey);
}
