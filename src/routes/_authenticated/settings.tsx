import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Building2, Flame, Package, Users, KeyRound, ShieldCheck, Wrench } from "lucide-react";
import { toast } from "sonner";
import { listStaff, createStaff, updateStaffRole, deleteStaff, resetStaffPassword } from "@/lib/staff.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Life Care Plant" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: ok } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
      setIsAdmin(!!ok);
    });
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Company, gases, sizes{isAdmin ? " and staff" : ""}.</p>
      </header>

      <Tabs defaultValue="company" className="w-full">
        <TabsList className={`grid ${isAdmin ? "grid-cols-6" : "grid-cols-5"} w-full h-11`}>
          <TabsTrigger value="company" className="gap-2"><Building2 className="size-4" /> Company</TabsTrigger>
          <TabsTrigger value="gases" className="gap-2"><Flame className="size-4" /> Gases</TabsTrigger>
          <TabsTrigger value="sizes" className="gap-2"><Package className="size-4" /> Sizes</TabsTrigger>
          <TabsTrigger value="parts" className="gap-2"><Wrench className="size-4" /> Parts</TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2"><ShieldCheck className="size-4" /> Roles</TabsTrigger>
          {isAdmin && <TabsTrigger value="staff" className="gap-2"><Users className="size-4" /> Staff</TabsTrigger>}
        </TabsList>

        <TabsContent value="company" className="mt-5"><CompanyForm /></TabsContent>
        <TabsContent value="gases" className="mt-5"><GasTypesPanel /></TabsContent>
        <TabsContent value="sizes" className="mt-5"><SizesPanel /></TabsContent>
        <TabsContent value="parts" className="mt-5"><PartSizesPanel /></TabsContent>
        <TabsContent value="permissions" className="mt-5"><PermissionsMatrix /></TabsContent>
        {isAdmin && <TabsContent value="staff" className="mt-5"><StaffPanel /></TabsContent>}
      </Tabs>
    </div>
  );
}

function StaffPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"admin" | "staff">("staff");
  const [resetOpen, setResetOpen] = useState<string | null>(null);
  const [newPwd, setNewPwd] = useState("");

  const list = useServerFn(listStaff);
  const create = useServerFn(createStaff);
  const updateRole = useServerFn(updateStaffRole);
  const del = useServerFn(deleteStaff);
  const resetPwd = useServerFn(resetStaffPassword);

  const { data, isLoading } = useQuery({ queryKey: ["staff"], queryFn: () => list() });

  const createMut = useMutation({
    mutationFn: (vals: any) => create({ data: vals }),
    onSuccess: () => {
      toast.success("Staff added");
      qc.invalidateQueries({ queryKey: ["staff"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const roleMut = useMutation({
    mutationFn: (v: { user_id: string; role: "admin" | "staff" }) => updateRole({ data: v }),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (user_id: string) => del({ data: { user_id } }),
    onSuccess: () => {
      toast.success("User removed");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pwdMut = useMutation({
    mutationFn: (v: { user_id: string; password: string }) => resetPwd({ data: v }),
    onSuccess: () => {
      toast.success("Password updated");
      setResetOpen(null);
      setNewPwd("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    createMut.mutate({
      email: String(f.get("email") ?? "").trim(),
      password: String(f.get("password") ?? ""),
      full_name: String(f.get("full_name") ?? "").trim(),
      role,
    });
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold">Staff Management</h3>
          <p className="text-xs text-muted-foreground">Only admins can add or remove users.</p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className="gap-2"><Plus className="size-4" /> Add User</Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader><SheetTitle>Add Staff / Admin</SheetTitle></SheetHeader>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div><Label className="text-xs">Full Name*</Label><Input name="full_name" required className="mt-1.5 h-11" /></div>
              <div><Label className="text-xs">Email*</Label><Input name="email" type="email" required className="mt-1.5 h-11" /></div>
              <div><Label className="text-xs">Temporary Password*</Label><Input name="password" type="text" minLength={8} required className="mt-1.5 h-11" placeholder="min 8 chars" /></div>
              <div>
                <Label className="text-xs">Role*</Label>
                <Select value={role} onValueChange={(v) => setRole(v as any)}>
                  <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={createMut.isPending} className="w-full h-11">
                {createMut.isPending ? "Creating…" : "Create User"}
              </Button>
              <p className="text-[11px] text-muted-foreground">Share the email and temporary password with the user. They can change it later.</p>
            </form>
          </SheetContent>
        </Sheet>
      </div>

      <div className="divide-y">
        {isLoading && <div className="py-4 text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && (data ?? []).length === 0 && <div className="py-4 text-sm text-muted-foreground">No staff yet.</div>}
        {(data ?? []).map((u: any) => (
          <div key={u.id} className="py-3 flex items-center gap-3">
            <div className="size-9 rounded-full bg-brand/10 text-brand grid place-items-center font-bold text-sm">
              {(u.full_name ?? u.email ?? "?").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{u.full_name ?? u.email}</div>
              <div className="text-xs text-muted-foreground truncate">{u.email}</div>
            </div>
            <Select value={u.role} onValueChange={(v) => roleMut.mutate({ user_id: u.id, role: v as any })}>
              <SelectTrigger className="h-9 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="admin"><span className="flex items-center gap-1"><ShieldCheck className="size-3" /> Admin</span></SelectItem>
              </SelectContent>
            </Select>
            <AlertDialog open={resetOpen === u.id} onOpenChange={(o) => { if (!o) { setResetOpen(null); setNewPwd(""); } }}>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setResetOpen(u.id)} title="Reset password">
                  <KeyRound className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset password</AlertDialogTitle>
                  <AlertDialogDescription>Set a new password for {u.email}.</AlertDialogDescription>
                </AlertDialogHeader>
                <Input type="text" placeholder="New password (min 8)" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className="h-11" />
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => pwdMut.mutate({ user_id: u.id, password: newPwd })}>Update</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Delete"><Trash2 className="size-4 text-destructive" /></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove user?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently delete {u.email} and revoke access.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => delMut.mutate(u.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Badge variant={u.role === "admin" ? "default" : "secondary"} className="hidden md:inline-flex text-[10px]">{u.role}</Badge>
          </div>
        ))}
      </div>
    </Card>
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
      oxygen_conversion_factor: Number(f.get("oxygen_conversion_factor") ?? 0.7383) || 0.7383,
      total_owned_cylinders: Number(f.get("total_owned_cylinders") ?? 0) || 0,
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
        <div className="rounded-lg border p-4 bg-muted/20 space-y-1.5">
          <Label className="text-xs font-semibold">Oxygen KG → Cubic Meter Conversion Factor</Label>
          <Input
            name="oxygen_conversion_factor"
            type="number"
            step="0.0001"
            defaultValue={String(data?.oxygen_conversion_factor ?? 0.7383)}
            className="h-11 max-w-[200px]"
          />
          <p className="text-[11px] text-muted-foreground">
            Used when Oxygen purchases are entered in KG. Cubic Meter = KG × factor. Default 0.7383.
          </p>
        </div>
        <div className="rounded-lg border p-4 bg-muted/20 space-y-1.5">
          <Label className="text-xs font-semibold">Total Owned Cylinders (Fleet)</Label>
          <Input
            name="total_owned_cylinders"
            type="number"
            min="0"
            step="1"
            defaultValue={String(data?.total_owned_cylinders ?? 0)}
            className="h-11 max-w-[200px]"
          />
          <p className="text-[11px] text-muted-foreground">
            Total cylinders your plant owns. Used on the Stock page to reconcile Owned = In Plant + With Customers. The difference should always be zero.
          </p>
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
  const [capacity, setCapacity] = useState("");
  const [capacityUnit, setCapacityUnit] = useState("m3");

  const { data } = useQuery({
    queryKey: ["cylinder_sizes"],
    queryFn: async () => (await supabase.from("cylinder_sizes").select("*").order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name required");
      const { error } = await supabase.from("cylinder_sizes").insert({
        name: name.trim(),
        volume_liters: vol ? Number(vol) : null,
        capacity: capacity ? Number(capacity) : null,
        capacity_unit: capacityUnit,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Size added");
      setName(""); setVol(""); setCapacity("");
      qc.invalidateQueries({ queryKey: ["cylinder_sizes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateCapacity = useMutation({
    mutationFn: async (v: { id: string; capacity: number | null; capacity_unit: string }) => {
      const { error } = await supabase.from("cylinder_sizes")
        .update({ capacity: v.capacity, capacity_unit: v.capacity_unit }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Capacity updated"); qc.invalidateQueries({ queryKey: ["cylinder_sizes"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (s: any) => {
      const { error } = await supabase.from("cylinder_sizes").update({ active: !s.active }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cylinder_sizes"] }),
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
      <div>
        <h3 className="font-semibold text-sm">Cylinder Sizes & Gas Capacity</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Capacity is the gas per cylinder (e.g. 9.90 m³). Used to auto-deduct bulk gas on production.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-[1fr_100px_100px_110px_auto] gap-2">
        <Input placeholder="Name (e.g. 9.90)" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
        <Input placeholder="Litres" type="number" value={vol} onChange={(e) => setVol(e.target.value)} className="h-11" />
        <Input placeholder="Capacity" type="number" step="0.01" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="h-11" />
        <Select value={capacityUnit} onValueChange={setCapacityUnit}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="m3">m³</SelectItem>
            <SelectItem value="cft">CFT</SelectItem>
            <SelectItem value="litre">Litre</SelectItem>
            <SelectItem value="kg">KG</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => create.mutate()} disabled={create.isPending} className="h-11 gap-2"><Plus className="size-4" /> Add</Button>
      </div>
      <div className="divide-y">
        {(data ?? []).map((s: any) => (
          <div key={s.id} className="py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold flex items-center gap-2">
                {s.name}
                {!s.active && <Badge variant="secondary" className="text-[10px]">inactive</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">
                {s.capacity != null ? `Capacity ${s.capacity} ${s.capacity_unit ?? "m3"}` : "No capacity set"}
                {s.volume_liters ? ` • ${s.volume_liters} L` : ""}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Input
                type="number"
                step="0.01"
                defaultValue={s.capacity ?? ""}
                placeholder="cap"
                className="h-9 w-20 text-xs"
                onBlur={(e) => {
                  const val = e.target.value === "" ? null : Number(e.target.value);
                  if (val !== (s.capacity ?? null)) updateCapacity.mutate({ id: s.id, capacity: val, capacity_unit: s.capacity_unit ?? "m3" });
                }}
              />
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => toggle.mutate(s)}>{s.active ? "Disable" : "Enable"}</Button>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => remove.mutate(s.id)}><Trash2 className="size-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {(data ?? []).length === 0 && <div className="py-4 text-sm text-muted-foreground">No sizes yet.</div>}
      </div>
    </Card>
  );
}


function PartSizesPanel() {
  const qc = useQueryClient();
  const [label, setLabel] = useState("");

  const { data } = useQuery({
    queryKey: ["part_sizes_all"],
    queryFn: async () => (await supabase.from("part_sizes").select("*").order("sort_order").order("label")).data ?? [],
  });

  const partsStock = useQuery({
    queryKey: ["parts_stock_for_settings"],
    queryFn: async () => (await supabase.from("parts_stock").select("kind,size,quantity")).data ?? [],
  });

  const stockBySize = new Map<string, { valve: number; spindle: number }>();
  for (const p of partsStock.data ?? []) {
    const cur = stockBySize.get(p.size) ?? { valve: 0, spindle: 0 };
    if (p.kind === "valve") cur.valve += Number(p.quantity ?? 0);
    if (p.kind === "spindle") cur.spindle += Number(p.quantity ?? 0);
    stockBySize.set(p.size, cur);
  }

  const create = useMutation({
    mutationFn: async () => {
      if (!label.trim()) throw new Error("Label required");
      const sort_order = ((data ?? []).reduce((m: number, r: any) => Math.max(m, Number(r.sort_order ?? 0)), 0)) + 10;
      const { error } = await supabase.from("part_sizes").insert({ label: label.trim(), sort_order, active: true });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Size added"); setLabel(""); qc.invalidateQueries({ queryKey: ["part_sizes_all"] }); qc.invalidateQueries({ queryKey: ["part_sizes"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (row: any) => {
      const { error } = await supabase.from("part_sizes").update({ active: !row.active }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["part_sizes_all"] }); qc.invalidateQueries({ queryKey: ["part_sizes"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("part_sizes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["part_sizes_all"] }); qc.invalidateQueries({ queryKey: ["part_sizes"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-sm">Valve / Spindle Sizes</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Yahan jo sizes add karein gy, wo deliver entry aur Stock tab dono mein dropdown mein aein gy.</p>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Input placeholder='e.g. 1.30"' value={label} onChange={(e) => setLabel(e.target.value)} className="h-11" />
        <Button onClick={() => create.mutate()} disabled={create.isPending} className="h-11 gap-2"><Plus className="size-4" /> Add</Button>
      </div>
      <div className="divide-y">
        {(data ?? []).map((s: any) => {
          const st = stockBySize.get(s.label) ?? { valve: 0, spindle: 0 };
          return (
            <div key={s.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold flex items-center gap-2">
                  {s.label}
                  {!s.active && <Badge variant="secondary" className="text-[10px]">inactive</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">Valve stock: {st.valve} • Spindle stock: {st.spindle}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => toggle.mutate(s)}>
                  {s.active ? "Disable" : "Enable"}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8"><Trash2 className="size-4 text-destructive" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete size {s.label}?</AlertDialogTitle>
                      <AlertDialogDescription>Iss size ka parts stock bhi affect ho sakta hai. Disable karna safer hai.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove.mutate(s.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          );
        })}
        {(data ?? []).length === 0 && <div className="py-4 text-sm text-muted-foreground">No part sizes yet.</div>}
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

function PermissionsMatrix() {
  const rows: { module: string; actions: { name: string; admin: boolean; staff: boolean }[] }[] = [
    { module: "Dashboard", actions: [
      { name: "View KPIs & charts", admin: true, staff: true },
    ]},
    { module: "Customers", actions: [
      { name: "View list & balances", admin: true, staff: true },
      { name: "Add new customer", admin: true, staff: true },
      { name: "Edit / delete customer", admin: true, staff: false },
    ]},
    { module: "Movements (Receive / Deliver)", actions: [
      { name: "View entries", admin: true, staff: true },
      { name: "Record Receive", admin: true, staff: true },
      { name: "Record Deliver", admin: true, staff: true },
      { name: "Edit / delete entry", admin: true, staff: false },
    ]},
    { module: "Payments", actions: [
      { name: "View payments", admin: true, staff: true },
      { name: "Record payment", admin: true, staff: true },
      { name: "Edit / delete payment", admin: true, staff: false },
    ]},
    { module: "Production", actions: [
      { name: "View logs", admin: true, staff: true },
      { name: "Log production", admin: true, staff: true },
      { name: "Edit / delete log", admin: true, staff: false },
    ]},
    { module: "Stock", actions: [
      { name: "View plant & customer stock", admin: true, staff: true },
    ]},
    { module: "Reports", actions: [
      { name: "View reports & charts", admin: true, staff: true },
      { name: "Export CSV", admin: true, staff: true },
    ]},
    { module: "Settings — Company", actions: [
      { name: "View company info", admin: true, staff: true },
      { name: "Edit company / currency / tax", admin: true, staff: false },
    ]},
    { module: "Settings — Gases & Sizes", actions: [
      { name: "View", admin: true, staff: true },
      { name: "Add / edit / delete", admin: true, staff: false },
    ]},
    { module: "Settings — Staff Management", actions: [
      { name: "View staff list", admin: true, staff: false },
      { name: "Add / remove user", admin: true, staff: false },
      { name: "Change role", admin: true, staff: false },
      { name: "Reset password", admin: true, staff: false },
    ]},
  ];

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h3 className="font-display font-bold flex items-center gap-2"><ShieldCheck className="size-4 text-brand" /> Role Permissions</h3>
        <p className="text-xs text-muted-foreground mt-1">What each role can do in every module.</p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge className="bg-brand text-brand-foreground gap-1"><ShieldCheck className="size-3" /> Admin — full access</Badge>
        <Badge variant="secondary" className="gap-1"><Users className="size-3" /> Staff — daily operations</Badge>
      </div>

      <div className="overflow-x-auto -mx-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b">
              <th className="py-2 px-5 font-medium">Module / Action</th>
              <th className="py-2 px-3 font-medium text-center w-20">Admin</th>
              <th className="py-2 px-5 font-medium text-center w-20">Staff</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.module}>
                <tr className="bg-muted/40">
                  <td colSpan={3} className="py-2 px-5 font-display font-bold text-xs uppercase tracking-wider">{r.module}</td>
                </tr>
                {r.actions.map((a, i) => (
                  <tr key={r.module + i} className="border-b last:border-0">
                    <td className="py-2.5 px-5">{a.name}</td>
                    <td className="py-2.5 px-3 text-center">
                      {a.admin
                        ? <span className="inline-flex size-6 rounded-full bg-success/15 text-success items-center justify-center">✓</span>
                        : <span className="inline-flex size-6 rounded-full bg-muted text-muted-foreground items-center justify-center">–</span>}
                    </td>
                    <td className="py-2.5 px-5 text-center">
                      {a.staff
                        ? <span className="inline-flex size-6 rounded-full bg-success/15 text-success items-center justify-center">✓</span>
                        : <span className="inline-flex size-6 rounded-full bg-destructive/10 text-destructive items-center justify-center">✕</span>}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Note: Roles are enforced by Lovable Cloud security policies. To change a user's role, go to the <strong>Staff</strong> tab (admin only).
      </p>
    </Card>
  );
}
