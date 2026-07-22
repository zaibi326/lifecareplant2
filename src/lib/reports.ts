// Part 3 — Reports data aggregators. Pure functions over already-fetched rows.
// No network calls. Reused by the Reports hub (screen), CSV export and the
// letterhead print builder so screen and paper always agree.

export type Range = { from: string; to: string }; // inclusive ISO yyyy-mm-dd

// ---- Loose row shapes (only fields we read) ---------------------------------
export type MovementRow = {
  type: string; // deliver | receive
  date: string;
  quantity: number | null;
  total_amount: number | null;
  customer_id?: string | null;
  customers?: { name?: string | null } | null;
  gas_types?: { name?: string | null } | null;
  cylinder_sizes?: { name?: string | null } | null;
  vehicle_number?: string | null;
};
export type PaymentRow = {
  amount: number | null;
  date: string;
  customer_id?: string | null;
  customers?: { name?: string | null } | null;
};
export type LocalFillingRow = {
  date: string;
  total_amount: number | null;
  quantity: number | null;
  gas_consumed: number | null;
  gas_types?: { name?: string | null } | null;
};
export type GasPurchaseRow = {
  date: string;
  total_amount: number | null;
  cubic_meter: number | null;
  suppliers?: { name?: string | null } | null;
  gas_types?: { name?: string | null } | null;
};
export type CylinderPurchaseRow = {
  date: string;
  total_amount: number | null;
  quantity: number | null;
  suppliers?: { name?: string | null } | null;
};
export type ExpenseRow = {
  date: string;
  amount: number | null;
  category: string | null;
  payee?: string | null;
};
export type DeliveryExpenseRow = { date: string; total: number | null; vehicle_id?: string | null };

const num = (v: number | null | undefined) => Number(v ?? 0);
const sum = <T>(arr: T[], f: (t: T) => number) => arr.reduce((a, t) => a + f(t), 0);

// ---- Sales ------------------------------------------------------------------
export function computeSales(
  movements: MovementRow[],
  localFillings: LocalFillingRow[],
  payments: PaymentRow[],
) {
  const deliveries = movements.filter((m) => m.type === "deliver");
  const deliveredQty = sum(deliveries, (m) => num(m.quantity));
  const receivedQty = sum(
    movements.filter((m) => m.type === "receive"),
    (m) => num(m.quantity),
  );
  const deliveryBilled = sum(deliveries, (m) => num(m.total_amount));
  const localBilled = sum(localFillings, (l) => num(l.total_amount));
  const localQty = sum(localFillings, (l) => num(l.quantity));
  const collected = sum(payments, (p) => num(p.amount));
  return {
    deliveredQty,
    receivedQty,
    localQty,
    deliveryBilled,
    localBilled,
    billed: deliveryBilled + localBilled,
    collected,
  };
}

// ---- Purchases --------------------------------------------------------------
export function computePurchases(gas: GasPurchaseRow[], cylinders: CylinderPurchaseRow[]) {
  const gasCost = sum(gas, (g) => num(g.total_amount));
  const gasM3 = sum(gas, (g) => num(g.cubic_meter));
  const cylinderCost = sum(cylinders, (c) => num(c.total_amount));
  const cylinderQty = sum(cylinders, (c) => num(c.quantity));
  return { gasCost, gasM3, cylinderCost, cylinderQty, total: gasCost + cylinderCost };
}

// ---- Expenses (operating + delivery) ---------------------------------------
export function computeExpenses(expenses: ExpenseRow[], deliveryExpenses: DeliveryExpenseRow[]) {
  const byCategory = new Map<string, number>();
  expenses.forEach((e) => {
    const cat = (e.category || "Miscellaneous").trim();
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + num(e.amount));
  });
  const deliveryTotal = sum(deliveryExpenses, (d) => num(d.total));
  if (deliveryTotal > 0)
    byCategory.set(
      "Vehicle / Delivery",
      (byCategory.get("Vehicle / Delivery") ?? 0) + deliveryTotal,
    );
  const operating = sum(expenses, (e) => num(e.amount));
  return {
    byCategory: Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]),
    operating,
    deliveryTotal,
    total: operating + deliveryTotal,
  };
}

// ---- Profit & Loss (report-level) ------------------------------------------
export function computeReportPnl(args: {
  sales: ReturnType<typeof computeSales>;
  purchases: ReturnType<typeof computePurchases>;
  expenses: ReturnType<typeof computeExpenses>;
}) {
  const income = args.sales.billed;
  const purchaseCost = args.purchases.total;
  const expenseTotal = args.expenses.total;
  const gross = income - purchaseCost;
  const net = gross - expenseTotal;
  return { income, purchaseCost, expenseTotal, gross, net };
}

// ---- Top customers ----------------------------------------------------------
export function computeTopCustomers(movements: MovementRow[], payments: PaymentRow[], limit = 10) {
  const map = new Map<string, { name: string; qty: number; amount: number; paid: number }>();
  movements.forEach((m) => {
    if (m.type !== "deliver" || !m.customer_id) return;
    const e = map.get(m.customer_id) ?? {
      name: m.customers?.name ?? "—",
      qty: 0,
      amount: 0,
      paid: 0,
    };
    e.qty += num(m.quantity);
    e.amount += num(m.total_amount);
    map.set(m.customer_id, e);
  });
  payments.forEach((p) => {
    if (!p.customer_id) return;
    const e = map.get(p.customer_id);
    if (e) e.paid += num(p.amount);
  });
  return Array.from(map.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

// ---- Top suppliers (by purchase value) -------------------------------------
export function computeTopSuppliers(
  gas: GasPurchaseRow[],
  cylinders: CylinderPurchaseRow[],
  limit = 10,
) {
  const map = new Map<string, number>();
  gas.forEach((g) => {
    const n = g.suppliers?.name ?? "—";
    map.set(n, (map.get(n) ?? 0) + num(g.total_amount));
  });
  cylinders.forEach((c) => {
    const n = c.suppliers?.name ?? "—";
    map.set(n, (map.get(n) ?? 0) + num(c.total_amount));
  });
  return Array.from(map.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

// ---- Gas performance (delivered + local filling qty by gas) -----------------
export function computeGasPerformance(movements: MovementRow[], localFillings: LocalFillingRow[]) {
  const map = new Map<string, number>();
  movements.forEach((m) => {
    if (m.type !== "deliver") return;
    const n = m.gas_types?.name ?? "—";
    map.set(n, (map.get(n) ?? 0) + num(m.quantity));
  });
  localFillings.forEach((l) => {
    const n = l.gas_types?.name ?? "—";
    map.set(n, (map.get(n) ?? 0) + num(l.quantity));
  });
  return Array.from(map.entries())
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty);
}

// ---- Daily movement series (for charts) ------------------------------------
export function computeDailySeries(movements: MovementRow[], range: Range) {
  const map = new Map<string, { day: string; Received: number; Delivered: number }>();
  const start = new Date(range.from + "T00:00:00");
  const end = new Date(range.to + "T00:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    map.set(key, {
      day: new Date(key).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      Received: 0,
      Delivered: 0,
    });
  }
  movements.forEach((m) => {
    const e = map.get(m.date);
    if (!e) return;
    if (m.type === "receive") e.Received += num(m.quantity);
    else if (m.type === "deliver") e.Delivered += num(m.quantity);
  });
  return Array.from(map.values());
}

// ---- CSV helper -------------------------------------------------------------
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
