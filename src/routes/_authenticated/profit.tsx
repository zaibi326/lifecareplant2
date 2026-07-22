import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, todayISO } from "@/lib/format";
import { buildBulkBalances } from "@/lib/bulk-gas";
import { computePnl, answerOwnerQuery, type AssistantContext } from "@/lib/pnl";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Send,
  Wallet,
  Receipt,
  PackagePlus,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/profit")({
  head: () => ({ meta: [{ title: "Profit & Loss — Life Care Plant" }] }),
  component: ProfitPage,
});

function ranges() {
  const today = todayISO();
  const monthStart = today.slice(0, 8) + "01";
  const yearStart = today.slice(0, 4) + "-01-01";
  return { today, monthStart, yearStart };
}

function ProfitPage() {
  const { today, monthStart, yearStart } = ranges();

  const { data } = useQuery({
    queryKey: ["pnl-data"],
    queryFn: async () => {
      const [deliveries, purchases, expenses, delExp, customers, allPays, gases, sizes, prod] =
        await Promise.all([
          supabase
            .from("cylinder_movements")
            .select(
              "date,total_amount,rate,quantity,type,gas_type_id,cylinder_size_id,condition,customer_id",
            )
            .eq("type", "deliver")
            .gte("date", yearStart),
          supabase
            .from("gas_purchases")
            .select("date,total_amount,gas_type_id,cubic_meter")
            .gte("date", yearStart),
          supabase.from("expenses").select("date,amount,category").gte("date", yearStart),
          supabase.from("delivery_expenses").select("date,total,vehicle_id").gte("date", yearStart),
          supabase.from("customers").select("id,name,opening_due"),
          supabase.from("payments").select("amount"),
          supabase.from("gas_types").select("id,name"),
          supabase.from("cylinder_sizes").select("id,name"),
          supabase.from("production").select("gas_type_id,gas_consumed"),
        ]);
      return {
        deliveries: deliveries.data ?? [],
        purchases: purchases.data ?? [],
        expenses: expenses.data ?? [],
        delExp: delExp.data ?? [],
        customers: customers.data ?? [],
        allPays: allPays.data ?? [],
        gases: gases.data ?? [],
        sizes: sizes.data ?? [],
        prod: prod.data ?? [],
      };
    },
  });

  const d = data;
  const mk = (from: string, to: string) =>
    computePnl({
      range: { from, to },
      deliveries: (d?.deliveries ?? []) as any,
      purchases: (d?.purchases ?? []) as any,
      expenses: (d?.expenses ?? []) as any,
      deliveryExpenses: (d?.delExp ?? []) as any,
    });

  const todayPnl = mk(today, today);
  const monthPnl = mk(monthStart, today);
  const yearPnl = mk(yearStart, today);

  // Assistant context
  const ctx = useMemo<AssistantContext>(() => {
    const gasName = new Map<string, string>();
    (d?.gases ?? []).forEach((g: any) => gasName.set(g.id, g.name));
    const sizeName = new Map<string, string>();
    (d?.sizes ?? []).forEach((s: any) => sizeName.set(s.id, s.name));

    const bulk = buildBulkBalances(
      (d?.purchases ?? []).map((p: any) => ({
        gas_type_id: p.gas_type_id,
        cubic_meter: p.cubic_meter,
      })),
      (d?.prod ?? []) as any,
    );
    const bulkByGas = Array.from(bulk.entries()).map(([id, v]) => ({
      name: gasName.get(id) ?? "Gas",
      remaining: v.remaining,
    }));

    // Filled cylinders per gas+size = net delivered filled − received (proxy for what's out)
    const fillMap = new Map<string, number>();
    (d?.deliveries ?? []).forEach((m: any) => {
      const key = `${m.gas_type_id}||${m.cylinder_size_id}`;
      fillMap.set(key, (fillMap.get(key) ?? 0) + Number(m.quantity ?? 0));
    });
    const filledByGasSize = Array.from(fillMap.entries()).map(([k, filled]) => {
      const [g, s] = k.split("||");
      return { gas: gasName.get(g) ?? "Gas", size: sizeName.get(s) ?? "Size", filled };
    });

    // Top debtor (gross billed + opening − payments not netted per-customer; indicative)
    const debtMap = new Map<string, { name: string; due: number }>();
    (d?.customers ?? []).forEach((c: any) =>
      debtMap.set(c.id, { name: c.name, due: Number(c.opening_due ?? 0) }),
    );
    (d?.deliveries ?? []).forEach((m: any) => {
      if (!m.customer_id) return;
      const e = debtMap.get(m.customer_id);
      if (e) e.due += Number(m.total_amount ?? 0);
    });
    const debtors = Array.from(debtMap.values())
      .filter((x) => x.due > 0)
      .sort((a, b) => b.due - a.due);
    const outstanding = debtors.reduce((a, x) => a + x.due, 0);

    // Best selling gas by delivered qty
    const gasQty = new Map<string, number>();
    (d?.deliveries ?? []).forEach((m: any) =>
      gasQty.set(m.gas_type_id, (gasQty.get(m.gas_type_id) ?? 0) + Number(m.quantity ?? 0)),
    );
    const bestEntry = Array.from(gasQty.entries()).sort((a, b) => b[1] - a[1])[0];

    return {
      bulkByGas,
      filledByGasSize,
      todayProfit: todayPnl.netProfit,
      monthProfit: monthPnl.netProfit,
      topDebtor: debtors[0] ?? null,
      topVehicleExpense: null,
      bestSellingGas: bestEntry
        ? { name: gasName.get(bestEntry[0]) ?? "Gas", qty: bestEntry[1] }
        : null,
      outstanding,
    };
  }, [d, todayPnl.netProfit, monthPnl.netProfit]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
          Profit & Loss
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Business performance across today, month, and year to date.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <ProfitCard title="Today" pnl={todayPnl} />
        <ProfitCard title="This Month" pnl={monthPnl} highlight />
        <ProfitCard title="This Year" pnl={yearPnl} />
      </section>

      <PnlBreakdown title="Monthly Breakdown" pnl={monthPnl} />

      <OwnerAssistant ctx={ctx} />
    </div>
  );
}

function ProfitCard({
  title,
  pnl,
  highlight,
}: {
  title: string;
  pnl: ReturnType<typeof computePnl>;
  highlight?: boolean;
}) {
  const positive = pnl.netProfit >= 0;
  return (
    <Card className={`p-5 ${highlight ? "border-brand/40 bg-brand/5" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {title}
        </span>
        {positive ? (
          <TrendingUp className="size-4 text-success" />
        ) : (
          <TrendingDown className="size-4 text-destructive" />
        )}
      </div>
      <div
        className={`font-display text-2xl font-bold mt-2 ${positive ? "text-success" : "text-destructive"}`}
      >
        {formatCurrency(pnl.netProfit)}
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">Net profit</div>
      <div className="mt-3 pt-3 border-t space-y-1 text-xs">
        <Row label="Sales" value={pnl.income.sales} />
        <Row label="Purchase cost" value={-pnl.purchaseCost} />
        <Row label="Expenses" value={-pnl.expenses.total} />
        <div className="flex justify-between font-semibold pt-1">
          <span>Gross profit</span>
          <span>{formatCurrency(pnl.grossProfit)}</span>
        </div>
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className={value < 0 ? "text-destructive" : ""}>{formatCurrency(value)}</span>
    </div>
  );
}

function PnlBreakdown({ title, pnl }: { title: string; pnl: ReturnType<typeof computePnl> }) {
  const cats = Object.entries(pnl.expenses.byCategory).sort((a, b) => b[1] - a[1]);
  return (
    <Card className="p-5">
      <h2 className="font-display font-bold mb-4">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <Wallet className="size-3" /> Income
          </div>
          <div className="space-y-1.5 text-sm">
            <LineItem label="Cylinder & Gas Sales" value={pnl.income.sales} />
            <LineItem label="Rental Income" value={pnl.income.rentalIncome} />
            <LineItem label="Other Income" value={pnl.income.otherIncome} />
            <div className="flex justify-between font-semibold border-t pt-1.5">
              <span>Total Income</span>
              <span>{formatCurrency(pnl.income.total)}</span>
            </div>
          </div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mt-4 mb-2 flex items-center gap-1">
            <PackagePlus className="size-3" /> Purchase Cost
          </div>
          <LineItem label="Bulk Gas & Cylinder Purchases" value={pnl.purchaseCost} />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <Receipt className="size-3" /> Expenses
          </div>
          <div className="space-y-1.5 text-sm">
            {cats.length === 0 && (
              <p className="text-muted-foreground text-xs">No expenses in this period.</p>
            )}
            {cats.map(([cat, amt]) => (
              <LineItem key={cat} label={cat} value={amt} />
            ))}
            <div className="flex justify-between font-semibold border-t pt-1.5">
              <span>Total Expenses</span>
              <span>{formatCurrency(pnl.expenses.total)}</span>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-muted/40 p-3">
            <div className="flex justify-between text-sm">
              <span>Gross Profit</span>
              <span className="font-semibold">{formatCurrency(pnl.grossProfit)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span>Net Profit</span>
              <span
                className={`font-display font-bold ${pnl.netProfit >= 0 ? "text-success" : "text-destructive"}`}
              >
                {formatCurrency(pnl.netProfit)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function LineItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}

function OwnerAssistant({ ctx }: { ctx: AssistantContext }) {
  const [q, setQ] = useState("");
  const [log, setLog] = useState<{ q: string; a: string }[]>([]);
  const suggestions = [
    "What is today's profit?",
    "Which customer owes the most?",
    "What is the best selling gas?",
  ];

  const ask = (question: string) => {
    const query = question.trim();
    if (!query) return;
    const { answer } = answerOwnerQuery(query, ctx);
    setLog((l) => [{ q: query, a: answer }, ...l].slice(0, 8));
    setQ("");
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="size-8 rounded-lg bg-brand/10 text-brand grid place-items-center">
          <Sparkles className="size-4" />
        </div>
        <div>
          <h2 className="font-display font-bold">Owner Assistant</h2>
          <p className="text-xs text-muted-foreground">Ask about stock, profit, or customers</p>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
        className="flex gap-2"
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="How much oxygen is remaining?"
          className="h-11"
        />
        <Button type="submit" className="h-11 gap-1">
          <Send className="size-4" />
        </Button>
      </form>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => ask(s)}
            className="text-[11px] px-2.5 py-1 rounded-full border hover:bg-muted transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
      {log.length > 0 && (
        <div className="mt-4 space-y-2">
          {log.map((entry, i) => (
            <div key={i} className="rounded-xl border p-3">
              <div className="text-xs text-muted-foreground">{entry.q}</div>
              <div className="text-sm font-medium mt-1">{entry.a}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
