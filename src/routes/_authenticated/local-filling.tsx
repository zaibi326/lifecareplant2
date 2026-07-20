import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import { formatM3, gasConsumed } from "@/lib/bulk-gas";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Flame, Search, MoreVertical, Trash2, Printer } from "lucide-react";
import { toast } from "sonner";
import { printHTML } from "@/lib/print";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/local-filling")({
  head: () => ({ meta: [{ title: "Local Gas Filling — Life Care Plant" }] }),
  component: LocalFillingPage,
});

function LocalFillingPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["local-fillings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("local_fillings")
        .select("*,customers(name),gas_types(name,color),cylinder_sizes(name)")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data ?? [];
    return (data ?? []).filter(
      (r: any) =>
        (r.customers?.name ?? r.customer_name ?? "").toLowerCase().includes(s) ||
        (r.gas_types?.name ?? "").toLowerCase().includes(s) ||
        (r.invoice_number ?? "").toLowerCase().includes(s),
    );
  }, [data, q]);

  const totalAmt = (filtered as any[]).reduce((a, r) => a + Number(r.total_amount ?? 0), 0);
  const totalGas = (filtered as any[]).reduce((a, r) => a + Number(r.gas_consumed ?? 0), 0);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("local_fillings").delete().eq("id", id);
      if (error) throw error;
      await logAudit({
        action: "delete",
        entity: "local_filling",
        entityId: id,
        summary: "Local filling deleted",
      });
    },
    onSuccess: () => {
      toast.success("Entry deleted");
      qc.invalidateQueries();
      setDeleteId(null);
    },
    onError: (e: any) => {
      toast.error(e.message);
      setDeleteId(null);
    },
  });

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Flame className="size-6" /> Local Gas Filling
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Customer apne cylinder laata hai, plant fill karta hai, wapas le jaata hai. Sirf bulk
            gas deduct hoti hai.
          </p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className="gap-2 bg-warning text-warning-foreground hover:bg-warning/90">
              <Plus className="size-4" /> New Filling
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Local Gas Filling</SheetTitle>
            </SheetHeader>
            <FillingForm onDone={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Filling Revenue
          </div>
          <div className="font-display font-bold text-2xl mt-1">{formatCurrency(totalAmt)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Gas Consumed
          </div>
          <div className="font-display font-bold text-2xl mt-1">{formatM3(totalGas)}</div>
        </Card>
      </div>

      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search customer / gas / invoice"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      <div className="space-y-2">
        {isLoading && <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>}
        {!isLoading && filtered.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">No fillings yet.</Card>
        )}
        {(filtered as any[]).map((r) => (
          <Card key={r.id} className="p-4 flex items-center gap-3">
            <div
              className="size-10 rounded-lg grid place-items-center text-white font-bold text-xs"
              style={{ background: r.gas_types?.color || "var(--warning)" }}
            >
              {(r.gas_types?.name ?? "—").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">
                {r.customers?.name ?? r.customer_name ?? "Walk-in"}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {r.quantity}× {r.gas_types?.name ?? ""} {r.cylinder_sizes?.name ?? ""} •{" "}
                {formatDate(r.date)}
                {r.invoice_number ? ` • ${r.invoice_number}` : ""}
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
              <div className="font-display font-bold">
                {formatCurrency(Number(r.total_amount ?? 0))}
              </div>
              {Number(r.outstanding ?? 0) > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  Due {formatCurrency(Number(r.outstanding))}
                </Badge>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9 shrink-0">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => printFillingInvoice(r)} className="gap-2">
                  <Printer className="size-4" /> Invoice
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteId(r.id)}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete filling?</AlertDialogTitle>
            <AlertDialogDescription>
              Ye action permanent hai. Revenue aur bulk gas usage update ho jaega.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && del.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {del.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

async function printFillingInvoice(r: any) {
  const { data: s } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
  const tax = Number(s?.tax_percent ?? 0);
  const sub = Number(r.total_amount ?? 0);
  const taxAmt = (sub * tax) / 100;
  const grand = sub + taxAmt;
  const body = `
    <div class="head">
      <div><h1>${s?.company_name ?? "Life Care Plant"}</h1><div class="muted">${s?.company_address ?? ""}</div><div class="muted">${s?.company_phone ?? ""}</div></div>
      <div style="text-align:right"><span class="badge">FILLING</span><div style="margin-top:8px;font-weight:700">${r.invoice_number ?? ""}</div><div class="muted">${formatDate(r.date)}</div></div>
    </div>
    <h2>Bill To</h2>
    <div style="font-weight:600">${r.customers?.name ?? r.customer_name ?? "Walk-in Customer"}</div>
    <h2>Items</h2>
    <table><thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead>
    <tbody><tr><td>Gas filling — ${r.gas_types?.name ?? ""} ${r.cylinder_sizes?.name ?? ""}</td><td class="right">${r.quantity}</td><td class="right">${formatCurrency(Number(r.filling_rate ?? 0))}</td><td class="right">${formatCurrency(sub)}</td></tr></tbody></table>
    <div class="totals">
      <div><div class="label">Subtotal</div><div class="val">${formatCurrency(sub)}</div></div>
      ${tax ? `<div><div class="label">Tax (${tax}%)</div><div class="val">${formatCurrency(taxAmt)}</div></div>` : ""}
      <div><div class="label">Total</div><div class="val" style="font-size:18px">${formatCurrency(grand)}</div></div>
      ${Number(r.payment ?? 0) ? `<div><div class="label">Paid</div><div class="val">${formatCurrency(Number(r.payment))}</div></div>` : ""}
      ${Number(r.outstanding ?? 0) ? `<div><div class="label">Outstanding</div><div class="val">${formatCurrency(Number(r.outstanding))}</div></div>` : ""}
    </div>
    ${s?.invoice_footer ? `<div class="muted" style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:12px">${s.invoice_footer}</div>` : ""}
  `;
  printHTML(`Filling ${r.invoice_number ?? ""}`, body);
}

function FillingForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState<string>("walkin");
  const [walkinName, setWalkinName] = useState("");
  const [newCustomer, setNewCustomer] = useState(false);
  const [gas, setGas] = useState("");
  const [size, setSize] = useState("");
  const [qty, setQty] = useState<number>(0);
  const [rate, setRate] = useState<number>(0);
  const [payment, setPayment] = useState<number>(0);
  const [date, setDate] = useState(todayISO());

  const { data: lookups } = useQuery({
    queryKey: ["filling-lookups"],
    queryFn: async () => {
      const [c, g, s] = await Promise.all([
        supabase.from("customers").select("id,name").order("name"),
        supabase.from("gas_types").select("id,name").eq("active", true).order("name"),
        supabase
          .from("cylinder_sizes")
          .select("id,name,capacity,capacity_unit")
          .eq("active", true)
          .order("name"),
      ]);
      return { customers: c.data ?? [], gases: g.data ?? [], sizes: s.data ?? [] };
    },
  });

  const selectedSize = (lookups?.sizes ?? []).find((s: any) => s.id === size);
  const capacity = selectedSize?.capacity ?? null;
  const capacityUnit = selectedSize?.capacity_unit ?? "m3";
  const consumed = gasConsumed(capacity, qty, capacityUnit);
  const total = Number(qty || 0) * Number(rate || 0);
  const outstanding = Math.max(0, total - Number(payment || 0));

  const save = useMutation({
    mutationFn: async (f: FormData) => {
      if (!gas || !size) throw new Error("Gas and size required");
      if (!qty || qty <= 0) throw new Error("Quantity must be greater than 0");

      let finalCustomerId: string | null = null;
      let finalCustomerName: string | null = null;

      if (newCustomer) {
        const name = walkinName.trim();
        if (!name) throw new Error("Customer name required");
        const { data: created, error: cErr } = await supabase
          .from("customers")
          .insert({ name })
          .select("id,name")
          .single();
        if (cErr) throw cErr;
        finalCustomerId = created.id;
        finalCustomerName = created.name;
      } else if (customerId === "walkin") {
        finalCustomerName = walkinName.trim() || "Walk-in Customer";
      } else {
        finalCustomerId = customerId;
      }

      let invoice_number: string | null = null;
      const { data: invNum } = await supabase.rpc("next_invoice_number");
      if (invNum) invoice_number = invNum as string;

      const { data: inserted, error } = await supabase
        .from("local_fillings")
        .insert({
          date,
          customer_id: finalCustomerId,
          customer_name: finalCustomerName,
          gas_type_id: gas,
          cylinder_size_id: size,
          quantity: qty,
          filling_rate: rate,
          total_amount: total,
          gas_consumed: capacity != null ? consumed : 0,
          consumed_unit: "m3",
          payment: Number(payment || 0),
          outstanding,
          invoice_number,
          remarks: String(f.get("remarks") ?? "").trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      await logAudit({
        action: "create",
        entity: "local_filling",
        entityId: inserted?.id,
        summary: `Local filling ${qty} cyl • ${formatCurrency(total)}`,
        meta: { gas_consumed: consumed },
      });
    },
    onSuccess: () => {
      toast.success(capacity != null ? "Filling recorded — bulk gas deducted" : "Filling recorded");
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
        <div className="flex items-center justify-between">
          <Label className="text-xs">Customer</Label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => {
              setNewCustomer((v) => !v);
              setCustomerId("walkin");
            }}
          >
            {newCustomer ? "Pick existing" : "+ New customer"}
          </Button>
        </div>
        {newCustomer ? (
          <Input
            value={walkinName}
            onChange={(e) => setWalkinName(e.target.value)}
            placeholder="New customer name"
            className="mt-1.5 h-11"
          />
        ) : (
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger className="mt-1.5 h-11">
              <SelectValue placeholder="Select customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="walkin">Walk-in Customer</SelectItem>
              {lookups?.customers.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!newCustomer && customerId === "walkin" && (
          <Input
            value={walkinName}
            onChange={(e) => setWalkinName(e.target.value)}
            placeholder="Walk-in name (optional)"
            className="mt-2 h-10 text-sm"
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Gas*</Label>
          <Select value={gas} onValueChange={setGas}>
            <SelectTrigger className="mt-1.5 h-11">
              <SelectValue placeholder="Gas" />
            </SelectTrigger>
            <SelectContent>
              {lookups?.gases.map((g: any) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Size*</Label>
          <Select value={size} onValueChange={setSize}>
            <SelectTrigger className="mt-1.5 h-11">
              <SelectValue placeholder="Size" />
            </SelectTrigger>
            <SelectContent>
              {lookups?.sizes.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Quantity*</Label>
          <Input
            type="number"
            min={1}
            value={qty || ""}
            onChange={(e) => setQty(Number(e.target.value))}
            className="mt-1.5 h-11"
          />
        </div>
        <div>
          <Label className="text-xs">Filling Rate (per cyl)</Label>
          <Input
            type="number"
            min={0}
            value={rate || ""}
            onChange={(e) => setRate(Number(e.target.value))}
            className="mt-1.5 h-11"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Payment Received</Label>
          <Input
            type="number"
            min={0}
            value={payment || ""}
            onChange={(e) => setPayment(Number(e.target.value))}
            className="mt-1.5 h-11"
          />
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

      <div className="rounded-lg border p-3 bg-muted/30 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total</span>
          <b>{formatCurrency(total)}</b>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Outstanding</span>
          <b className={outstanding > 0 ? "text-destructive" : ""}>{formatCurrency(outstanding)}</b>
        </div>
        {size && (
          <div className="flex justify-between border-t pt-1 mt-1">
            <span className="text-muted-foreground">Bulk gas consumed</span>
            <b>{capacity != null ? formatM3(consumed) : "capacity not set"}</b>
          </div>
        )}
      </div>

      <div>
        <Label className="text-xs">Remarks</Label>
        <Textarea name="remarks" rows={2} className="mt-1.5" />
      </div>
      <Button
        type="submit"
        disabled={save.isPending}
        className="w-full h-11 bg-warning text-warning-foreground hover:bg-warning/90"
      >
        {save.isPending ? "Saving…" : "Record Filling"}
      </Button>
    </form>
  );
}
