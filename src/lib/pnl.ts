// Profit & Loss engine + Owner-assistant query helpers.
// Pure functions over already-fetched rows — no network calls here.

export type DateRange = { from: string; to: string }; // ISO yyyy-mm-dd, inclusive

const inRange = (d: string, r: DateRange) => d >= r.from && d <= r.to;

export type PnlInput = {
  range: DateRange;
  deliveries: {
    date: string;
    total_amount: number | null;
    rate: number | null;
    quantity: number | null;
  }[];
  purchases: { date: string; total_amount: number | null }[];
  expenses: { date: string; amount: number | null; category: string | null }[];
  deliveryExpenses: { date: string; total: number | null }[];
  rentalIncome?: number; // computed separately, added to income
};

export type PnlResult = {
  income: {
    sales: number; // billed deliveries (cylinder + gas + extras — total_amount)
    rentalIncome: number;
    otherIncome: number;
    total: number;
  };
  purchaseCost: number; // bulk gas + cylinder purchases
  expenses: {
    byCategory: Record<string, number>;
    deliveryExpense: number;
    total: number;
  };
  grossProfit: number; // sales+rental - purchaseCost
  netProfit: number; // gross - all expenses
};

export function computePnl(i: PnlInput): PnlResult {
  const sales = i.deliveries
    .filter((d) => inRange(d.date, i.range))
    .reduce((a, d) => a + Number(d.total_amount ?? 0), 0);

  const purchaseCost = i.purchases
    .filter((p) => inRange(p.date, i.range))
    .reduce((a, p) => a + Number(p.total_amount ?? 0), 0);

  const byCategory: Record<string, number> = {};
  i.expenses
    .filter((e) => inRange(e.date, i.range))
    .forEach((e) => {
      const cat = (e.category || "Miscellaneous").trim();
      byCategory[cat] = (byCategory[cat] ?? 0) + Number(e.amount ?? 0);
    });

  const deliveryExpense = i.deliveryExpenses
    .filter((d) => inRange(d.date, i.range))
    .reduce((a, d) => a + Number(d.total ?? 0), 0);
  if (deliveryExpense > 0)
    byCategory["Vehicle / Delivery"] = (byCategory["Vehicle / Delivery"] ?? 0) + deliveryExpense;

  const expensesTotal = Object.values(byCategory).reduce((a, b) => a + b, 0);
  const rentalIncome = Number(i.rentalIncome ?? 0);
  const otherIncome = 0;
  const incomeTotal = sales + rentalIncome + otherIncome;

  const grossProfit = incomeTotal - purchaseCost;
  const netProfit = grossProfit - expensesTotal;

  return {
    income: { sales, rentalIncome, otherIncome, total: incomeTotal },
    purchaseCost,
    expenses: { byCategory, deliveryExpense, total: expensesTotal },
    grossProfit,
    netProfit,
  };
}

// --- Rental accrual -----------------------------------------------------------
// Cylinders currently with a customer accrue rental from delivery until return.
// Simplified: rental = outstanding cylinders × rate × elapsed periods, capped at range end.

export type RentalConfig = {
  enabled: boolean;
  period: "daily" | "weekly" | "monthly";
  rate: number;
};

export function periodsBetween(
  fromISO: string,
  toISO: string,
  period: RentalConfig["period"],
): number {
  const from = new Date(fromISO + "T00:00:00");
  const to = new Date(toISO + "T00:00:00");
  const ms = Math.max(0, to.getTime() - from.getTime());
  const days = ms / 86400000;
  if (period === "daily") return Math.floor(days);
  if (period === "weekly") return Math.floor(days / 7);
  return Math.floor(days / 30);
}

// --- Owner AI assistant (rule-based intent matching) --------------------------

export type AssistantContext = {
  bulkByGas: { name: string; remaining: number }[]; // m3 remaining per gas
  filledByGasSize: { gas: string; size: string; filled: number }[];
  todayProfit: number;
  monthProfit: number;
  topDebtor: { name: string; due: number } | null;
  topVehicleExpense: { name: string; total: number } | null;
  bestSellingGas: { name: string; qty: number } | null;
  outstanding: number;
};

export type AssistantAnswer = { answer: string; matched: boolean };

export function answerOwnerQuery(qRaw: string, ctx: AssistantContext): AssistantAnswer {
  const q = qRaw.toLowerCase().trim();
  const currency = (n: number) => "Rs " + Math.round(n).toLocaleString();

  if (!q) return { answer: "Ask me about stock, profit, or customers.", matched: false };

  // Remaining gas (bulk) — "how much oxygen is remaining"
  const gasMatch = ctx.bulkByGas.find((g) => q.includes(g.name.toLowerCase()));
  if (
    (q.includes("remaining") ||
      q.includes("left") ||
      q.includes("stock") ||
      q.includes("available")) &&
    gasMatch &&
    !/\d/.test(q)
  ) {
    return {
      answer: `${gasMatch.name}: ${gasMatch.remaining.toFixed(2)} m³ remaining in bulk.`,
      matched: true,
    };
  }

  // Filled cylinders of a specific gas/size — "how many 9.90 oxygen cylinders"
  if (q.includes("cylinder") || /\d/.test(q)) {
    const cand = ctx.filledByGasSize.filter((r) => {
      const g = r.gas.toLowerCase();
      const s = r.size.toLowerCase();
      const gasHit = ctx.bulkByGas.some((b) => q.includes(b.name.toLowerCase()))
        ? q.includes(g)
        : true;
      const sizeHit = q.includes(s) || q.replace(/["]/g, "").includes(s.replace(/["]/g, ""));
      return gasHit && (sizeHit || q.includes(g));
    });
    if (cand.length > 0) {
      const total = cand.reduce((a, r) => a + r.filled, 0);
      const label = cand.length === 1 ? `${cand[0].size} ${cand[0].gas}` : "matching";
      return {
        answer: `${total} filled ${label} cylinder${total === 1 ? "" : "s"} available.`,
        matched: true,
      };
    }
  }

  // Profit
  if (q.includes("profit")) {
    if (q.includes("today"))
      return { answer: `Today's net profit: ${currency(ctx.todayProfit)}.`, matched: true };
    if (q.includes("month"))
      return { answer: `This month's net profit: ${currency(ctx.monthProfit)}.`, matched: true };
    return {
      answer: `Today ${currency(ctx.todayProfit)} · This month ${currency(ctx.monthProfit)}.`,
      matched: true,
    };
  }

  // Debtors
  if (q.includes("owe") || q.includes("debtor") || q.includes("outstanding") || q.includes("due")) {
    if (ctx.topDebtor)
      return {
        answer: `${ctx.topDebtor.name} owes the most: ${currency(ctx.topDebtor.due)}. Total outstanding ${currency(ctx.outstanding)}.`,
        matched: true,
      };
    return { answer: `Total outstanding is ${currency(ctx.outstanding)}.`, matched: true };
  }

  // Vehicle expense
  if (
    q.includes("vehicle") &&
    (q.includes("expense") || q.includes("cost") || q.includes("highest"))
  ) {
    if (ctx.topVehicleExpense)
      return {
        answer: `${ctx.topVehicleExpense.name} generated the highest delivery expense: ${currency(ctx.topVehicleExpense.total)}.`,
        matched: true,
      };
    return { answer: "No vehicle expenses recorded yet.", matched: true };
  }

  // Best selling gas
  if (q.includes("best") || q.includes("most sold") || q.includes("selling")) {
    if (ctx.bestSellingGas)
      return {
        answer: `Best selling gas: ${ctx.bestSellingGas.name} (${ctx.bestSellingGas.qty} cylinders delivered).`,
        matched: true,
      };
  }

  return {
    answer:
      'I couldn\'t match that. Try: "How much oxygen is remaining?", "What is today\'s profit?", or "Which customer owes the most?"',
    matched: false,
  };
}
