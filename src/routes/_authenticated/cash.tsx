import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import { computeCashInHand } from "@/lib/finance";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Plus, Coins, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cash")({
  head: () => ({ meta: [{ title: "Cash in Hand — Life Care Plant" }] }),
  component: CashPage,
});

type LedgerRow = {
  date: string;
  ts: string;
  kind: "in" | "out";
  title: string;
  detail: string;
  amount: number;
};

function CashPage() {
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["cash-ledger"],
    queryFn: async () => {
      const [pays, supPays, exps, adj] = await Promise.all([
        supabase
          .from("payments")
          .select("amount,account,date,created_at,customers(name)")
          .eq("account", "cash"),
        supabase
          .from("supplier_payments")
          .select("amount,account,date,created_at,suppliers(name)")
          .eq("account", "cash"),
        supabase
          .from("expenses")
          .select("amount,account,category,date,created_at")
          .eq("account", "cash"),
        supabase.from("cash_adjustments").select("*").order("created_at", { ascending: false }),
      ]);
      return {
        payments: pays.data ?? [],
        supplierPayments: supPays.data ?? [],
        expenses: exps.data ?? [],
        adjustments: adj.data ?? [],
      };
    },
  });

  const cash = useMemo(
    () =>
      computeCashInHand({
        customerPayments: data?.payments ?? [],
        supplierPayments: data?.supplierPayments ?? [],
        expenses: data?.expenses ?? [],
        adjustments: data?.adjustments ?? [],
      }),
    [data],
  );

  const ledger = useMemo<LedgerRow[]>(() => {
    const rows: LedgerRow[] = [];
    (data?.payments ?? []).forEach((p: any) =>
      rows.push({
        date: p.date,
        ts: p.created_at,
        kind: "in",
        title: p.customers?.name ?? "Customer",
        detail: "Customer payment",
        amount: Number(p.amount ?? 0),
      }),
    );
    (data?.supplierPayments ?? []).forEach((p: any) =>
      rows.push({
        date: p.date,
        ts: p.created_at,
        kind: "out",
        title: p.suppliers?.name ?? "Supplier",
        detail: "Supplier payment",
        amount: Number(p.amount ?? 0),
      }),
    );
    (data?.expenses ?? []).forEach((e: any) =>
      rows.push({
        date: e.date,
        ts: e.created_at,
        kind: "out",
        title: e.category ?? "Expense",
        detail: "Expense",
        amount: Number(e.amount ?? 0),
      }),
    );
    (data?.adjustments ?? []).forEach((a: any) =>
      rows.push({
        date: a.date,
        ts: a.created_at,
        kind: (a.direction ?? "out") === "in" ? "in" : "out",
        title: a.reason ?? "Adjustment",
        detail: (a.direction ?? "out") === "in" ? "Cash added" : "Cash withdrawn",
        amount: Number(a.amount ?? 0),
      }),
    );
    return rows.sort((a, b) => (b.ts ?? b.date).localeCompare(a.ts ?? a.date));
  }, [data]);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Coins className="size-6" /> Cash in Hand
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live cash balance from payments, expenses and manual adjustments.
          </p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" /> Cash Adjustment
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Cash Adjustment</SheetTitle>
            </SheetHeader>
            <AdjustmentForm onDone={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cash In</div>
          <div className="font-display font-bold text-lg mt-1 text-success">
            {formatCurrency(cash.inflow)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cash Out</div>
          <div className="font-display font-bold text-lg mt-1 text-destructive">
            {formatCurrency(cash.outflow)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</div>
          <div className="font-display font-bold text-lg mt-1">{formatCurrency(cash.balance)}</div>
        </Card>
      </div>

      <div className="space-y-2">
        {ledger.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No cash movement yet.
          </Card>
        )}
        {ledger.map((r, i) => (
          <Card key={i} className="p-4 flex items-center gap-3">
            <div
              className={`size-10 rounded-lg grid place-items-center ${
                r.kind === "in"
                  ? "bg-success/15 text-success"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {r.kind === "in" ? (
                <ArrowDownToLine className="size-4" />
              ) : (
                <ArrowUpFromLine className="size-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{r.title}</div>
              <div className="text-xs text-muted-foreground">
                {formatDate(r.date)} • {r.detail}
              </div>
            </div>
            <div className="text-right">
              <div
                className={`font-display font-bold ${r.kind === "in" ? "text-success" : "text-destructive"}`}
              >
                {r.kind === "in" ? "+" : "−"}
                {formatCurrency(r.amount)}
              </div>
              <Badge variant="secondary" className="text-[10px] mt-1 capitalize">
                {r.kind}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AdjustmentForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [direction, setDirection] = useState("out");
  const [date, setDate] = useState(todayISO());

  const save = useMutation({
    mutationFn: async (f: FormData) => {
      const amount = Number(f.get("amount") ?? 0);
      if (!amount || amount <= 0) throw new Error("Amount must be greater than 0");
      const { error } = await supabase.from("cash_adjustments").insert({
        direction,
        amount,
        date,
        reason: String(f.get("reason") ?? "").trim() || null,
        notes: String(f.get("notes") ?? "").trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Adjustment recorded");
      qc.invalidateQueries();
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(new FormData(e.currentTarget));
      }}
      className="mt-6 space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Direction</Label>
          <Select value={direction} onValueChange={setDirection}>
            <SelectTrigger className="mt-1.5 h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in">Cash In (add)</SelectItem>
              <SelectItem value="out">Cash Out (withdraw)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Amount (Rs)*</Label>
          <Input name="amount" type="number" min={1} step="0.01" required className="mt-1.5 h-11" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Date</Label>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1.5 h-11"
        />
      </div>
      <div>
        <Label className="text-xs">Reason</Label>
        <Input name="reason" className="mt-1.5 h-11" placeholder="Owner withdrawal, correction…" />
      </div>
      <div>
        <Label className="text-xs">Notes</Label>
        <Textarea name="notes" rows={2} className="mt-1.5" />
      </div>
      <Button type="submit" disabled={save.isPending} className="w-full h-11">
        {save.isPending ? "Saving…" : "Save Adjustment"}
      </Button>
    </form>
  );
}
