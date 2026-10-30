import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";
import { useSyncExternalStore } from "react";
import { canonicalize } from "./canonical";
import { generateIdentity, hexToBytes, randomId, sha256Hex, signDigest, utf8, verifyDigest } from "./crypto";
import { acceptText, authenticateOffer, buildPayload, offerText, parseMessage } from "./protocol";
import type { Agreement, AgreementStatus, GpsFix, Identity, PhotoRef, TemplateType } from "./types";
import { isTemplate } from "./types";

const IDENTITY_KEY = "microproof.identity";
const BENCH_KEY = "microproof.bench";

type Db = {
  ready: boolean;
  identity: Identity | null;
  benchIdentity: Identity | null;
  agreements: Agreement[];
};

let database: SQLite.SQLiteDatabase | null = null;
let snapshot: Db = { ready: false, identity: null, benchIdentity: null, agreements: [] };
const listeners = new Set<() => void>();

function emit(next: Db) {
  snapshot = next;
  for (const listener of listeners) listener();
}

export function useDb(): Db {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => snapshot,
  );
}

async function openDb(): Promise<SQLite.SQLiteDatabase> {
  if (database) return database;
  database = await SQLite.openDatabaseAsync("microproof.db");
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS agreements (
      id TEXT PRIMARY KEY NOT NULL,
      template_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      sha256_hash TEXT NOT NULL,
      sig_party_a TEXT NOT NULL,
      sig_party_b TEXT,
      pub_party_a TEXT NOT NULL,
      pub_party_b TEXT,
      status TEXT NOT NULL,
      role TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);
  return database;
}

function asAgreement(row: Record<string, unknown>): Agreement | null {
  if (!isTemplate(row.template_type)) return null;
  const status = row.status;
  if (status !== "DRAFT" && status !== "SIGNED" && status !== "DISPUTED" && status !== "RESOLVED") return null;
  if (row.role !== "A" && row.role !== "B") return null;
  return {
    id: String(row.id),
    template_type: row.template_type,
    payload_json: String(row.payload_json),
    sha256_hash: String(row.sha256_hash),
    sig_party_a: String(row.sig_party_a),
    sig_party_b: row.sig_party_b == null ? null : String(row.sig_party_b),
    pub_party_a: String(row.pub_party_a),
    pub_party_b: row.pub_party_b == null ? null : String(row.pub_party_b),
    status,
    role: row.role,
    updatedAt: String(row.updatedAt),
  };
}

async function readIdentity(key: string): Promise<Identity | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Identity;
    if (typeof parsed.publicKey !== "string" || typeof parsed.secretKey !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeIdentity(key: string, identity: Identity) {
  await SecureStore.setItemAsync(key, JSON.stringify(identity));
}

async function persist(agreement: Agreement) {
  const db = await openDb();
  await db.runAsync(
    `INSERT INTO agreements (
      id, template_type, payload_json, sha256_hash, sig_party_a, sig_party_b,
      pub_party_a, pub_party_b, status, role, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      payload_json = excluded.payload_json,
      sha256_hash = excluded.sha256_hash,
      sig_party_a = excluded.sig_party_a,
      sig_party_b = excluded.sig_party_b,
      pub_party_a = excluded.pub_party_a,
      pub_party_b = excluded.pub_party_b,
      status = excluded.status,
      role = excluded.role,
      updatedAt = excluded.updatedAt`,
    agreement.id,
    agreement.template_type,
    agreement.payload_json,
    agreement.sha256_hash,
    agreement.sig_party_a,
    agreement.sig_party_b,
    agreement.pub_party_a,
    agreement.pub_party_b,
    agreement.status,
    agreement.role,
    agreement.updatedAt,
  );
}

function remember(agreement: Agreement) {
  const rest = snapshot.agreements.filter((item) => item.id !== agreement.id);
  emit({ ...snapshot, agreements: [agreement, ...rest] });
}

export async function bootstrap() {
  const [identity, benchIdentity] = await Promise.all([readIdentity(IDENTITY_KEY), readIdentity(BENCH_KEY)]);
  const db = await openDb();
  const rows = await db.getAllAsync<Record<string, unknown>>("SELECT * FROM agreements ORDER BY updatedAt DESC");
  const agreements = rows.map(asAgreement).filter((item): item is Agreement => item !== null);
  emit({ ready: true, identity, benchIdentity, agreements });
}

export async function ensureIdentity(): Promise<Identity> {
  if (snapshot.identity) return snapshot.identity;
  const existing = await readIdentity(IDENTITY_KEY);
  if (existing) {
    emit({ ...snapshot, identity: existing });
    return existing;
  }
  const identity = generateIdentity();
  await writeIdentity(IDENTITY_KEY, identity);
  emit({ ...snapshot, identity });
  return identity;
}

export async function ensureBenchIdentity(): Promise<Identity> {
  if (snapshot.benchIdentity) return snapshot.benchIdentity;
  const existing = await readIdentity(BENCH_KEY);
  if (existing) {
    emit({ ...snapshot, benchIdentity: existing });
    return existing;
  }
  const identity = generateIdentity();
  await writeIdentity(BENCH_KEY, identity);
  emit({ ...snapshot, benchIdentity: identity });
  return identity;
}

export async function replaceIdentity(): Promise<Identity> {
  const identity = generateIdentity();
  await writeIdentity(IDENTITY_KEY, identity);
  emit({ ...snapshot, identity });
  return identity;
}

export async function createDraft(input: {
  template: TemplateType;
  initiator: string;
  counterparty: string;
  fields: Record<string, string>;
  photos: PhotoRef[];
  gps: GpsFix | null;
}): Promise<Agreement> {
  const identity = await ensureIdentity();
  const createdAt = new Date().toISOString();
  const payload = buildPayload({
    id: randomId(),
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
    id: payload.id,
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
  await persist(agreement);
  remember(agreement);
  return agreement;
}

export async function acceptOffer(messageText: string, which: "primary" | "bench") {
  const offer = await authenticateOffer(messageText);
  const identity = which === "bench" ? await ensureBenchIdentity() : await ensureIdentity();
  if (identity.publicKey === offer.pubA) {
    throw new Error("This code was signed by the key on this phone. The other person has to sign it.");
  }
  const signature = signDigest(hexToBytes(offer.hash), identity.secretKey);
  const now = new Date().toISOString();
  const existing = snapshot.agreements.find((item) => item.id === offer.id);
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
  await persist(agreement);
  remember(agreement);
  return { agreement, responseText: acceptText(agreement.id, agreement.sha256_hash, signature, identity.publicKey) };
}

export async function applyAccept(messageText: string): Promise<Agreement> {
  const message = parseMessage(messageText);
  if (message.kind !== "accept") throw new Error("That code is an offer, not a signed reply.");
  const existing = snapshot.agreements.find((item) => item.id === message.id);
  if (!existing) throw new Error("No matching draft on this device. Open the reply on the phone that started it.");
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
  await persist(agreement);
  remember(agreement);
  return agreement;
}

export async function setStatus(id: string, status: Extract<AgreementStatus, "DISPUTED" | "RESOLVED">) {
  const current = snapshot.agreements.find((item) => item.id === id);
  if (!current) return;
  const allowed =
    (status === "DISPUTED" && (current.status === "SIGNED" || current.status === "RESOLVED")) ||
    (status === "RESOLVED" && current.status === "DISPUTED");
  if (!allowed) return;
  const agreement = { ...current, status, updatedAt: new Date().toISOString() };
  await persist(agreement);
  remember(agreement);
}
