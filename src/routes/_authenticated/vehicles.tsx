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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { Plus, Search, Phone, Truck, MoreVertical, Pencil, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/vehicles")({
  head: () => ({ meta: [{ title: "Vehicles — Life Care Plant" }] }),
  component: VehiclesPage,
});

const VEHICLE_TYPES = ["truck", "pickup", "van", "rickshaw", "other"];
const FUEL_TYPES = ["diesel", "petrol", "cng", "electric", "other"];
const STATUSES = ["active", "maintenance", "inactive"];

type EditState = {
  id: string;
  registration_number: string;
  type: string;
  make_model: string;
  driver_name: string;
  driver_phone: string;
  capacity_cylinders: number | "";
  notes: string;
  vehicle_name: string;
  fuel_type: string;
  status: string;
  default_driver_id: string;
  daily_rent: number | "";
  monthly_rent: number | "";
  per_trip_rent: number | "";
} | null;

function VehiclesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("truck");
  const [fuelType, setFuelType] = useState<string>("diesel");
  const [status, setStatus] = useState<string>("active");
  const [defaultDriver, setDefaultDriver] = useState<string>("none");
  const [editing, setEditing] = useState<EditState>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: drivers } = useQuery({
    queryKey: ["drivers-lookup"],
    queryFn: async () =>
      (await supabase.from("drivers").select("id,name").eq("status", "active").order("name"))
        .data ?? [],
  });

  const { data } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () =>
      (await supabase.from("vehicles").select("*").order("registration_number")).data ?? [],
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const rows = data ?? [];
    if (!s) return rows;
    return rows.filter(
      (r: any) =>
        r.registration_number.toLowerCase().includes(s) ||
        (r.driver_name ?? "").toLowerCase().includes(s) ||
        (r.driver_phone ?? "").includes(s),
    );
  }, [data, q]);

  const save = useMutation({
    mutationFn: async (vals: any) => {
      if (editing) {
        const { error } = await supabase.from("vehicles").update(vals).eq("id", editing.id);
        if (error) throw error;
        await logAudit({
          action: "update",
          entity: "vehicles",
          entityId: editing.id,
          summary: `Updated vehicle ${vals.registration_number}`,
        });
      } else {
        const { data: ins, error } = await supabase
          .from("vehicles")
          .insert(vals)
          .select("id")
          .single();
        if (error) throw error;
        await logAudit({
          action: "create",
          entity: "vehicles",
          entityId: ins?.id,
          summary: `Added vehicle ${vals.registration_number}`,
        });
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Vehicle updated" : "Vehicle added");
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
      await logAudit({
        action: "delete",
        entity: "vehicles",
        entityId: id,
        summary: "Deleted vehicle",
      });
    },
    onSuccess: () => {
      toast.success("Vehicle deleted");
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      setDeleteId(null);
    },
    onError: (e: any) => {
      toast.error(e.message);
      setDeleteId(null);
    },
  });

  const num = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim();
    return s ? Number(s) : null;
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const cap = String(f.get("capacity_cylinders") ?? "").trim();
    save.mutate({
      registration_number: String(f.get("registration_number") ?? "").trim(),
      type,
      vehicle_name: String(f.get("vehicle_name") ?? "").trim() || null,
      make_model: String(f.get("make_model") ?? "").trim() || null,
      driver_name: String(f.get("driver_name") ?? "").trim() || null,
      driver_phone: String(f.get("driver_phone") ?? "").trim() || null,
      capacity_cylinders: cap ? Number(cap) : null,
      fuel_type: fuelType,
      status,
      default_driver_id: defaultDriver === "none" ? null : defaultDriver,
      daily_rent: num(f.get("daily_rent")),
      monthly_rent: num(f.get("monthly_rent")),
      per_trip_rent: num(f.get("per_trip_rent")),
      notes: String(f.get("notes") ?? "").trim() || null,
    });
  };

  const openNew = () => {
    setEditing(null);
    setType("truck");
    setFuelType("diesel");
    setStatus("active");
    setDefaultDriver("none");
    setOpen(true);
  };
  const openEdit = (v: any) => {
    setEditing({
      id: v.id,
      registration_number: v.registration_number ?? "",
      type: v.type ?? "truck",
      make_model: v.make_model ?? "",
      driver_name: v.driver_name ?? "",
      driver_phone: v.driver_phone ?? "",
      capacity_cylinders: v.capacity_cylinders ?? "",
      notes: v.notes ?? "",
      vehicle_name: v.vehicle_name ?? "",
      fuel_type: v.fuel_type ?? "diesel",
      status: v.status ?? "active",
      default_driver_id: v.default_driver_id ?? "none",
      daily_rent: v.daily_rent ?? "",
      monthly_rent: v.monthly_rent ?? "",
      per_trip_rent: v.per_trip_rent ?? "",
    });
    setType(v.type ?? "truck");
    setFuelType(v.fuel_type ?? "diesel");
    setStatus(v.status ?? "active");
    setDefaultDriver(v.default_driver_id ?? "none");
    setOpen(true);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="size-6" /> Vehicles
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Delivery fleet and assigned drivers.</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="size-4" /> New Vehicle
        </Button>
      </header>

      <Sheet
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit Vehicle" : "New Vehicle"}</SheetTitle>
          </SheetHeader>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Registration Number"
                name="registration_number"
                required
                defaultValue={editing?.registration_number}
                placeholder="LEB-1234"
              />
              <Field
                label="Vehicle Name"
                name="vehicle_name"
                defaultValue={editing?.vehicle_name}
                placeholder="Vehicle A"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="mt-1.5 h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field label="Make / Model" name="make_model" defaultValue={editing?.make_model} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Fuel Type</Label>
                <Select value={fuelType} onValueChange={setFuelType}>
                  <SelectTrigger className="mt-1.5 h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FUEL_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="mt-1.5 h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Default Driver</Label>
              <Select value={defaultDriver} onValueChange={setDefaultDriver}>
                <SelectTrigger className="mt-1.5 h-11">
                  <SelectValue placeholder="No default driver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default driver</SelectItem>
                  {(drivers ?? []).map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                Manage drivers on the Employees / Drivers page.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Driver Name (free text)"
                name="driver_name"
                defaultValue={editing?.driver_name}
              />
              <Field
                label="Driver Phone"
                name="driver_phone"
                defaultValue={editing?.driver_phone}
              />
            </div>
            <Field
              label="Capacity (cylinders)"
              name="capacity_cylinders"
              type="number"
              defaultValue={editing?.capacity_cylinders}
            />
            <div className="rounded-lg border p-3 space-y-3">
              <Label className="text-xs font-semibold">Rent Configuration</Label>
              <div className="grid grid-cols-3 gap-2">
                <Field
                  label="Per Trip"
                  name="per_trip_rent"
                  type="number"
                  defaultValue={editing?.per_trip_rent}
                  placeholder="1500"
                />
                <Field
                  label="Daily"
                  name="daily_rent"
                  type="number"
                  defaultValue={editing?.daily_rent}
                  placeholder="4000"
                />
                <Field
                  label="Monthly"
                  name="monthly_rent"
                  type="number"
                  defaultValue={editing?.monthly_rent}
                  placeholder="90000"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Per-trip rent auto-adds to delivery expense when this vehicle is used.
              </p>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea name="notes" rows={2} defaultValue={editing?.notes} className="mt-1.5" />
            </div>

            <Button type="submit" disabled={save.isPending} className="w-full h-11">
              {save.isPending ? "Saving…" : editing ? "Update Vehicle" : "Save Vehicle"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by reg no, driver or phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No vehicles yet. Add your first vehicle.
          </Card>
        )}
        {filtered.map((v: any) => (
          <Card key={v.id} className="p-4 flex items-center gap-3">
            <div className="size-11 rounded-full bg-brand/10 text-brand grid place-items-center">
              <Truck className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate flex items-center gap-2">
                {v.registration_number}
                {v.type && (
                  <Badge variant="secondary" className="text-[10px]">
                    {v.type}
                  </Badge>
                )}
                {!v.active && (
                  <Badge variant="outline" className="text-[10px]">
                    inactive
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                {v.driver_name && (
                  <span className="flex items-center gap-1">
                    <User className="size-3" />
                    {v.driver_name}
                  </span>
                )}
                {v.driver_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="size-3" />
                    {v.driver_phone}
                  </span>
                )}
              </div>
            </div>
            {v.capacity_cylinders != null && (
              <div className="text-right shrink-0">
                <div className="text-sm font-bold">
                  {Number(v.capacity_cylinders).toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground">cyl cap</div>
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9 shrink-0">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEdit(v)} className="gap-2">
                  <Pencil className="size-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteId(v.id)}
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
            <AlertDialogTitle>Delete vehicle?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the vehicle record.
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

function Field({ label, name, type = "text", required, defaultValue, placeholder }: any) {
  return (
    <div>
      <Label className="text-xs">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      <Input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1.5 h-11"
      />
    </div>
  );
}
