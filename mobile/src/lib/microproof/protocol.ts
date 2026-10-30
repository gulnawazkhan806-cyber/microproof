import { canonicalize } from "./canonical";
import { hexToBytes, sha256Hex, signDigest, utf8, verifyDigest } from "./crypto";
import { getTemplate } from "./templates";
import { isTemplate, type Agreement, type GpsFix, type Payload, type PhotoRef, type TemplateType } from "./types";

export function buildPayload(input: {
  id: string;
  template: TemplateType;
  initiator: string;
  initiatorPub: string;
  counterparty: string;
  fields: Record<string, string>;
  photos: PhotoRef[];
  gps: GpsFix | null;
  createdAt: string;
}): Payload {
  const spec = getTemplate(input.template);
  const fields: Record<string, string> = {};
  for (const field of spec.fields) {
    const value = (input.fields[field.key] ?? "").trim();
    if (value) fields[field.key] = value;
  }
  if (!fields.yourRole) {
    const fallback = spec.fields.find((field) => field.key === "yourRole")?.options?.[0];
    if (fallback) fields.yourRole = fallback;
  }
  return {
    protocol: "microproof-1",
    version: 1,
    id: input.id,
    template: input.template,
    initiator: input.initiator.trim(),
    initiatorPub: input.initiatorPub,
    counterparty: input.counterparty.trim(),
    fields,
    clauses: [...spec.clauses],
    photos: input.photos.map((photo) => ({ hash: photo.hash, label: photo.label.trim() || "Photo" })),
    gps: input.gps
      ? {
          lat: Math.round(input.gps.lat * 1e5) / 1e5,
          lng: Math.round(input.gps.lng * 1e5) / 1e5,
          accuracy: Math.round(input.gps.accuracy),
        }
      : null,
    createdAt: input.createdAt,
  };
}

export function readPayload(json: string): Payload {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error("The terms are not valid JSON.");
  }
  if (!value || typeof value !== "object") throw new Error("Unrecognized agreement.");
  const record = value as Partial<Payload>;
  if (record.protocol !== "microproof-1" || record.version !== 1) {
    throw new Error("Unsupported agreement version.");
  }
  if (!isTemplate(record.template) || typeof record.id !== "string") throw new Error("The terms are incomplete.");
  if (typeof record.initiator !== "string" || typeof record.counterparty !== "string" || typeof record.initiatorPub !== "string") {
    throw new Error("The terms are missing a party.");
  }
  if (!record.fields || typeof record.fields !== "object" || Array.isArray(record.fields)) {
    throw new Error("The terms are missing their fields.");
  }
  if (!Array.isArray(record.clauses) || !Array.isArray(record.photos) || typeof record.createdAt !== "string") {
    throw new Error("The terms are incomplete.");
  }
  return {
    protocol: "microproof-1",
    version: 1,
    id: record.id,
    template: record.template,
    initiator: record.initiator,
    initiatorPub: record.initiatorPub,
    counterparty: record.counterparty,
    fields: record.fields as Record<string, string>,
    clauses: record.clauses.filter((clause): clause is string => typeof clause === "string"),
    photos: record.photos
      .filter((photo): photo is PhotoRef => {
        if (!photo || typeof photo !== "object") return false;
        const candidate = photo as PhotoRef;
        return typeof candidate.hash === "string" && typeof candidate.label === "string";
      })
      .map((photo) => ({ hash: photo.hash, label: photo.label })),
    gps:
      record.gps && typeof record.gps === "object"
        ? {
            lat: Number((record.gps as GpsFix).lat),
            lng: Number((record.gps as GpsFix).lng),
            accuracy: Number((record.gps as GpsFix).accuracy),
          }
        : null,
    createdAt: record.createdAt,
  };
}

export type OfferMessage = {
  kind: "offer";
  payloadJson: string;
  hash: string;
  sigA: string;
  pubA: string;
  id: string;
};

export type AcceptMessage = {
  kind: "accept";
  id: string;
  hash: string;
  sigB: string;
  pubB: string;
};

export function offerText(agreement: Agreement): string {
  return JSON.stringify({
    v: 1,
    k: "o",
    c: agreement.payload_json,
    h: agreement.sha256_hash,
    s: agreement.sig_party_a,
    p: agreement.pub_party_a,
  });
}

export function acceptText(id: string, hash: string, signature: string, publicKey: string): string {
  return JSON.stringify({ v: 1, k: "a", id, h: hash, s: signature, p: publicKey });
}

export function parseMessage(text: string): OfferMessage | AcceptMessage {
  let raw: unknown;
  try {
    raw = JSON.parse(text.trim());
  } catch {
    throw new Error("That isn't a MicroProof code.");
  }
  if (!raw || typeof raw !== "object") throw new Error("Unrecognized code.");
  const message = raw as Record<string, unknown>;
  if (message.v !== 1) throw new Error("Unsupported code version.");
  if (message.k === "o") {
    if (typeof message.c !== "string" || typeof message.h !== "string" || typeof message.s !== "string" || typeof message.p !== "string") {
      throw new Error("This offer code is incomplete.");
    }
    const payload = readPayload(message.c);
    return { kind: "offer", payloadJson: message.c, hash: message.h, sigA: message.s, pubA: message.p, id: payload.id };
  }
  if (message.k === "a") {
    if (typeof message.id !== "string" || typeof message.h !== "string" || typeof message.s !== "string" || typeof message.p !== "string") {
      throw new Error("This reply code is incomplete.");
    }
    return { kind: "accept", id: message.id, hash: message.h, sigB: message.s, pubB: message.p };
  }
  throw new Error("Unrecognized code.");
}

export type AuthenticatedOffer = OfferMessage & { payload: Payload };

export async function authenticateOffer(text: string): Promise<AuthenticatedOffer> {
  const message = parseMessage(text);
  if (message.kind !== "offer") throw new Error("That code is a signed reply, not an offer.");
  const recomputed = await sha256Hex(utf8(message.payloadJson));
  if (recomputed !== message.hash) throw new Error("The digest does not match the terms in the code.");
  const payload = readPayload(message.payloadJson);
  if (canonicalize(payload) !== message.payloadJson) throw new Error("The terms are not in canonical form.");
  if (payload.initiatorPub !== message.pubA || payload.id !== message.id) {
    throw new Error("The initiator key does not match the signed terms.");
  }
  if (!verifyDigest(hexToBytes(recomputed), message.sigA, message.pubA)) {
    throw new Error("The initiator signature does not verify.");
  }
  return { ...message, payload };
}

export type Integrity = {
  hashOk: boolean;
  sigAOk: boolean;
  sigBOk: boolean;
  state: "sealed" | "waiting" | "broken";
};

export async function inspect(agreement: Agreement): Promise<Integrity> {
  let recomputed = "";
  try {
    recomputed = await sha256Hex(utf8(agreement.payload_json));
  } catch {
    return { hashOk: false, sigAOk: false, sigBOk: false, state: "broken" };
  }
  const hashOk = recomputed === agreement.sha256_hash;
  let pubBound = false;
  try {
    pubBound = readPayload(agreement.payload_json).initiatorPub === agreement.pub_party_a;
  } catch {
    pubBound = false;
  }
  const digest = hexToBytes(recomputed);
  const sigAOk = hashOk && pubBound && verifyDigest(digest, agreement.sig_party_a, agreement.pub_party_a);
  const sigBOk = Boolean(
    agreement.sig_party_b &&
      agreement.pub_party_b &&
      hashOk &&
      agreement.pub_party_b !== agreement.pub_party_a &&
      verifyDigest(digest, agreement.sig_party_b, agreement.pub_party_b),
  );
  let state: Integrity["state"] = "broken";
  if (sigAOk && sigBOk) state = "sealed";
  else if (sigAOk && !agreement.sig_party_b) state = "waiting";
  return { hashOk, sigAOk, sigBOk, state };
}

export function exportRecord(agreement: Agreement): string {
  return JSON.stringify(
    {
      id: agreement.id,
      template_type: agreement.template_type,
      status: agreement.status,
      payload_json: agreement.payload_json,
      sha256_hash: agreement.sha256_hash,
      sig_party_a: agreement.sig_party_a,
      sig_party_b: agreement.sig_party_b,
      pub_party_a: agreement.pub_party_a,
      pub_party_b: agreement.pub_party_b,
    },
    null,
    2,
  );
}
