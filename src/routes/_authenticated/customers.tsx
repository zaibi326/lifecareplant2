import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Phone, MapPin, Users as UsersIcon, Wallet, Package, Trash2, Pencil, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "Customers — Life Care Plant" }] }),
  component: CustomersPage,
});

type OpenRow = { gas_type_id: string; cylinder_size_id: string; condition: "filled" | "empty"; quantity: number };
type EditState = { id: string; name: string; phone: string; address: string; category: string; opening_due: number; notes: string } | null;

function CustomersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditState>(null);
  const [openRows, setOpenRows] = useState<OpenRow[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const { data: refs } = useQuery({
    queryKey: ["customer-form-refs"],
    queryFn: async () => {
      const [g, s] = await Promise.all([
        supabase.from("gas_types").select("id,name").eq("active", true).order("name"),
        supabase.from("cylinder_sizes").select("id,name").eq("active", true).order("name"),
      ]);
      return { gases: g.data ?? [], sizes: s.data ?? [] };
    },
  });

  const { data } = useQuery({
    queryKey: ["customers-with-balance"],
    queryFn: async () => {
      const [{ data: cs }, { data: ms }, { data: ps }, { data: obs }, { data: szs }, { data: gts }] = await Promise.all([
        supabase.from("customers").select("*").order("name"),
        supabase.from("cylinder_movements").select("customer_id,type,quantity,total_amount,cylinder_size_id,gas_type_id"),
        supabase.from("payments").select("customer_id,amount"),
        supabase.from("customer_opening_balances").select("customer_id,quantity,condition,cylinder_size_id,gas_type_id"),
        supabase.from("cylinder_sizes").select("id,name").order("name"),
        supabase.from("gas_types").select("id,name").order("name"),
      ]);
      const openSum = new Map<string, number>();
      (obs ?? []).forEach((o: any) => {
        openSum.set(o.customer_id, (openSum.get(o.customer_id) ?? 0) + Number(o.quantity ?? 0));
      });
      const map = new Map<string, { out: number; due: number }>();
      (cs ?? []).forEach((c) => {
        const breakdown = openSum.get(c.id);
        const opening = breakdown !== undefined ? breakdown : Number(c.opening_cylinders ?? 0);
        map.set(c.id, { out: opening, due: Number(c.opening_due ?? 0) });
      });

      (ms ?? []).forEach((m: any) => {
        const e = map.get(m.customer_id);
        if (!e) return;
        const qty = Number(m.quantity ?? 0);
        if (m.type === "deliver") {
          e.out -= qty;
          e.due += Number(m.total_amount ?? 0);
        } else {
          e.out += qty;
        }
      });
      (ps ?? []).forEach((p: any) => {
        const e = map.get(p.customer_id);
        if (!e) return;
        e.due -= Number(p.amount ?? 0);
      });

      // Per gas+size breakdown (opening + received − delivered)
      const sizeNames = new Map<string, string>((szs ?? []).map((s: any) => [s.id, s.name]));
      const gasNames = new Map<string, string>((gts ?? []).map((g: any) => [g.id, g.name]));
      const comboMap = new Map<string, { gas: string; size: string; opening: number; received: number; delivered: number }>();
      const ensure = (gid: string, sid: string) => {
        const key = `${gid}::${sid}`;
        let v = comboMap.get(key);
        if (!v) {
          v = { gas: gasNames.get(gid) ?? "—", size: sizeNames.get(sid) ?? "—", opening: 0, received: 0, delivered: 0 };
          comboMap.set(key, v);
        }
        return v;
      };
      (obs ?? []).forEach((o: any) => {
        if (!o.cylinder_size_id || !o.gas_type_id) return;
        ensure(o.gas_type_id, o.cylinder_size_id).opening += Number(o.quantity ?? 0);
      });
      (ms ?? []).forEach((m: any) => {
        if (!m.cylinder_size_id || !m.gas_type_id) return;
        const qty = Number(m.quantity ?? 0);
        const v = ensure(m.gas_type_id, m.cylinder_size_id);
        if (m.type === "deliver") v.delivered += qty;
        else v.received += qty;
      });
      const sizeBreakdown = Array.from(comboMap.values())
        .map((v) => ({ name: `${v.gas} • ${v.size}`, ...v, qty: v.opening + v.received - v.delivered }))
        .sort((a, b) => a.name.localeCompare(b.name));



      return { rows: (cs ?? []).map((c) => ({ ...c, balance: map.get(c.id)! })), sizeBreakdown };
    },
  });

  // Load opening rows when opening edit sheet
  useEffect(() => {
    if (!editing) return;
    (async () => {
      const { data: rows } = await supabase
        .from("customer_opening_balances")
        .select("gas_type_id,cylinder_size_id,condition,quantity")
        .eq("customer_id", editing.id);
      setOpenRows((rows ?? []).map((r: any) => ({ ...r, quantity: Number(r.quantity ?? 0) })));
    })();
  }, [editing]);

  const filtered = useMemo(() => {
    const rows = data?.rows ?? [];
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((c: any) => c.name.toLowerCase().includes(s) || (c.phone ?? "").includes(s));
  }, [data, q]);

  const totals = useMemo(() => {
    const out = (filtered ?? []).reduce((a: number, c: any) => a + c.balance.out, 0);
    const due = (filtered ?? []).reduce((a: number, c: any) => a + c.balance.due, 0);
    return { out, due, count: filtered.length };
  }, [filtered]);

  const save = useMutation({
    mutationFn: async (vals: any) => {
      const rows = openRows.filter((r) => r.gas_type_id && r.cylinder_size_id && r.quantity > 0);
      const totalOpen = rows.reduce((a, r) => a + Number(r.quantity || 0), 0);
      if (editing) {
        const { error } = await supabase
          .from("customers")
          .update({ ...vals, opening_cylinders: totalOpen })
          .eq("id", editing.id);
        if (error) throw error;
        await supabase.from("customer_opening_balances").delete().eq("customer_id", editing.id);
        if (rows.length > 0) {
          const payload = rows.map((r) => ({ ...r, customer_id: editing.id }));
          const { error: e2 } = await supabase.from("customer_opening_balances").insert(payload);
          if (e2) throw e2;
        }
      } else {
        const { data: ins, error } = await supabase
          .from("customers")
          .insert({ ...vals, opening_cylinders: totalOpen })
          .select("id")
          .single();
        if (error) throw error;
        if (rows.length > 0) {
          const payload = rows.map((r) => ({ ...r, customer_id: ins.id }));
          const { error: e2 } = await supabase.from("customer_opening_balances").insert(payload);
          if (e2) throw e2;
        }
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Customer updated" : "Customer added");
      qc.invalidateQueries({ queryKey: ["customers-with-balance"] });
      setOpen(false);
      setEditing(null);
      setOpenRows([]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      // Cascade: pehle related records hatao
      const r1 = await supabase.from("cylinder_movements").delete().eq("customer_id", id);
      if (r1.error) throw r1.error;
      const r2 = await supabase.from("payments").delete().eq("customer_id", id);
      if (r2.error) throw r2.error;
      const r3 = await supabase.from("customer_opening_balances").delete().eq("customer_id", id);
      if (r3.error) throw r3.error;
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Customer aur related records deleted");
      qc.invalidateQueries();
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
      phone: String(f.get("phone") ?? "").trim() || null,
      address: String(f.get("address") ?? "").trim() || null,
      category: String(f.get("category") ?? "").trim() || null,
      opening_due: Number(f.get("opening_due") ?? 0),
      notes: String(f.get("notes") ?? "").trim() || null,
    });
  };

  const addRow = () =>
    setOpenRows((r) => [...r, { gas_type_id: refs?.gases[0]?.id ?? "", cylinder_size_id: refs?.sizes[0]?.id ?? "", condition: "filled", quantity: 1 }]);
  const updRow = (i: number, patch: Partial<OpenRow>) => setOpenRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const delRow = (i: number) => setOpenRows((r) => r.filter((_, idx) => idx !== i));

  const openNew = () => { setEditing(null); setOpenRows([]); setOpen(true); };
  const openEdit = (c: any) => {
    setEditing({
      id: c.id, name: c.name ?? "", phone: c.phone ?? "", address: c.address ?? "",
      category: c.category ?? "", opening_due: Number(c.opening_due ?? 0), notes: c.notes ?? "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage clients, balances and dues.</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="size-4" /> New Customer</Button>
      </header>

      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setOpenRows([]); } }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? "Edit Customer" : "New Customer"}</SheetTitle></SheetHeader>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field label="Name" name="name" required defaultValue={editing?.name} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone" name="phone" defaultValue={editing?.phone} />
              <Field label="Category" name="category" placeholder="Industrial / Medical" defaultValue={editing?.category} />
            </div>
            <Field label="Address" name="address" defaultValue={editing?.address} />
            <Field label="Opening Due (Rs)" name="opening_due" type="number" defaultValue={editing?.opening_due ?? 0} />

            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Opening Cylinder Balance</Label>
                <Button type="button" size="sm" variant="outline" onClick={addRow} className="h-8 gap-1">
                  <Plus className="size-3.5" /> Add
                </Button>
              </div>
              {openRows.length === 0 && (
                <p className="text-xs text-muted-foreground">Customer ke pas pehle se mojood cylinders gas type + size + condition ke hisab se add karein.</p>
              )}
              {openRows.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_90px_70px_auto] gap-1.5 items-center">
                  <Select value={r.gas_type_id} onValueChange={(v) => updRow(i, { gas_type_id: v })}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Gas" /></SelectTrigger>
                    <SelectContent>
                      {(refs?.gases ?? []).map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={r.cylinder_size_id} onValueChange={(v) => updRow(i, { cylinder_size_id: v })}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Size" /></SelectTrigger>
                    <SelectContent>
                      {(refs?.sizes ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={r.condition} onValueChange={(v: any) => updRow(i, { condition: v })}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="filled">Filled</SelectItem>
                      <SelectItem value="empty">Empty</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" min={0} value={r.quantity} onChange={(e) => updRow(i, { quantity: Number(e.target.value) })} className="h-9 text-xs" />
                  <Button type="button" size="icon" variant="ghost" onClick={() => delRow(i)} className="size-9">
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea name="notes" rows={2} defaultValue={editing?.notes} className="mt-1.5" />
            </div>
            <Button type="submit" disabled={save.isPending} className="w-full h-11">
              {save.isPending ? "Saving…" : editing ? "Update Customer" : "Save Customer"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <div className="grid grid-cols-3 gap-3">
        <Stat icon={UsersIcon} label="Customers" value={totals.count.toLocaleString()} tone="default" />
        <button type="button" onClick={() => setBreakdownOpen(true)} className="text-left">
          <Stat icon={Package} label="Cylinders Out" value={totals.out.toLocaleString()} tone="brand" hint="Tap for sizes" />
        </button>
        <Stat icon={Wallet} label="Outstanding" value={formatCurrency(totals.due)} tone="warn" />
      </div>

      <Dialog open={breakdownOpen} onOpenChange={setBreakdownOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Cylinders by Size</DialogTitle></DialogHeader>
          <div className="space-y-2 mt-2">
            {(data?.sizeBreakdown ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Koi size configured nahi.</p>
            )}
            {(data?.sizeBreakdown ?? []).map((s: any) => (
              <div key={s.name} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{s.name}</span>
                  <span className="font-display font-bold text-lg">{Number(s.qty).toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded bg-muted/60 p-1.5 text-center">
                    <div className="text-muted-foreground uppercase tracking-wider">Opening</div>
                    <div className="font-bold text-sm">{Number(s.opening).toLocaleString()}</div>
                  </div>
                  <div className="rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 p-1.5 text-center">
                    <div className="uppercase tracking-wider">+ Received</div>
                    <div className="font-bold text-sm">{Number(s.received).toLocaleString()}</div>
                  </div>
                  <div className="rounded bg-destructive/10 text-destructive p-1.5 text-center">
                    <div className="uppercase tracking-wider">− Delivered</div>
                    <div className="font-bold text-sm">{Number(s.delivered).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-lg bg-muted p-3 mt-3">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Total</span>
              <span className="font-display font-bold text-xl">{totals.out.toLocaleString()}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name or phone" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-11" />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No customers yet. Add your first customer.</Card>}
        {filtered.map((c: any) => (
          <Card key={c.id} className="p-4 flex items-center gap-3 hover:bg-muted/40 transition-colors">
            <Link to="/customers/$customerId" params={{ customerId: c.id }} className="flex items-center gap-3 flex-1 min-w-0">
              <div className="size-11 rounded-full bg-brand/10 text-brand grid place-items-center font-bold">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                  {c.phone && <span className="flex items-center gap-1"><Phone className="size-3" />{c.phone}</span>}
                  {c.address && <span className="hidden sm:flex items-center gap-1 truncate"><MapPin className="size-3" />{c.address}</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold">{c.balance.out} cyl</div>
                <Badge variant={c.balance.due > 0 ? "destructive" : "secondary"} className="mt-1 text-[10px]">
                  {formatCurrency(c.balance.due)}
                </Badge>
              </div>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9 shrink-0"><MoreVertical className="size-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEdit(c)} className="gap-2"><Pencil className="size-4" /> Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeleteId(c.id)} className="gap-2 text-destructive focus:text-destructive">
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
            <AlertDialogTitle>Delete customer?</AlertDialogTitle>
            <AlertDialogDescription>
              Ye action permanent hai. Customer ke saath uski tamam movements, payments, aur opening balances bhi delete ho jaein gy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && del.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {del.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, name, type = "text", required, defaultValue, placeholder }: any) {
  return (
    <div>
      <Label className="text-xs">{label}{required && <span className="text-destructive">*</span>}</Label>
      <Input name={name} type={type} required={required} defaultValue={defaultValue} placeholder={placeholder} className="mt-1.5 h-11" />
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone, hint }: any) {
  const toneCls = tone === "brand" ? "bg-brand/10 text-brand" : tone === "warn" ? "bg-warning/15 text-warning" : "bg-muted text-foreground";
  return (
    <Card className="p-3 h-full">
      <div className={`size-8 rounded-lg grid place-items-center ${toneCls}`}><Icon className="size-4" /></div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">{label}</div>
      <div className="font-display font-bold text-lg mt-0.5 truncate">{value}</div>
      {hint && <div className="text-[9px] text-brand mt-0.5">{hint}</div>}
    </Card>
  );
}
