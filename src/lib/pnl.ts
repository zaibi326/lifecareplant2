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

// --- Smart ERP Assistant Context & Engine --------------------------

export type AssistantContext = {
  bulkByGas: { name: string; remaining: number }[]; // m3 remaining per gas
  filledByGasSize: { gas: string; size: string; filled: number }[];
  todayProfit: number;
  monthProfit: number;
  topDebtor: { id?: string; name: string; due: number } | null;
  topVehicleExpense: { name: string; total: number } | null;
  bestSellingGas: { name: string; qty: number } | null;
  outstanding: number;
  todayProduction?: { filled: number; gasUsed: number };
  customerBalances?: { id: string; name: string; due: number; outCylinders: number }[];
  pendingSuppliers?: { id: string; name: string; due: number }[];
};

export type AssistantAnswer = {
  answer: string;
  matched: boolean;
  navigateTo?: string;
};

export function answerOwnerQuery(qRaw: string, ctx: AssistantContext): AssistantAnswer {
  const q = qRaw.toLowerCase().trim();
  const currency = (n: number) => "Rs " + Math.round(n).toLocaleString();

  if (!q)
    return {
      answer: "Ask me about production, balance, low stock, or pending payments.",
      matched: false,
    };

  // Direct Page Navigation Commands
  if (
    q.includes("open production") ||
    q.includes("show production") ||
    q.includes("go to production")
  ) {
    return {
      answer: "Opening Filling Production module...",
      matched: true,
      navigateTo: "/production",
    };
  }
  if (
    q.includes("open customer statement") ||
    q.includes("open customer") ||
    q.includes("show customers")
  ) {
    return {
      answer: "Opening Customer Management & Statements...",
      matched: true,
      navigateTo: "/customers",
    };
  }
  if (q.includes("open report") || q.includes("show report") || q.includes("report center")) {
    return {
      answer: "Opening Universal Report Center...",
      matched: true,
      navigateTo: "/reports",
    };
  }
  if (q.includes("open stock") || q.includes("show stock")) {
    return {
      answer: "Opening Cylinder & Gas Stock view...",
      matched: true,
      navigateTo: "/stock",
    };
  }
  if (q.includes("open supplier") || q.includes("show supplier")) {
    return {
      answer: "Opening Supplier Management...",
      matched: true,
      navigateTo: "/suppliers",
    };
  }
  if (q.includes("open expense") || q.includes("show expense")) {
    return {
      answer: "Opening Expense Log...",
      matched: true,
      navigateTo: "/expenses",
    };
  }
  if (
    q.includes("print today's report") ||
    q.includes("print report") ||
    q.includes("today report")
  ) {
    return {
      answer: "Loading today's report for printing...",
      matched: true,
      navigateTo: "/reports",
    };
  }

  // Today's Production intent
  if (
    q.includes("today's production") ||
    q.includes("today production") ||
    q.includes("production today")
  ) {
    const prod = ctx.todayProduction ?? { filled: 0, gasUsed: 0 };
    return {
      answer: `Today's production: ${prod.filled.toLocaleString()} cylinders filled (${prod.gasUsed.toFixed(1)} m³ bulk gas consumed).`,
      matched: true,
      navigateTo: "/production",
    };
  }

  // Low Stock intent
  if (q.includes("low stock") || q.includes("stock low") || q.includes("check stock")) {
    const lowGas = ctx.bulkByGas.filter((g) => g.remaining < 50);
    if (lowGas.length > 0) {
      const names = lowGas.map((g) => `${g.name} (${g.remaining.toFixed(1)} m³)`).join(", ");
      return {
        answer: `Alert: Low bulk gas stock detected for: ${names}.`,
        matched: true,
        navigateTo: "/stock",
      };
    }
    return {
      answer: "All bulk gas levels are currently healthy.",
      matched: true,
      navigateTo: "/stock",
    };
  }

  // Specific Customer Balance intent (e.g. "Customer Ali balance" or "Ali balance")
  if (q.includes("balance") || q.includes("customer")) {
    if (ctx.customerBalances && ctx.customerBalances.length > 0) {
      const match = ctx.customerBalances.find((c) => q.includes(c.name.toLowerCase()));
      if (match) {
        return {
          answer: `Customer ${match.name}: Remaining Due ${currency(match.due)}, Customer Stock (cylinders holding) ${match.outCylinders} units.`,
          matched: true,
          navigateTo: `/customers/${match.id}`,
        };
      }
    }
  }

  // Highest due debtor intent ("Which customer has highest due?")
  if (
    q.includes("highest due") ||
    q.includes("top due") ||
    q.includes("highest balance") ||
    q.includes("who owes most")
  ) {
    if (ctx.topDebtor) {
      return {
        answer: `Customer with highest due is ${ctx.topDebtor.name} with ${currency(ctx.topDebtor.due)} remaining due.`,
        matched: true,
        navigateTo: ctx.topDebtor.id ? `/customers/${ctx.topDebtor.id}` : "/customers",
      };
    }
  }

  // Supplier pending payment intent ("Which supplier has pending payment?")
  if (
    q.includes("supplier") &&
    (q.includes("pending") ||
      q.includes("due") ||
      q.includes("payment") ||
      q.includes("outstanding"))
  ) {
    if (ctx.pendingSuppliers && ctx.pendingSuppliers.length > 0) {
      const topSup = ctx.pendingSuppliers[0];
      return {
        answer: `${topSup.name} has pending payment of ${currency(topSup.due)}. Total suppliers pending: ${ctx.pendingSuppliers.length}.`,
        matched: true,
        navigateTo: "/suppliers",
      };
    }
    return {
      answer: "No pending supplier payments found.",
      matched: true,
      navigateTo: "/suppliers",
    };
  }

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
      navigateTo: "/stock",
    };
  }

  // Filled cylinders of a specific gas/size
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
        answer: `${total} filled ${label} cylinder${total === 1 ? "" : "s"} available in plant stock.`,
        matched: true,
        navigateTo: "/stock",
      };
    }
  }

  // Profit
  if (q.includes("profit")) {
    if (q.includes("today"))
      return {
        answer: `Today's net profit: ${currency(ctx.todayProfit)}.`,
        matched: true,
        navigateTo: "/profit",
      };
    if (q.includes("month"))
      return {
        answer: `This month's net profit: ${currency(ctx.monthProfit)}.`,
        matched: true,
        navigateTo: "/profit",
      };
    return {
      answer: `Today ${currency(ctx.todayProfit)} · This month ${currency(ctx.monthProfit)}.`,
      matched: true,
      navigateTo: "/profit",
    };
  }

  // Debtors
  if (q.includes("owe") || q.includes("debtor") || q.includes("outstanding") || q.includes("due")) {
    if (ctx.topDebtor)
      return {
        answer: `${ctx.topDebtor.name} owes the most: ${currency(ctx.topDebtor.due)}. Total remaining due ${currency(ctx.outstanding)}.`,
        matched: true,
        navigateTo: "/customers",
      };
    return {
      answer: `Total remaining due is ${currency(ctx.outstanding)}.`,
      matched: true,
      navigateTo: "/customers",
    };
  }

  // Vehicle expense
  if (
    q.includes("vehicle") &&
    (q.includes("expense") || q.includes("cost") || q.includes("highest"))
  ) {
    if (ctx.topVehicleExpense)
      return {
        answer: `${ctx.topVehicleExpense.name} generated highest delivery expense: ${currency(ctx.topVehicleExpense.total)}.`,
        matched: true,
        navigateTo: "/vehicles",
      };
    return { answer: "No vehicle expenses recorded yet.", matched: true };
  }

  // Best selling gas
  if (q.includes("best") || q.includes("most sold") || q.includes("selling")) {
    if (ctx.bestSellingGas)
      return {
        answer: `Best selling gas: ${ctx.bestSellingGas.name} (${ctx.bestSellingGas.qty} cylinders delivered).`,
        matched: true,
        navigateTo: "/reports",
      };
  }

  return {
    answer:
      'I am your Smart ERP Assistant. Try asking: "Today\'s production", "Customer Ali balance", "Which customer has highest due?", "Show low stock", "Which supplier has pending payment?", or "Open production".',
    matched: false,
  };
}
