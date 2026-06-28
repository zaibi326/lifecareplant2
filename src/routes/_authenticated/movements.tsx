import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { ArrowDownToLine, ArrowUpFromLine, Plus, Search } from "lucide-react";
import { toast } from "sonner";

type MovType = "receive" | "deliver";

export const Route = createFileRoute("/_authenticated/movements")({
  validateSearch: (s: Record<string, unknown>) => ({ type: ((s.type as MovType) ?? "receive") as MovType }),
  head: () => ({ meta: [{ title: "Movements — GasFlow Pro" }] }),
  component: MovementsPage,
});

function MovementsPage() {
  const { type } = Route.useSearch();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["movements", type],
    queryFn: async () => {
      const { data } = await supabase
        .from("cylinder_movements")
        .select("*,customers(name),gas_types(name,color),cylinder_sizes(name)")
        .eq("type", type)
        .order("created_at", { ascending: false })
        .limit(100);
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

  const Icon = type === "receive" ? ArrowDownToLine : ArrowUpFromLine;
  const tone = type === "receive" ? "bg-brand text-brand-foreground" : "bg-primary text-primary-foreground";

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
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className={`gap-2 ${tone}`}><Plus className="size-4" /> New Entry</Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader><SheetTitle>{type === "receive" ? "Receive" : "Deliver"} Cylinders</SheetTitle></SheetHeader>
            <MovementForm type={type} onDone={() => setOpen(false)} />
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
            <div className="text-right">
              <div className="font-display font-bold">{m.quantity}</div>
              {type === "deliver" && <Badge variant="secondary" className="text-[10px] mt-1">{formatCurrency(m.total_amount)}</Badge>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MovementForm({ type, onDone }: { type: MovType; onDone: () => void }) {
  const qc = useQueryClient();
  const [customer, setCustomer] = useState("");
  const [gas, setGas] = useState("");
  const [size, setSize] = useState("");
  const [qty, setQty] = useState("");
  const [rate, setRate] = useState("");
  const [date, setDate] = useState(todayISO());

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

  const total = type === "deliver" ? Number(qty || 0) * Number(rate || 0) : null;

  const save = useMutation({
    mutationFn: async (f: FormData) => {
      if (!customer || !gas || !size || !qty) throw new Error("Customer, gas, size, qty required");
      const { error } = await supabase.from("cylinder_movements").insert({
        type,
        customer_id: customer,
        gas_type_id: gas,
        cylinder_size_id: size,
        quantity: Number(qty),
        rate: type === "deliver" ? Number(rate || 0) : null,
        total_amount: total,
        date,
        vehicle_number: String(f.get("vehicle_number") ?? "").trim() || null,
        driver_name: String(f.get("driver_name") ?? "").trim() || null,
        condition: type === "receive" ? "empty" : "filled",
        remarks: String(f.get("remarks") ?? "").trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(type === "receive" ? "Receive recorded" : "Delivery recorded");
      qc.invalidateQueries();
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    save.mutate(new FormData(e.currentTarget));
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
          <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className="mt-1.5 h-11" required />
        </div>
        <div>
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5 h-11" />
        </div>
      </div>
      {type === "deliver" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Rate (Rs / cyl)</Label>
            <Input type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} className="mt-1.5 h-11" />
          </div>
          <div>
            <Label className="text-xs">Total</Label>
            <Input value={formatCurrency(total ?? 0)} readOnly className="mt-1.5 h-11 bg-muted font-semibold" />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Vehicle #</Label>
          <Input name="vehicle_number" className="mt-1.5 h-11" />
        </div>
        <div>
          <Label className="text-xs">Driver</Label>
          <Input name="driver_name" className="mt-1.5 h-11" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Remarks</Label>
        <Textarea name="remarks" rows={2} className="mt-1.5" />
      </div>
      <Button type="submit" disabled={save.isPending} className="w-full h-11">
        {save.isPending ? "Saving…" : type === "receive" ? "Record Receive" : "Record Delivery"}
      </Button>
    </form>
  );
}
