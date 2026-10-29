import { useSyncExternalStore } from "react";
import { canonicalize } from "./canonical";
import { generateIdentity, hexToBytes, sha256Hex, signDigest, utf8, verifyDigest, type Identity } from "./crypto";
import { acceptText, authenticateOffer, buildPayload, offerText, parseMessage } from "./protocol";
import type { Agreement, AgreementStatus, GpsFix, PhotoRef, TemplateType } from "./types";

const STORAGE_KEY = "microproof.v1";

export type Db = {
  identity: Identity | null;
  benchIdentity: Identity | null;
  agreements: Agreement[];
};

const SERVER: Db = { identity: null, benchIdentity: null, agreements: [] };

let db: Db = { identity: null, benchIdentity: null, agreements: [] };
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<Db>;
    db = {
      identity: parsed.identity ?? null,
      benchIdentity: parsed.benchIdentity ?? null,
      agreements: Array.isArray(parsed.agreements) ? parsed.agreements : [],
    };
  } catch {
    db = { identity: null, benchIdentity: null, agreements: [] };
  }
}

function commit(next: Db) {
  db = next;
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  emit();
}

export function getState(): Db {
  load();
  return db;
}

export function useDb(): Db {
  return useSyncExternalStore(subscribe, getState, () => SERVER);
}

export function ensureIdentity(): Identity {
  load();
  if (db.identity) return db.identity;
  const identity = generateIdentity();
  commit({ ...db, identity });
  return identity;
}

export function ensureBenchIdentity(): Identity {
  load();
  if (db.benchIdentity && db.benchIdentity.publicKey !== db.identity?.publicKey) return db.benchIdentity;
  const benchIdentity = generateIdentity();
  commit({ ...db, benchIdentity });
  return benchIdentity;
}

export function resetIdentity(): Identity {
  load();
  const identity = generateIdentity();
  commit({ ...db, identity });
  return identity;
}

function replace(agreement: Agreement) {
  commit({
    ...getState(),
    agreements: getState().agreements.map((item) => (item.id === agreement.id ? agreement : item)),
  });
}

export async function createDraft(input: {
  template: TemplateType;
  initiator: string;
  counterparty: string;
  fields: Record<string, string>;
  photos: PhotoRef[];
  gps: GpsFix | null;
}): Promise<Agreement> {
  const identity = ensureIdentity();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const payload = buildPayload({
    id,
    template: input.template,
    initiator: input.initiator,
    initiatorPub: identity.publicKey,
    counterparty: input.counterparty,
    fields: input.fields,
    photos: input.photos,
    gps: input.gps,
    createdAt,
  });
  const payload_json = canonicalize(payload);
  const hash = await sha256Hex(utf8(payload_json));
  const signature = signDigest(hexToBytes(hash), identity.secretKey);
  const agreement: Agreement = {
    id,
    template_type: input.template,
    payload_json,
    sha256_hash: hash,
    sig_party_a: signature,
    sig_party_b: null,
    pub_party_a: identity.publicKey,
    pub_party_b: null,
    status: "DRAFT",
    role: "A",
    updatedAt: createdAt,
  };
  await authenticateOffer(offerText(agreement));
  commit({ ...getState(), agreements: [agreement, ...getState().agreements] });
  return agreement;
}

export async function acceptOffer(
  messageText: string,
  which: "primary" | "bench",
): Promise<{ agreement: Agreement; responseText: string }> {
  const offer = await authenticateOffer(messageText);
  const identity = which === "bench" ? ensureBenchIdentity() : ensureIdentity();
  if (identity.publicKey === offer.pubA) {
    throw new Error("This code was signed by the key on this phone. The other person has to sign it.");
  }
  const signature = signDigest(hexToBytes(offer.hash), identity.secretKey);
  const now = new Date().toISOString();
  const existing = getState().agreements.find((item) => item.id === offer.id);
  if (existing && (existing.payload_json !== offer.payloadJson || existing.sha256_hash !== offer.hash)) {
    throw new Error("The code does not match the copy stored on this device.");
  }
  const agreement: Agreement = existing
    ? {
        ...existing,
        sig_party_b: signature,
        pub_party_b: identity.publicKey,
        status: existing.status === "DRAFT" ? "SIGNED" : existing.status,
        updatedAt: now,
      }
    : {
        id: offer.id,
        template_type: offer.payload.template,
        payload_json: offer.payloadJson,
        sha256_hash: offer.hash,
        sig_party_a: offer.sigA,
        sig_party_b: signature,
        pub_party_a: offer.pubA,
        pub_party_b: identity.publicKey,
        status: "SIGNED",
        role: "B",
        updatedAt: now,
      };
  if (existing) replace(agreement);
  else commit({ ...getState(), agreements: [agreement, ...getState().agreements] });
  return { agreement, responseText: acceptText(agreement.id, agreement.sha256_hash, signature, identity.publicKey) };
}

export async function applyAccept(messageText: string): Promise<Agreement> {
  const message = parseMessage(messageText);
  if (message.kind !== "accept") throw new Error("That code is an offer, not a signed reply.");
  const existing = getState().agreements.find((item) => item.id === message.id);
  if (!existing) {
    throw new Error("No matching draft on this device. Open the reply on the phone that started it.");
  }
  if (existing.sha256_hash !== message.hash) throw new Error("This reply is for a different digest than the draft stored here.");
  const recomputed = await sha256Hex(utf8(existing.payload_json));
  if (recomputed !== existing.sha256_hash) throw new Error("The stored terms no longer match their digest.");
  if (!verifyDigest(hexToBytes(recomputed), message.sigB, message.pubB)) {
    throw new Error("The counterparty signature does not verify.");
  }
  if (message.pubB === existing.pub_party_a) throw new Error("The reply is signed by the same key as the initiator.");
  const agreement: Agreement = {
    ...existing,
    sig_party_b: message.sigB,
    pub_party_b: message.pubB,
    status: existing.status === "DRAFT" ? "SIGNED" : existing.status,
    updatedAt: new Date().toISOString(),
  };
  replace(agreement);
  return agreement;
}

export function setStatus(id: string, status: Extract<AgreementStatus, "DISPUTED" | "RESOLVED">) {
  const current = getState().agreements.find((item) => item.id === id);
  if (!current) return;
  const allowed =
    (status === "DISPUTED" && (current.status === "SIGNED" || current.status === "RESOLVED")) ||
    (status === "RESOLVED" && current.status === "DISPUTED");
  if (!allowed) return;
  replace({ ...current, status, updatedAt: new Date().toISOString() });
}

export function discardDraft(id: string): boolean {
  const current = getState().agreements.find((item) => item.id === id);
  if (!current || current.status !== "DRAFT") return false;
  commit({ ...getState(), agreements: getState().agreements.filter((item) => item.id !== id) });
  return true;
}
