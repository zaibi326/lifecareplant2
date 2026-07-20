import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatM3 } from "@/lib/bulk-gas";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Wallet,
  Factory,
  Download,
  PackagePlus,
  Receipt,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Life Care Plant" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ["reports", from, to],
    queryFn: async () => {
      const [m, p, prod, pur, exp] = await Promise.all([
        supabase
          .from("cylinder_movements")
          .select("type,quantity,total_amount,date,customer_id,customers(name)")
          .gte("date", from)
          .lte("date", to),
        supabase
          .from("payments")
          .select("amount,date,customer_id,customers(name)")
          .gte("date", from)
          .lte("date", to),
        supabase.from("production").select("quantity,date").gte("date", from).lte("date", to),
        supabase
          .from("gas_purchases")
          .select("total_amount,cubic_meter,date,suppliers(name),gas_types(name)")
          .gte("date", from)
          .lte("date", to),
        supabase
          .from("expenses")
          .select("amount,category,date,payee")
          .gte("date", from)
          .lte("date", to),
      ]);
      return {
        movements: m.data ?? [],
        payments: p.data ?? [],
        production: prod.data ?? [],
        purchases: pur.data ?? [],
        expenses: exp.data ?? [],
      };
    },
  });

  const ms: any[] = data?.movements ?? [];
  const ps: any[] = data?.payments ?? [];
  const pr: any[] = data?.production ?? [];
  const pur: any[] = data?.purchases ?? [];
  const exp: any[] = data?.expenses ?? [];

  const totals = useMemo(() => {
    const received = ms
      .filter((m) => m.type === "receive")
      .reduce((a, b) => a + Number(b.quantity ?? 0), 0);
    const delivered = ms
      .filter((m) => m.type === "deliver")
      .reduce((a, b) => a + Number(b.quantity ?? 0), 0);
    const billed = ms
      .filter((m) => m.type === "deliver")
      .reduce((a, b) => a + Number(b.total_amount ?? 0), 0);
    const collected = ps.reduce((a, b) => a + Number(b.amount ?? 0), 0);
    const produced = pr.reduce((a, b) => a + Number(b.quantity ?? 0), 0);
    const purchased = pur.reduce((a, b) => a + Number(b.total_amount ?? 0), 0);
    const purchasedM3 = pur.reduce((a, b) => a + Number(b.cubic_meter ?? 0), 0);
    const expensed = exp.reduce((a, b) => a + Number(b.amount ?? 0), 0);
    // Profit/Loss = revenue billed − cost of gas purchased − operating expenses
    const profit = billed - purchased - expensed;
    return {
      received,
      delivered,
      billed,
      collected,
      produced,
      purchased,
      purchasedM3,
      expensed,
      profit,
    };
  }, [ms, ps, pr, pur, exp]);

  const expenseBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    exp.forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount ?? 0)));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [exp]);

  const dailySeries = useMemo(() => {
    const map = new Map<string, { day: string; Received: number; Delivered: number }>();
    const start = new Date(from);
    const end = new Date(to);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      map.set(key, {
        day: new Date(key).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        Received: 0,
        Delivered: 0,
      });
    }
    ms.forEach((m) => {
      const e = map.get(m.date);
      if (!e) return;
      if (m.type === "receive") e.Received += Number(m.quantity ?? 0);
      else e.Delivered += Number(m.quantity ?? 0);
    });
    return Array.from(map.values());
  }, [ms, from, to]);

  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; amount: number; paid: number }>();
    ms.forEach((m) => {
      if (m.type !== "deliver") return;
      const k = m.customer_id;
      const e = map.get(k) ?? { name: m.customers?.name ?? "—", qty: 0, amount: 0, paid: 0 };
      e.qty += Number(m.quantity ?? 0);
      e.amount += Number(m.total_amount ?? 0);
      map.set(k, e);
    });
    ps.forEach((p) => {
      const e = map.get(p.customer_id);
      if (e) e.paid += Number(p.amount ?? 0);
    });
    return Array.from(map.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [ms, ps]);

  const exportCsv = () => {
    const rows = [
      ["FINANCIAL SUMMARY", `${from} to ${to}`],
      ["Revenue (Billed)", totals.billed],
      ["Collected", totals.collected],
      ["Gas Purchases (Cost)", totals.purchased],
      ["Operating Expenses", totals.expensed],
      ["Net Profit / Loss", totals.profit],
      [],
      ["Date", "Type", "Customer", "Quantity", "Amount"],
      ...ms.map((m: any) => [
        m.date,
        m.type,
        m.customers?.name ?? "",
        m.quantity,
        m.total_amount ?? "",
      ]),
      [],
      ["Date", "Payment", "Customer", "Amount"],
      ...ps.map((p: any) => [p.date, "payment", p.customers?.name ?? "", p.amount]),
      [],
      ["Date", "Gas Purchase", "Supplier", "Gas", "Cubic Meter", "Amount"],
      ...pur.map((p: any) => [
        p.date,
        "purchase",
        p.suppliers?.name ?? "",
        p.gas_types?.name ?? "",
        p.cubic_meter ?? "",
        p.total_amount ?? "",
      ]),
      [],
      ["Date", "Expense", "Category", "Payee", "Amount"],
      ...exp.map((e: any) => [e.date, "expense", e.category ?? "", e.payee ?? "", e.amount ?? ""]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDate(from)} → {formatDate(to)}
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} className="gap-2">
          <Download className="size-4" /> Export CSV
        </Button>
      </header>

      <Card className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
        <div>
          <Label className="text-xs">From</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1.5 h-11"
          />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1.5 h-11"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 md:col-span-1 col-span-2">
          {[
            ["7D", 6],
            ["30D", 29],
            ["90D", 89],
          ].map(([lbl, days]) => (
            <Button
              key={lbl as string}
              variant="secondary"
              className="h-11"
              onClick={() => {
                const t = new Date();
                setTo(t.toISOString().slice(0, 10));
                setFrom(
                  new Date(Date.now() - (days as number) * 86400000).toISOString().slice(0, 10),
                );
              }}
            >
              {lbl}
            </Button>
          ))}
        </div>
      </Card>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi
          icon={ArrowDownToLine}
          label="Received"
          value={totals.received.toLocaleString()}
          tone="brand"
        />
        <Kpi
          icon={ArrowUpFromLine}
          label="Delivered"
          value={totals.delivered.toLocaleString()}
          tone="default"
        />
        <Kpi
          icon={Factory}
          label="Produced"
          value={totals.produced.toLocaleString()}
          tone="success"
        />
        <Kpi icon={Wallet} label="Billed" value={formatCurrency(totals.billed)} tone="warn" />
        <Kpi
          icon={Wallet}
          label="Collected"
          value={formatCurrency(totals.collected)}
          tone="success"
        />
      </section>

      {/* Profit & Loss */}
      <Card className="p-5">
        <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
          <TrendingUp className="size-5 text-brand" /> Profit &amp; Loss
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <PLBox icon={Wallet} label="Revenue (Billed)" value={totals.billed} tone="success" />
          <PLBox
            icon={PackagePlus}
            label="Gas Purchases"
            value={-totals.purchased}
            sub={formatM3(totals.purchasedM3)}
            tone="brand"
          />
          <PLBox icon={Receipt} label="Expenses" value={-totals.expensed} tone="warn" />
          <PLBox
            icon={TrendingUp}
            label="Net Profit / Loss"
            value={totals.profit}
            tone={totals.profit >= 0 ? "success" : "destructive"}
            strong
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          Net = Billed revenue − Gas purchases − Operating expenses for the selected period.
          Collected ({formatCurrency(totals.collected)}) is cash actually received.
        </p>
      </Card>

      <Card className="p-4">
        <h2 className="font-display font-bold text-lg mb-3">Daily Movements</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailySeries}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} width={30} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Received" fill="var(--brand)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Delivered" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {expenseBreakdown.length > 0 && (
        <Card className="p-4">
          <h2 className="font-display font-bold text-lg mb-3">Expenses by Category</h2>
          <div className="divide-y">
            {expenseBreakdown.map(([cat, amt]) => (
              <div key={cat} className="py-2.5 flex items-center justify-between">
                <span className="text-sm font-medium">{cat}</span>
                <span className="font-display font-bold">{formatCurrency(amt)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="font-display font-bold text-lg mb-3">Top Customers</h2>
        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && topCustomers.length === 0 && (
          <div className="text-sm text-muted-foreground">No data in this range.</div>
        )}
        <div className="divide-y">
          {topCustomers.map((c, i) => (
            <div key={i} className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-7 rounded-full bg-brand/10 text-brand grid place-items-center text-xs font-bold">
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.qty} cyl • Paid {formatCurrency(c.paid)}
                  </div>
                </div>
              </div>
              <div className="font-display font-bold">{formatCurrency(c.amount)}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function PLBox({ icon: Icon, label, value, sub, tone, strong }: any) {
  const cls =
    tone === "success"
      ? "text-success"
      : tone === "warn"
        ? "text-warning"
        : tone === "brand"
          ? "text-brand"
          : tone === "destructive"
            ? "text-destructive"
            : "text-foreground";
  return (
    <div className={`rounded-xl border p-3 ${strong ? "bg-muted/30" : ""}`}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className={`font-display font-bold text-lg mt-1 ${cls}`}>{formatCurrency(value)}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: any) {
  const cls =
    tone === "brand"
      ? "bg-brand/10 text-brand"
      : tone === "success"
        ? "bg-success/15 text-success"
        : tone === "warn"
          ? "bg-warning/15 text-warning"
          : "bg-muted text-foreground";
  return (
    <Card className="p-3">
      <div className={`size-8 rounded-lg grid place-items-center ${cls}`}>
        <Icon className="size-4" />
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">{label}</div>
      <div className="font-display font-bold text-lg mt-0.5 truncate">{value}</div>
    </Card>
  );
}
