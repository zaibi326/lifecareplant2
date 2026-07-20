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
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Plus,
  Search,
  Camera,
  Printer,
  X,
  MoreVertical,
  Pencil,
  Trash2,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { printHTML } from "@/lib/print";
import { enqueue } from "@/lib/offline-queue";
import html2canvas from "html2canvas";

type MovType = "receive" | "deliver";
type LineRow = { gas_type_id: string; cylinder_size_id: string; quantity: number; rate: number };
type ExtraRow = { name: string; price: number | ""; qty: number | ""; size?: string };
const EXTRA_PRESETS = ["Valve", "Spindle", "Repair Valve", "Cap", "O-Ring", "Neck Ring", "Other"];
const PART_SIZES = ['1"', '1.15"', '1.30"', '1.45"', '2"'];
const isSized = (n: string) => n === "Valve" || n === "Spindle";

export const Route = createFileRoute("/_authenticated/movements")({
  validateSearch: (s: Record<string, unknown>) => ({
    type: ((s.type as MovType) ?? "receive") as MovType,
  }),
  head: () => ({ meta: [{ title: "Movements — Life Care Plant" }] }),
  component: MovementsPage,
});

function MovementsPage() {
  const { type } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<string[] | null>(null);
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
    return (data ?? []).filter(
      (m: any) =>
        (m.customers?.name ?? "").toLowerCase().includes(s) ||
        (m.invoice_number ?? "").toLowerCase().includes(s) ||
        (m.vehicle_number ?? "").toLowerCase().includes(s),
    );
  }, [data, q]);

  // Group delivery rows by shared invoice_number (one bill per delivery)
  const groups = useMemo(() => {
    if (type !== "deliver") return (filtered as any[]).map((m) => ({ key: m.id, rows: [m] }));
    const map = new Map<string, any[]>();
    const out: { key: string; rows: any[] }[] = [];
    (filtered as any[]).forEach((m) => {
      const key = m.invoice_number ? `inv:${m.invoice_number}` : `id:${m.id}`;
      if (!map.has(key)) {
        map.set(key, []);
        out.push({ key, rows: map.get(key)! });
      }
      map.get(key)!.push(m);
    });
    return out;
  }, [filtered, type]);

  const del = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("cylinder_movements").delete().in("id", ids);
      if (error) throw error;
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

  const Icon = type === "receive" ? ArrowDownToLine : ArrowUpFromLine;
  const tone =
    type === "receive" ? "bg-brand text-brand-foreground" : "bg-primary text-primary-foreground";

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (m: any) => {
    setEditing(m);
    setOpen(true);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Icon className="size-6" />{" "}
            {type === "receive" ? "Receive Cylinders" : "Deliver Cylinders"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {type === "receive"
              ? "Empties received from customers."
              : "Filled cylinders sent to customers."}
          </p>
        </div>
        <Sheet
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setEditing(null);
          }}
        >
          <SheetTrigger asChild>
            <Button className={`gap-2 ${tone}`} onClick={openNew}>
              <Plus className="size-4" /> New Entry
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>
                {editing ? "Edit" : type === "receive" ? "Receive" : "Deliver"} Cylinders
              </SheetTitle>
            </SheetHeader>
            <MovementForm
              type={type}
              editing={editing}
              onDone={() => {
                setOpen(false);
                setEditing(null);
              }}
            />
          </SheetContent>
        </Sheet>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={type === "receive" ? "default" : "outline"}
          className="h-11 gap-2"
          onClick={() => navigate({ to: "/movements", search: { type: "receive" } })}
        >
          <ArrowDownToLine className="size-4" /> Receive
        </Button>
        <Button
          variant={type === "deliver" ? "default" : "outline"}
          className="h-11 gap-2"
          onClick={() => navigate({ to: "/movements", search: { type: "deliver" } })}
        >
          <ArrowUpFromLine className="size-4" /> Deliver
        </Button>
      </div>

      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search customer / invoice / vehicle"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      <div className="space-y-2">
        {isLoading && <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>}
        {!isLoading && filtered.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">No entries yet.</Card>
        )}
        {groups.map((g) => {
          const rows = g.rows;
          const first = rows[0];
          const totalQty = rows.reduce((a: number, r: any) => a + Number(r.quantity || 0), 0);
          const totalAmt = rows.reduce((a: number, r: any) => a + Number(r.total_amount || 0), 0);
          const summary = rows
            .map((r: any) =>
              `${r.quantity}× ${r.gas_types?.name ?? ""} ${r.cylinder_sizes?.name ?? ""}`.trim(),
            )
            .join(", ");
          const ids = rows.map((r: any) => r.id);
          return (
            <Card key={g.key} className="p-4 flex items-center gap-3">
              <div
                className="size-10 rounded-lg grid place-items-center text-white font-bold text-xs"
                style={{ background: first.gas_types?.color || "var(--brand)" }}
              >
                {(first.gas_types?.name ?? "—").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{first.customers?.name ?? "—"}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {summary} • {formatDate(first.date)}
                  {first.invoice_number ? ` • ${first.invoice_number}` : ""}
                </div>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <div className="font-display font-bold">{totalQty}</div>
                {type === "deliver" && (
                  <Badge variant="secondary" className="text-[10px]">
                    {formatCurrency(totalAmt)}
                  </Badge>
                )}
                {type === "deliver" && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 gap-1 text-xs"
                      onClick={() => printInvoice(rows, "print")}
                    >
                      <Printer className="size-3" /> Invoice
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 gap-1 text-xs"
                      onClick={() => printInvoice(rows, "jpg")}
                    >
                      <Download className="size-3" /> JPG
                    </Button>
                  </div>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-9 shrink-0">
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {rows.length === 1 && (
                    <DropdownMenuItem onClick={() => openEdit(first)} className="gap-2">
                      <Pencil className="size-4" /> Edit
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => setDeleteId(ids)}
                    className="gap-2 text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-4" /> Delete
                    {rows.length > 1 ? ` (${rows.length} lines)` : ""}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete entry?</AlertDialogTitle>
            <AlertDialogDescription>
              Ye action permanent hai. Stock aur balances update ho jaein gy.
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

async function printInvoice(input: any | any[], mode: "print" | "jpg" = "print") {
  const rows: any[] = Array.isArray(input) ? input : [input];
  const first = rows[0];
  const { data: s } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
  const tax = Number(s?.tax_percent ?? 0);

  // Party balance: opening − delivered + received (cylinders this party still holds)
  let partyBalance = 0;
  if (first.customer_id) {
    const [{ data: cust }, { data: moves }] = await Promise.all([
      supabase
        .from("customers")
        .select("opening_cylinders")
        .eq("id", first.customer_id)
        .maybeSingle(),
      supabase
        .from("cylinder_movements")
        .select("type,quantity")
        .eq("customer_id", first.customer_id),
    ]);
    const op = Number(cust?.opening_cylinders ?? 0);
    const d = (moves ?? [])
      .filter((m: any) => m.type === "deliver")
      .reduce((a: number, m: any) => a + Number(m.quantity || 0), 0);
    const r = (moves ?? [])
      .filter((m: any) => m.type === "receive")
      .reduce((a: number, m: any) => a + Number(m.quantity || 0), 0);
    partyBalance = Math.max(0, op - d + r);
  }

  const cylRows = rows
    .map((r) => {
      const amt = Number(r.quantity || 0) * Number(r.rate || 0);
      return `<tr><td>${r.gas_types?.name ?? ""} — ${r.cylinder_sizes?.name ?? ""}</td><td class="right">${r.quantity}</td><td class="right">${formatCurrency(Number(r.rate ?? 0))}</td><td class="right">${formatCurrency(amt)}</td></tr>`;
    })
    .join("");

  const extras = rows.flatMap((r) => (Array.isArray(r.extras) ? r.extras : []));
  const extraRows = extras
    .map((e: any) => {
      const qty = Math.max(1, Number(e.qty) || 1);
      const price = Number(e.price) || 0;
      const label = `${e.name ?? ""}${e.size ? ` (${e.size})` : ""}`;
      return `<tr><td>${label}</td><td class="right">${qty}</td><td class="right">${formatCurrency(price)}</td><td class="right">${formatCurrency(price * qty)}</td></tr>`;
    })
    .join("");

  const cylSub = rows.reduce((a, r) => a + Number(r.quantity || 0) * Number(r.rate || 0), 0);
  const extrasSub = extras.reduce(
    (a: number, e: any) => a + (Number(e.price) || 0) * Math.max(1, Number(e.qty) || 1),
    0,
  );
  const sub = cylSub + extrasSub;
  const taxAmt = (sub * tax) / 100;
  const grand = sub + taxAmt;

  const billNos = Array.from(new Set(rows.map((r) => r.bill_number).filter(Boolean))).join(", ");
  const ecrNos = Array.from(new Set(rows.map((r) => r.ecr_number).filter(Boolean))).join(", ");

  const body = `
    <div class="head">
      <div><h1>${s?.company_name ?? "Life Care Plant"}</h1><div class="muted">${s?.company_address ?? ""}</div><div class="muted">${s?.company_phone ?? ""}</div></div>
      <div style="text-align:right"><span class="badge">INVOICE</span><div style="margin-top:8px;font-weight:700">${first.invoice_number ?? ""}</div><div class="muted">${formatDate(first.date)}</div>${billNos ? `<div class="muted">Bill #: ${billNos}</div>` : ""}${ecrNos ? `<div class="muted">ECR #: ${ecrNos}</div>` : ""}</div>
    </div>
    <h2>Bill To</h2>
    <div style="font-weight:600">${first.customers?.name ?? ""}</div>
    <div class="muted">Cylinders with party (balance): <b>${partyBalance}</b></div>
    <h2>Items</h2>
    <table><thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead>
    <tbody>${cylRows}${extraRows}</tbody></table>
    <div class="totals">
      <div><div class="label">Subtotal</div><div class="val">${formatCurrency(sub)}</div></div>
      ${tax ? `<div><div class="label">Tax (${tax}%)</div><div class="val">${formatCurrency(taxAmt)}</div></div>` : ""}
      <div><div class="label">Total</div><div class="val" style="font-size:18px">${formatCurrency(grand)}</div></div>
    </div>
    ${first.vehicle_number ? `<div class="muted" style="margin-top:16px">Vehicle: ${first.vehicle_number}${first.driver_name ? ` • Driver: ${first.driver_name}` : ""}</div>` : ""}
    ${s?.invoice_footer ? `<div class="muted" style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:12px">${s.invoice_footer}</div>` : ""}
  `;

  if (mode === "print") {
    printHTML(`Invoice ${first.invoice_number ?? ""}`, body);
    return;
  }

  // JPG mode — render off-screen, snapshot with html2canvas, trigger download
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:800px;background:#fff;padding:32px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;";
  host.innerHTML = `<style>
    h1{font-size:22px;margin:0 0 4px} h2{font-size:14px;margin:24px 0 8px;letter-spacing:.06em;text-transform:uppercase;color:#64748b}
    .muted{color:#64748b;font-size:12px} table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
    th,td{padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:left} th{background:#f8fafc;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#475569}
    .right{text-align:right} .totals{margin-top:16px;display:flex;justify-content:flex-end;gap:32px;font-size:14px}
    .totals .label{color:#64748b} .totals .val{font-weight:700}
    .head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:2px solid #0f172a;padding-bottom:16px}
    .badge{display:inline-block;padding:2px 8px;border-radius:999px;background:#0f172a;color:#fff;font-size:11px}
  </style>${body}`;
  document.body.appendChild(host);
  try {
    const canvas = await html2canvas(host, { backgroundColor: "#ffffff", scale: 2 });
    const url = canvas.toDataURL("image/jpeg", 0.95);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice-${first.invoice_number ?? first.id}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("Invoice JPG downloaded");
  } catch (e: any) {
    toast.error(e?.message || "Failed to generate JPG");
  } finally {
    host.remove();
  }
}

function MovementForm({
  type,
  editing,
  onDone,
}: {
  type: MovType;
  editing: any | null;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!editing;
  const [customer, setCustomer] = useState(editing?.customer_id ?? "");
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [lines, setLines] = useState<LineRow[]>(
    isEdit
      ? [
          {
            gas_type_id: editing.gas_type_id,
            cylinder_size_id: editing.cylinder_size_id,
            quantity: Number(editing.quantity ?? 1),
            rate: Number(editing.rate ?? 0),
          },
        ]
      : [],
  );
  const [photos, setPhotos] = useState<File[]>([]);
  const [billNumber, setBillNumber] = useState<string>(editing?.bill_number ?? "");
  const [ecrNumber, setEcrNumber] = useState<string>(editing?.ecr_number ?? "");
  const [extras, setExtras] = useState<ExtraRow[]>(
    Array.isArray(editing?.extras)
      ? (editing.extras as any[]).map((e) => ({
          name: String(e?.name ?? ""),
          price:
            e?.price === null || e?.price === undefined || e?.price === "" ? "" : Number(e.price),
          qty: e?.qty === null || e?.qty === undefined || e?.qty === "" ? 1 : Number(e.qty),
          size: e?.size ? String(e.size) : undefined,
        }))
      : [],
  );
  const addExtra = () =>
    setExtras((r) => [...r, { name: EXTRA_PRESETS[0], price: "", qty: 1, size: partSizes[0] }]);
  const updExtra = (i: number, patch: Partial<ExtraRow>) =>
    setExtras((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const delExtra = (i: number) => setExtras((r) => r.filter((_, idx) => idx !== i));

  const [vehicleId, setVehicleId] = useState<string>(editing?.vehicle_id ?? "none");
  const [driverId, setDriverId] = useState<string>(editing?.driver_id ?? "none");
  const [fuel, setFuel] = useState<number | "">("");
  const [labour, setLabour] = useState<number | "">("");
  const [loadingExp, setLoadingExp] = useState<number | "">("");
  const [tollTax, setTollTax] = useState<number | "">("");
  const [misc, setMisc] = useState<number | "">("");

  const { data: lookups } = useQuery({
    queryKey: ["movement-lookups"],
    queryFn: async () => {
      const [c, g, s, ps, v, d] = await Promise.all([
        supabase.from("customers").select("id,name").order("name"),
        supabase.from("gas_types").select("id,name").eq("active", true).order("name"),
        supabase.from("cylinder_sizes").select("id,name").eq("active", true).order("name"),
        supabase
          .from("part_sizes")
          .select("label")
          .eq("active", true)
          .order("sort_order")
          .order("label"),
        supabase
          .from("vehicles")
          .select("id,registration_number,vehicle_name,per_trip_rent,default_driver_id")
          .eq("status", "active")
          .order("registration_number"),
        supabase.from("drivers").select("id,name").eq("status", "active").order("name"),
      ]);
      return {
        customers: c.data ?? [],
        gases: g.data ?? [],
        sizes: s.data ?? [],
        partSizes: (ps.data ?? []).map((r: any) => String(r.label)),
        vehicles: v.data ?? [],
        drivers: d.data ?? [],
      };
    },
  });
  const partSizes = lookups?.partSizes?.length ? lookups.partSizes : PART_SIZES;

  useEffect(() => {
    if (!isEdit && lines.length === 0 && lookups?.gases?.length && lookups?.sizes?.length) {
      setLines([
        {
          gas_type_id: lookups.gases[0].id,
          cylinder_size_id: lookups.sizes[0].id,
          quantity: 1,
          rate: 0,
        },
      ]);
    }
  }, [lookups, isEdit, lines.length]);

  const addLine = () =>
    setLines((r) => [
      ...r,
      {
        gas_type_id: lookups?.gases[0]?.id ?? "",
        cylinder_size_id: lookups?.sizes[0]?.id ?? "",
        quantity: 1,
        rate: 0,
      },
    ]);
  const updLine = (i: number, patch: Partial<LineRow>) =>
    setLines((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const delLine = (i: number) => setLines((r) => r.filter((_, idx) => idx !== i));

  const extrasTotal =
    type === "deliver"
      ? extras.reduce((a, e) => a + (Number(e.price) || 0) * (Number(e.qty) || 0), 0)
      : 0;
  const linesTotal =
    type === "deliver"
      ? lines.reduce((a, l) => a + Number(l.quantity || 0) * Number(l.rate || 0), 0)
      : 0;
  const grandTotal = linesTotal + extrasTotal;

  const { data: custPrices } = useQuery({
    queryKey: ["customer-prices", customer],
    enabled: !!customer,
    queryFn: async () => {
      const { data } = await supabase
        .from("customer_prices")
        .select("gas_type_id,cylinder_size_id,price")
        .eq("customer_id", customer);
      return data ?? [];
    },
  });
  const priceFor = (gid: string, sid: string) =>
    Number(
      (custPrices ?? []).find((p: any) => p.gas_type_id === gid && p.cylinder_size_id === sid)
        ?.price ?? 0,
    );

  const { data: customerRow } = useQuery({
    queryKey: ["customer-karaya", customer],
    enabled: !!customer,
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("karaya_per_cylinder")
        .eq("id", customer)
        .maybeSingle();
      return data;
    },
  });
  const karayaRate = Number((customerRow as any)?.karaya_per_cylinder ?? 0);

  // Auto-fill line rate from customer_prices when a matching price exists and rate is empty.
  useEffect(() => {
    if (type !== "deliver" || !customer || !custPrices) return;
    setLines((rows) =>
      rows.map((r) => {
        if (!r.gas_type_id || !r.cylinder_size_id) return r;
        if (Number(r.rate) > 0) return r;
        const p = priceFor(r.gas_type_id, r.cylinder_size_id);
        return p > 0 ? { ...r, rate: p } : r;
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, custPrices]);

  const cylinderQtyTotal =
    type === "deliver" ? lines.reduce((a, l) => a + Number(l.quantity || 0), 0) : 0;
  const cylinderKaraya = type === "deliver" ? cylinderQtyTotal * karayaRate : 0;

  const selectedVehicle = (lookups?.vehicles ?? []).find((x: any) => x.id === vehicleId);
  const perTripRent = Number(selectedVehicle?.per_trip_rent ?? 0);
  const deliveryExpenseTotal =
    perTripRent +
    cylinderKaraya +
    (Number(fuel) || 0) +
    (Number(labour) || 0) +
    (Number(loadingExp) || 0) +
    (Number(tollTax) || 0) +
    (Number(misc) || 0);

  useEffect(() => {
    if (vehicleId && vehicleId !== "none") {
      const v = (lookups?.vehicles ?? []).find((x: any) => x.id === vehicleId);
      if (v?.default_driver_id) setDriverId(v.default_driver_id as string);
    }
  }, [vehicleId, lookups]);

  const save = useMutation({
    mutationFn: async (f: FormData) => {
      if (!customer) throw new Error("Customer required");
      const valid = lines.filter(
        (l) => l.gas_type_id && l.cylinder_size_id && Number(l.quantity) > 0,
      );
      if (valid.length === 0) throw new Error("At least one line item required");
      const cond = String(f.get("condition") ?? "") as any;
      const selVehicle = (lookups?.vehicles ?? []).find((x: any) => x.id === vehicleId);
      const selDriver = (lookups?.drivers ?? []).find((x: any) => x.id === driverId);
      const vehicle_number =
        String(f.get("vehicle_number") ?? "").trim() ||
        (selVehicle ? String(selVehicle.registration_number) : "") ||
        null;
      const driver_name =
        String(f.get("driver_name") ?? "").trim() ||
        (selDriver ? String(selDriver.name) : "") ||
        null;
      const vehicle_id = vehicleId && vehicleId !== "none" ? vehicleId : null;
      const driver_id = driverId && driverId !== "none" ? driverId : null;
      const remarks = String(f.get("remarks") ?? "").trim() || null;
      const condition = cond || (type === "receive" ? "empty" : "filled");
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      const bill_number = type === "deliver" ? billNumber.trim() || null : null;
      const ecr_number = type === "deliver" ? ecrNumber.trim() || null : null;
      const extrasClean =
        type === "deliver"
          ? extras
              .map((e) => {
                const name = String(e.name || "").trim();
                const size = isSized(name) && e.size ? String(e.size) : null;
                const qty = Math.max(1, Number(e.qty) || 1);
                return {
                  name,
                  price: e.price === "" ? null : Number(e.price) || 0,
                  qty,
                  size,
                  kind: name === "Valve" ? "valve" : name === "Spindle" ? "spindle" : null,
                };
              })
              .filter((e) => e.name.length > 0 && (!isSized(e.name) || e.size))
          : [];

      const photo_urls: string[] = [];
      if (!offline && photos.length > 0) {
        for (const file of photos) {
          const path = `${customer}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
          const up = await supabase.storage
            .from("movement-photos")
            .upload(path, file, { upsert: false });
          if (up.error) throw up.error;
          const { data: signed } = await supabase.storage
            .from("movement-photos")
            .createSignedUrl(path, 60 * 60 * 24 * 365);
          if (signed?.signedUrl) photo_urls.push(signed.signedUrl);
        }
      }

      if (isEdit) {
        const l = valid[0];
        const lineAmt = type === "deliver" ? Number(l.quantity) * Number(l.rate || 0) : null;
        const extrasSum = extrasClean.reduce(
          (a, e) => a + (Number(e.price) || 0) * (Number(e.qty) || 1),
          0,
        );
        const { error } = await supabase
          .from("cylinder_movements")
          .update({
            customer_id: customer,
            gas_type_id: l.gas_type_id,
            cylinder_size_id: l.cylinder_size_id,
            quantity: Number(l.quantity),
            rate: type === "deliver" ? Number(l.rate || 0) : null,
            total_amount: type === "deliver" ? (lineAmt ?? 0) + extrasSum : null,
            date,
            vehicle_number,
            driver_name,
            vehicle_id,
            driver_id,
            condition,
            remarks,
            bill_number,
            ecr_number,
            extras: extrasClean,
            ...(photo_urls.length ? { photo_urls } : {}),
          })
          .eq("id", editing.id);
        if (error) throw error;
        return { queued: false };
      }

      const payloads = valid.map((l, idx) => {
        const lineAmt = type === "deliver" ? Number(l.quantity) * Number(l.rate || 0) : null;
        const extrasSum =
          idx === 0
            ? extrasClean.reduce((a, e) => a + (Number(e.price) || 0) * (Number(e.qty) || 1), 0)
            : 0;
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
          vehicle_id,
          driver_id,
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
          await enqueue({
            table: "cylinder_movements",
            payload: p,
            label: `${type} ${p.quantity} cyl`,
          });
        }
        if (photos.length > 0) toast.message("Saved offline — photos skipped (require connection)");
        return { queued: true };
      }

      // Share a single invoice number across all lines of one delivery
      if (type === "deliver" && payloads.length > 0) {
        const { data: invNum, error: invErr } = await supabase.rpc("next_invoice_number");
        if (invErr) throw invErr;
        if (invNum)
          payloads.forEach((p: any) => {
            p.invoice_number = invNum as string;
          });
      }

      const { error } = await supabase.from("cylinder_movements").insert(payloads);
      if (error) throw error;

      // Auto delivery expense: per-trip rent + manual expenses → delivery_expenses + expenses.
      if (type === "deliver" && deliveryExpenseTotal > 0) {
        const invNo = (payloads[0] as any)?.invoice_number ?? null;
        const deNotes = [
          `Delivery ${invNo ?? ""}`,
          vehicle_number ? `Vehicle ${vehicle_number}` : null,
          cylinderQtyTotal > 0 ? `${cylinderQtyTotal} cyl` : null,
          cylinderKaraya > 0 ? `Karaya ${cylinderKaraya.toFixed(0)}` : null,
        ]
          .filter(Boolean)
          .join(" • ");
        const { error: deErr } = await supabase.from("delivery_expenses").insert({
          date,
          invoice_number: invNo,
          vehicle_id,
          driver_id,
          vehicle_rent: perTripRent,
          cylinder_karaya: cylinderKaraya,
          fuel: Number(fuel) || 0,
          labour: Number(labour) || 0,
          loading: Number(loadingExp) || 0,
          toll_tax: Number(tollTax) || 0,
          miscellaneous: Number(misc) || 0,
          total: deliveryExpenseTotal,
          notes: deNotes,
        });
        if (deErr) throw deErr;
        await supabase.from("expenses").insert({
          date,
          category: "Vehicle / Delivery",
          amount: deliveryExpenseTotal,
          payee: driver_name,
          reference_number: invNo,
          notes: `Auto delivery expense${vehicle_number ? ` • ${vehicle_number}` : ""}${cylinderKaraya > 0 ? ` • Karaya ${cylinderKaraya.toFixed(0)}` : ""}`,
        });
      }
      return { queued: false };
    },
    onSuccess: (res) => {
      if (res?.queued) toast.success("Saved offline — will sync when online");
      else
        toast.success(
          isEdit ? "Entry updated" : type === "receive" ? "Receive recorded" : "Delivery recorded",
        );
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

      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">
            Line Items{" "}
            {isEdit && (
              <span className="text-muted-foreground font-normal">(edit mode — single item)</span>
            )}
          </Label>
          {!isEdit && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addLine}
              className="h-8 gap-1"
            >
              <Plus className="size-3.5" /> Add
            </Button>
          )}
        </div>
        {lines.length === 0 && (
          <p className="text-xs text-muted-foreground">Aik ya zyada gas + size + qty add karein.</p>
        )}
        {lines.map((r, i) => (
          <div key={i} className="space-y-1.5 rounded-md bg-muted/30 p-2">
            <div
              className={`grid ${type === "deliver" ? "grid-cols-[1fr_1fr_70px_80px_auto]" : "grid-cols-[1fr_1fr_70px_auto]"} gap-1.5 items-center`}
            >
              <Select value={r.gas_type_id} onValueChange={(v) => updLine(i, { gas_type_id: v })}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Gas" />
                </SelectTrigger>
                <SelectContent>
                  {(lookups?.gases ?? []).map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={r.cylinder_size_id}
                onValueChange={(v) => updLine(i, { cylinder_size_id: v })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Size" />
                </SelectTrigger>
                <SelectContent>
                  {(lookups?.sizes ?? []).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                value={r.quantity}
                onChange={(e) => updLine(i, { quantity: Number(e.target.value) })}
                placeholder="Qty"
                className="h-9 text-xs"
              />
              {type === "deliver" && (
                <Input
                  type="number"
                  min={0}
                  value={r.rate}
                  onChange={(e) => updLine(i, { rate: Number(e.target.value) })}
                  placeholder="Rate"
                  className="h-9 text-xs"
                />
              )}
              {!isEdit && lines.length > 1 ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => delLine(i)}
                  className="size-9"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              ) : (
                <div className="size-9" />
              )}
            </div>
            {type === "deliver" && (
              <div className="text-[11px] text-muted-foreground text-right">
                Line total:{" "}
                <span className="font-semibold text-foreground">
                  {formatCurrency(Number(r.quantity || 0) * Number(r.rate || 0))}
                </span>
              </div>
            )}
          </div>
        ))}
        {type === "deliver" && lines.length > 0 && (
          <>
            <div className="flex items-center justify-between border-t pt-2 mt-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Cylinders Total
              </span>
              <span className="font-semibold">{formatCurrency(linesTotal)}</span>
            </div>
            {cylinderQtyTotal > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Karaya ({cylinderQtyTotal} × {formatCurrency(karayaRate)})
                </span>
                <span className="font-semibold">{formatCurrency(cylinderKaraya)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {type === "deliver" && (
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">
              Extras / Parts <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addExtra}
              className="h-8 gap-1"
            >
              <Plus className="size-3.5" /> Add
            </Button>
          </div>
          {extras.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Valve, spindle, repair valve waghaira add karein.
            </p>
          )}
          {extras.map((e, i) => {
            const sized = isSized(e.name);
            return (
              <div key={i} className="space-y-1.5 rounded-md bg-muted/30 p-2">
                <div className="grid grid-cols-12 gap-1.5 items-end">
                  <div className="col-span-5">
                    <Label className="text-[10px] text-muted-foreground">Item</Label>
                    <Select
                      value={EXTRA_PRESETS.includes(e.name) ? e.name : "Other"}
                      onValueChange={(v) =>
                        updExtra(i, {
                          name: v === "Other" ? "" : v,
                          size:
                            v === "Valve" || v === "Spindle" ? (e.size ?? partSizes[0]) : undefined,
                        })
                      }
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Item" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXTRA_PRESETS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-7">
                    <Label className="text-[10px] text-muted-foreground">Name / details</Label>
                    <Input
                      value={e.name}
                      onChange={(ev) => updExtra(i, { name: ev.target.value })}
                      placeholder="Name / details"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="col-span-4">
                    <Label className="text-[10px] text-muted-foreground">Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      value={e.qty === "" ? "" : e.qty}
                      onChange={(ev) =>
                        updExtra(i, {
                          qty: ev.target.value === "" ? "" : Math.max(1, Number(ev.target.value)),
                        })
                      }
                      placeholder="Qty"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="col-span-6">
                    <Label className="text-[10px] text-muted-foreground">Price</Label>
                    <Input
                      type="number"
                      min={0}
                      value={e.price === "" ? "" : e.price}
                      onChange={(ev) =>
                        updExtra(i, {
                          price: ev.target.value === "" ? "" : Number(ev.target.value),
                        })
                      }
                      placeholder="Price"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => delExtra(i)}
                      className="size-9"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {sized && (
                  <div className="grid grid-cols-[80px_1fr] gap-1.5 items-center">
                    <Label className="text-[11px] text-muted-foreground">Size</Label>
                    <Select
                      value={e.size ?? partSizes[0]}
                      onValueChange={(v) => updExtra(i, { size: v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Size" />
                      </SelectTrigger>
                      <SelectContent>
                        {partSizes.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(Number(e.qty) || 0) > 1 && e.price !== "" && (
                  <div className="text-[11px] text-muted-foreground text-right">
                    Line total: {formatCurrency((Number(e.price) || 0) * (Number(e.qty) || 0))}
                  </div>
                )}
              </div>
            );
          })}
          {extras.length > 0 && (
            <div className="flex items-center justify-between border-t pt-2 mt-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Extras Total
              </span>
              <span className="font-semibold">{formatCurrency(extrasTotal)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t pt-2 mt-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Grand Total
            </span>
            <span className="font-display font-bold text-lg">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      )}

      {type === "deliver" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Bill #</Label>
            <Input
              value={billNumber}
              onChange={(e) => setBillNumber(e.target.value)}
              placeholder="Optional"
              className="mt-1.5 h-11"
            />
          </div>
          <div>
            <Label className="text-xs">ECR #</Label>
            <Input
              value={ecrNumber}
              onChange={(e) => setEcrNumber(e.target.value)}
              placeholder="Optional"
              className="mt-1.5 h-11"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
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
          <Label className="text-xs">Cylinder Condition</Label>
          <Select
            name="condition"
            defaultValue={editing?.condition ?? (type === "receive" ? "empty" : "filled")}
          >
            <SelectTrigger className="mt-1.5 h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="filled">Filled</SelectItem>
              <SelectItem value="empty">Empty</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {type === "deliver" ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Vehicle</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger className="mt-1.5 h-11">
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No vehicle</SelectItem>
                {(lookups?.vehicles ?? []).map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.registration_number}
                    {v.vehicle_name ? ` — ${v.vehicle_name}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">
              Driver <span className="text-muted-foreground font-normal">(auto)</span>
            </Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger className="mt-1.5 h-11">
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No driver</SelectItem>
                {(lookups?.drivers ?? []).map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* keep free-text fallbacks so existing flow & printing keep working */}
          <input type="hidden" name="vehicle_number" value="" readOnly />
          <input type="hidden" name="driver_name" value="" readOnly />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Vehicle #</Label>
            <Input
              name="vehicle_number"
              defaultValue={editing?.vehicle_number ?? ""}
              className="mt-1.5 h-11"
            />
          </div>
          <div>
            <Label className="text-xs">Driver</Label>
            <Input
              name="driver_name"
              defaultValue={editing?.driver_name ?? ""}
              className="mt-1.5 h-11"
            />
          </div>
        </div>
      )}

      {type === "deliver" && (
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Delivery Expense</Label>
            {perTripRent > 0 && (
              <span className="text-[11px] text-muted-foreground">
                Vehicle rent auto: <b className="text-foreground">{formatCurrency(perTripRent)}</b>
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Fuel</Label>
              <Input
                type="number"
                min={0}
                value={fuel}
                onChange={(e) => setFuel(e.target.value === "" ? "" : Number(e.target.value))}
                className="h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Labour</Label>
              <Input
                type="number"
                min={0}
                value={labour}
                onChange={(e) => setLabour(e.target.value === "" ? "" : Number(e.target.value))}
                className="h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Loading</Label>
              <Input
                type="number"
                min={0}
                value={loadingExp}
                onChange={(e) => setLoadingExp(e.target.value === "" ? "" : Number(e.target.value))}
                className="h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Toll Tax</Label>
              <Input
                type="number"
                min={0}
                value={tollTax}
                onChange={(e) => setTollTax(e.target.value === "" ? "" : Number(e.target.value))}
                className="h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Misc</Label>
              <Input
                type="number"
                min={0}
                value={misc}
                onChange={(e) => setMisc(e.target.value === "" ? "" : Number(e.target.value))}
                className="h-9 text-xs"
              />
            </div>
          </div>
          {cylinderQtyTotal > 0 && (
            <div className="flex items-center justify-between text-xs bg-muted/40 rounded px-2 py-1.5">
              <span className="text-muted-foreground">
                Cylinder Karaya{" "}
                <span className="text-[10px]">
                  ({cylinderQtyTotal} cyl × {formatCurrency(karayaRate)})
                </span>
              </span>
              <span className="font-semibold">{formatCurrency(cylinderKaraya)}</span>
            </div>
          )}
          {customer && karayaRate === 0 && cylinderQtyTotal > 0 && (
            <p className="text-[10px] text-warning">
              Is customer ka karaya set nahi — Customers page → edit karke set karein.
            </p>
          )}
          <div className="flex items-center justify-between border-t pt-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Total Delivery Expense
            </span>
            <span className="font-semibold">{formatCurrency(deliveryExpenseTotal)}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Vehicle rent + cylinder karaya (customer flat rate × qty) + manual — auto-posted to
            Expenses on save.
          </p>
        </div>
      )}

      <div>
        <Label className="text-xs">Photos (optional, max 5)</Label>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <label className="h-11 rounded-md border border-dashed flex items-center justify-center gap-2 text-xs cursor-pointer hover:bg-muted/40">
            <Camera className="size-4" /> Camera
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </label>
          <label className="h-11 rounded-md border border-dashed flex items-center justify-center gap-2 text-xs cursor-pointer hover:bg-muted/40">
            <Plus className="size-4" /> Upload
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </label>
        </div>
        {photos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative size-16 rounded-md border overflow-hidden">
                <img src={URL.createObjectURL(p)} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((arr) => arr.filter((_, j) => j !== i))}
                  className="absolute top-0.5 right-0.5 size-5 rounded-full bg-black/70 text-white grid place-items-center"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <Label className="text-xs">Remarks</Label>
        <Textarea
          name="remarks"
          rows={2}
          defaultValue={editing?.remarks ?? ""}
          className="mt-1.5"
        />
      </div>
      <Button type="submit" disabled={save.isPending} className="w-full h-11">
        {save.isPending
          ? "Saving…"
          : isEdit
            ? "Update Entry"
            : type === "receive"
              ? "Record Receive"
              : "Record Delivery"}
      </Button>
    </form>
  );
}
