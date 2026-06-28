import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Phone, MapPin, Users as UsersIcon, Wallet, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "Customers — GasFlow Pro" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["customers-with-balance"],
    queryFn: async () => {
      const [{ data: cs }, { data: ms }, { data: ps }] = await Promise.all([
        supabase.from("customers").select("*").order("name"),
        supabase.from("cylinder_movements").select("customer_id,type,quantity,total_amount"),
        supabase.from("payments").select("customer_id,amount"),
      ]);
      const map = new Map<string, { out: number; due: number }>();
      (cs ?? []).forEach((c) => map.set(c.id, { out: c.opening_cylinders ?? 0, due: Number(c.opening_due ?? 0) }));
      (ms ?? []).forEach((m: any) => {
        const e = map.get(m.customer_id);
        if (!e) return;
        if (m.type === "deliver") {
          e.out += Number(m.quantity ?? 0);
          e.due += Number(m.total_amount ?? 0);
        } else {
          e.out -= Number(m.quantity ?? 0);
        }
      });
      (ps ?? []).forEach((p: any) => {
        const e = map.get(p.customer_id);
        if (!e) return;
        e.due -= Number(p.amount ?? 0);
      });
      return (cs ?? []).map((c) => ({ ...c, balance: map.get(c.id)! }));
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data ?? [];
    return (data ?? []).filter((c: any) => c.name.toLowerCase().includes(s) || (c.phone ?? "").includes(s));
  }, [data, q]);

  const totals = useMemo(() => {
    const out = (filtered ?? []).reduce((a: number, c: any) => a + c.balance.out, 0);
    const due = (filtered ?? []).reduce((a: number, c: any) => a + c.balance.due, 0);
    return { out, due, count: filtered.length };
  }, [filtered]);

  const create = useMutation({
    mutationFn: async (vals: any) => {
      const { error } = await supabase.from("customers").insert(vals);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Customer added");
      qc.invalidateQueries({ queryKey: ["customers-with-balance"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    create.mutate({
      name: String(f.get("name") ?? "").trim(),
      phone: String(f.get("phone") ?? "").trim() || null,
      address: String(f.get("address") ?? "").trim() || null,
      category: String(f.get("category") ?? "").trim() || null,
      opening_cylinders: Number(f.get("opening_cylinders") ?? 0),
      opening_due: Number(f.get("opening_due") ?? 0),
      notes: String(f.get("notes") ?? "").trim() || null,
    });
  };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage clients, balances and dues.</p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className="gap-2"><Plus className="size-4" /> New Customer</Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader><SheetTitle>New Customer</SheetTitle></SheetHeader>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <Field label="Name" name="name" required />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone" name="phone" />
                <Field label="Category" name="category" placeholder="Industrial / Medical" />
              </div>
              <Field label="Address" name="address" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Opening Cylinders" name="opening_cylinders" type="number" defaultValue="0" />
                <Field label="Opening Due (Rs)" name="opening_due" type="number" defaultValue="0" />
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea name="notes" rows={2} className="mt-1.5" />
              </div>
              <Button type="submit" disabled={create.isPending} className="w-full h-11">
                {create.isPending ? "Saving…" : "Save Customer"}
              </Button>
            </form>
          </SheetContent>
        </Sheet>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat icon={UsersIcon} label="Customers" value={totals.count.toLocaleString()} tone="default" />
        <Stat icon={Package} label="Cylinders Out" value={totals.out.toLocaleString()} tone="brand" />
        <Stat icon={Wallet} label="Outstanding" value={formatCurrency(totals.due)} tone="warn" />
      </div>

      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name or phone" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-11" />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No customers yet. Add your first customer.</Card>}
        {filtered.map((c: any) => (
          <Link key={c.id} to={"/customers" as any} className="block">
            <Card className="p-4 flex items-center gap-3 hover:bg-muted/40 transition-colors">
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
            </Card>
          </Link>
        ))}
      </div>
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

function Stat({ icon: Icon, label, value, tone }: any) {
  const toneCls = tone === "brand" ? "bg-brand/10 text-brand" : tone === "warn" ? "bg-warning/15 text-warning" : "bg-muted text-foreground";
  return (
    <Card className="p-3">
      <div className={`size-8 rounded-lg grid place-items-center ${toneCls}`}><Icon className="size-4" /></div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">{label}</div>
      <div className="font-display font-bold text-lg mt-0.5 truncate">{value}</div>
    </Card>
  );
}
