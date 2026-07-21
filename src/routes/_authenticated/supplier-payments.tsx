import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
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
import { Plus, Wallet, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/supplier-payments")({
  head: () => ({ meta: [{ title: "Supplier Payments — Life Care Plant" }] }),
  component: SupplierPaymentsPage,
});

function SupplierPaymentsPage() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["supplier-payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("supplier_payments")
        .select("*,suppliers(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const rows = data ?? [];
    if (!s) return rows;
    return rows.filter(
      (p: any) =>
        (p.suppliers?.name ?? "").toLowerCase().includes(s) ||
        (p.reference_number ?? "").toLowerCase().includes(s),
    );
  }, [data, q]);

  const total = filtered.reduce((a, b: any) => a + Number(b.amount ?? 0), 0);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="size-6" /> Supplier Payments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Amounts paid to suppliers — reduces Cash or Bank automatically.
          </p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" /> New Payment
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Pay Supplier</SheetTitle>
            </SheetHeader>
            <SupplierPaymentForm onDone={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>

      <Card className="p-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Recent total
          </div>
          <div className="font-display font-bold text-2xl mt-1">{formatCurrency(total)}</div>
        </div>
        <div className="text-xs text-muted-foreground">{filtered.length} entries</div>
      </Card>

      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search supplier or reference"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      <div className="space-y-2">
        {isLoading && <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>}
        {!isLoading && filtered.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">No payments yet.</Card>
        )}
        {filtered.map((p: any) => (
          <Card key={p.id} className="p-4 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <Wallet className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{p.suppliers?.name ?? "—"}</div>
              <div className="text-xs text-muted-foreground">
                {formatDate(p.date)} • {(p.account ?? "cash") === "bank" ? "Bank" : "Cash"}
                {p.reference_number ? ` • Ref ${p.reference_number}` : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display font-bold">{formatCurrency(p.amount)}</div>
              <Badge variant="secondary" className="text-[10px] mt-1 capitalize">
                {p.payment_type ?? "payment"}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SupplierPaymentForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [supplier, setSupplier] = useState("");
  const [account, setAccount] = useState("cash");
  const [bankAccountId, setBankAccountId] = useState("");
  const [paymentType, setPaymentType] = useState("payment");
  const [date, setDate] = useState(todayISO());

  const { data: lookups } = useQuery({
    queryKey: ["supplier-payment-lookups"],
    queryFn: async () => {
      const [s, b] = await Promise.all([
        supabase.from("suppliers").select("id,name").order("name"),
        supabase.from("bank_accounts").select("id,bank_name,account_title").eq("active", true),
      ]);
      return { suppliers: s.data ?? [], banks: b.data ?? [] };
    },
  });

  const save = useMutation({
    mutationFn: async (f: FormData) => {
      const amount = Number(f.get("amount") ?? 0);
      if (!supplier) throw new Error("Supplier required");
      if (!amount || amount <= 0) throw new Error("Amount must be greater than 0");
      if (account === "bank" && !bankAccountId) throw new Error("Select a bank account");
      const { error } = await supabase.from("supplier_payments").insert({
        supplier_id: supplier,
        amount,
        account,
        bank_account_id: account === "bank" ? bankAccountId : null,
        payment_type: paymentType,
        date,
        reference_number: String(f.get("reference_number") ?? "").trim() || null,
        notes: String(f.get("notes") ?? "").trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment recorded");
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
      <div>
        <Label className="text-xs">Supplier*</Label>
        <Select value={supplier} onValueChange={setSupplier}>
          <SelectTrigger className="mt-1.5 h-11">
            <SelectValue placeholder="Select supplier" />
          </SelectTrigger>
          <SelectContent>
            {lookups?.suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Amount (Rs)*</Label>
          <Input name="amount" type="number" min={1} required className="mt-1.5 h-11" />
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
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Paid From</Label>
          <Select value={account} onValueChange={setAccount}>
            <SelectTrigger className="mt-1.5 h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash in Hand</SelectItem>
              <SelectItem value="bank">Bank Account</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Type</Label>
          <Select value={paymentType} onValueChange={setPaymentType}>
            <SelectTrigger className="mt-1.5 h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="payment">Payment</SelectItem>
              <SelectItem value="partial">Partial Payment</SelectItem>
              <SelectItem value="advance">Advance</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {account === "bank" && (
        <div>
          <Label className="text-xs">Bank Account*</Label>
          <Select value={bankAccountId} onValueChange={setBankAccountId}>
            <SelectTrigger className="mt-1.5 h-11">
              <SelectValue placeholder="Select bank account" />
            </SelectTrigger>
            <SelectContent>
              {(lookups?.banks ?? []).map((b: any) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.bank_name}
                  {b.account_title ? ` — ${b.account_title}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(lookups?.banks ?? []).length === 0 && (
            <p className="text-[11px] text-muted-foreground mt-1">
              No bank accounts yet. Add one in the Bank module first.
            </p>
          )}
        </div>
      )}
      <div>
        <Label className="text-xs">Reference #</Label>
        <Input name="reference_number" className="mt-1.5 h-11" />
      </div>
      <div>
        <Label className="text-xs">Notes</Label>
        <Textarea name="notes" rows={2} className="mt-1.5" />
      </div>
      <Button type="submit" disabled={save.isPending} className="w-full h-11">
        {save.isPending ? "Saving…" : "Save Payment"}
      </Button>
    </form>
  );
}
