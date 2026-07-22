// WhatsApp share helpers — build wa.me links and formatted plain-text
// statements. Pure string builders, no network calls. Reused by customer
// and supplier statements (Part 3).

import { formatCurrency, formatDate } from "@/lib/format";

// Normalise a phone number to international digits for wa.me.
// Common Pakistani local format (03xx…) is upgraded to 92…; anything else is
// kept as raw digits. Empty phone returns "" (opens the picker).
export function normaliseWhatsAppPhone(phoneRaw: string | null | undefined): string {
  let phone = String(phoneRaw ?? "").replace(/[^0-9]/g, "");
  if (phone.startsWith("0")) phone = "92" + phone.slice(1);
  return phone;
}

// Build a wa.me link with an optional pre-filled message.
export function buildWaLink(phone: string | null | undefined, text: string): string {
  const p = normaliseWhatsAppPhone(phone);
  const base = p ? `https://wa.me/${p}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

// Open a WhatsApp share in a new tab.
export function openWhatsApp(phone: string | null | undefined, text: string): void {
  window.open(buildWaLink(phone, text), "_blank", "noopener,noreferrer");
}

export type StatementLine = {
  date: string;
  title: string;
  detail?: string;
  amount?: number | null; // signed: negative usually means money received / paid
};

export type StatementInput = {
  company: string;
  companyPhone?: string | null;
  heading: string; // e.g. "Account Statement"
  partyName: string;
  currency?: string;
  summary: { label: string; value: string }[]; // headline figures (cylinders, outstanding…)
  lines?: StatementLine[]; // recent activity (already newest-first or as given)
  maxLines?: number; // cap recent activity in the message (default 6)
};

// Build a clean, WhatsApp-friendly text statement (bold markers, bullet list).
export function formatStatementText(i: StatementInput): string {
  const currency = i.currency ?? "Rs";
  const out: string[] = [`*${i.company}* — ${i.heading}`, `Party: ${i.partyName}`, ""];
  i.summary.forEach((s) => out.push(`${s.label}: *${s.value}*`));
  const lines = i.lines ?? [];
  const cap = i.maxLines ?? 6;
  if (lines.length > 0) {
    out.push("", "Recent activity:");
    lines.slice(0, cap).forEach((l) => {
      const amt =
        l.amount != null && l.amount !== 0
          ? ` — ${formatCurrency(Math.abs(l.amount), currency)}`
          : "";
      out.push(`• ${formatDate(l.date)} ${l.title}${l.detail ? ` (${l.detail})` : ""}${amt}`);
    });
  }
  if (i.companyPhone) out.push("", `Contact: ${i.companyPhone}`);
  return out.join("\n");
}

// Convenience: customer account statement text.
export function formatCustomerStatement(args: {
  company: string;
  companyPhone?: string | null;
  currency?: string;
  customerName: string;
  cylindersWithCustomer: number;
  outstanding: number;
  lines?: StatementLine[];
}): string {
  return formatStatementText({
    company: args.company,
    companyPhone: args.companyPhone,
    currency: args.currency,
    heading: "Account Statement",
    partyName: args.customerName,
    summary: [
      { label: "Cylinders with you", value: String(args.cylindersWithCustomer) },
      { label: "Outstanding due", value: formatCurrency(args.outstanding, args.currency ?? "Rs") },
    ],
    lines: args.lines,
  });
}

// Convenience: supplier account statement text (what we owe them).
export function formatSupplierStatement(args: {
  company: string;
  companyPhone?: string | null;
  currency?: string;
  supplierName: string;
  purchases: number;
  paid: number;
  outstanding: number;
  lines?: StatementLine[];
}): string {
  const cur = args.currency ?? "Rs";
  return formatStatementText({
    company: args.company,
    companyPhone: args.companyPhone,
    currency: cur,
    heading: "Supplier Statement",
    partyName: args.supplierName,
    summary: [
      { label: "Total purchases", value: formatCurrency(args.purchases, cur) },
      { label: "Paid", value: formatCurrency(args.paid, cur) },
      { label: "Outstanding payable", value: formatCurrency(args.outstanding, cur) },
    ],
    lines: args.lines,
  });
}
