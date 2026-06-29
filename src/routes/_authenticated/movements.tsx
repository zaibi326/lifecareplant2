import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowDownToLine, ArrowUpFromLine, Plus, Search, Camera, Printer, X, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { printHTML } from "@/lib/print";
import { enqueue } from "@/lib/offline-queue";

type MovType = "receive" | "deliver";
type LineRow = { gas_type_id: string; cylinder_size_id: string; quantity: number; rate: number };
type ExtraRow = { name: string; price: number | "" };
const EXTRA_PRESETS = ["Valve", "Spindle", "Repair Valve", "Cap", "O-Ring", "Neck Ring", "Other"];

export const Route = createFileRoute("/_authenticated/movements")({
  validateSearch: (s: Record<string, unknown>) => ({ type: ((s.type as MovType) ?? "receive") as MovType }),
  head: () => ({ meta: [{ title: "Movements — GasFlow Pro" }] }),
  component: MovementsPage,
});

function MovementsPage() {
  const { type } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["movements", type],
    queryFn: async () => {
      const { data } = await supabase
        .from("cylinder_movements")
        .select("*,customers(name),gas_types(name,color),cylinder_sizes(name)")
        .eq("type", type)
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data ?? [];
    return (data ?? []).filter((m: any) =>
      (m.customers?.name ?? "").toLowerCase().includes(s) ||
      (m.invoice_number ?? "").toLowerCase().includes(s) ||
      (m.vehicle_number ?? "").toLowerCase().includes(s),
    );
  }, [data, q]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cylinder_movements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entry deleted");
      qc.invalidateQueries();
      setDeleteId(null);
    },
    onError: (e: any) => { toast.error(e.message); setDeleteId(null); },
  });

  const Icon = type === "receive" ? ArrowDownToLine : ArrowUpFromLine;
  const tone = type === "receive" ? "bg-brand text-brand-foreground" : "bg-primary text-primary-foreground";

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (m: any) => { setEditing(m); setOpen(true); };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Icon className="size-6" /> {type === "receive" ? "Receive Cylinders" : "Deliver Cylinders"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {type === "receive" ? "Empties received from customers." : "Filled cylinders sent to customers."}
          </p>
        </div>
        <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <SheetTrigger asChild>
            <Button className={`gap-2 ${tone}`} onClick={openNew}><Plus className="size-4" /> New Entry</Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{editing ? "Edit" : type === "receive" ? "Receive" : "Deliver"} Cylinders</SheetTitle>
            </SheetHeader>
            <MovementForm
              type={type}
              editing={editing}
              onDone={() => { setOpen(false); setEditing(null); }}
            />
          </SheetContent>
        </Sheet>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Button variant={type === "receive" ? "default" : "outline"} className="h-11 gap-2" onClick={() => navigate({ to: "/movements", search: { type: "receive" } })}>
          <ArrowDownToLine className="size-4" /> Receive
        </Button>
        <Button variant={type === "deliver" ? "default" : "outline"} className="h-11 gap-2" onClick={() => navigate({ to: "/movements", search: { type: "deliver" } })}>
          <ArrowUpFromLine className="size-4" /> Deliver
        </Button>
      </div>

      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search customer / invoice / vehicle" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-11" />
      </div>

      <div className="space-y-2">
        {isLoading && <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>}
        {!isLoading && filtered.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No entries yet.</Card>}
        {filtered.map((m: any) => (
          <Card key={m.id} className="p-4 flex items-center gap-3">
            <div className="size-10 rounded-lg grid place-items-center text-white font-bold text-xs" style={{ background: m.gas_types?.color || "var(--brand)" }}>
              {(m.gas_types?.name ?? "—").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{m.customers?.name ?? "—"}</div>
              <div className="text-xs text-muted-foreground truncate">
                {m.quantity}× {m.cylinder_sizes?.name ?? ""} • {formatDate(m.date)}
                {m.invoice_number ? ` • ${m.invoice_number}` : ""}
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
              <div className="font-display font-bold">{m.quantity}</div>
              {type === "deliver" && <Badge variant="secondary" className="text-[10px]">{formatCurrency(m.total_amount)}</Badge>}
              {type === "deliver" && (
                <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs" onClick={() => printInvoice(m)}>
                  <Printer className="size-3" /> Invoice
                </Button>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9 shrink-0"><MoreVertical className="size-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEdit(m)} className="gap-2"><Pencil className="size-4" /> Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeleteId(m.id)} className="gap-2 text-destructive focus:text-destructive">
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
            <AlertDialogTitle>Delete entry?</AlertDialogTitle>
            <AlertDialogDescription>Ye action permanent hai. Stock aur balances update ho jaein gy.</AlertDialogDescription>
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

async function printInvoice(m: any) {
  const { data: s } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
  const tax = Number(s?.tax_percent ?? 0);
  const sub = Number(m.total_amount ?? 0);
  const taxAmt = sub * tax / 100;
  const grand = sub + taxAmt;
  printHTML(`Invoice ${m.invoice_number ?? ""}`, `
    <div class="head">
      <div><h1>${s?.company_name ?? "GasFlow Pro"}</h1><div class="muted">${s?.company_address ?? ""}</div><div class="muted">${s?.company_phone ?? ""}</div></div>
      <div style="text-align:right"><span class="badge">INVOICE</span><div style="margin-top:8px;font-weight:700">${m.invoice_number ?? ""}</div><div class="muted">${formatDate(m.date)}</div></div>
    </div>
    <h2>Bill To</h2>
    <div style="font-weight:600">${m.customers?.name ?? ""}</div>
    <h2>Items</h2>
    <table><thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead>
    <tbody><tr><td>${m.gas_types?.name ?? ""} — ${m.cylinder_sizes?.name ?? ""}</td><td class="right">${m.quantity}</td><td class="right">${formatCurrency(Number(m.rate ?? 0))}</td><td class="right">${formatCurrency(sub)}</td></tr></tbody></table>
    <div class="totals">
      <div><div class="label">Subtotal</div><div class="val">${formatCurrency(sub)}</div></div>
      ${tax ? `<div><div class="label">Tax (${tax}%)</div><div class="val">${formatCurrency(taxAmt)}</div></div>` : ""}
      <div><div class="label">Total</div><div class="val" style="font-size:18px">${formatCurrency(grand)}</div></div>
    </div>
    ${m.vehicle_number ? `<div class="muted" style="margin-top:16px">Vehicle: ${m.vehicle_number}${m.driver_name ? ` • Driver: ${m.driver_name}` : ""}</div>` : ""}
    ${s?.invoice_footer ? `<div class="muted" style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:12px">${s.invoice_footer}</div>` : ""}
  `);
}

function MovementForm({ type, editing, onDone }: { type: MovType; editing: any | null; onDone: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!editing;
  const [customer, setCustomer] = useState(editing?.customer_id ?? "");
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [lines, setLines] = useState<LineRow[]>(
    isEdit
      ? [{
          gas_type_id: editing.gas_type_id,
          cylinder_size_id: editing.cylinder_size_id,
          quantity: Number(editing.quantity ?? 1),
          rate: Number(editing.rate ?? 0),
        }]
      : [],
  );
  const [photos, setPhotos] = useState<File[]>([]);
  const [billNumber, setBillNumber] = useState<string>(editing?.bill_number ?? "");
  const [ecrNumber, setEcrNumber] = useState<string>(editing?.ecr_number ?? "");
  const [extras, setExtras] = useState<ExtraRow[]>(
    Array.isArray(editing?.extras)
      ? (editing.extras as any[]).map((e) => ({ name: String(e?.name ?? ""), price: e?.price === null || e?.price === undefined || e?.price === "" ? "" : Number(e.price) }))
      : [],
  );
  const addExtra = () => setExtras((r) => [...r, { name: EXTRA_PRESETS[0], price: "" }]);
  const updExtra = (i: number, patch: Partial<ExtraRow>) =>
    setExtras((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const delExtra = (i: number) => setExtras((r) => r.filter((_, idx) => idx !== i));

  const { data: lookups } = useQuery({
    queryKey: ["movement-lookups"],
    queryFn: async () => {
      const [c, g, s] = await Promise.all([
        supabase.from("customers").select("id,name").order("name"),
        supabase.from("gas_types").select("id,name").eq("active", true).order("name"),
        supabase.from("cylinder_sizes").select("id,name").eq("active", true).order("name"),
      ]);
      return { customers: c.data ?? [], gases: g.data ?? [], sizes: s.data ?? [] };
    },
  });

  useEffect(() => {
    if (!isEdit && lines.length === 0 && lookups?.gases?.length && lookups?.sizes?.length) {
      setLines([{ gas_type_id: lookups.gases[0].id, cylinder_size_id: lookups.sizes[0].id, quantity: 1, rate: 0 }]);
    }
  }, [lookups, isEdit, lines.length]);

  const addLine = () =>
    setLines((r) => [...r, {
      gas_type_id: lookups?.gases[0]?.id ?? "",
      cylinder_size_id: lookups?.sizes[0]?.id ?? "",
      quantity: 1,
      rate: 0,
    }]);
  const updLine = (i: number, patch: Partial<LineRow>) =>
    setLines((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const delLine = (i: number) => setLines((r) => r.filter((_, idx) => idx !== i));

  const extrasTotal = type === "deliver"
    ? extras.reduce((a, e) => a + (Number(e.price) || 0), 0)
    : 0;
  const linesTotal = type === "deliver"
    ? lines.reduce((a, l) => a + Number(l.quantity || 0) * Number(l.rate || 0), 0)
    : 0;
  const grandTotal = linesTotal + extrasTotal;

  const save = useMutation({
    mutationFn: async (f: FormData) => {
      if (!customer) throw new Error("Customer required");
      const valid = lines.filter((l) => l.gas_type_id && l.cylinder_size_id && Number(l.quantity) > 0);
      if (valid.length === 0) throw new Error("At least one line item required");
      const cond = String(f.get("condition") ?? "") as any;
      const vehicle_number = String(f.get("vehicle_number") ?? "").trim() || null;
      const driver_name = String(f.get("driver_name") ?? "").trim() || null;
      const remarks = String(f.get("remarks") ?? "").trim() || null;
      const condition = cond || (type === "receive" ? "empty" : "filled");
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      const bill_number = type === "deliver" ? (billNumber.trim() || null) : null;
      const ecr_number = type === "deliver" ? (ecrNumber.trim() || null) : null;
      const extrasClean = type === "deliver"
        ? extras
            .map((e) => ({ name: String(e.name || "").trim(), price: e.price === "" ? null : Number(e.price) || 0 }))
            .filter((e) => e.name.length > 0)
        : [];

      const photo_urls: string[] = [];
      if (!offline && photos.length > 0) {
        for (const file of photos) {
          const path = `${customer}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
          const up = await supabase.storage.from("movement-photos").upload(path, file, { upsert: false });
          if (up.error) throw up.error;
          const { data: signed } = await supabase.storage.from("movement-photos").createSignedUrl(path, 60 * 60 * 24 * 365);
          if (signed?.signedUrl) photo_urls.push(signed.signedUrl);
        }
      }

      if (isEdit) {
        const l = valid[0];
        const lineAmt = type === "deliver" ? Number(l.quantity) * Number(l.rate || 0) : null;
        const extrasSum = extrasClean.reduce((a, e) => a + (Number(e.price) || 0), 0);
        const { error } = await supabase.from("cylinder_movements").update({
          customer_id: customer,
          gas_type_id: l.gas_type_id,
          cylinder_size_id: l.cylinder_size_id,
          quantity: Number(l.quantity),
          rate: type === "deliver" ? Number(l.rate || 0) : null,
          total_amount: type === "deliver" ? (lineAmt ?? 0) + extrasSum : null,
          date,
          vehicle_number,
          driver_name,
          condition,
          remarks,
          bill_number,
          ecr_number,
          extras: extrasClean,
          ...(photo_urls.length ? { photo_urls } : {}),
        }).eq("id", editing.id);
        if (error) throw error;
        return { queued: false };
      }

      const payloads = valid.map((l, idx) => {
        const lineAmt = type === "deliver" ? Number(l.quantity) * Number(l.rate || 0) : null;
        const extrasSum = idx === 0 ? extrasClean.reduce((a, e) => a + (Number(e.price) || 0), 0) : 0;
        return {
          type,
          customer_id: customer,
          gas_type_id: l.gas_type_id,
          cylinder_size_id: l.cylinder_size_id,
          quantity: Number(l.quantity),
          rate: type === "deliver" ? Number(l.rate || 0) : null,
          total_amount: type === "deliver" ? (lineAmt ?? 0) + extrasSum : null,
          date,
          vehicle_number,
          driver_name,
          condition,
          remarks,
          bill_number,
          ecr_number,
          extras: idx === 0 ? extrasClean : [],
          photo_urls: photo_urls.length ? photo_urls : null,
        };
      });

      if (offline) {
        for (const p of payloads) {
          await enqueue({ table: "cylinder_movements", payload: p, label: `${type} ${p.quantity} cyl` });
        }
        if (photos.length > 0) toast.message("Saved offline — photos skipped (require connection)");
        return { queued: true };
      }

      const { error } = await supabase.from("cylinder_movements").insert(payloads);
      if (error) throw error;
      return { queued: false };
    },
    onSuccess: (res) => {
      if (res?.queued) toast.success("Saved offline — will sync when online");
      else toast.success(isEdit ? "Entry updated" : type === "receive" ? "Receive recorded" : "Delivery recorded");
      qc.invalidateQueries();
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    save.mutate(new FormData(e.currentTarget));
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setPhotos((p) => [...p, ...Array.from(files)].slice(0, 5));
  };

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <Label className="text-xs">Customer*</Label>
        <Select value={customer} onValueChange={setCustomer}>
          <SelectTrigger className="mt-1.5 h-11"><SelectValue placeholder="Select customer" /></SelectTrigger>
          <SelectContent>{lookups?.customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Line Items {isEdit && <span className="text-muted-foreground font-normal">(edit mode — single item)</span>}</Label>
          {!isEdit && (
            <Button type="button" size="sm" variant="outline" onClick={addLine} className="h-8 gap-1">
              <Plus className="size-3.5" /> Add
            </Button>
          )}
        </div>
        {lines.length === 0 && (
          <p className="text-xs text-muted-foreground">Aik ya zyada gas + size + qty add karein.</p>
        )}
        {lines.map((r, i) => (
          <div key={i} className="space-y-1.5 rounded-md bg-muted/30 p-2">
            <div className={`grid ${type === "deliver" ? "grid-cols-[1fr_1fr_70px_80px_auto]" : "grid-cols-[1fr_1fr_70px_auto]"} gap-1.5 items-center`}>
              <Select value={r.gas_type_id} onValueChange={(v) => updLine(i, { gas_type_id: v })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Gas" /></SelectTrigger>
                <SelectContent>
                  {(lookups?.gases ?? []).map((g: any) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={r.cylinder_size_id} onValueChange={(v) => updLine(i, { cylinder_size_id: v })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Size" /></SelectTrigger>
                <SelectContent>
                  {(lookups?.sizes ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="number" min={1} value={r.quantity} onChange={(e) => updLine(i, { quantity: Number(e.target.value) })} placeholder="Qty" className="h-9 text-xs" />
              {type === "deliver" && (
                <Input type="number" min={0} value={r.rate} onChange={(e) => updLine(i, { rate: Number(e.target.value) })} placeholder="Rate" className="h-9 text-xs" />
              )}
              {!isEdit && lines.length > 1 ? (
                <Button type="button" size="icon" variant="ghost" onClick={() => delLine(i)} className="size-9">
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              ) : (
                <div className="size-9" />
              )}
            </div>
            {type === "deliver" && (
              <div className="text-[11px] text-muted-foreground text-right">
                Line total: <span className="font-semibold text-foreground">{formatCurrency(Number(r.quantity || 0) * Number(r.rate || 0))}</span>
              </div>
            )}
          </div>
        ))}
        {type === "deliver" && lines.length > 0 && (
          <div className="flex items-center justify-between border-t pt-2 mt-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Grand Total</span>
            <span className="font-display font-bold text-lg">{formatCurrency(grandTotal)}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5 h-11" />
        </div>
        <div>
          <Label className="text-xs">Vehicle #</Label>
          <Input name="vehicle_number" defaultValue={editing?.vehicle_number ?? ""} className="mt-1.5 h-11" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Driver</Label>
          <Input name="driver_name" defaultValue={editing?.driver_name ?? ""} className="mt-1.5 h-11" />
        </div>
        <div>
          <Label className="text-xs">Cylinder Condition</Label>
          <Select name="condition" defaultValue={editing?.condition ?? (type === "receive" ? "empty" : "filled")}>
            <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="filled">Filled</SelectItem>
              <SelectItem value="empty">Empty</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs">Photos (optional, max 5)</Label>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <label className="h-11 rounded-md border border-dashed flex items-center justify-center gap-2 text-xs cursor-pointer hover:bg-muted/40">
            <Camera className="size-4" /> Camera
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => addFiles(e.target.files)} />
          </label>
          <label className="h-11 rounded-md border border-dashed flex items-center justify-center gap-2 text-xs cursor-pointer hover:bg-muted/40">
            <Plus className="size-4" /> Upload
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
          </label>
        </div>
        {photos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative size-16 rounded-md border overflow-hidden">
                <img src={URL.createObjectURL(p)} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setPhotos((arr) => arr.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 size-5 rounded-full bg-black/70 text-white grid place-items-center">
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <Label className="text-xs">Remarks</Label>
        <Textarea name="remarks" rows={2} defaultValue={editing?.remarks ?? ""} className="mt-1.5" />
      </div>
      <Button type="submit" disabled={save.isPending} className="w-full h-11">
        {save.isPending ? "Saving…" : isEdit ? "Update Entry" : type === "receive" ? "Record Receive" : "Record Delivery"}
      </Button>
    </form>
  );
}
