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
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/payments")({
  validateSearch: (s: Record<string, unknown>) => ({
    open: s.open === true || s.open === "true",
    customer_id: (s.customer_id as string) ?? undefined,
  }),
  head: () => ({ meta: [{ title: "Customer Payments — Life Care Plant" }] }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const searchRoute = Route.useSearch();
  const [open, setOpen] = useState(searchRoute.open ?? false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (searchRoute.open) {
      setOpen(true);
    }
  }, [searchRoute.open]);

  const { data, isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*,customers(name)")
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
        (p.customers?.name ?? "").toLowerCase().includes(s) ||
        (p.reference_number ?? "").toLowerCase().includes(s),
    );
  }, [data, q]);

  const total = filtered.reduce((a, b: any) => a + Number(b.amount ?? 0), 0);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="size-6" /> Customer Payments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Amounts received from customers — goes to Cash or Bank automatically.
          </p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className="gap-2 bg-success text-success-foreground hover:bg-success/90">
              <Plus className="size-4" /> New Payment
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Record Payment</SheetTitle>
            </SheetHeader>
            <PaymentForm
              defaultCustomerId={searchRoute.customer_id}
              onDone={() => setOpen(false)}
            />
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
          placeholder="Search customer or reference"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      <div className="space-y-2">
        {isLoading && <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>}
        {!isLoading && filtered.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No payments logged yet.
          </Card>
        )}
        {filtered.map((p: any) => (
          <Card key={p.id} className="p-4 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-success/15 text-success grid place-items-center">
              <Wallet className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{p.customers?.name ?? "—"}</div>
              <div className="text-xs text-muted-foreground">
                {formatDate(p.date)} • {(p.account ?? "cash") === "bank" ? "Bank" : "Cash"}
                {p.method ? ` • ${p.method}` : ""}
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

function PaymentForm({
  defaultCustomerId,
  onDone,
}: {
  defaultCustomerId?: string;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [customer, setCustomer] = useState(defaultCustomerId ?? "");
  const [account, setAccount] = useState("cash");
  const [bankAccountId, setBankAccountId] = useState("");
  const [paymentType, setPaymentType] = useState("payment");
  const [date, setDate] = useState(todayISO());

  useEffect(() => {
    if (defaultCustomerId) {
      setCustomer(defaultCustomerId);
    }
  }, [defaultCustomerId]);

  const { data: lookups } = useQuery({
    queryKey: ["payment-lookups"],
    queryFn: async () => {
      const [c, b] = await Promise.all([
        supabase.from("customers").select("id,name").order("name"),
        supabase.from("bank_accounts").select("id,bank_name,account_title").eq("active", true),
      ]);
      return { customers: c.data ?? [], banks: b.data ?? [] };
    },
  });

  const save = useMutation({
    mutationFn: async (f: FormData) => {
      const amount = Number(f.get("amount") ?? 0);
      if (!customer) throw new Error("Customer required");
      if (!amount || amount <= 0) throw new Error("Amount must be greater than 0");
      if (account === "bank" && !bankAccountId) throw new Error("Select a bank account");
      const { error } = await supabase.from("payments").insert({
        customer_id: customer,
        amount,
        method: account === "bank" ? "Bank" : "Cash",
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
        <Label className="text-xs">Customer*</Label>
        <Select value={customer} onValueChange={setCustomer}>
          <SelectTrigger className="mt-1.5 h-11">
            <SelectValue placeholder="Select customer" />
          </SelectTrigger>
          <SelectContent>
            {lookups?.customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
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
          <Label className="text-xs">Received In</Label>
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
              <SelectItem value="credit">Credit</SelectItem>
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
      <Button
        type="submit"
        disabled={save.isPending}
        className="w-full h-11 bg-success text-success-foreground hover:bg-success/90"
      >
        {save.isPending ? "Saving…" : "Save Payment"}
      </Button>
    </form>
  );
}
