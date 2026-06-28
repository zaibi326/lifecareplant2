import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, todayISO } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Plus, Factory } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/production")({
  head: () => ({ meta: [{ title: "Production — GasFlow Pro" }] }),
  component: ProductionPage,
});

function ProductionPage() {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["production"],
    queryFn: async () => {
      const { data } = await supabase
        .from("production")
        .select("*,gas_types(name,color),cylinder_sizes(name)")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const total = (data ?? []).reduce((a, b: any) => a + Number(b.quantity ?? 0), 0);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Factory className="size-6" /> Filling Production
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Daily filling output by operator.</p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className="gap-2 bg-warning text-warning-foreground hover:bg-warning/90"><Plus className="size-4" /> New Production</Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader><SheetTitle>Log Production</SheetTitle></SheetHeader>
            <ProductionForm onDone={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>

      <Card className="p-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Recent total filled</div>
          <div className="font-display font-bold text-2xl mt-1">{total.toLocaleString()} cyl</div>
        </div>
        <div className="text-xs text-muted-foreground">{(data ?? []).length} logs</div>
      </Card>

      <div className="space-y-2">
        {isLoading && <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>}
        {!isLoading && (data ?? []).length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No production logged yet.</Card>}
        {(data ?? []).map((p: any) => (
          <Card key={p.id} className="p-4 flex items-center gap-3">
            <div className="size-10 rounded-lg grid place-items-center text-white font-bold text-xs" style={{ background: p.gas_types?.color || "var(--warning)" }}>
              {(p.gas_types?.name ?? "—").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{p.gas_types?.name ?? "—"} • {p.cylinder_sizes?.name ?? ""}</div>
              <div className="text-xs text-muted-foreground">
                {formatDate(p.date)}{p.operator_name ? ` • ${p.operator_name}` : ""}
              </div>
            </div>
            <div className="font-display font-bold text-xl">{p.quantity}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ProductionForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [gas, setGas] = useState("");
  const [size, setSize] = useState("");
  const [date, setDate] = useState(todayISO());

  const { data: lookups } = useQuery({
    queryKey: ["prod-lookups"],
    queryFn: async () => {
      const [g, s] = await Promise.all([
        supabase.from("gas_types").select("id,name").eq("active", true).order("name"),
        supabase.from("cylinder_sizes").select("id,name").eq("active", true).order("name"),
      ]);
      return { gases: g.data ?? [], sizes: s.data ?? [] };
    },
  });

  const save = useMutation({
    mutationFn: async (f: FormData) => {
      const qty = Number(f.get("quantity") ?? 0);
      if (!gas || !size) throw new Error("Gas and size required");
      if (!qty || qty <= 0) throw new Error("Quantity must be greater than 0");
      const { error } = await supabase.from("production").insert({
        gas_type_id: gas,
        cylinder_size_id: size,
        quantity: qty,
        date,
        operator_name: String(f.get("operator_name") ?? "").trim() || null,
        remarks: String(f.get("remarks") ?? "").trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Production logged");
      qc.invalidateQueries();
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(new FormData(e.currentTarget)); }} className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Gas*</Label>
          <Select value={gas} onValueChange={setGas}>
            <SelectTrigger className="mt-1.5 h-11"><SelectValue placeholder="Gas" /></SelectTrigger>
            <SelectContent>{lookups?.gases.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Size*</Label>
          <Select value={size} onValueChange={setSize}>
            <SelectTrigger className="mt-1.5 h-11"><SelectValue placeholder="Size" /></SelectTrigger>
            <SelectContent>{lookups?.sizes.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Quantity*</Label>
          <Input name="quantity" type="number" min={1} required className="mt-1.5 h-11" />
        </div>
        <div>
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5 h-11" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Operator</Label>
        <Input name="operator_name" className="mt-1.5 h-11" />
      </div>
      <div>
        <Label className="text-xs">Remarks</Label>
        <Textarea name="remarks" rows={2} className="mt-1.5" />
      </div>
      <Button type="submit" disabled={save.isPending} className="w-full h-11 bg-warning text-warning-foreground hover:bg-warning/90">
        {save.isPending ? "Saving…" : "Save Production"}
      </Button>
    </form>
  );
}
