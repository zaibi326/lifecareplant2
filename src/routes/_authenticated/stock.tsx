import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Truck, Factory, Users } from "lucide-react";
import { todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/stock")({
  head: () => ({ meta: [{ title: "Stock — GasFlow Pro" }] }),
  component: StockPage,
});

function StockPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["stock"],
    queryFn: async () => {
      const today = todayISO();
      const [gases, sizes, movements, openings, production] = await Promise.all([
        supabase.from("gas_types").select("id,name,color").eq("active", true).order("name"),
        supabase.from("cylinder_sizes").select("id,name").eq("active", true).order("name"),
        supabase.from("cylinder_movements").select("type,quantity,gas_type_id,cylinder_size_id,date"),
        supabase.from("customer_opening_balances").select("quantity,gas_type_id,cylinder_size_id,condition"),
        supabase.from("production").select("quantity,date").eq("date", today),
      ]);
      return {
        gases: gases.data ?? [],
        sizes: sizes.data ?? [],
        movements: movements.data ?? [],
        openings: openings.data ?? [],
        production: production.data ?? [],
      };
    },
  });

  const today = todayISO();
  const ms: any[] = data?.movements ?? [];
  const obs: any[] = data?.openings ?? [];
  const sumBy = (filter: (m: any) => boolean) => ms.filter(filter).reduce((a, b) => a + Number(b.quantity ?? 0), 0);
  const sumOpen = (filter: (o: any) => boolean) => obs.filter(filter).reduce((a, b) => a + Number(b.quantity ?? 0), 0);

  const totalReceived = sumBy((m) => m.type === "receive");
  const totalDelivered = sumBy((m) => m.type === "deliver");
  const plantStock = Math.max(0, totalReceived - totalDelivered);
  const customerOpening = sumOpen(() => true);
  const withCustomers = Math.max(0, customerOpening + totalDelivered - totalReceived);
  const todayProduction = (data?.production ?? []).reduce((a, p: any) => a + Number(p.quantity ?? 0), 0);


  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Stock Position</h1>
        <p className="text-sm text-muted-foreground mt-1">Plant stock, with customers and gas-wise breakdown.</p>
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
    </div>
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
