import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildBulkBalances } from "@/lib/bulk-gas";
import { computePnl } from "@/lib/pnl";
import { ask, SUGGESTED_QUESTIONS, type AssistantContext } from "@/lib/ai";
import { todayISO } from "@/lib/format";
import { Sparkles, Send, Bot, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({ meta: [{ title: "AI Assistant — Life Care Plant" }] }),
  component: AssistantPage,
});

type ChatMessage = { role: "user" | "bot"; text: string };

function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build the assistant context from live figures (offline, rule-based engine).
  const { data, isLoading } = useQuery({
    queryKey: ["assistant-context"],
    queryFn: async () => {
      const today = todayISO();
      const monthStart = today.slice(0, 8) + "01";
      const [
        gases,
        sizes,
        purchases,
        production,
        movesToday,
        expToday,
        delivExpToday,
        movesMonth,
        expMonth,
        delivExpMonth,
        customers,
        allMoves,
        allPays,
        vehicles,
        delivExpAll,
        allMovesGas,
      ] = await Promise.all([
        supabase.from("gas_types").select("id,name").eq("active", true),
        supabase.from("cylinder_sizes").select("id,name").eq("active", true),
        supabase.from("gas_purchases").select("gas_type_id,cubic_meter,date,total_amount"),
        supabase.from("production").select("gas_type_id,gas_consumed,quantity,date"),
        supabase
          .from("cylinder_movements")
          .select("type,total_amount,rate,quantity,date")
          .eq("date", today),
        supabase.from("expenses").select("amount,category,date").eq("date", today),
        supabase.from("delivery_expenses").select("total,date").eq("date", today),
        supabase
          .from("cylinder_movements")
          .select("type,total_amount,rate,quantity,date")
          .gte("date", monthStart),
        supabase.from("expenses").select("amount,category,date").gte("date", monthStart),
        supabase.from("delivery_expenses").select("total,date").gte("date", monthStart),
        supabase.from("customers").select("id,name,opening_due"),
        supabase.from("cylinder_movements").select("type,total_amount,customer_id"),
        supabase.from("payments").select("amount,customer_id"),
        supabase.from("vehicles").select("id,vehicle_number"),
        supabase.from("delivery_expenses").select("vehicle_id,total"),
        supabase
          .from("cylinder_movements")
          .select("type,quantity,gas_type_id,cylinder_size_id,condition"),
      ]);

      return {
        today,
        monthStart,
        gases: gases.data ?? [],
        sizes: sizes.data ?? [],
        purchases: purchases.data ?? [],
        production: production.data ?? [],
        movesToday: movesToday.data ?? [],
        expToday: expToday.data ?? [],
        delivExpToday: delivExpToday.data ?? [],
        movesMonth: movesMonth.data ?? [],
        expMonth: expMonth.data ?? [],
        delivExpMonth: delivExpMonth.data ?? [],
        customers: customers.data ?? [],
        allMoves: allMoves.data ?? [],
        allPays: allPays.data ?? [],
        vehicles: vehicles.data ?? [],
        delivExpAll: delivExpAll.data ?? [],
        allMovesGas: allMovesGas.data ?? [],
      };
    },
  });

  const ctx = useMemo<AssistantContext>(() => {
    const gasName = new Map<string, string>();
    (data?.gases ?? []).forEach((g: any) => gasName.set(g.id, g.name));
    const sizeName = new Map<string, string>();
    (data?.sizes ?? []).forEach((s: any) => sizeName.set(s.id, s.name));

    // Bulk gas remaining (m³) per gas.
    const balances = buildBulkBalances(data?.purchases ?? [], data?.production ?? []);
    const bulkByGas = Array.from(balances.entries()).map(([id, v]) => ({
      name: gasName.get(id) ?? "Gas",
      remaining: v.remaining,
    }));

    // Filled cylinders currently in plant, by gas × size (received − delivered, filled only).
    const cellMap = new Map<string, { gas: string; size: string; filled: number }>();
    (data?.allMovesGas ?? []).forEach((m: any) => {
      if (m.condition === "empty") return;
      const gas = gasName.get(m.gas_type_id) ?? "Gas";
      const size = sizeName.get(m.cylinder_size_id) ?? "—";
      const key = `${gas}||${size}`;
      const e = cellMap.get(key) ?? { gas, size, filled: 0 };
      const q = Number(m.quantity ?? 0);
      e.filled += m.type === "receive" ? q : -q;
      cellMap.set(key, e);
    });
    const filledByGasSize = Array.from(cellMap.values()).filter((c) => c.filled !== 0);

    // Today / month net profit (report P&L engine).
    const pnl = (
      moves: any[],
      exps: any[],
      delivExps: any[],
      range: { from: string; to: string },
    ) =>
      computePnl({
        range,
        deliveries: moves
          .filter((m) => m.type === "deliver")
          .map((m) => ({
            date: m.date,
            total_amount: m.total_amount,
            rate: m.rate ?? null,
            quantity: m.quantity,
          })),
        purchases: (data?.purchases ?? []).map((p: any) => ({
          date: p.date,
          total_amount: p.total_amount,
        })),
        expenses: exps.map((e) => ({ date: e.date, amount: e.amount, category: e.category })),
        deliveryExpenses: delivExps.map((d) => ({ date: d.date, total: d.total })),
      }).netProfit;

    const todayProfit = pnl(
      data?.movesToday ?? [],
      data?.expToday ?? [],
      data?.delivExpToday ?? [],
      { from: data?.today ?? "", to: data?.today ?? "" },
    );
    const monthProfit = pnl(
      data?.movesMonth ?? [],
      data?.expMonth ?? [],
      data?.delivExpMonth ?? [],
      { from: data?.monthStart ?? "", to: data?.today ?? "" },
    );

    // Outstanding + top debtor.
    const dueMap = new Map<string, { name: string; due: number }>();
    (data?.customers ?? []).forEach((c: any) =>
      dueMap.set(c.id, { name: c.name ?? "Customer", due: Number(c.opening_due ?? 0) }),
    );
    (data?.allMoves ?? []).forEach((m: any) => {
      if (m.type !== "deliver" || !m.customer_id) return;
      const e = dueMap.get(m.customer_id);
      if (e) e.due += Number(m.total_amount ?? 0);
    });
    (data?.allPays ?? []).forEach((p: any) => {
      if (!p.customer_id) return;
      const e = dueMap.get(p.customer_id);
      if (e) e.due -= Number(p.amount ?? 0);
    });
    const debtors = Array.from(dueMap.values())
      .filter((d) => d.due > 0)
      .sort((a, b) => b.due - a.due);
    const outstanding = debtors.reduce((a, d) => a + d.due, 0);
    const topDebtor = debtors[0] ?? null;

    // Top vehicle expense.
    const vName = new Map<string, string>();
    (data?.vehicles ?? []).forEach((v: any) => vName.set(v.id, v.vehicle_number));
    const vMap = new Map<string, number>();
    (data?.delivExpAll ?? []).forEach((d: any) => {
      if (!d.vehicle_id) return;
      vMap.set(d.vehicle_id, (vMap.get(d.vehicle_id) ?? 0) + Number(d.total ?? 0));
    });
    const vTop = Array.from(vMap.entries()).sort((a, b) => b[1] - a[1])[0];
    const topVehicleExpense = vTop
      ? { name: vName.get(vTop[0]) ?? "Vehicle", total: vTop[1] }
      : null;

    // Best selling gas (by delivered quantity, all time).
    const gasQty = new Map<string, number>();
    (data?.allMovesGas ?? []).forEach((m: any) => {
      if (m.type !== "deliver") return;
      const n = gasName.get(m.gas_type_id) ?? "Gas";
      gasQty.set(n, (gasQty.get(n) ?? 0) + Number(m.quantity ?? 0));
    });
    const gTop = Array.from(gasQty.entries()).sort((a, b) => b[1] - a[1])[0];
    const bestSellingGas = gTop ? { name: gTop[0], qty: gTop[1] } : null;

    return {
      bulkByGas,
      filledByGasSize,
      todayProfit,
      monthProfit,
      topDebtor,
      topVehicleExpense,
      bestSellingGas,
      outstanding,
    };
  }, [data]);

  const send = (q: string) => {
    const question = q.trim();
    if (!question) return;
    const answer = ask(question, ctx);
    setMessages((prev) => [
      ...prev,
      { role: "user", text: question },
      { role: "bot", text: answer.answer },
    ]);
    setInput("");
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <div className="size-11 rounded-2xl bg-brand text-brand-foreground grid place-items-center shadow-md shadow-brand/20">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
            AI Assistant
          </h1>
          <p className="text-sm text-muted-foreground">
            Apne business ke baare mein poochein — stock, profit, customers.
          </p>
        </div>
      </header>

      <Card className="p-4">
        <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
          Suggested questions
        </p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={isLoading}
              className="text-xs px-3 py-1.5 rounded-full border bg-muted/40 hover:bg-brand/10 hover:border-brand/40 transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col h-[52vh] min-h-80">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="h-full grid place-items-center text-center text-sm text-muted-foreground">
              <div>
                <Bot className="size-8 mx-auto mb-2 text-muted-foreground/60" />
                Ask a question or tap a suggestion above.
                {isLoading && <div className="mt-2 text-xs">Loading your figures…</div>}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "bot" && (
                <div className="size-8 rounded-full bg-brand/10 text-brand grid place-items-center shrink-0">
                  <Bot className="size-4" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-brand text-brand-foreground rounded-br-sm"
                    : "bg-muted rounded-bl-sm"
                }`}
              >
                {m.text}
              </div>
              {m.role === "user" && (
                <div className="size-8 rounded-full bg-muted grid place-items-center shrink-0">
                  <User className="size-4" />
                </div>
              )}
            </div>
          ))}
        </div>
        <form
          className="border-t p-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question…"
            className="h-11"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" className="size-11 shrink-0" disabled={isLoading}>
            <Send className="size-4" />
          </Button>
        </form>
      </Card>

      <p className="text-[11px] text-muted-foreground text-center">
        Answers are generated on-device from your recorded data. No information leaves your browser.
      </p>
    </div>
  );
}
