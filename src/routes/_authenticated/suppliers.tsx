import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatM3 } from "@/lib/bulk-gas";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import {
  Plus,
  Search,
  Phone,
  MapPin,
  Truck,
  MoreVertical,
  Pencil,
  Trash2,
  History,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({ meta: [{ title: "Suppliers — Life Care Plant" }] }),
  component: SuppliersPage,
});

type EditState = {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  address: string;
  ntn_gst: string;
  notes: string;
} | null;

function SuppliersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditState>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["suppliers-with-totals"],
    queryFn: async () => {
      const [{ data: sup }, { data: pur }] = await Promise.all([
        supabase.from("suppliers").select("*").order("name"),
        supabase.from("gas_purchases").select("supplier_id,cubic_meter,total_amount"),
      ]);
      const totals = new Map<string, { m3: number; amount: number; count: number }>();
      (pur ?? []).forEach((p: any) => {
        if (!p.supplier_id) return;
        const e = totals.get(p.supplier_id) ?? { m3: 0, amount: 0, count: 0 };
        e.m3 += Number(p.cubic_meter ?? 0);
        e.amount += Number(p.total_amount ?? 0);
        e.count += 1;
        totals.set(p.supplier_id, e);
      });
      return (sup ?? []).map((s: any) => ({
        ...s,
        totals: totals.get(s.id) ?? { m3: 0, amount: 0, count: 0 },
      }));
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const rows = data ?? [];
    if (!s) return rows;
    return rows.filter((r: any) => r.name.toLowerCase().includes(s) || (r.phone ?? "").includes(s));
  }, [data, q]);

  const save = useMutation({
    mutationFn: async (vals: any) => {
      if (editing) {
        const { error } = await supabase.from("suppliers").update(vals).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert(vals);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Supplier updated" : "Supplier added");
      qc.invalidateQueries({ queryKey: ["suppliers-with-totals"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Supplier deleted");
      qc.invalidateQueries({ queryKey: ["suppliers-with-totals"] });
      setDeleteId(null);
    },
    onError: (e: any) => {
      toast.error(e.message);
      setDeleteId(null);
    },
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate({
      name: String(f.get("name") ?? "").trim(),
      contact_person: String(f.get("contact_person") ?? "").trim() || null,
      phone: String(f.get("phone") ?? "").trim() || null,
      address: String(f.get("address") ?? "").trim() || null,
      ntn_gst: String(f.get("ntn_gst") ?? "").trim() || null,
      notes: String(f.get("notes") ?? "").trim() || null,
    });
  };

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (s: any) => {
    setEditing({
      id: s.id,
      name: s.name ?? "",
      contact_person: s.contact_person ?? "",
      phone: s.phone ?? "",
      address: s.address ?? "",
      ntn_gst: s.ntn_gst ?? "",
      notes: s.notes ?? "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="size-6" /> Suppliers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bulk gas suppliers and purchase history.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="size-4" /> New Supplier
        </Button>
      </header>

      <Sheet
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit Supplier" : "New Supplier"}</SheetTitle>
          </SheetHeader>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field label="Supplier Name" name="name" required defaultValue={editing?.name} />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Contact Person"
                name="contact_person"
                defaultValue={editing?.contact_person}
              />
              <Field label="Phone" name="phone" defaultValue={editing?.phone} />
            </div>
            <Field label="Address" name="address" defaultValue={editing?.address} />
            <Field label="NTN / GST (optional)" name="ntn_gst" defaultValue={editing?.ntn_gst} />
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea name="notes" rows={2} defaultValue={editing?.notes} className="mt-1.5" />
            </div>
            <Button type="submit" disabled={save.isPending} className="w-full h-11">
              {save.isPending ? "Saving…" : editing ? "Update Supplier" : "Save Supplier"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No suppliers yet. Add your first supplier.
          </Card>
        )}
        {filtered.map((s: any) => (
          <Card key={s.id} className="p-4 flex items-center gap-3">
            <div className="size-11 rounded-full bg-brand/10 text-brand grid place-items-center font-bold">
              {s.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{s.name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                {s.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="size-3" />
                    {s.phone}
                  </span>
                )}
                {s.address && (
                  <span className="hidden sm:flex items-center gap-1 truncate">
                    <MapPin className="size-3" />
                    {s.address}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold">{formatM3(s.totals.m3)}</div>
              <div className="text-[10px] text-muted-foreground">
                {formatCurrency(s.totals.amount)} • {s.totals.count} buys
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9 shrink-0">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setHistoryId(s.id)} className="gap-2">
                  <History className="size-4" /> Purchase history
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEdit(s)} className="gap-2">
                  <Pencil className="size-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteId(s.id)}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Card>
        ))}
      </div>

      <SupplierHistoryDialog supplierId={historyId} onClose={() => setHistoryId(null)} />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete supplier?</AlertDialogTitle>
            <AlertDialogDescription>
              Purchases linked to this supplier will block deletion. Remove or reassign purchases
              first.
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

function SupplierHistoryDialog({
  supplierId,
  onClose,
}: {
  supplierId: string | null;
  onClose: () => void;
}) {
  const { data } = useQuery({
    queryKey: ["supplier-ledger", supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const [gp, cp, sp] = await Promise.all([
        supabase
          .from("gas_purchases")
          .select("*,gas_types(name,color)")
          .eq("supplier_id", supplierId!),
        supabase.from("cylinder_purchases").select("*").eq("supplier_id", supplierId!),
        supabase.from("supplier_payments").select("*").eq("supplier_id", supplierId!),
      ]);
      return {
        gasPurchases: gp.data ?? [],
        cylinderPurchases: cp.data ?? [],
        payments: sp.data ?? [],
      };
    },
  });

  // Build a running-balance ledger: purchases increase what we owe, payments reduce it.
  const ledger = useMemo(() => {
    type Row = {
      date: string;
      ts: string;
      title: string;
      detail: string;
      charge: number;
      payment: number;
    };
    const rows: Row[] = [];
    (data?.gasPurchases ?? []).forEach((p: any) =>
      rows.push({
        date: p.date,
        ts: p.created_at,
        title: p.gas_types?.name ?? "Gas Purchase",
        detail: `${formatM3(p.cubic_meter)}${p.invoice_number ? ` • ${p.invoice_number}` : ""}`,
        charge: Number(p.total_amount ?? 0),
        payment: 0,
      }),
    );
    (data?.cylinderPurchases ?? []).forEach((p: any) =>
      rows.push({
        date: p.date,
        ts: p.created_at,
        title: "Cylinder Purchase",
        detail: `${p.quantity} cyl${p.invoice_number ? ` • ${p.invoice_number}` : ""}`,
        charge: Number(p.total_amount ?? 0),
        payment: 0,
      }),
    );
    (data?.payments ?? []).forEach((p: any) =>
      rows.push({
        date: p.date,
        ts: p.created_at,
        title: "Payment",
        detail: `${(p.account ?? "cash") === "bank" ? "Bank" : "Cash"}${p.reference_number ? ` • Ref ${p.reference_number}` : ""}`,
        charge: 0,
        payment: Number(p.amount ?? 0),
      }),
    );
    const sorted = [...rows].sort((a, b) => (a.ts ?? a.date).localeCompare(b.ts ?? b.date));
    let running = 0;
    const withRunning = sorted.map((r) => {
      running += r.charge - r.payment;
      return { ...r, running };
    });
    const totalCharge = rows.reduce((a, r) => a + r.charge, 0);
    const totalPayment = rows.reduce((a, r) => a + r.payment, 0);
    // Show newest first in the UI.
    return {
      rows: withRunning.reverse(),
      totalCharge,
      totalPayment,
      outstanding: totalCharge - totalPayment,
    };
  }, [data]);

  return (
    <Dialog open={!!supplierId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Supplier Ledger</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Purchases
            </div>
            <div className="font-display font-bold text-sm mt-0.5">
              {formatCurrency(ledger.totalCharge)}
            </div>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Paid</div>
            <div className="font-display font-bold text-sm mt-0.5 text-success">
              {formatCurrency(ledger.totalPayment)}
            </div>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Outstanding
            </div>
            <div
              className={`font-display font-bold text-sm mt-0.5 ${ledger.outstanding > 0 ? "text-destructive" : ""}`}
            >
              {formatCurrency(ledger.outstanding)}
            </div>
          </div>
        </div>
        <div className="space-y-2 mt-2 max-h-[50vh] overflow-y-auto">
          {ledger.rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No activity recorded.</p>
          )}
          {ledger.rows.map((r, i) => (
            <div key={i} className="rounded-lg border p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{r.title}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(r.date)} • {r.detail}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div
                  className={`font-display font-bold text-sm ${r.payment > 0 ? "text-success" : ""}`}
                >
                  {r.payment > 0 ? "−" : ""}
                  {formatCurrency(r.payment > 0 ? r.payment : r.charge)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Bal {formatCurrency(r.running)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, name, type = "text", required, defaultValue }: any) {
  return (
    <div>
      <Label className="text-xs">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      <Input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="mt-1.5 h-11"
      />
    </div>
  );
}
