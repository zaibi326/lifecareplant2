import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowDownToLine, ArrowUpFromLine, Wallet, Printer, Phone, MapPin, Package } from "lucide-react";
import { printHTML } from "@/lib/print";

export const Route = createFileRoute("/_authenticated/customers/$customerId")({
  head: () => ({ meta: [{ title: "Customer — Life Care Plant" }] }),
  component: CustomerProfilePage,
});

function CustomerProfilePage() {
  const { customerId } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["customer-profile", customerId],
    queryFn: async () => {
      const [c, ms, ps, s, ob] = await Promise.all([
        supabase.from("customers").select("*").eq("id", customerId).maybeSingle(),
        supabase.from("cylinder_movements").select("*,gas_types(name,color),cylinder_sizes(name)").eq("customer_id", customerId).order("date", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("payments").select("*").eq("customer_id", customerId).order("date", { ascending: false }),
        supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
        supabase.from("customer_opening_balances").select("*,gas_types(name,color),cylinder_sizes(name)").eq("customer_id", customerId),
      ]);
      return { customer: c.data, movements: ms.data ?? [], payments: ps.data ?? [], settings: s.data, opening: ob.data ?? [] };
    },
  });

  const balance = useMemo(() => {
    if (!data?.customer) return { withCust: 0, due: 0, last: null as string | null };
    let withCust = 0;
    (data.opening ?? []).forEach((o: any) => { withCust += Number(o.quantity ?? 0); });
    let due = Number(data.customer.opening_due ?? 0);
    data.movements.forEach((m: any) => {
      if (m.type === "deliver") { withCust += m.quantity; due += Number(m.total_amount ?? 0); }
      else { withCust -= m.quantity; }
    });
    data.payments.forEach((p: any) => { due -= Number(p.amount ?? 0); });
    const last = data.movements[0]?.date ?? data.payments[0]?.date ?? null;
    return { withCust, due, last };
  }, [data]);

  // breakdown: gas + size + condition
  const breakdown = useMemo(() => {
    const map = new Map<string, { gas: string; size: string; color?: string; filled: number; empty: number }>();
    const key = (g: string, s: string) => `${g}||${s}`;
    const ensure = (g: string, s: string, color?: string) => {
      const k = key(g, s);
      if (!map.has(k)) map.set(k, { gas: g, size: s, color, filled: 0, empty: 0 });
      return map.get(k)!;
    };
    (data?.opening ?? []).forEach((o: any) => {
      const row = ensure(o.gas_types?.name ?? "—", o.cylinder_sizes?.name ?? "—", o.gas_types?.color);
      if (o.condition === "empty") row.empty += Number(o.quantity ?? 0);
      else row.filled += Number(o.quantity ?? 0);
    });
    (data?.movements ?? []).forEach((m: any) => {
      const row = ensure(m.gas_types?.name ?? "—", m.cylinder_sizes?.name ?? "—", m.gas_types?.color);
      const cond = m.condition === "empty" ? "empty" : "filled";
      const q = Number(m.quantity ?? 0);
      if (m.type === "deliver") row[cond] += q;
      else row[cond] -= q;
    });
    return Array.from(map.values()).filter((r) => r.filled !== 0 || r.empty !== 0);
  }, [data]);


  const timeline = useMemo(() => {
    const items: any[] = [];
    (data?.movements ?? []).forEach((m: any) => items.push({
      kind: m.type, date: m.date, ts: m.created_at,
      title: m.type === "receive" ? "Received" : "Delivered",
      sub: `${m.quantity}× ${m.cylinder_sizes?.name ?? ""} ${m.gas_types?.name ?? ""}`,
      amount: m.type === "deliver" ? Number(m.total_amount ?? 0) : null,
      invoice: m.invoice_number,
    }));
    (data?.payments ?? []).forEach((p: any) => items.push({
      kind: "payment", date: p.date, ts: p.created_at,
      title: "Payment Received", sub: p.method ?? "", amount: Number(p.amount), ref: p.reference_number,
    }));
    return items.sort((a, b) => (b.ts ?? b.date).localeCompare(a.ts ?? a.date));
  }, [data]);

  const printStatement = () => {
    if (!data?.customer) return;
    const rows = timeline.map((t) => `<tr><td>${formatDate(t.date)}</td><td>${t.title}</td><td>${t.sub}${t.invoice ? ` <span class="muted">(${t.invoice})</span>` : ""}${t.ref ? ` <span class="muted">Ref ${t.ref}</span>` : ""}</td><td class="right">${t.amount != null ? formatCurrency(t.kind === "payment" ? -t.amount : t.amount) : "—"}</td></tr>`).join("");
    printHTML(`Statement — ${data.customer.name}`, `
      <div class="head">
        <div><h1>${data.settings?.company_name ?? "Life Care Plant"}</h1><div class="muted">${data.settings?.company_address ?? ""}</div><div class="muted">${data.settings?.company_phone ?? ""}</div></div>
        <div style="text-align:right"><span class="badge">STATEMENT</span><div style="margin-top:8px;font-weight:700">${data.customer.name}</div><div class="muted">${data.customer.phone ?? ""}</div><div class="muted">${data.customer.address ?? ""}</div></div>
      </div>
      <h2>Activity</h2>
      <table><thead><tr><th>Date</th><th>Type</th><th>Details</th><th class="right">Amount</th></tr></thead><tbody>${rows || `<tr><td colspan="4" class="muted">No activity</td></tr>`}</tbody></table>
      <div class="totals"><div><div class="label">Cylinders With Customer</div><div class="val">${balance.withCust}</div></div><div><div class="label">Outstanding Due</div><div class="val">${formatCurrency(balance.due)}</div></div></div>
    `);
  };

  if (isLoading) return <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>;
  if (!data?.customer) return <Card className="p-6 text-sm">Customer not found. <Link to="/customers" className="underline">Back</Link></Card>;

  const c = data.customer;

  return (
    <div className="space-y-5">
      <Link to="/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to customers
      </Link>

      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="size-14 rounded-full bg-brand/10 text-brand grid place-items-center font-bold text-xl">{c.name.charAt(0).toUpperCase()}</div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight truncate">{c.name}</h1>
            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3 mt-1">
              {c.phone && <span className="flex items-center gap-1"><Phone className="size-3" />{c.phone}</span>}
              {c.address && <span className="flex items-center gap-1"><MapPin className="size-3" />{c.address}</span>}
              {c.category && <Badge variant="secondary" className="text-[10px]">{c.category}</Badge>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-5">
          <Mini icon={Package} label="With Customer" value={`${balance.withCust} cyl`} />
          <Mini icon={Wallet} label="Outstanding" value={formatCurrency(balance.due)} warn={balance.due > 0} />
          <Mini icon={Package} label="Last Activity" value={balance.last ? formatDate(balance.last) : "—"} />
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Link to="/movements" search={{ type: "receive" }}><Button variant="outline" className="w-full h-12 gap-2"><ArrowDownToLine className="size-4" /> Receive</Button></Link>
        <Link to="/movements" search={{ type: "deliver" }}><Button variant="outline" className="w-full h-12 gap-2"><ArrowUpFromLine className="size-4" /> Deliver</Button></Link>
        <Link to="/payments"><Button variant="outline" className="w-full h-12 gap-2"><Wallet className="size-4" /> Payment</Button></Link>
        <Button onClick={printStatement} className="h-12 gap-2"><Printer className="size-4" /> Print Statement</Button>
      </div>

      <div>
        <h2 className="font-display text-lg font-bold mb-3">Cylinders With Customer (by Gas & Size)</h2>
        {breakdown.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">Koi cylinder is customer ke pas track nahi.</Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {breakdown.map((b, i) => (
              <Card key={i} className="p-3">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-md grid place-items-center text-white text-[10px] font-bold" style={{ background: b.color || "var(--brand)" }}>
                    {b.gas.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{b.gas}</div>
                    <div className="text-[10px] text-muted-foreground">{b.size}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-success font-semibold">Filled: {b.filled}</span>
                  <span className="text-muted-foreground font-semibold">Empty: {b.empty}</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>

        <h2 className="font-display text-lg font-bold mb-3">History</h2>
        <div className="space-y-2">
          {timeline.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No activity yet.</Card>}
          {timeline.map((t, i) => (
            <Card key={i} className="p-4 flex items-center gap-3">
              <div className={`size-10 rounded-lg grid place-items-center ${t.kind === "receive" ? "bg-brand/15 text-brand" : t.kind === "deliver" ? "bg-primary/15 text-primary" : "bg-success/15 text-success"}`}>
                {t.kind === "receive" ? <ArrowDownToLine className="size-4" /> : t.kind === "deliver" ? <ArrowUpFromLine className="size-4" /> : <Wallet className="size-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{t.title}</span>
                  {t.invoice && <span className="text-[10px] px-2 py-0.5 bg-muted rounded font-medium">{t.invoice}</span>}
                </div>
                <div className="text-xs text-muted-foreground truncate">{t.sub} • {formatDate(t.date)}{t.ref ? ` • Ref ${t.ref}` : ""}</div>
              </div>
              {t.amount != null && (
                <div className={`font-display font-bold ${t.kind === "payment" ? "text-success" : ""}`}>
                  {t.kind === "payment" ? "−" : ""}{formatCurrency(t.amount)}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function Mini({ icon: Icon, label, value, warn }: any) {
  return (
    <div className="rounded-lg border p-3">
      <div className={`size-7 rounded-md grid place-items-center ${warn ? "bg-destructive/15 text-destructive" : "bg-muted"}`}><Icon className="size-3.5" /></div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">{label}</div>
      <div className="font-display font-bold mt-0.5 truncate">{value}</div>
    </div>
  );
}
