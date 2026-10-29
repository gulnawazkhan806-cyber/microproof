export const TEMPLATE_TYPES = ["BUY_SELL", "ITEM_BORROW", "PROPERTY_CHECK", "EXPENSE_SPLIT"] as const;

export type TemplateType = (typeof TEMPLATE_TYPES)[number];

export function isTemplate(value: unknown): value is TemplateType {
  return typeof value === "string" && (TEMPLATE_TYPES as readonly string[]).includes(value);
}

export type PhotoRef = { hash: string; label: string };

export type GpsFix = { lat: number; lng: number; accuracy: number };

export type Payload = {
  protocol: "microproof-1";
  version: 1;
  id: string;
  template: TemplateType;
  initiator: string;
  initiatorPub: string;
  counterparty: string;
  fields: Record<string, string>;
  clauses: string[];
  photos: PhotoRef[];
  gps: GpsFix | null;
  createdAt: string;
};

export type AgreementStatus = "DRAFT" | "SIGNED" | "DISPUTED" | "RESOLVED";

export type Agreement = {
  id: string;
  template_type: TemplateType;
  payload_json: string;
  sha256_hash: string;
  sig_party_a: string;
  sig_party_b: string | null;
  pub_party_a: string;
  pub_party_b: string | null;
  status: AgreementStatus;
  role: "A" | "B";
  updatedAt: string;
};
