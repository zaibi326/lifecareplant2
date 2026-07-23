import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Package,
  Truck,
  Factory,
  Users,
  Wrench,
  Plus,
  Pencil,
  Check,
  X,
  Fuel,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

import { toast } from "sonner";
import { todayISO } from "@/lib/format";
import { buildBulkBalances, formatM3, gasConsumed } from "@/lib/bulk-gas";

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
      const [
        gases,
        sizes,
        movements,
        openings,
        production,
        parts,
        partSizes,
        customers,
        purchases,
        allProduction,
        settings,
        localFillings,
      ] = await Promise.all([
        supabase.from("gas_types").select("id,name,color").eq("active", true).order("name"),
        supabase
          .from("cylinder_sizes")
          .select("id,name,capacity,capacity_unit")
          .eq("active", true)
          .order("name"),
        supabase
          .from("cylinder_movements")
          .select("type,quantity,gas_type_id,cylinder_size_id,date,extras,customer_id,condition"),
        supabase
          .from("customer_opening_balances")
          .select("quantity,gas_type_id,cylinder_size_id,condition"),
        supabase.from("production").select("quantity,date,gas_type_id,cylinder_size_id"),

        supabase.from("parts_stock").select("*").order("kind").order("size"),
        supabase
          .from("part_sizes")
          .select("label")
          .eq("active", true)
          .order("sort_order")
          .order("label"),
        supabase.from("customers").select("id,opening_cylinders"),
        supabase.from("gas_purchases").select("gas_type_id,cubic_meter"),
        supabase.from("production").select("gas_type_id,gas_consumed"),
        supabase.from("settings").select("total_owned_cylinders").eq("id", 1).maybeSingle(),
        supabase.from("local_fillings").select("gas_type_id,gas_consumed"),
      ]);
      return {
        gases: gases.data ?? [],
        sizes: sizes.data ?? [],
        movements: movements.data ?? [],
        openings: openings.data ?? [],
        production: production.data ?? [],
        parts: parts.data ?? [],
        partSizes: (partSizes.data ?? []).map((r: any) => String(r.label)),
        customers: customers.data ?? [],
        purchases: purchases.data ?? [],
        allProduction: allProduction.data ?? [],
        localFillings: localFillings.data ?? [],
        totalOwned: Number(settings.data?.total_owned_cylinders ?? 0),
      };
    },
  });

  const ms: any[] = data?.movements ?? [];
  const obs: any[] = data?.openings ?? [];
  const sumBy = (filter: (m: any) => boolean) =>
    ms.filter(filter).reduce((a, b) => a + Number(b.quantity ?? 0), 0);
  const sumOpen = (filter: (o: any) => boolean) =>
    obs.filter(filter).reduce((a, b) => a + Number(b.quantity ?? 0), 0);

  const totalReceived = sumBy((m) => m.type === "receive");
  const totalDelivered = sumBy((m) => m.type === "deliver");
  // Plant stock = received - delivered (opening cylinders are with parties, not in plant)
  const plantStock = Math.max(0, totalReceived - totalDelivered);
  // With customers = per-party max(0, opening + delivered − received) summed
  const perCust = new Map<string, { op: number; d: number; r: number }>();
  for (const c of data?.customers ?? []) {
    perCust.set(c.id, { op: Number(c.opening_cylinders ?? 0), d: 0, r: 0 });
  }
  for (const m of ms) {
    if (!m.customer_id) continue;
    const e = perCust.get(m.customer_id) ?? { op: 0, d: 0, r: 0 };
    if (m.type === "deliver") e.d += Number(m.quantity ?? 0);
    else if (m.type === "receive") e.r += Number(m.quantity ?? 0);
    perCust.set(m.customer_id, e);
  }
  let withCustomers = 0;
  for (const v of perCust.values()) withCustomers += Math.max(0, v.op - v.d + v.r);

  const todayProduction = (data?.production ?? []).reduce(
    (a, p: any) => a + Number(p.quantity ?? 0),
    0,
  );

  // Reconciliation: Owned fleet should equal Plant + Customers.
  const totalOwned = Number(data?.totalOwned ?? 0);
  const trackedTotal = plantStock + withCustomers;
  const reconDiff = totalOwned - trackedTotal;
  const reconConfigured = totalOwned > 0;

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

  // Gas × Size matrix
  const gasSizeRows = (data?.gases ?? []).map((g: any) => {
    const sizes = (data?.sizes ?? []).map((s: any) => {
      const r = sumBy(
        (m) => m.type === "receive" && m.gas_type_id === g.id && m.cylinder_size_id === s.id,
      );
      const d = sumBy(
        (m) => m.type === "deliver" && m.gas_type_id === g.id && m.cylinder_size_id === s.id,
      );
      const op = sumOpen((o) => o.gas_type_id === g.id && o.cylinder_size_id === s.id);
      const plant = Math.max(0, r - d);
      const customers = Math.max(0, op + d - r);
      const total = plant + customers;
      return {
        size: s.name,
        plant,
        customers,
        total,
        active: plant > 0 || customers > 0 || op > 0,
      };
    });
    const totals = sizes.reduce(
      (a: any, x: any) => ({
        plant: a.plant + x.plant,
        customers: a.customers + x.customers,
        total: a.total + x.total,
      }),
      { plant: 0, customers: 0, total: 0 },
    );
    return { gas: g, sizes: sizes.filter((s: any) => s.active), totals };
  });

  // Plant condition matrix (Filled / Empty / Unknown) per gas × size.
  // Model: production adds filled cylinders; receives bring cylinders in by their
  // recorded condition; delivers send filled cylinders out; production consumes empties.
  const prod: any[] = data?.production ?? [];
  const prodBy = (gid: string, sid: string) =>
    prod
      .filter((p) => p.gas_type_id === gid && p.cylinder_size_id === sid)
      .reduce((a, b) => a + Number(b.quantity ?? 0), 0);
  const plantMatrix = (data?.gases ?? [])
    .map((g: any) => {
      const rows = (data?.sizes ?? []).map((s: any) => {
        const recFilled = sumBy(
          (m) =>
            m.type === "receive" &&
            m.gas_type_id === g.id &&
            m.cylinder_size_id === s.id &&
            m.condition === "filled",
        );
        const recEmpty = sumBy(
          (m) =>
            m.type === "receive" &&
            m.gas_type_id === g.id &&
            m.cylinder_size_id === s.id &&
            m.condition === "empty",
        );
        const recUnknown = sumBy(
          (m) =>
            m.type === "receive" &&
            m.gas_type_id === g.id &&
            m.cylinder_size_id === s.id &&
            (m.condition === "unknown" || m.condition == null),
        );
        const delivered = sumBy(
          (m) => m.type === "deliver" && m.gas_type_id === g.id && m.cylinder_size_id === s.id,
        );
        const produced = prodBy(g.id, s.id);
        const filled = Math.max(0, produced + recFilled - delivered);
        const empty = Math.max(0, recEmpty - produced);
        const unknown = Math.max(0, recUnknown);
        const total = filled + empty + unknown;
        return { size: s.name, filled, empty, unknown, total, active: total > 0 };
      });
      const totals = rows.reduce(
        (a: any, x: any) => ({
          filled: a.filled + x.filled,
          empty: a.empty + x.empty,
          unknown: a.unknown + x.unknown,
          total: a.total + x.total,
        }),
        { filled: 0, empty: 0, unknown: 0, total: 0 },
      );
      return { gas: g, rows: rows.filter((r: any) => r.active), totals };
    })
    .filter((m: any) => m.totals.total > 0);

  const plantTotals = plantMatrix.reduce(
    (a: any, m: any) => ({
      filled: a.filled + m.totals.filled,
      empty: a.empty + m.totals.empty,
      unknown: a.unknown + m.totals.unknown,
      total: a.total + m.totals.total,
    }),
    { filled: 0, empty: 0, unknown: 0, total: 0 },
  );

  // Bulk gas inventory = purchased − consumed (m³) per gas type.
  // Auto-consumption (production, local filling, delivered filled cylinders) applies to OXYGEN only.
  const sizeById = new Map<string, { capacity: number | null; capacity_unit: string | null }>();
  for (const s of data?.sizes ?? [])
    sizeById.set(s.id, { capacity: (s as any).capacity, capacity_unit: (s as any).capacity_unit });

  const oxygenGasIds = new Set(
    (data?.gases ?? []).filter((g: any) => /oxygen/i.test(g.name)).map((g: any) => g.id),
  );
  const isOxygen = (gasId: string | null | undefined) => !!gasId && oxygenGasIds.has(gasId);

  const allProduction = ((data?.allProduction ?? []) as any[]).filter((r: any) => isOxygen(r.gas_type_id));
  const allLocalFillings = ((data?.localFillings ?? []) as any[]).filter((r: any) => isOxygen(r.gas_type_id));
  const allDeliveries = ((data?.movements ?? []) as any[])
    .filter((m: any) => m.type === "deliver" && m.condition === "filled" && isOxygen(m.gas_type_id))
    .map((m: any) => {
      const sz = sizeById.get(m.cylinder_size_id);
      return {
        gas_type_id: m.gas_type_id,
        gas_consumed: gasConsumed(sz?.capacity ?? 0, m.quantity, sz?.capacity_unit ?? "m3"),
      };
    });

  const bulkConsumers = [...allProduction, ...allLocalFillings, ...allDeliveries];

  const bulkBalances = buildBulkBalances(data?.purchases ?? [], bulkConsumers);

  const gasInfoById = new Map<string, { name: string; color: string | null }>();
  for (const g of data?.gases ?? []) gasInfoById.set(g.id, { name: g.name, color: g.color });
  const bulkRows = Array.from(bulkBalances.entries())
    .map(([id, v]) => ({
      id,
      name: gasInfoById.get(id)?.name ?? "Gas",
      color: gasInfoById.get(id)?.color ?? null,
      ...v,
    }))
    .sort((a, b) => b.remaining - a.remaining);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
          Stock Position
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gas × size wise plant, customers aur total breakdown.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Package} label="In Plant" value={plantStock} tone="brand" />
        <Kpi icon={Users} label="With Customers" value={withCustomers} tone="default" />
        <Kpi
          icon={Truck}
          label="Total Movement"
          value={totalReceived + totalDelivered}
          tone="muted"
        />
        <Kpi icon={Factory} label="Today Production" value={todayProduction} tone="success" />
      </section>

      <section>
        {reconConfigured ? (
          <Card
            className={`p-4 ${reconDiff === 0 ? "border-success/50 bg-success/5" : "border-destructive/60 bg-destructive/5"}`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`size-10 rounded-xl grid place-items-center shrink-0 ${reconDiff === 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}
              >
                {reconDiff === 0 ? (
                  <ShieldCheck className="size-5" />
                ) : (
                  <AlertTriangle className="size-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold">Stock Reconciliation</div>
                <div className="text-xs text-muted-foreground">
                  Owned <b>{totalOwned.toLocaleString()}</b> = Plant{" "}
                  <b className="text-brand">{plantStock.toLocaleString()}</b> + Customers{" "}
                  <b className="text-warning">{withCustomers.toLocaleString()}</b> (tracked{" "}
                  {trackedTotal.toLocaleString()})
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Difference
                </div>
                <div
                  className={`font-display font-bold text-2xl ${reconDiff === 0 ? "text-success" : "text-destructive"}`}
                >
                  {reconDiff > 0 ? "+" : ""}
                  {reconDiff.toLocaleString()}
                </div>
              </div>
            </div>
            {reconDiff !== 0 && (
              <p className="text-xs text-destructive mt-3">
                ⚠ Mismatch of {Math.abs(reconDiff).toLocaleString()} cylinders.{" "}
                {reconDiff > 0
                  ? "Owned count is higher than tracked — some cylinders are unaccounted (missing movements or opening balances)."
                  : "Tracked count exceeds owned fleet — check for duplicate receives or an outdated owned count in Settings."}
              </p>
            )}
          </Card>
        ) : (
          <Card className="p-4 text-xs text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="size-4 shrink-0" />
            Set your total owned cylinder fleet in <b>Settings → Company</b> to enable stock
            reconciliation (Owned = Plant + Customers).
          </Card>
        )}
      </section>

      {plantMatrix.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-lg flex items-center gap-2">
              <Package className="size-5" /> Plant Stock Matrix
            </h2>
            <div className="text-xs text-muted-foreground">
              <span className="text-success font-semibold">{plantTotals.filled}</span> filled •
              <span className="text-muted-foreground font-semibold"> {plantTotals.empty}</span>{" "}
              empty •<span className="text-warning font-semibold"> {plantTotals.unknown}</span>{" "}
              unknown
            </div>
          </div>
          <div className="grid gap-3">
            {plantMatrix.map(({ gas, rows, totals }: any) => (
              <Card key={gas.id} className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="size-9 rounded-xl grid place-items-center text-white font-bold text-sm shrink-0"
                    style={{ background: gas.color || "var(--brand)" }}
                  >
                    {gas.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="font-display font-bold">{gas.name}</div>
                  <div className="ml-auto text-[10px] text-muted-foreground uppercase tracking-wider">
                    In-plant {totals.total}
                  </div>
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <div className="grid grid-cols-5 bg-muted/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-2">
                    <span>Size</span>
                    <span className="text-right">Filled</span>
                    <span className="text-right">Empty</span>
                    <span className="text-right">Unknown</span>
                    <span className="text-right">Total</span>
                  </div>
                  {rows.map((row: any, i: number) => (
                    <div
                      key={i}
                      className="grid grid-cols-5 items-center px-3 py-2.5 text-sm border-t"
                    >
                      <span className="font-medium truncate">{row.size}</span>
                      <span className="text-right font-display font-bold text-success">
                        {row.filled}
                      </span>
                      <span className="text-right font-display font-bold text-muted-foreground">
                        {row.empty}
                      </span>
                      <span className="text-right font-display font-bold text-warning">
                        {row.unknown}
                      </span>
                      <span className="text-right font-display font-bold">{row.total}</span>
                    </div>
                  ))}
                  <div className="grid grid-cols-5 items-center px-3 py-2 text-sm border-t bg-muted/30 font-bold">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Total
                    </span>
                    <span className="text-right text-success">{totals.filled}</span>
                    <span className="text-right text-muted-foreground">{totals.empty}</span>
                    <span className="text-right text-warning">{totals.unknown}</span>
                    <span className="text-right">{totals.total}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display font-bold text-lg mb-3">Gas-wise Breakdown</h2>

        {isLoading && <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>}

        {!isLoading && gasSizeRows.length === 0 && (
          <Card className="p-6 text-sm text-muted-foreground">
            No gas types configured. Add gas types in Settings.
          </Card>
        )}
        <div className="grid gap-3">
          {gasSizeRows.map(({ gas, sizes, totals }: any) => (
            <Card key={gas.id} className="p-4">
              <div className="flex items-center justify-between mb-3 gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="size-10 rounded-xl grid place-items-center text-white font-bold text-sm shrink-0"
                    style={{ background: gas.color || "var(--brand)" }}
                  >
                    {gas.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-display font-bold truncate">{gas.name}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Total {totals.total} cyl
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-muted-foreground">Plant / Cust</div>
                  <div className="font-display font-bold text-sm">
                    <span className="text-brand">{totals.plant}</span> /{" "}
                    <span className="text-warning">{totals.customers}</span>
                  </div>
                </div>
              </div>
              {sizes.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2">
                  Is gas ka koi stock ya movement nahi.
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <div className="grid grid-cols-4 bg-muted/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-2">
                    <span>Size</span>
                    <span className="text-right">Plant</span>
                    <span className="text-right">Customers</span>
                    <span className="text-right">Total</span>
                  </div>
                  {sizes.map((row: any, i: number) => (
                    <div
                      key={i}
                      className="grid grid-cols-4 items-center px-3 py-2.5 text-sm border-t"
                    >
                      <span className="font-medium truncate">{row.size}</span>
                      <span className="text-right font-display font-bold text-brand">
                        {row.plant}
                      </span>
                      <span className="text-right font-display font-bold text-warning">
                        {row.customers}
                      </span>
                      <span className="text-right font-display font-bold">{row.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display font-bold text-lg mb-3 flex items-center gap-2">
          <Fuel className="size-5" /> Bulk Gas Inventory
        </h2>
        {bulkRows.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            No gas purchases recorded yet. Record purchases to track bulk gas.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {bulkRows.map((b) => {
              const low = b.remaining <= 0;
              return (
                <Card key={b.id} className={`p-4 ${low ? "border-destructive/60" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div
                      className="size-10 rounded-xl grid place-items-center text-white font-bold text-sm shrink-0"
                      style={{ background: b.color || "var(--brand)" }}
                    >
                      {b.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold truncate">{b.name}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        In {formatM3(b.purchased)} • Used {formatM3(b.consumed)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`font-display font-bold text-xl ${low ? "text-destructive" : "text-brand"}`}
                      >
                        {formatM3(b.remaining)}
                      </div>
                      {low && (
                        <Badge variant="destructive" className="text-[10px] mt-0.5">
                          Depleted
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
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

function PartsStockSection({
  parts,
  partSizes,
  usedMap,
  onChanged,
}: {
  parts: any[];
  partSizes: string[];
  usedMap: Map<string, number>;
  onChanged: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);

  const upsert = useMutation({
    mutationFn: async (row: { kind: string; size: string; quantity: number }) => {
      const { error } = await supabase.from("parts_stock").upsert(row, { onConflict: "kind,size" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      onChanged();
      setAddOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("parts_stock").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      onChanged();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-bold text-lg flex items-center gap-2">
          <Wrench className="size-5" /> Parts Stock
        </h2>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1"
          onClick={() => setAddOpen((v) => !v)}
        >
          <Plus className="size-3.5" /> {addOpen ? "Cancel" : "Add"}
        </Button>
      </div>

      {addOpen && (
        <AddPartForm
          partSizes={partSizes}
          onSubmit={(row) => upsert.mutate(row)}
          pending={upsert.isPending}
        />
      )}

      {parts.length === 0 && !addOpen && (
        <Card className="p-6 text-sm text-muted-foreground">
          Koi parts stock add nahi. Upar "Add" se valve/spindle add karein.
        </Card>
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

function AddPartForm({
  partSizes,
  onSubmit,
  pending,
}: {
  partSizes: string[];
  onSubmit: (r: { kind: string; size: string; quantity: number }) => void;
  pending: boolean;
}) {
  const [kind, setKind] = useState<string>("valve");
  const [size, setSize] = useState<string>(partSizes[0] ?? DEFAULT_PART_SIZES[0]);
  const [qty, setQty] = useState<number>(0);
  return (
    <Card className="p-3 mb-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
        <div>
          <label className="text-[11px] text-muted-foreground">Kind</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            {PART_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Size</label>
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            {partSizes.map((s: string) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">On-hand</label>
          <Input
            type="number"
            min={0}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="mt-1 h-9"
          />
        </div>
        <Button
          disabled={pending}
          onClick={() => onSubmit({ kind, size, quantity: qty })}
          className="h-9"
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">
        Same kind+size dobara add karne par quantity replace ho jayegi.
      </p>
    </Card>
  );
}

function PartCard({
  part,
  used,
  avail,
  onSave,
  onDelete,
}: {
  part: any;
  used: number;
  avail: number;
  onSave: (q: number) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState<number>(Number(part.quantity ?? 0));
  const low = avail <= 0;
  return (
    <Card className={`p-3 ${low ? "border-destructive/60" : ""}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {part.kind}
          </div>
          <div className="font-semibold text-sm">{part.size}</div>
        </div>
        {!editing ? (
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={() => {
                setQ(Number(part.quantity ?? 0));
                setEditing(true);
              }}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-destructive"
              onClick={onDelete}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-success"
              onClick={() => {
                onSave(q);
                setEditing(false);
              }}
            >
              <Check className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={() => setEditing(false)}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
      {editing ? (
        <Input
          type="number"
          min={0}
          value={q}
          onChange={(e) => setQ(Number(e.target.value))}
          className="mt-2 h-9"
        />
      ) : (
        <>
          <div className="font-display font-bold text-2xl mt-1">{Math.max(0, avail)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            on-hand {part.quantity} • used {used}
          </div>
          {low && (
            <Badge variant="destructive" className="text-[10px] mt-1">
              Out of stock
            </Badge>
          )}
        </>
      )}
    </Card>
  );
}

function Kpi({ icon: Icon, label, value, tone }: any) {
  const cls =
    tone === "brand"
      ? "bg-brand/10 text-brand"
      : tone === "success"
        ? "bg-success/15 text-success"
        : tone === "muted"
          ? "bg-muted text-foreground"
          : "bg-secondary text-foreground";
  return (
    <Card className="p-4">
      <div className={`size-9 rounded-lg grid place-items-center ${cls}`}>
        <Icon className="size-4" />
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">{label}</div>
      <div className="font-display font-bold text-2xl mt-0.5">{Number(value).toLocaleString()}</div>
    </Card>
  );
}
