import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import { formatM3, toCubicMeter, DEFAULT_OXYGEN_FACTOR } from "@/lib/bulk-gas";
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
import { Plus, PackagePlus, Search, MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/purchases")({
  head: () => ({ meta: [{ title: "Gas Purchases — Life Care Plant" }] }),
  component: PurchasesPage,
});

function PurchasesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["gas-purchases"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gas_purchases")
        .select("*,suppliers(name),gas_types(name,color)")
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
      (p: any) =>
        (p.suppliers?.name ?? "").toLowerCase().includes(s) ||
        (p.gas_types?.name ?? "").toLowerCase().includes(s) ||
        (p.invoice_number ?? "").toLowerCase().includes(s),
    );
  }, [data, q]);

  const totalM3 = (filtered as any[]).reduce((a, p) => a + Number(p.cubic_meter ?? 0), 0);
  const totalAmt = (filtered as any[]).reduce((a, p) => a + Number(p.total_amount ?? 0), 0);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gas_purchases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Purchase deleted");
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
            <PackagePlus className="size-6" /> Gas Purchases
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bulk gas received from suppliers. KG auto-converts to m³.
          </p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" /> New Purchase
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Record Gas Purchase</SheetTitle>
            </SheetHeader>
            <PurchaseForm onDone={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>

      <Card className="p-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Purchased (filtered)
          </div>
          <div className="font-display font-bold text-2xl mt-1">{formatM3(totalM3)}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Value</div>
          <div className="font-display font-bold text-xl mt-1">{formatCurrency(totalAmt)}</div>
        </div>
      </Card>

      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search supplier / gas / invoice"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      <div className="space-y-2">
        {isLoading && <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>}
        {!isLoading && filtered.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">No purchases yet.</Card>
        )}
        {(filtered as any[]).map((p) => (
          <Card key={p.id} className="p-4 flex items-center gap-3">
            <div
              className="size-10 rounded-lg grid place-items-center text-white font-bold text-xs"
              style={{ background: p.gas_types?.color || "var(--brand)" }}
            >
              {(p.gas_types?.name ?? "—").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">
                {p.gas_types?.name ?? "—"} • {p.suppliers?.name ?? "No supplier"}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {formatDate(p.date)} • {formatM3(p.cubic_meter)}
                {p.unit === "kg"
                  ? ` (${Number(p.kg ?? p.quantity).toLocaleString()} kg × ${p.conversion_factor ?? DEFAULT_OXYGEN_FACTOR})`
                  : ""}
                {p.tank_number ? ` • Tank ${p.tank_number}` : ""}
                {p.invoice_number ? ` • ${p.invoice_number}` : ""}
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
              <div className="font-display font-bold">{formatM3(p.cubic_meter)}</div>
              <Badge variant="secondary" className="text-[10px]">
                {formatCurrency(p.total_amount)}
              </Badge>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9 shrink-0">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setDeleteId(p.id)}
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
            <AlertDialogTitle>Delete purchase?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reduce bulk gas inventory for this gas type.
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

function PurchaseForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [supplier, setSupplier] = useState("");
  const [gas, setGas] = useState("");
  const [unit, setUnit] = useState<"m3" | "kg">("m3");
  const [quantity, setQuantity] = useState<number>(0);
  const [rate, setRate] = useState<number>(0);
  const [rateBasis, setRateBasis] = useState<"unit" | "m3">("unit");
  const [date, setDate] = useState(todayISO());

  const { data: lookups } = useQuery({
    queryKey: ["purchase-lookups"],
    queryFn: async () => {
      const [s, g, st] = await Promise.all([
        supabase.from("suppliers").select("id,name").eq("active", true).order("name"),
        supabase.from("gas_types").select("id,name").eq("active", true).order("name"),
        supabase.from("settings").select("oxygen_conversion_factor").eq("id", 1).maybeSingle(),
      ]);
      return {
        suppliers: s.data ?? [],
        gases: g.data ?? [],
        factor: Number(st.data?.oxygen_conversion_factor ?? DEFAULT_OXYGEN_FACTOR),
      };
    },
  });

  const factor = lookups?.factor ?? DEFAULT_OXYGEN_FACTOR;
  const gasName = (lookups?.gases ?? []).find((g: any) => g.id === gas)?.name?.toLowerCase() ?? "";
  const isOxygenKg = gasName.includes("oxygen") && unit === "kg";
  const cubicMeter = toCubicMeter(quantity, unit, factor);
  const total = (rateBasis === "m3" ? cubicMeter : Number(quantity) || 0) * (Number(rate) || 0);

  const save = useMutation({
    mutationFn: async (f: FormData) => {
      if (!gas) throw new Error("Gas type required");
      if (!quantity || quantity <= 0) throw new Error("Quantity must be greater than 0");
      const payload = {
        date,
        supplier_id: supplier || null,
        gas_type_id: gas,
        quantity: Number(quantity),
        unit,
        cubic_meter: cubicMeter,
        kg: unit === "kg" ? Number(quantity) : null,
        conversion_factor: unit === "kg" ? factor : null,
        purchase_rate: Number(rate) || null,
        total_amount: total || null,
        invoice_number: String(f.get("invoice_number") ?? "").trim() || null,
        tank_number: String(f.get("tank_number") ?? "").trim() || null,
        remarks: String(f.get("remarks") ?? "").trim() || null,
      };
      const { error } = await supabase.from("gas_purchases").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Purchase recorded — bulk inventory updated");
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
        <Label className="text-xs">Supplier</Label>
        <Select value={supplier} onValueChange={setSupplier}>
          <SelectTrigger className="mt-1.5 h-11">
            <SelectValue placeholder="Select supplier" />
          </SelectTrigger>
          <SelectContent>
            {(lookups?.suppliers ?? []).map((s: any) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Gas Type*</Label>
        <Select value={gas} onValueChange={setGas}>
          <SelectTrigger className="mt-1.5 h-11">
            <SelectValue placeholder="Select gas" />
          </SelectTrigger>
          <SelectContent>
            {(lookups?.gases ?? []).map((g: any) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Quantity Received*</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={quantity || ""}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="mt-1.5 h-11"
          />
        </div>
        <div>
          <Label className="text-xs">Unit</Label>
          <Select value={unit} onValueChange={(v: any) => setUnit(v)}>
            <SelectTrigger className="mt-1.5 h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="m3">Cubic Meter (m³)</SelectItem>
              <SelectItem value="kg">Kilogram (KG)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {unit === "kg" && (
        <div className="rounded-lg border p-3 bg-muted/30 text-xs">
          {isOxygenKg ? (
            <>
              Oxygen KG → m³ using factor <b>{factor}</b>. Converted: <b>{formatM3(cubicMeter)}</b>
            </>
          ) : (
            <>
              KG entered. Stored as <b>{formatM3(cubicMeter)}</b> using factor <b>{factor}</b>.
              (Configure factor in Settings.)
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Rate Basis</Label>
          <Select value={rateBasis} onValueChange={(v: any) => setRateBasis(v)}>
            <SelectTrigger className="mt-1.5 h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unit">Per {unit}</SelectItem>
              <SelectItem value="m3">Per m³</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">
            Purchase Rate (per {rateBasis === "m3" ? "m³" : unit})
          </Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={rate || ""}
            onChange={(e) => setRate(Number(e.target.value))}
            className="mt-1.5 h-11"
          />
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Invoice #</Label>
          <Input name="invoice_number" className="mt-1.5 h-11" />
        </div>
        <div>
          <Label className="text-xs">Tank # (optional)</Label>
          <Input name="tank_number" className="mt-1.5 h-11" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Remarks</Label>
        <Textarea name="remarks" rows={2} className="mt-1.5" />
      </div>

      <div className="flex items-center justify-between border-t pt-3">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Total</span>
        <span className="font-display font-bold text-lg">{formatCurrency(total)}</span>
      </div>

      <Button type="submit" disabled={save.isPending} className="w-full h-11">
        {save.isPending ? "Saving…" : "Save Purchase"}
      </Button>
    </form>
  );
}
