// Rule-based AI Business Insights engine. Pure functions, turning raw
// figures into prioritized, simple plain-language business insights and Health Score.

export type InsightTone = "positive" | "warning" | "critical" | "info";

export type Insight = {
  id: string;
  tone: InsightTone;
  title: string;
  detail: string;
  category?: "sales" | "production" | "expense" | "stock" | "due" | "supplier" | "general";
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
  bulkLow: { name: string; remaining: number }[]; // gas types at/below low threshold
  topDebtors: { name: string; due: number }[];
  bestCustomer?: { name: string; amount: number } | null; // highest billed this period
  bestSellingGas?: { name: string; qty: number } | null; // most delivered/filled gas
  topVehicleExpense?: { name: string; total: number } | null; // highest delivery expense
  pendingSuppliers?: { name: string; due: number }[];
  productionEfficiency?: number;
};

const currency = (n: number) => "Rs " + Math.round(n).toLocaleString();

export function computeBusinessHealthScore(i: InsightInput): {
  score: number;
  label: string;
  color: string;
} {
  let score = 70; // baseline

  // Profitability check (+15 / -20)
  const netProfit = i.monthRevenue - i.monthExpenses;
  if (netProfit > 0) score += 15;
  else if (netProfit < 0) score -= 20;

  // Collection / Outstanding health check (+10 / -15)
  if (i.outstanding === 0) score += 10;
  else if (i.monthRevenue > 0 && i.outstanding > i.monthRevenue * 1.5) score -= 15;

  // Low stock penalty (-15 per depleted bulk gas)
  if (i.bulkLow.length > 0) score -= i.bulkLow.length * 10;

  // Production efficiency bonus (+10 if >90%)
  if (i.productionEfficiency && i.productionEfficiency >= 90) score += 10;

  const finalScore = Math.max(10, Math.min(100, Math.round(score)));

  let label = "Healthy";
  let color = "text-emerald-600 border-emerald-500 bg-emerald-50";
  if (finalScore < 50) {
    label = "Needs Attention";
    color = "text-rose-600 border-rose-500 bg-rose-50";
  } else if (finalScore < 75) {
    label = "Fair & Stable";
    color = "text-amber-600 border-amber-500 bg-amber-50";
  }

  return { score: finalScore, label, color };
}

export function generateInsights(i: InsightInput): Insight[] {
  const out: Insight[] = [];

  // 1. Daily Business Summary & Activity
  if (i.todayDelivered > 0 || i.todayReceived > 0 || i.todayProduction > 0 || i.todayPayments > 0) {
    out.push({
      id: "today-summary",
      tone: "info",
      category: "general",
      title: "Daily Business Summary",
      detail: `Today's activity: Delivered ${i.todayDelivered} cyl, Received ${i.todayReceived} empties, Filled ${i.todayProduction} cyl. Payments collected ${currency(i.todayPayments)}.`,
    });
  }

  // 2. Sales Insights
  const net = i.monthRevenue - i.monthExpenses;
  if (i.monthRevenue > 0 || i.monthExpenses > 0) {
    if (net >= 0) {
      out.push({
        id: "sales-insights",
        tone: "positive",
        category: "sales",
        title: "Sales & Monthly Revenue Insight",
        detail: `Profitable operations this month: ${currency(net)} net margin. Billed ${currency(i.monthRevenue)} against ${currency(i.monthExpenses)} expenses.`,
      });
    } else {
      out.push({
        id: "sales-insights",
        tone: "warning",
        category: "sales",
        title: "Sales & Expense Alert",
        detail: `Operating expenses exceed revenue by ${currency(-net)} this month. Review overheads and delivery costs.`,
      });
    }
  }

  // 3. High Performing Customers
  if (i.bestCustomer && i.bestCustomer.amount > 0) {
    out.push({
      id: "high-performing-customer",
      tone: "positive",
      category: "sales",
      title: `High Performing Customer: ${i.bestCustomer.name}`,
      detail: `${i.bestCustomer.name} is your top account, generating ${currency(i.bestCustomer.amount)} in billed sales this month.`,
    });
  }

  // 4. High Due Customers & Outstanding
  if (i.outstanding > 0) {
    const tone: InsightTone =
      i.monthRevenue > 0 && i.outstanding > i.monthRevenue ? "critical" : "warning";
    const topLine = i.topDebtors[0];
    out.push({
      id: "high-due-customers",
      tone,
      category: "due",
      title: `High Due Alert: ${currency(i.outstanding)} total remaining customer due`,
      detail: topLine
        ? `Highest due balance is held by ${topLine.name} (${currency(topLine.due)}). Send a WhatsApp payment reminder.`
        : "Follow up on customer receivables to protect cash liquidity.",
    });
  }

  // 5. Low Stock Alerts
  if (i.bulkLow.length > 0) {
    out.push({
      id: "low-stock-alert",
      tone: "critical",
      category: "stock",
      title: `Low Stock Alert: ${i.bulkLow.length} gas type${i.bulkLow.length > 1 ? "s" : ""} low`,
      detail: `Low bulk gas levels for ${i.bulkLow.map((b) => b.name).join(", ")}. Reorder bulk gas before plant filling halts.`,
    });
  }

  // 6. Production Insights
  if (i.todayProduction > 0 || (i.productionEfficiency && i.productionEfficiency > 0)) {
    const eff = i.productionEfficiency ?? 100;
    out.push({
      id: "production-insights",
      tone: eff >= 90 ? "positive" : "warning",
      category: "production",
      title: `Production Insight: ${eff}% Filling Efficiency`,
      detail: `Plant produced ${i.todayProduction} filled cylinders today with an average gas conversion efficiency of ${eff}%.`,
    });
  }

  // 7. Expense Insights
  if (i.topVehicleExpense && i.topVehicleExpense.total > 0) {
    out.push({
      id: "expense-insights",
      tone: "warning",
      category: "expense",
      title: `Expense Insight: ${i.topVehicleExpense.name}`,
      detail: `${i.topVehicleExpense.name} accounts for highest delivery costs (${currency(i.topVehicleExpense.total)}) this month.`,
    });
  }

  // 8. Supplier Performance
  if (i.pendingSuppliers && i.pendingSuppliers.length > 0) {
    const topSup = i.pendingSuppliers[0];
    out.push({
      id: "supplier-performance",
      tone: "info",
      category: "supplier",
      title: `Supplier Payables Insight`,
      detail: `${i.pendingSuppliers.length} pending supplier balance(s). Highest payable: ${topSup.name} (${currency(topSup.due)}).`,
    });
  }

  const rank: Record<InsightTone, number> = { critical: 0, warning: 1, positive: 2, info: 3 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}
