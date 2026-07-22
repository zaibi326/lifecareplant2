import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import { buildBulkBalances, formatM3, gasConsumed } from "@/lib/bulk-gas";
import { generateInsights, type Insight } from "@/lib/insights";
import { computeCashInHand, computeTotalBankBalance } from "@/lib/finance";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertCircle,
  Fuel,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";


import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Life Care Plant" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const today = todayISO();
      const since = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
      const monthStart = today.slice(0, 8) + "01";
      const [
        movements,
        payments,
        production,
        customers,
        gases,
        allMoves,
        allPays,
        purchases,
        allProduction,
        monthMoves,
        monthExp,
        settings,
        allCustPays,
        allSupPays,
        allExpenses,
        cashAdjustments,
        bankAccounts,
        sizes,
        localFillings,
      ] = await Promise.all([

        supabase
          .from("cylinder_movements")
          .select(
            "type,date,quantity,total_amount,customer_id,gas_type_id,cylinder_size_id,vehicle_number,driver_name,invoice_number,created_at,customers(name),gas_types(name,color)",
          )
          .gte("date", since)
          .order("created_at", { ascending: false }),
        supabase
          .from("payments")
          .select("amount,date,customer_id,created_at,customers(name)")
          .gte("date", since)
          .order("created_at", { ascending: false }),
        supabase.from("production").select("quantity,date").eq("date", today),
        supabase.from("customers").select("id,name,opening_cylinders,opening_due"),
        supabase.from("gas_types").select("id,name,color").eq("active", true),
        supabase
          .from("cylinder_movements")
          .select(
            "type,quantity,total_amount,customer_id,gas_type_id,cylinder_size_id,condition,customers(name)",
          ),
        supabase.from("payments").select("amount"),
        supabase.from("gas_purchases").select("gas_type_id,cubic_meter"),
        supabase.from("production").select("gas_type_id,gas_consumed"),
        supabase
          .from("cylinder_movements")
          .select("total_amount,type,date")
          .eq("type", "deliver")
          .gte("date", monthStart),
        supabase.from("expenses").select("amount,date").gte("date", monthStart),
        supabase.from("settings").select("total_owned_cylinders").eq("id", 1).maybeSingle(),
        supabase.from("payments").select("amount,account"),
        supabase.from("supplier_payments").select("amount,account,bank_account_id"),
        supabase.from("expenses").select("amount,account,bank_account_id"),
        supabase.from("cash_adjustments").select("amount,direction"),
        supabase.from("bank_accounts").select("id,bank_name,account_title,opening_balance"),
        supabase
          .from("cylinder_sizes")
          .select("id,capacity,capacity_unit")
          .eq("active", true),
        supabase.from("local_fillings").select("gas_type_id,gas_consumed"),
      ]);

      return {
        movements: movements.data ?? [],
        payments: payments.data ?? [],
        production: production.data ?? [],
        customers: customers.data ?? [],
        gases: gases.data ?? [],
        allMoves: allMoves.data ?? [],
        allPays: allPays.data ?? [],
        purchases: purchases.data ?? [],
        allProduction: allProduction.data ?? [],
        monthRevenue: (monthMoves.data ?? []).reduce(
          (a: number, m: any) => a + Number(m.total_amount ?? 0),
          0,
        ),
        monthExpenses: (monthExp.data ?? []).reduce(
          (a: number, e: any) => a + Number(e.amount ?? 0),
          0,
        ),
        totalOwned: Number(settings.data?.total_owned_cylinders ?? 0),
        allCustPays: allCustPays.data ?? [],
        allSupPays: allSupPays.data ?? [],
        allExpenses: allExpenses.data ?? [],
        cashAdjustments: cashAdjustments.data ?? [],
        bankAccounts: bankAccounts.data ?? [],
        sizes: sizes.data ?? [],
        localFillings: localFillings.data ?? [],
      };
    },
  });


  const today = todayISO();
  const movs = data?.movements ?? [];
  const pays = data?.payments ?? [];

  const sum = (arr: any[], k: string) => arr.reduce((a, b) => a + Number(b[k] ?? 0), 0);
  const todayReceived = sum(
    movs.filter((m: any) => m.type === "receive" && m.date === today),
    "quantity",
  );
  const todayDelivered = sum(
    movs.filter((m: any) => m.type === "deliver" && m.date === today),
    "quantity",
  );
  const todayProduction = sum(data?.production ?? [], "quantity");
  const todayPayments = sum(
    pays.filter((p: any) => p.date === today),
    "amount",
  );

  // Plant stock = received − delivered (opening cylinders har customer ke saath count hote hain, plant mein nahi)
  // With customers = har party ka opening + delivered − received (clamped)
  const all = data?.allMoves ?? [];
  const allReceived = sum(
    all.filter((m: any) => m.type === "receive"),
    "quantity",
  );
  const allDelivered = sum(
    all.filter((m: any) => m.type === "deliver"),
    "quantity",
  );
  const plantStock = Math.max(0, allReceived - allDelivered);

  // Per-party outstanding cylinders = opening − delivered + received (clamped ≥ 0)
  const partyMap = new Map<string, { name: string; out: number }>();
  for (const c of data?.customers ?? []) {
    partyMap.set(c.id, { name: c.name ?? "Customer", out: Number(c.opening_cylinders ?? 0) });
  }
  for (const m of all) {
    if (!m.customer_id) continue;
    const e = partyMap.get(m.customer_id) ?? { name: m.customers?.name ?? "Customer", out: 0 };
    const qty = Number(m.quantity ?? 0);
    if (m.type === "deliver") e.out -= qty;
    else if (m.type === "receive") e.out += qty;
    partyMap.set(m.customer_id, e);
  }

  const partyBalances = Array.from(partyMap.values())
    .map((p) => ({ ...p, out: Math.max(0, p.out) }))
    .filter((p) => p.out > 0)
    .sort((a, b) => b.out - a.out);
  const withCustomers = partyBalances.reduce((a, p) => a + p.out, 0);

  const openingDue = sum(data?.customers ?? [], "opening_due");
  const billed = sum(
    all.filter((m: any) => m.type === "deliver"),
    "total_amount",
  );
  const paid = sum(data?.allPays ?? [], "amount");
  const outstanding = Math.max(0, openingDue + billed - paid);

  // Cash-in-hand & bank balances (Part 2 finance engine)
  const cash = computeCashInHand({
    customerPayments: (data?.allCustPays ?? []) as any,
    supplierPayments: (data?.allSupPays ?? []) as any,
    expenses: (data?.allExpenses ?? []) as any,
    adjustments: (data?.cashAdjustments ?? []) as any,
  });
  const bankBalance = computeTotalBankBalance(
    (data?.bankAccounts ?? []) as any,
    (data?.allCustPays ?? []) as any,
    (data?.allSupPays ?? []) as any,
    (data?.allExpenses ?? []) as any,
  );


  // Bulk gas remaining per gas type = purchased − consumed
  // Bulk gas remaining per gas type = purchased − consumed.
  // Auto-consumption (production, local filling, delivered filled cylinders) applies ONLY to Oxygen.
  const oxygenIds = new Set(
    (data?.gases ?? [])
      .filter((g: any) => /oxygen/i.test(String(g.name ?? "")))
      .map((g: any) => g.id as string),
  );
  const sizeById = new Map<string, { capacity: number | null; capacity_unit: string | null }>();
  for (const s of (data as any)?.sizes ?? [])
    sizeById.set(s.id, { capacity: s.capacity, capacity_unit: s.capacity_unit });
  const oxyProduction = (data?.allProduction ?? []).filter((r: any) =>
    oxygenIds.has(r.gas_type_id),
  );
  const oxyLocalFillings = ((data as any)?.localFillings ?? []).filter((r: any) =>
    oxygenIds.has(r.gas_type_id),
  );
  const oxyDeliveries = ((data as any)?.allMoves ?? [])
    .filter(
      (m: any) =>
        m.type === "deliver" && m.condition === "filled" && oxygenIds.has(m.gas_type_id),
    )
    .map((m: any) => {
      const sz = sizeById.get(m.cylinder_size_id);
      return {
        gas_type_id: m.gas_type_id,
        gas_consumed: gasConsumed(sz?.capacity ?? 0, m.quantity, sz?.capacity_unit ?? "m3"),
      };
    });
  const bulkBalances = buildBulkBalances(data?.purchases ?? [], [
    ...oxyProduction,
    ...oxyLocalFillings,
    ...oxyDeliveries,
  ]);
  const gasNameById = new Map<string, { name: string; color: string | null }>();
  for (const g of data?.gases ?? []) gasNameById.set(g.id, { name: g.name, color: g.color });
  const bulkRows = Array.from(bulkBalances.entries())
    .map(([id, v]) => ({
      id,
      name: gasNameById.get(id)?.name ?? "Gas",
      color: gasNameById.get(id)?.color ?? null,
      ...v,
    }))
    .sort((a, b) => b.remaining - a.remaining);

  // Owner insights (rule-based)
  const topDebtorMap = new Map<string, { name: string; due: number }>();
  for (const c of data?.customers ?? [])
    topDebtorMap.set(c.id, { name: c.name ?? "Customer", due: Number(c.opening_due ?? 0) });
  for (const m of all) {
    if (m.type !== "deliver" || !m.customer_id) continue;
    const e = topDebtorMap.get(m.customer_id);
    if (e) e.due += Number(m.total_amount ?? 0);
  }
  // Note: allPays has no customer_id, so debtor-level payment netting isn't applied here;
  // the top debtor list reflects gross billed amounts and is indicative only.
  const topDebtors = Array.from(topDebtorMap.values())
    .filter((d) => d.due > 0)
    .sort((a, b) => b.due - a.due)
    .slice(0, 3);

  const insights = generateInsights({
    plantStock,
    withCustomers,
    totalOwned: Number(data?.totalOwned ?? 0),
    outstanding,
    todayPayments,
    todayDelivered,
    todayReceived,
    todayProduction,
    monthRevenue: Number(data?.monthRevenue ?? 0),
    monthExpenses: Number(data?.monthExpenses ?? 0),
    bulkLow: bulkRows
      .filter((b) => b.remaining <= 0)
      .map((b) => ({ name: b.name, remaining: b.remaining })),
    topDebtors,
  });

  // Build 14-day chart
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10);
    return {
      day: new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      Received: sum(
        movs.filter((m: any) => m.type === "receive" && m.date === d),
        "quantity",
      ),
      Delivered: sum(
        movs.filter((m: any) => m.type === "deliver" && m.date === d),
        "quantity",
      ),
    };
  });

  const recent = [
    ...movs.slice(0, 10).map((m: any) => ({
      kind: m.type as "receive" | "deliver",
      title: m.customers?.name ?? "Customer",
      subtitle: `${m.type === "receive" ? "Received" : "Delivered"} ${m.quantity}× ${m.gas_types?.name ?? ""}`,
      amount: m.type === "deliver" ? m.total_amount : null,
      invoice: m.invoice_number,
      at: m.created_at,
    })),
    ...pays.slice(0, 10).map((p: any) => ({
      kind: "payment" as const,
      title: p.customers?.name ?? "Customer",
      subtitle: "Payment Received",
      amount: p.amount,
      invoice: null,
      at: p.created_at,
    })),
  ]
    .sort((a, b) => +new Date(b.at) - +new Date(a.at))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
          Plant Overview
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{formatDate(new Date())}</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="In Plant" value={plantStock.toLocaleString()} sub="Cylinders" tone="default" />
        <Kpi
          label="With Customers"
          value={withCustomers.toLocaleString()}
          sub={`${data?.customers.length ?? 0} clients`}
          tone="default"
        />
        <Kpi label="Received Today" value={`+${todayReceived}`} sub="Cylinders in" tone="success" />
        <Kpi
          label="Delivered Today"
          value={`-${todayDelivered}`}
          sub="Cylinders out"
          tone="brand"
        />
        <Kpi
          label="Filling Today"
          value={todayProduction.toLocaleString()}
          sub="Production"
          tone="warning"
        />
        <Kpi
          label="Payments Today"
          value={formatCurrency(todayPayments)}
          sub="Cash + Bank"
          tone="success"
        />
        <Kpi
          label="Outstanding"
          value={formatCurrency(outstanding)}
          sub="Remaining due"
          tone="warning"
        />
        <Kpi
          label="Cash in Hand"
          value={formatCurrency(cash.balance)}
          sub="Cash box"
          tone={cash.balance < 0 ? "warning" : "success"}
        />
        <Kpi
          label="Bank Balance"
          value={formatCurrency(bankBalance)}
          sub={`${data?.bankAccounts.length ?? 0} account(s)`}
          tone={bankBalance < 0 ? "warning" : "default"}
        />
      </section>


      {insights.length > 0 && (
        <section className="bg-card border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="size-8 rounded-lg bg-brand/10 text-brand grid place-items-center">
              <Sparkles className="size-4" />
            </div>
            <div>
              <h2 className="font-display font-bold">Owner Insights</h2>
              <p className="text-xs text-muted-foreground">
                Auto-generated from your latest figures
              </p>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {insights.map((ins) => (
              <InsightCard key={ins.id} insight={ins} />
            ))}
          </div>
        </section>
      )}

      <section className="bg-card border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display font-bold">Cylinders with Parties</h2>

            <p className="text-xs text-muted-foreground">
              Plant ke cylinder jo abhi parties ke paas hain
            </p>
          </div>
          <Link to="/customers" className="text-xs text-brand font-medium">
            View all
          </Link>
        </div>
        {partyBalances.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">Koi cylinder party ke paas nahi.</p>
        ) : (
          <div className="divide-y">
            {partyBalances.slice(0, 8).map((p, i) => (
              <div key={i} className="py-2.5 flex items-center justify-between">
                <span className="text-sm font-medium truncate">{p.name}</span>
                <span className="font-display font-bold text-brand">{p.out}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-card border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display font-bold flex items-center gap-2">
              <Fuel className="size-4 text-brand" /> Bulk Gas Inventory
            </h2>
            <p className="text-xs text-muted-foreground">
              Purchased minus consumed in filling (in m³)
            </p>
          </div>
          <Link to="/purchases" className="text-xs text-brand font-medium">
            Purchases
          </Link>
        </div>
        {bulkRows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">No bulk gas purchases recorded yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {bulkRows.map((b) => (
              <div key={b.id} className="rounded-xl border p-3">
                <div className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-full"
                    style={{ background: b.color || "var(--color-brand)" }}
                  />
                  <span className="text-sm font-semibold truncate">{b.name}</span>
                </div>
                <div
                  className={`font-display font-bold text-lg mt-1 ${b.remaining < 0 ? "text-destructive" : ""}`}
                >
                  {formatM3(b.remaining)}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  In {formatM3(b.purchased)} • Used {formatM3(b.consumed)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 md:hidden">
        <Link
          to="/movements"
          search={{ type: "receive" } as any}
          className="flex flex-col items-center justify-center gap-2 bg-brand text-brand-foreground p-6 rounded-3xl shadow-lg shadow-brand/20 active:scale-95 transition-transform"
        >
          <div className="size-10 rounded-full bg-white/20 grid place-items-center">
            <ArrowDownToLine className="size-5" />
          </div>
          <span className="font-semibold">Receive</span>
        </Link>
        <Link
          to="/movements"
          search={{ type: "deliver" } as any}
          className="flex flex-col items-center justify-center gap-2 bg-primary text-primary-foreground p-6 rounded-3xl shadow-lg shadow-primary/20 active:scale-95 transition-transform"
        >
          <div className="size-10 rounded-full bg-white/20 grid place-items-center">
            <ArrowUpFromLine className="size-5" />
          </div>
          <span className="font-semibold">Deliver</span>
        </Link>
      </section>

      <section className="bg-card border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display font-bold">Daily Movement</h2>
            <p className="text-xs text-muted-foreground">Last 14 days</p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand bg-brand/10 px-2 py-1 rounded-full">
            Live
          </span>
        </div>
        <div className="h-56">
          <ResponsiveContainer>
            <AreaChart data={days} margin={{ left: -20, right: 0, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--color-border)",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="Received"
                stroke="var(--color-success)"
                fill="url(#g1)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="Delivered"
                stroke="var(--color-brand)"
                fill="url(#g2)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h2 className="font-display font-bold mb-3">Recent Activity</h2>
        <div className="relative space-y-3 before:absolute before:left-5 before:top-3 before:bottom-3 before:w-px before:bg-border">
          {recent.length === 0 && (
            <div className="bg-card border rounded-2xl p-6 text-center text-sm text-muted-foreground">
              No activity yet. Use the + button to record your first cylinder movement.
            </div>
          )}
          {recent.map((r, i) => (
            <div key={i} className="relative flex items-start gap-4">
              <div
                className={`size-10 rounded-full border-4 border-background grid place-items-center z-10 text-[10px] font-bold font-mono ${
                  r.kind === "receive"
                    ? "bg-success/15 text-success"
                    : r.kind === "deliver"
                      ? "bg-brand/15 text-brand"
                      : "bg-warning/15 text-warning"
                }`}
              >
                {r.kind === "receive" ? "IN" : r.kind === "deliver" ? "OUT" : "PAY"}
              </div>
              <div className="flex-1 bg-card border rounded-2xl p-3">
                <div className="flex justify-between items-start gap-2">
                  <p className="text-sm font-semibold truncate">{r.title}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(r.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {r.subtitle}
                  {r.amount != null ? ` · ${formatCurrency(r.amount)}` : ""}
                </p>
                {r.invoice && (
                  <div className="mt-2 pt-2 border-t border-border/60">
                    <span className="text-[10px] px-2 py-0.5 bg-brand/10 text-brand rounded font-medium">
                      {r.invoice}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const map = {
    critical: {
      icon: AlertCircle,
      cls: "border-destructive/40 bg-destructive/5",
      icon_cls: "text-destructive",
    },
    warning: {
      icon: AlertTriangle,
      cls: "border-warning/40 bg-warning/5",
      icon_cls: "text-warning",
    },
    positive: {
      icon: CheckCircle2,
      cls: "border-success/40 bg-success/5",
      icon_cls: "text-success",
    },
    info: { icon: Info, cls: "border-border bg-muted/30", icon_cls: "text-muted-foreground" },
  } as const;
  const m = map[insight.tone];
  const Icon = m.icon;
  return (
    <div className={`rounded-xl border p-3 flex gap-2.5 ${m.cls}`}>
      <Icon className={`size-4 shrink-0 mt-0.5 ${m.icon_cls}`} />
      <div className="min-w-0">
        <div className="text-sm font-semibold">{insight.title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{insight.detail}</div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "default" | "success" | "warning" | "brand";
}) {
  const toneCls =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "brand"
          ? "text-brand"
          : "text-foreground";
  return (
    <div className="bg-card p-4 rounded-2xl border shadow-sm">
      <p className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`font-display text-xl md:text-2xl font-bold ${toneCls}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
