import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Truck, Factory, Users, Wrench, Plus, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { todayISO } from "@/lib/format";

const PART_KINDS = ["valve", "spindle"] as const;
const DEFAULT_PART_SIZES = ['1"', '1.15"', '1.30"', '1.45"', '2"'];

export const Route = createFileRoute("/_authenticated/stock")({
  head: () => ({ meta: [{ title: "Stock — Life Care Plant" }] }),
  component: StockPage,
});

function StockPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["stock"],
    queryFn: async () => {
      const today = todayISO();
      const [gases, sizes, movements, openings, production, parts, partSizes, settings] = await Promise.all([
        supabase.from("gas_types").select("id,name,color").eq("active", true).order("name"),
        supabase.from("cylinder_sizes").select("id,name").eq("active", true).order("name"),
        supabase.from("cylinder_movements").select("type,quantity,gas_type_id,cylinder_size_id,date,extras"),
        supabase.from("customer_opening_balances").select("quantity,gas_type_id,cylinder_size_id,condition"),
        supabase.from("production").select("quantity,date").eq("date", today),
        supabase.from("parts_stock").select("*").order("kind").order("size"),
        supabase.from("part_sizes").select("label").eq("active", true).order("sort_order").order("label"),
        supabase.from("settings").select("plant_opening_stock").eq("id", 1).maybeSingle(),
      ]);
      return {
        gases: gases.data ?? [],
        sizes: sizes.data ?? [],
        movements: movements.data ?? [],
        openings: openings.data ?? [],
        production: production.data ?? [],
        parts: parts.data ?? [],
        partSizes: (partSizes.data ?? []).map((r: any) => String(r.label)),
        plantOpening: Number(settings.data?.plant_opening_stock ?? 0),
      };
    },
  });

  const ms: any[] = data?.movements ?? [];
  const obs: any[] = data?.openings ?? [];
  const sumBy = (filter: (m: any) => boolean) => ms.filter(filter).reduce((a, b) => a + Number(b.quantity ?? 0), 0);
  const sumOpen = (filter: (o: any) => boolean) => obs.filter(filter).reduce((a, b) => a + Number(b.quantity ?? 0), 0);

  const totalReceived = sumBy((m) => m.type === "receive");
  const totalDelivered = sumBy((m) => m.type === "deliver");
  const plantOpening = Number(data?.plantOpening ?? 0);
  const plantStock = Math.max(0, plantOpening + totalReceived - totalDelivered);
  const withCustomers = Math.max(0, totalDelivered - totalReceived);
  const todayProduction = (data?.production ?? []).reduce((a, p: any) => a + Number(p.quantity ?? 0), 0);

  // Parts used count: each extras row with kind+size = qty pieces delivered
  const partsUsed = new Map<string, number>(); // key: `${kind}::${size}`
  for (const m of ms) {
    if (m.type !== "deliver") continue;
    const arr = Array.isArray(m.extras) ? m.extras : [];
    for (const e of arr) {
      if (!e?.kind || !e?.size) continue;
      const k = `${e.kind}::${e.size}`;
      const q = Math.max(1, Number(e?.qty) || 1);
      partsUsed.set(k, (partsUsed.get(k) ?? 0) + q);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Stock Position</h1>
        <p className="text-sm text-muted-foreground mt-1">Plant stock, with customers, gas-wise aur parts breakdown.</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Package} label="In Plant" value={plantStock} tone="brand" />
        <Kpi icon={Users} label="With Customers" value={withCustomers} tone="default" />
        <Kpi icon={Truck} label="Total Movement" value={totalReceived + totalDelivered} tone="muted" />
        <Kpi icon={Factory} label="Today Production" value={todayProduction} tone="success" />
      </section>

      <section>
        <h2 className="font-display font-bold text-lg mb-3">Gas-wise Plant Stock</h2>
        {isLoading && <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>}
        {!isLoading && (data?.gases ?? []).length === 0 && (
          <Card className="p-6 text-sm text-muted-foreground">No gas types configured. Add gas types in Settings.</Card>
        )}
        <div className="grid gap-2">
          {(data?.gases ?? []).map((g: any) => {
            const r = sumBy((m) => m.type === "receive" && m.gas_type_id === g.id);
            const d = sumBy((m) => m.type === "deliver" && m.gas_type_id === g.id);
            const op = sumOpen((o) => o.gas_type_id === g.id);
            const stock = Math.max(0, r - d);
            const out = Math.max(0, op + d - r);

            return (
              <Card key={g.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg grid place-items-center text-white font-bold text-sm" style={{ background: g.color || "var(--brand)" }}>
                      {g.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold">{g.name}</div>
                      <div className="text-xs text-muted-foreground">Received {r} • Delivered {d}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-bold text-2xl">{stock}</div>
                    <Badge variant="secondary" className="text-[10px] mt-0.5">{out} with customers</Badge>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-display font-bold text-lg mb-3">By Cylinder Size</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {(data?.sizes ?? []).map((s: any) => {
            const r = sumBy((m) => m.type === "receive" && m.cylinder_size_id === s.id);
            const d = sumBy((m) => m.type === "deliver" && m.cylinder_size_id === s.id);
            return (
              <Card key={s.id} className="p-3">
                <div className="text-xs text-muted-foreground">{s.name}</div>
                <div className="font-display font-bold text-xl mt-1">{Math.max(0, r - d)}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">in plant</div>
              </Card>
            );
          })}
          {(data?.sizes ?? []).length === 0 && (
            <Card className="p-6 col-span-full text-sm text-muted-foreground">No cylinder sizes configured.</Card>
          )}
        </div>
      </section>

      <PartsStockSection
        parts={data?.parts ?? []}
        partSizes={data?.partSizes?.length ? data.partSizes : DEFAULT_PART_SIZES}
        usedMap={partsUsed}
        onChanged={() => qc.invalidateQueries({ queryKey: ["stock"] })}
      />
    </div>
  );
}

function PartsStockSection({ parts, partSizes, usedMap, onChanged }: { parts: any[]; partSizes: string[]; usedMap: Map<string, number>; onChanged: () => void }) {
  const [addOpen, setAddOpen] = useState(false);

  const upsert = useMutation({
    mutationFn: async (row: { kind: string; size: string; quantity: number }) => {
      const { error } = await supabase.from("parts_stock").upsert(row, { onConflict: "kind,size" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); onChanged(); setAddOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("parts_stock").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-bold text-lg flex items-center gap-2"><Wrench className="size-5" /> Parts Stock</h2>
        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setAddOpen((v) => !v)}>
          <Plus className="size-3.5" /> {addOpen ? "Cancel" : "Add"}
        </Button>
      </div>

      {addOpen && (
        <AddPartForm partSizes={partSizes} onSubmit={(row) => upsert.mutate(row)} pending={upsert.isPending} />
      )}

      {parts.length === 0 && !addOpen && (
        <Card className="p-6 text-sm text-muted-foreground">Koi parts stock add nahi. Upar "Add" se valve/spindle add karein.</Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
        {parts.map((p) => {
          const used = usedMap.get(`${p.kind}::${p.size}`) ?? 0;
          const avail = Number(p.quantity ?? 0) - used;
          return (
            <PartCard
              key={p.id}
              part={p}
              used={used}
              avail={avail}
              onSave={(q) => upsert.mutate({ kind: p.kind, size: p.size, quantity: q })}
              onDelete={() => del.mutate(p.id)}
            />
          );
        })}
      </div>
    </section>
  );
}

function AddPartForm({ partSizes, onSubmit, pending }: { partSizes: string[]; onSubmit: (r: { kind: string; size: string; quantity: number }) => void; pending: boolean }) {
  const [kind, setKind] = useState<string>("valve");
  const [size, setSize] = useState<string>(partSizes[0] ?? DEFAULT_PART_SIZES[0]);
  const [qty, setQty] = useState<number>(0);
  return (
    <Card className="p-3 mb-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
        <div>
          <label className="text-[11px] text-muted-foreground">Kind</label>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm">
            {PART_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Size</label>
          <select value={size} onChange={(e) => setSize(e.target.value)} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm">
            {partSizes.map((s: string) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">On-hand</label>
          <Input type="number" min={0} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="mt-1 h-9" />
        </div>
        <Button disabled={pending} onClick={() => onSubmit({ kind, size, quantity: qty })} className="h-9">
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">Same kind+size dobara add karne par quantity replace ho jayegi.</p>
    </Card>
  );
}

function PartCard({ part, used, avail, onSave, onDelete }: { part: any; used: number; avail: number; onSave: (q: number) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState<number>(Number(part.quantity ?? 0));
  const low = avail <= 0;
  return (
    <Card className={`p-3 ${low ? "border-destructive/60" : ""}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{part.kind}</div>
          <div className="font-semibold text-sm">{part.size}</div>
        </div>
        {!editing ? (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="size-7" onClick={() => { setQ(Number(part.quantity ?? 0)); setEditing(true); }}>
              <Pencil className="size-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="size-7 text-destructive" onClick={onDelete}>
              <X className="size-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="size-7 text-success" onClick={() => { onSave(q); setEditing(false); }}>
              <Check className="size-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditing(false)}>
              <X className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
      {editing ? (
        <Input type="number" min={0} value={q} onChange={(e) => setQ(Number(e.target.value))} className="mt-2 h-9" />
      ) : (
        <>
          <div className="font-display font-bold text-2xl mt-1">{Math.max(0, avail)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">on-hand {part.quantity} • used {used}</div>
          {low && <Badge variant="destructive" className="text-[10px] mt-1">Out of stock</Badge>}
        </>
      )}
    </Card>
  );
}

function Kpi({ icon: Icon, label, value, tone }: any) {
  const cls = tone === "brand" ? "bg-brand/10 text-brand" : tone === "success" ? "bg-success/15 text-success" : tone === "muted" ? "bg-muted text-foreground" : "bg-secondary text-foreground";
  return (
    <Card className="p-4">
      <div className={`size-9 rounded-lg grid place-items-center ${cls}`}><Icon className="size-4" /></div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">{label}</div>
      <div className="font-display font-bold text-2xl mt-0.5">{Number(value).toLocaleString()}</div>
    </Card>
  );
}
