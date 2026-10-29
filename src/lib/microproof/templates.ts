import type { Payload, TemplateType } from "./types";

export type FieldKind = "text" | "money" | "date" | "textarea" | "select";

export type FieldSpec = {
  key: string;
  label: string;
  placeholder: string;
  kind: FieldKind;
  required?: boolean;
  options?: string[];
  maxLength?: number;
};

export type TemplateSpec = {
  id: TemplateType;
  index: string;
  name: string;
  blurb: string;
  clauses: string[];
  fields: FieldSpec[];
  roles: (yourRole: string) => { yours: string; theirs: string };
  title: (fields: Record<string, string>) => string;
};

export const TEMPLATES: Record<TemplateType, TemplateSpec> = {
  BUY_SELL: {
    id: "BUY_SELL",
    index: "01",
    name: "Private sale",
    blurb: "Item, serial or IMEI, price, and an as-is bill of sale.",
    clauses: [
      "Sold as-is, with no warranty of condition or fitness beyond what is written in this record.",
      "Ownership of the named item transfers when both parties have signed and the named payment has been received outside this app.",
      "The payment method is a receipt note only. This app does not hold, escrow, or move money.",
    ],
    fields: [
      { key: "yourRole", label: "You are the", placeholder: "", kind: "select", options: ["Seller", "Buyer"], required: true },
      { key: "item", label: "Item", placeholder: "2014 Trek FX 7.4", kind: "text", required: true, maxLength: 80 },
      { key: "serial", label: "Serial or IMEI", placeholder: "Optional", kind: "text", maxLength: 64 },
      { key: "price", label: "Price", placeholder: "180", kind: "money", required: true, maxLength: 16 },
      { key: "payment", label: "Payment method", placeholder: "", kind: "select", options: ["Cash", "Bank transfer", "Other"], required: true },
    ],
    roles: (role) => (role === "Buyer" ? { yours: "Buyer", theirs: "Seller" } : { yours: "Seller", theirs: "Buyer" }),
    title: (fields) => fields.item || "Private sale",
  },
  ITEM_BORROW: {
    id: "ITEM_BORROW",
    index: "02",
    name: "Equipment loan",
    blurb: "What went out, when it comes back, and the damage deposit.",
    clauses: [
      "The item will be returned by the return date in the condition received, fair wear excepted.",
      "Damage beyond fair wear is owed up to the deposit, then reasonable repair or replacement cost.",
    ],
    fields: [
      { key: "yourRole", label: "You are the", placeholder: "", kind: "select", options: ["Lender", "Borrower"], required: true },
      { key: "item", label: "Item", placeholder: "DeWalt 20V drill", kind: "text", required: true, maxLength: 80 },
      { key: "returnDate", label: "Return date", placeholder: "", kind: "date", required: true },
      { key: "deposit", label: "Deposit", placeholder: "40", kind: "money", required: true, maxLength: 16 },
      { key: "notes", label: "Condition now", placeholder: "Scratches on the grip, battery holds a charge", kind: "textarea", maxLength: 400 },
    ],
    roles: (role) => (role === "Borrower" ? { yours: "Borrower", theirs: "Lender" } : { yours: "Lender", theirs: "Borrower" }),
    title: (fields) => fields.item || "Equipment loan",
  },
  PROPERTY_CHECK: {
    id: "PROPERTY_CHECK",
    index: "03",
    name: "Property check",
    blurb: "Move-in or move-out notes, with photo fingerprints locked in.",
    clauses: [
      "The notes and photo fingerprints record the defects both parties acknowledge at this inspection.",
      "This record does not by itself release a deposit. It is the signed condition note for that decision.",
    ],
    fields: [
      { key: "yourRole", label: "You are the", placeholder: "", kind: "select", options: ["Landlord", "Tenant"], required: true },
      { key: "location", label: "Unit", placeholder: "14 Birch St, Apt 4B", kind: "text", required: true, maxLength: 120 },
      { key: "phase", label: "Inspection", placeholder: "", kind: "select", options: ["Move-in", "Move-out"], required: true },
      { key: "notes", label: "Condition notes", placeholder: "Hallway scuff on the east wall. One cracked kitchen tile.", kind: "textarea", required: true, maxLength: 400 },
    ],
    roles: (role) => (role === "Tenant" ? { yours: "Tenant", theirs: "Landlord" } : { yours: "Landlord", theirs: "Tenant" }),
    title: (fields) => fields.location || "Property check",
  },
  EXPENSE_SPLIT: {
    id: "EXPENSE_SPLIT",
    index: "04",
    name: "Expense split",
    blurb: "A named amount, a due date, and no interest.",
    clauses: [
      "The debtor named by these terms acknowledges the debt in the amount and for the reason stated.",
      "The debt carries no interest and is due on the date stated. This app does not collect it.",
    ],
    fields: [
      { key: "yourRole", label: "Direction", placeholder: "", kind: "select", options: ["They owe me", "I owe them"], required: true },
      { key: "amount", label: "Amount", placeholder: "64.20", kind: "money", required: true, maxLength: 16 },
      { key: "dueDate", label: "Due date", placeholder: "", kind: "date", required: true },
      { key: "reason", label: "Reason", placeholder: "Dinner at Lila's", kind: "text", required: true, maxLength: 120 },
    ],
    roles: (role) => (role === "I owe them" ? { yours: "Debtor", theirs: "Creditor" } : { yours: "Creditor", theirs: "Debtor" }),
    title: (fields) => fields.reason || "Expense split",
  },
};

export function getTemplate(id: TemplateType): TemplateSpec {
  return TEMPLATES[id];
}

export function agreementTitle(payload: Payload): string {
  return getTemplate(payload.template).title(payload.fields);
}

export function partyLines(payload: Payload): { role: string; name: string; side: "A" | "B" }[] {
  const roles = getTemplate(payload.template).roles(payload.fields.yourRole ?? "");
  return [
    { role: roles.yours, name: payload.initiator, side: "A" },
    { role: roles.theirs, name: payload.counterparty, side: "B" },
  ];
}

export function formatMoney(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
}

export function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fieldRows(payload: Payload): { label: string; value: string }[] {
  const spec = getTemplate(payload.template);
  const rows: { label: string; value: string }[] = [];
  for (const field of spec.fields) {
    if (field.key === "yourRole") continue;
    const raw = payload.fields[field.key];
    if (!raw) continue;
    let value = raw;
    if (field.kind === "money") value = formatMoney(raw);
    if (field.kind === "date") value = formatDate(raw);
    rows.push({ label: field.label, value });
  }
  return rows;
}

function plusDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function exampleFor(id: TemplateType): {
  initiator: string;
  counterparty: string;
  fields: Record<string, string>;
} {
  if (id === "BUY_SELL") {
    return {
      initiator: "Alex Kim",
      counterparty: "Jordan Lee",
      fields: { yourRole: "Seller", item: "2014 Trek FX 7.4", serial: "WTU123F4421", price: "180", payment: "Cash" },
    };
  }
  if (id === "ITEM_BORROW") {
    return {
      initiator: "Alex Kim",
      counterparty: "Jordan Lee",
      fields: {
        yourRole: "Lender",
        item: "DeWalt 20V drill",
        returnDate: plusDays(7),
        deposit: "40",
        notes: "Grip is scuffed. Battery holds a charge.",
      },
    };
  }
  if (id === "PROPERTY_CHECK") {
    return {
      initiator: "Alex Kim",
      counterparty: "Jordan Lee",
      fields: {
        yourRole: "Landlord",
        location: "14 Birch St, Apt 4B",
        phase: "Move-in",
        notes: "Hallway: scuff on the east wall. Kitchen: one cracked tile by the sink.",
      },
    };
  }
  return {
    initiator: "Alex Kim",
    counterparty: "Jordan Lee",
    fields: { yourRole: "They owe me", amount: "64.20", dueDate: plusDays(7), reason: "Dinner at Lila's" },
  };
}
