import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Building2, Flame, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — GasFlow Pro" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Company, gas types, cylinder sizes.</p>
      </header>

      <Tabs defaultValue="company" className="w-full">
        <TabsList className="grid grid-cols-3 w-full h-11">
          <TabsTrigger value="company" className="gap-2"><Building2 className="size-4" /> Company</TabsTrigger>
          <TabsTrigger value="gases" className="gap-2"><Flame className="size-4" /> Gases</TabsTrigger>
          <TabsTrigger value="sizes" className="gap-2"><Package className="size-4" /> Sizes</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-5">
          <CompanyForm />
        </TabsContent>
        <TabsContent value="gases" className="mt-5">
          <GasTypesPanel />
        </TabsContent>
        <TabsContent value="sizes" className="mt-5">
          <SizesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CompanyForm() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (vals: any) => {
      const { error } = await supabase.from("settings").upsert({ id: 1, ...vals });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate({
      company_name: String(f.get("company_name") ?? "").trim() || null,
      company_phone: String(f.get("company_phone") ?? "").trim() || null,
      company_address: String(f.get("company_address") ?? "").trim() || null,
      currency: String(f.get("currency") ?? "Rs").trim() || "Rs",
      invoice_prefix: String(f.get("invoice_prefix") ?? "").trim() || null,
      invoice_footer: String(f.get("invoice_footer") ?? "").trim() || null,
      tax_percent: Number(f.get("tax_percent") ?? 0),
    });
  };

  return (
    <Card className="p-5">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Company Name" name="company_name" defaultValue={data?.company_name ?? ""} />
          <Field label="Phone" name="company_phone" defaultValue={data?.company_phone ?? ""} />
        </div>
        <div>
          <Label className="text-xs">Address</Label>
          <Textarea name="company_address" defaultValue={data?.company_address ?? ""} rows={2} className="mt-1.5" />
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Currency" name="currency" defaultValue={data?.currency ?? "Rs"} />
          <Field label="Invoice Prefix" name="invoice_prefix" defaultValue={data?.invoice_prefix ?? "INV-"} />
          <Field label="Tax %" name="tax_percent" type="number" defaultValue={String(data?.tax_percent ?? 0)} />
        </div>
        <div>
          <Label className="text-xs">Invoice Footer</Label>
          <Textarea name="invoice_footer" defaultValue={data?.invoice_footer ?? ""} rows={2} className="mt-1.5" />
        </div>
        <Button type="submit" disabled={save.isPending} className="h-11">
          {save.isPending ? "Saving…" : "Save Settings"}
        </Button>
      </form>
    </Card>
  );
}

function GasTypesPanel() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#2563eb");

  const { data } = useQuery({
    queryKey: ["gas_types"],
    queryFn: async () => (await supabase.from("gas_types").select("*").order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name required");
      const { error } = await supabase.from("gas_types").insert({ name: name.trim(), color, active: true });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gas type added");
      setName("");
      qc.invalidateQueries({ queryKey: ["gas_types"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (g: any) => {
      const { error } = await supabase.from("gas_types").update({ active: !g.active }).eq("id", g.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gas_types"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gas_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["gas_types"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-5 space-y-4">
      <div className="flex gap-2">
        <Input placeholder="Gas name (e.g. Oxygen)" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
        <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-11 w-16 p-1" />
        <Button onClick={() => create.mutate()} disabled={create.isPending} className="h-11 gap-2"><Plus className="size-4" /> Add</Button>
      </div>
      <div className="divide-y">
        {(data ?? []).map((g: any) => (
          <div key={g.id} className="py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg" style={{ background: g.color || "#999" }} />
              <div>
                <div className="font-semibold">{g.name}</div>
                <Badge variant={g.active ? "secondary" : "outline"} className="text-[10px] mt-0.5">{g.active ? "Active" : "Inactive"}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => toggle.mutate(g)}>{g.active ? "Disable" : "Enable"}</Button>
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(g.id)}><Trash2 className="size-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {(data ?? []).length === 0 && <div className="py-4 text-sm text-muted-foreground">No gas types yet.</div>}
      </div>
    </Card>
  );
}

function SizesPanel() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [vol, setVol] = useState("");

  const { data } = useQuery({
    queryKey: ["cylinder_sizes"],
    queryFn: async () => (await supabase.from("cylinder_sizes").select("*").order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name required");
      const { error } = await supabase.from("cylinder_sizes").insert({ name: name.trim(), volume_liters: vol ? Number(vol) : null, active: true });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Size added");
      setName(""); setVol("");
      qc.invalidateQueries({ queryKey: ["cylinder_sizes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cylinder_sizes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cylinder_sizes"] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-5 space-y-4">
      <div className="grid grid-cols-[1fr_120px_auto] gap-2">
        <Input placeholder="Size (e.g. 47L)" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
        <Input placeholder="Litres" type="number" value={vol} onChange={(e) => setVol(e.target.value)} className="h-11" />
        <Button onClick={() => create.mutate()} disabled={create.isPending} className="h-11 gap-2"><Plus className="size-4" /> Add</Button>
      </div>
      <div className="divide-y">
        {(data ?? []).map((s: any) => (
          <div key={s.id} className="py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold">{s.name}</div>
              <div className="text-xs text-muted-foreground">{s.volume_liters ? `${s.volume_liters} L` : "—"}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => remove.mutate(s.id)}><Trash2 className="size-4 text-destructive" /></Button>
          </div>
        ))}
        {(data ?? []).length === 0 && <div className="py-4 text-sm text-muted-foreground">No sizes yet.</div>}
      </div>
    </Card>
  );
}

function Field({ label, name, type = "text", defaultValue }: any) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input name={name} type={type} defaultValue={defaultValue} className="mt-1.5 h-11" />
    </div>
  );
}
