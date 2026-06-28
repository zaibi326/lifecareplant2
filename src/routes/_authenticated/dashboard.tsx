import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import { ArrowDownToLine, ArrowUpFromLine, Wallet, Factory, Package, Users, TrendingUp, AlertCircle } from "lucide-react";
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
  head: () => ({ meta: [{ title: "Dashboard — GasFlow Pro" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const today = todayISO();
      const since = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
      const [movements, payments, production, customers, gases] = await Promise.all([
        supabase.from("cylinder_movements").select("type,date,quantity,total_amount,customer_id,gas_type_id,cylinder_size_id,vehicle_number,driver_name,invoice_number,created_at,customers(name),gas_types(name,color)").gte("date", since).order("created_at", { ascending: false }),
        supabase.from("payments").select("amount,date,customer_id,created_at,customers(name)").gte("date", since).order("created_at", { ascending: false }),
        supabase.from("production").select("quantity,date").eq("date", today),
        supabase.from("customers").select("id,opening_cylinders,opening_due"),
        supabase.from("gas_types").select("id,name,color").eq("active", true),
      ]);
      return { movements: movements.data ?? [], payments: payments.data ?? [], production: production.data ?? [], customers: customers.data ?? [], gases: gases.data ?? [] };
    },
  });

  const today = todayISO();
  const movs = data?.movements ?? [];
  const pays = data?.payments ?? [];

  const sum = (arr: any[], k: string) => arr.reduce((a, b) => a + Number(b[k] ?? 0), 0);
  const todayReceived = sum(movs.filter((m: any) => m.type === "receive" && m.date === today), "quantity");
  const todayDelivered = sum(movs.filter((m: any) => m.type === "deliver" && m.date === today), "quantity");
  const todayProduction = sum(data?.production ?? [], "quantity");
  const todayPayments = sum(pays.filter((p: any) => p.date === today), "amount");

  // Plant stock = received - delivered (across all time visible) + opening adjustments are with customers
  const allReceived = sum(movs.filter((m: any) => m.type === "receive"), "quantity");
  const allDelivered = sum(movs.filter((m: any) => m.type === "deliver"), "quantity");

  const customerOpening = sum(data?.customers ?? [], "opening_cylinders");
  const withCustomers = customerOpening + allDelivered - allReceived;
  const plantStock = Math.max(0, allReceived - allDelivered);

  const openingDue = sum(data?.customers ?? [], "opening_due");
  const billed = sum(movs.filter((m: any) => m.type === "deliver"), "total_amount");
  const paid = sum(pays, "amount");
  const outstanding = Math.max(0, openingDue + billed - paid);

  // Build 14-day chart
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10);
    return {
      day: new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      Received: sum(movs.filter((m: any) => m.type === "receive" && m.date === d), "quantity"),
      Delivered: sum(movs.filter((m: any) => m.type === "deliver" && m.date === d), "quantity"),
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
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Plant Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">{formatDate(new Date())}</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="In Plant" value={plantStock.toLocaleString()} sub="Cylinders" tone="default" />
        <Kpi label="With Customers" value={withCustomers.toLocaleString()} sub={`${data?.customers.length ?? 0} clients`} tone="default" />
        <Kpi label="Received Today" value={`+${todayReceived}`} sub="Cylinders in" tone="success" />
        <Kpi label="Delivered Today" value={`-${todayDelivered}`} sub="Cylinders out" tone="brand" />
        <Kpi label="Filling Today" value={todayProduction.toLocaleString()} sub="Production" tone="warning" />
        <Kpi label="Payments Today" value={formatCurrency(todayPayments)} sub="Cash + Bank" tone="success" />
        <Kpi label="Outstanding" value={formatCurrency(outstanding)} sub="Remaining due" tone="warning" />
        <Kpi label="Total Customers" value={(data?.customers.length ?? 0).toString()} sub="Active" tone="default" />
      </section>

      <section className="grid grid-cols-2 gap-3 md:hidden">
        <Link to="/movements" search={{ type: "receive" } as any} className="flex flex-col items-center justify-center gap-2 bg-brand text-brand-foreground p-6 rounded-3xl shadow-lg shadow-brand/20 active:scale-95 transition-transform">
          <div className="size-10 rounded-full bg-white/20 grid place-items-center"><ArrowDownToLine className="size-5" /></div>
          <span className="font-semibold">Receive</span>
        </Link>
        <Link to="/movements" search={{ type: "deliver" } as any} className="flex flex-col items-center justify-center gap-2 bg-primary text-primary-foreground p-6 rounded-3xl shadow-lg shadow-primary/20 active:scale-95 transition-transform">
          <div className="size-10 rounded-full bg-white/20 grid place-items-center"><ArrowUpFromLine className="size-5" /></div>
          <span className="font-semibold">Deliver</span>
        </Link>
      </section>

      <section className="bg-card border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display font-bold">Daily Movement</h2>
            <p className="text-xs text-muted-foreground">Last 14 days</p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand bg-brand/10 px-2 py-1 rounded-full">Live</span>
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
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 12 }} />
              <Area type="monotone" dataKey="Received" stroke="var(--color-success)" fill="url(#g1)" strokeWidth={2} />
              <Area type="monotone" dataKey="Delivered" stroke="var(--color-brand)" fill="url(#g2)" strokeWidth={2} />
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
              <div className={`size-10 rounded-full border-4 border-background grid place-items-center z-10 text-[10px] font-bold font-mono ${
                r.kind === "receive" ? "bg-success/15 text-success" : r.kind === "deliver" ? "bg-brand/15 text-brand" : "bg-warning/15 text-warning"
              }`}>
                {r.kind === "receive" ? "IN" : r.kind === "deliver" ? "OUT" : "PAY"}
              </div>
              <div className="flex-1 bg-card border rounded-2xl p-3">
                <div className="flex justify-between items-start gap-2">
                  <p className="text-sm font-semibold truncate">{r.title}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0">{new Date(r.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{r.subtitle}{r.amount != null ? ` · ${formatCurrency(r.amount)}` : ""}</p>
                {r.invoice && (
                  <div className="mt-2 pt-2 border-t border-border/60">
                    <span className="text-[10px] px-2 py-0.5 bg-brand/10 text-brand rounded font-medium">{r.invoice}</span>
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

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "default" | "success" | "warning" | "brand" }) {
  const toneCls =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "brand" ? "text-brand" : "text-foreground";
  return (
    <div className="bg-card p-4 rounded-2xl border shadow-sm">
      <p className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-display text-xl md:text-2xl font-bold ${toneCls}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}