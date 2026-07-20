import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
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
import { Plus, Search, Phone, Users, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({ meta: [{ title: "Employees — Life Care Plant" }] }),
  component: EmployeesPage,
});

const ROLES = ["operator", "driver", "manager", "labour", "accountant", "other"];

type EditState = {
  id: string;
  name: string;
  role: string;
  phone: string;
  cnic: string;
  address: string;
  monthly_salary: number | "";
  joining_date: string;
  notes: string;
} | null;

function EmployeesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string>("operator");
  const [editing, setEditing] = useState<EditState>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await supabase.from("employees").select("*").order("name")).data ?? [],
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const rows = data ?? [];
    if (!s) return rows;
    return rows.filter(
      (r: any) =>
        r.name.toLowerCase().includes(s) ||
        (r.role ?? "").toLowerCase().includes(s) ||
        (r.phone ?? "").includes(s),
    );
  }, [data, q]);

  const totalPayroll = useMemo(
    () =>
      (data ?? [])
        .filter((e: any) => e.active)
        .reduce((a: number, e: any) => a + Number(e.monthly_salary ?? 0), 0),
    [data],
  );

  const save = useMutation({
    mutationFn: async (vals: any) => {
      if (editing) {
        const { error } = await supabase.from("employees").update(vals).eq("id", editing.id);
        if (error) throw error;
        await logAudit({
          action: "update",
          entity: "employees",
          entityId: editing.id,
          summary: `Updated employee ${vals.name}`,
        });
      } else {
        const { data: ins, error } = await supabase
          .from("employees")
          .insert(vals)
          .select("id")
          .single();
        if (error) throw error;
        await logAudit({
          action: "create",
          entity: "employees",
          entityId: ins?.id,
          summary: `Added employee ${vals.name}`,
        });
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Employee updated" : "Employee added");
      qc.invalidateQueries({ queryKey: ["employees"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
      await logAudit({
        action: "delete",
        entity: "employees",
        entityId: id,
        summary: "Deleted employee",
      });
    },
    onSuccess: () => {
      toast.success("Employee deleted");
      qc.invalidateQueries({ queryKey: ["employees"] });
      setDeleteId(null);
    },
    onError: (e: any) => {
      toast.error(e.message);
      setDeleteId(null);
    },
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const sal = String(f.get("monthly_salary") ?? "").trim();
    const jd = String(f.get("joining_date") ?? "").trim();
    save.mutate({
      name: String(f.get("name") ?? "").trim(),
      role,
      phone: String(f.get("phone") ?? "").trim() || null,
      cnic: String(f.get("cnic") ?? "").trim() || null,
      address: String(f.get("address") ?? "").trim() || null,
      monthly_salary: sal ? Number(sal) : null,
      joining_date: jd || null,
      notes: String(f.get("notes") ?? "").trim() || null,
    });
  };

  const openNew = () => {
    setEditing(null);
    setRole("operator");
    setOpen(true);
  };
  const openEdit = (e: any) => {
    setEditing({
      id: e.id,
      name: e.name ?? "",
      role: e.role ?? "operator",
      phone: e.phone ?? "",
      cnic: e.cnic ?? "",
      address: e.address ?? "",
      monthly_salary: e.monthly_salary ?? "",
      joining_date: e.joining_date ?? "",
      notes: e.notes ?? "",
    });
    setRole(e.role ?? "operator");
    setOpen(true);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="size-6" /> Employees
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Staff, drivers and labour records.</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="size-4" /> New Employee
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Active Staff
          </div>
          <div className="font-display font-bold text-2xl mt-0.5">
            {(data ?? []).filter((e: any) => e.active).length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Monthly Payroll
          </div>
          <div className="font-display font-bold text-2xl mt-0.5">
            {formatCurrency(totalPayroll)}
          </div>
        </Card>
      </div>

      <Sheet
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit Employee" : "New Employee"}</SheetTitle>
          </SheetHeader>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field label="Name" name="name" required defaultValue={editing?.name} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="mt-1.5 h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field label="Phone" name="phone" defaultValue={editing?.phone} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CNIC" name="cnic" defaultValue={editing?.cnic} />
              <Field
                label="Monthly Salary (Rs)"
                name="monthly_salary"
                type="number"
                defaultValue={editing?.monthly_salary}
              />
            </div>
            <Field
              label="Joining Date"
              name="joining_date"
              type="date"
              defaultValue={editing?.joining_date}
            />
            <Field label="Address" name="address" defaultValue={editing?.address} />
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea name="notes" rows={2} defaultValue={editing?.notes} className="mt-1.5" />
            </div>
            <Button type="submit" disabled={save.isPending} className="w-full h-11">
              {save.isPending ? "Saving…" : editing ? "Update Employee" : "Save Employee"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, role or phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No employees yet. Add your first employee.
          </Card>
        )}
        {filtered.map((e: any) => (
          <Card key={e.id} className="p-4 flex items-center gap-3">
            <div className="size-11 rounded-full bg-brand/10 text-brand grid place-items-center font-bold">
              {e.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate flex items-center gap-2">
                {e.name}
                {e.role && (
                  <Badge variant="secondary" className="text-[10px]">
                    {e.role}
                  </Badge>
                )}
                {!e.active && (
                  <Badge variant="outline" className="text-[10px]">
                    inactive
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                {e.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="size-3" />
                    {e.phone}
                  </span>
                )}
                {e.joining_date && (
                  <span className="hidden sm:inline">Joined {formatDate(e.joining_date)}</span>
                )}
              </div>
            </div>
            {e.monthly_salary != null && (
              <div className="text-right shrink-0">
                <div className="text-sm font-bold">{formatCurrency(e.monthly_salary)}</div>
                <div className="text-[10px] text-muted-foreground">/ month</div>
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9 shrink-0">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEdit(e)} className="gap-2">
                  <Pencil className="size-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteId(e.id)}
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
            <AlertDialogTitle>Delete employee?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the employee record.
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

function Field({ label, name, type = "text", required, defaultValue }: any) {
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
        className="mt-1.5 h-11"
      />
    </div>
  );
}
