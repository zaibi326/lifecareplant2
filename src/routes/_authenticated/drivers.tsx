import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Phone, CreditCard, MoreVertical, Pencil, Trash2, User, Truck } from "lucide-react";

import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/drivers")({
  head: () => ({ meta: [{ title: "Drivers — Life Care Plant" }] }),
  component: DriversPage,
});

const STATUSES = ["active", "inactive"];

type EditState = {
  id: string; name: string; phone: string; cnic: string; license_number: string;
  assigned_vehicle_id: string; status: string; notes: string;
} | null;

function DriversPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("active");
  const [vehicle, setVehicle] = useState("none");
  const [editing, setEditing] = useState<EditState>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles-lookup"],
    queryFn: async () => (await supabase.from("vehicles").select("id,registration_number,vehicle_name").order("registration_number")).data ?? [],
  });

  const { data } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => (await supabase.from("drivers").select("*,vehicles:assigned_vehicle_id(registration_number)").order("name")).data ?? [],
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const rows = data ?? [];
    if (!s) return rows;
    return rows.filter((r: any) =>
      r.name.toLowerCase().includes(s) ||
      (r.phone ?? "").includes(s) ||
      (r.cnic ?? "").includes(s));
  }, [data, q]);

  const save = useMutation({
    mutationFn: async (vals: any) => {
      if (editing) {
        const { error } = await supabase.from("drivers").update(vals).eq("id", editing.id);
        if (error) throw error;
        await logAudit({ action: "update", entity: "drivers", entityId: editing.id, summary: `Updated driver ${vals.name}` });
      } else {
        const { data: ins, error } = await supabase.from("drivers").insert(vals).select("id").single();
        if (error) throw error;
        await logAudit({ action: "create", entity: "drivers", entityId: ins?.id, summary: `Added driver ${vals.name}` });
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Driver updated" : "Driver added");
      qc.invalidateQueries({ queryKey: ["drivers"] });
      qc.invalidateQueries({ queryKey: ["drivers-lookup"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("drivers").delete().eq("id", id);
      if (error) throw error;
      await logAudit({ action: "delete", entity: "drivers", entityId: id, summary: "Deleted driver" });
    },
    onSuccess: () => {
      toast.success("Driver deleted");
      qc.invalidateQueries({ queryKey: ["drivers"] });
      setDeleteId(null);
    },
    onError: (e: any) => { toast.error(e.message); setDeleteId(null); },
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate({
      name: String(f.get("name") ?? "").trim(),
      phone: String(f.get("phone") ?? "").trim() || null,
      cnic: String(f.get("cnic") ?? "").trim() || null,
      license_number: String(f.get("license_number") ?? "").trim() || null,
      assigned_vehicle_id: vehicle === "none" ? null : vehicle,
      status,
      notes: String(f.get("notes") ?? "").trim() || null,
    });
  };

  const openNew = () => { setEditing(null); setStatus("active"); setVehicle("none"); setOpen(true); };
  const openEdit = (d: any) => {
    setEditing({
      id: d.id, name: d.name ?? "", phone: d.phone ?? "", cnic: d.cnic ?? "",
      license_number: d.license_number ?? "", assigned_vehicle_id: d.assigned_vehicle_id ?? "none",
      status: d.status ?? "active", notes: d.notes ?? "",
    });
    setStatus(d.status ?? "active");
    setVehicle(d.assigned_vehicle_id ?? "none");
    setOpen(true);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <User className="size-6" /> Drivers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Driver records and vehicle assignments.</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="size-4" /> New Driver</Button>
      </header>

      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>{editing ? "Edit Driver" : "New Driver"}</SheetTitle></SheetHeader>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field label="Driver Name" name="name" required defaultValue={editing?.name} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone" name="phone" defaultValue={editing?.phone} />
              <Field label="CNIC" name="cnic" defaultValue={editing?.cnic} placeholder="00000-0000000-0" />
            </div>
            <Field label="License Number" name="license_number" defaultValue={editing?.license_number} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Assigned Vehicle</Label>
                <Select value={vehicle} onValueChange={setVehicle}>
                  <SelectTrigger className="mt-1.5 h-11"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(vehicles ?? []).map((v: any) => (
                      <SelectItem key={v.id} value={v.id}>{v.registration_number}{v.vehicle_name ? ` — ${v.vehicle_name}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea name="notes" rows={2} defaultValue={editing?.notes} className="mt-1.5" />
            </div>
            <Button type="submit" disabled={save.isPending} className="w-full h-11">
              {save.isPending ? "Saving…" : editing ? "Update Driver" : "Save Driver"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name, phone or CNIC" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-11" />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No drivers yet. Add your first driver.</Card>}
        {filtered.map((d: any) => (
          <Card key={d.id} className="p-4 flex items-center gap-3">
            <div className="size-11 rounded-full bg-brand/10 text-brand grid place-items-center">
              <User className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate flex items-center gap-2">
                {d.name}
                {d.status !== "active" && <Badge variant="outline" className="text-[10px]">{d.status}</Badge>}
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3 mt-0.5">
                {d.phone && <span className="flex items-center gap-1"><Phone className="size-3" />{d.phone}</span>}
                {d.license_number && <span className="flex items-center gap-1"><CreditCard className="size-3" />{d.license_number}</span>}

                {d.vehicles?.registration_number && <span className="flex items-center gap-1"><Truck className="size-3" />{d.vehicles.registration_number}</span>}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9 shrink-0"><MoreVertical className="size-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEdit(d)} className="gap-2"><Pencil className="size-4" /> Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeleteId(d.id)} className="gap-2 text-destructive focus:text-destructive">
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
            <AlertDialogTitle>Delete driver?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the driver record.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && del.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {del.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
