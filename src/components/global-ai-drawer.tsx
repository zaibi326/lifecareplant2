import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ask, SUGGESTED_QUESTIONS, type AssistantContext } from "@/lib/ai";
import { buildBulkBalances } from "@/lib/bulk-gas";
import { computePnl } from "@/lib/pnl";
import { todayISO } from "@/lib/format";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Bot, User, ArrowRight } from "lucide-react";

type ChatMessage = {
  role: "user" | "bot";
  text: string;
  navigateTo?: string;
};

export function GlobalAiDrawer() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch assistant context from live data
  const { data } = useQuery({
    queryKey: ["global-ai-context"],
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
        prodToday,
        suppliers,
        supPays,
      ] = await Promise.all([
        supabase.from("gas_types").select("id,name").eq("active", true),
        supabase.from("cylinder_sizes").select("id,name").eq("active", true),
        supabase
          .from("gas_purchases")
          .select("gas_type_id,cubic_meter,date,total_amount,supplier_id"),
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
        supabase.from("cylinder_movements").select("type,total_amount,customer_id,quantity"),
        supabase.from("payments").select("amount,customer_id"),
        supabase.from("vehicles").select("id,vehicle_number"),
        supabase.from("delivery_expenses").select("vehicle_id,total"),
        supabase
          .from("cylinder_movements")
          .select("type,quantity,gas_type_id,cylinder_size_id,condition"),
        supabase.from("production").select("quantity,gas_consumed").eq("date", today),
        supabase.from("suppliers").select("*"),
        supabase.from("supplier_payments").select("amount,supplier_id"),
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
        prodToday: prodToday.data ?? [],
        suppliers: suppliers.data ?? [],
        supPays: supPays.data ?? [],
      };
    },
    enabled: open, // fetch when drawer opens
  });

  const ctx = useMemo<AssistantContext>(() => {
    const gasName = new Map<string, string>();
    (data?.gases ?? []).forEach((g: any) => gasName.set(g.id, g.name));
    const sizeName = new Map<string, string>();
    (data?.sizes ?? []).forEach((s: any) => sizeName.set(s.id, s.name));

    const balances = buildBulkBalances(data?.purchases ?? [], data?.production ?? []);
    const bulkByGas = Array.from(balances.entries()).map(([id, v]) => ({
      name: gasName.get(id) ?? "Gas",
      remaining: v.remaining,
    }));

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

    // Customer dues and stock holding
    const dueMap = new Map<
      string,
      { id: string; name: string; due: number; outCylinders: number }
    >();
    (data?.customers ?? []).forEach((c: any) =>
      dueMap.set(c.id, {
        id: c.id,
        name: c.name ?? "Customer",
        due: Number(c.opening_due ?? 0),
        outCylinders: 0,
      }),
    );
    (data?.allMoves ?? []).forEach((m: any) => {
      if (!m.customer_id) return;
      const e = dueMap.get(m.customer_id);
      if (e) {
        if (m.type === "deliver") {
          e.due += Number(m.total_amount ?? 0);
          e.outCylinders += Number(m.quantity ?? 0);
        } else if (m.type === "receive") {
          e.outCylinders -= Number(m.quantity ?? 0);
        }
      }
    });
    (data?.allPays ?? []).forEach((p: any) => {
      if (!p.customer_id) return;
      const e = dueMap.get(p.customer_id);
      if (e) e.due -= Number(p.amount ?? 0);
    });

    const customerBalances = Array.from(dueMap.values());
    const debtors = customerBalances.filter((d) => d.due > 0).sort((a, b) => b.due - a.due);
    const outstanding = debtors.reduce((a, d) => a + d.due, 0);

    // Supplier pending payments
    const supMap = new Map<string, { id: string; name: string; due: number }>();
    (data?.suppliers ?? []).forEach((s: any) =>
      supMap.set(s.id, { id: s.id, name: s.name, due: Number(s.opening_balance ?? 0) }),
    );
    (data?.purchases ?? []).forEach((p: any) => {
      if (!p.supplier_id) return;
      const e = supMap.get(p.supplier_id);
      if (e) e.due += Number(p.total_amount ?? 0);
    });
    (data?.supPays ?? []).forEach((sp: any) => {
      if (!sp.supplier_id) return;
      const e = supMap.get(sp.supplier_id);
      if (e) e.due -= Number(sp.amount ?? 0);
    });
    const pendingSuppliers = Array.from(supMap.values())
      .filter((s) => s.due > 0)
      .sort((a, b) => b.due - a.due);

    // Today's production totals
    const todayFilled = (data?.prodToday ?? []).reduce(
      (a: number, b: any) => a + Number(b.quantity ?? 0),
      0,
    );
    const todayGasUsed = (data?.prodToday ?? []).reduce(
      (a: number, b: any) => a + Number(b.gas_consumed ?? 0),
      0,
    );

    return {
      bulkByGas,
      filledByGasSize,
      todayProfit,
      monthProfit,
      topDebtor: debtors[0] ?? null,
      topVehicleExpense: null,
      bestSellingGas: null,
      outstanding,
      todayProduction: { filled: todayFilled, gasUsed: todayGasUsed },
      customerBalances,
      pendingSuppliers,
    };
  }, [data]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text) return;
    setInput("");

    const userMsg: ChatMessage = { role: "user", text };
    const ans = ask(text, ctx);

    const botMsg: ChatMessage = {
      role: "bot",
      text: ans.answer,
      navigateTo: ans.navigateTo,
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);

    // Auto navigate if AI determined direct route
    if (ans.navigateTo) {
      setTimeout(() => {
        setOpen(false);
        navigate({ to: ans.navigateTo as any });
      }, 1200);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Smart ERP AI Assistant"
          className="fixed left-5 bottom-24 md:bottom-8 size-14 rounded-full bg-gradient-to-r from-brand to-brand/90 text-brand-foreground shadow-2xl shadow-brand/40 grid place-items-center ring-4 ring-background active:scale-95 transition-transform z-40"
        >
          <Sparkles className="size-6 animate-pulse" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col h-full">
        <SheetHeader className="p-4 border-b bg-muted/40">
          <SheetTitle className="flex items-center gap-2 font-display text-lg">
            <div className="size-8 rounded-lg bg-brand text-brand-foreground grid place-items-center">
              <Sparkles className="size-4" />
            </div>
            Smart ERP Assistant
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Instant business answers & auto-navigation
          </p>
        </SheetHeader>

        {/* Message area */}
        <div className="flex-1 p-4 space-y-3 overflow-y-auto min-h-0 bg-background">
          {messages.length === 0 && (
            <div className="text-center py-6 text-xs text-muted-foreground space-y-3">
              <div className="size-12 rounded-2xl bg-brand/10 text-brand mx-auto grid place-items-center">
                <Bot className="size-6" />
              </div>
              <p className="font-medium text-foreground">Hello! How can I help your plant today?</p>
              <p>Tap any example question below or type your question.</p>
            </div>
          )}

          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`size-7 rounded-lg grid place-items-center shrink-0 text-xs ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-brand text-brand-foreground"
                }`}
              >
                {m.role === "user" ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
              </div>
              <div
                className={`p-3 rounded-2xl max-w-[82%] text-xs leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-none"
                    : "bg-muted border text-foreground rounded-tl-none"
                }`}
              >
                {m.text}
                {m.navigateTo && (
                  <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-1.5 text-[11px] text-brand font-semibold">
                    Navigating to page <ArrowRight className="size-3" />
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-3 border-t bg-muted/20 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => handleSend(q)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-background border hover:bg-brand/10 hover:border-brand/30 text-nowrap transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input bar */}
        <div className="p-3 border-t bg-background">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything or type command..."
              className="h-10 text-xs"
            />
            <Button type="submit" size="icon" className="h-10 w-10 shrink-0">
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
