// Rule-based "AI" owner insights. Pure functions, no external calls — turns raw
// business figures into prioritised, plain-language observations for the owner.

export type InsightTone = "positive" | "warning" | "critical" | "info";

export type Insight = {
  id: string;
  tone: InsightTone;
  title: string;
  detail: string;
};

export type InsightInput = {
  plantStock: number;
  withCustomers: number;
  totalOwned: number; // 0 when not configured
  outstanding: number;
  todayPayments: number;
  todayDelivered: number;
  todayReceived: number;
  todayProduction: number;
  monthRevenue: number; // billed this calendar month
  monthExpenses: number; // expenses this calendar month
  bulkLow: { name: string; remaining: number }[]; // gas types at/below zero
  topDebtors: { name: string; due: number }[];
};

const currency = (n: number) => "Rs " + Math.round(n).toLocaleString();

export function generateInsights(i: InsightInput): Insight[] {
  const out: Insight[] = [];

  // Cash / profitability signal for the month so far.
  const net = i.monthRevenue - i.monthExpenses;
  if (i.monthRevenue > 0 || i.monthExpenses > 0) {
    if (net >= 0) {
      out.push({
        id: "month-net",
        tone: "positive",
        title: `Month is profitable so far: ${currency(net)}`,
        detail: `Billed ${currency(i.monthRevenue)} against ${currency(i.monthExpenses)} expenses this month.`,
      });
    } else {
      out.push({
        id: "month-net",
        tone: "warning",
        title: `Expenses exceed revenue by ${currency(-net)} this month`,
        detail: `Billed ${currency(i.monthRevenue)} but spent ${currency(i.monthExpenses)}. Review large expenses.`,
      });
    }
  }

  // Outstanding receivables.
  if (i.outstanding > 0) {
    const tone: InsightTone =
      i.outstanding > i.monthRevenue && i.monthRevenue > 0 ? "critical" : "warning";
    const topLine = i.topDebtors[0];
    out.push({
      id: "outstanding",
      tone,
      title: `${currency(i.outstanding)} outstanding from customers`,
      detail: topLine
        ? `Largest is ${topLine.name} at ${currency(topLine.due)}. Consider a follow-up.`
        : "Chase overdue balances to improve cash flow.",
    });
  }

  // Bulk gas depletion — operational risk.
  if (i.bulkLow.length > 0) {
    out.push({
      id: "bulk-low",
      tone: "critical",
      title: `${i.bulkLow.length} gas type${i.bulkLow.length > 1 ? "s" : ""} depleted`,
      detail: `Restock ${i.bulkLow.map((b) => b.name).join(", ")} — recorded balance is zero or negative. Filling may stop.`,
    });
  }

  // Reconciliation mismatch — asset control risk.
  if (i.totalOwned > 0) {
    const diff = i.totalOwned - (i.plantStock + i.withCustomers);
    if (diff !== 0) {
      out.push({
        id: "recon",
        tone: Math.abs(diff) > i.totalOwned * 0.05 ? "critical" : "warning",
        title: `Cylinder count off by ${Math.abs(diff)}`,
        detail:
          diff > 0
            ? `${diff} owned cylinders are unaccounted for. Check missing movements or opening balances.`
            : `Tracked count exceeds the owned fleet by ${-diff}. Check for duplicate receives.`,
      });
    } else {
      out.push({
        id: "recon",
        tone: "positive",
        title: "Cylinder stock fully reconciled",
        detail: `All ${i.totalOwned.toLocaleString()} owned cylinders are accounted for across plant and customers.`,
      });
    }
  }

  // Today's activity summary.
  if (i.todayDelivered > 0 || i.todayReceived > 0 || i.todayProduction > 0) {
    out.push({
      id: "today",
      tone: "info",
      title: "Today's activity",
      detail: `Delivered ${i.todayDelivered}, received ${i.todayReceived}, filled ${i.todayProduction} cylinders. Payments ${currency(i.todayPayments)}.`,
    });
  }

  // Idle plant stock note.
  if (i.plantStock > 0 && i.withCustomers > 0) {
    const utilisation = i.withCustomers / (i.plantStock + i.withCustomers);
    if (utilisation < 0.4) {
      out.push({
        id: "utilisation",
        tone: "info",
        title: `${Math.round(utilisation * 100)}% of cylinders are out with customers`,
        detail:
          "A large share of the fleet is idle in the plant. Push deliveries to improve utilisation.",
      });
    }
  }

  // Priority order: critical → warning → positive → info.
  const rank: Record<InsightTone, number> = { critical: 0, warning: 1, positive: 2, info: 3 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}
