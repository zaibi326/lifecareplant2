import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, todayISO } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
import { Plus, RefreshCw, Search, MoreVertical, Trash2, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/cylinder-exchange")({
  head: () => ({ meta: [{ title: "Cylinder Exchange — Life Care Plant" }] }),
  component: CylinderExchangePage,
});

function CylinderExchangePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["cylinder-exchanges"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cylinder_exchanges")
        .select("*,suppliers(name),gas_types(name,color),cylinder_sizes(name)")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data ?? [];
    return (data ?? []).filter(
      (r: any) =>
        (r.suppliers?.name ?? "").toLowerCase().includes(s) ||
        (r.gas_types?.name ?? "").toLowerCase().includes(s) ||
        (r.invoice_number ?? "").toLowerCase().includes(s),
    );
  }, [data, q]);

  const totalOut = (filtered as any[]).reduce((a, r) => a + Number(r.empties_out ?? 0), 0);
  const totalIn = (filtered as any[]).reduce((a, r) => a + Number(r.filled_in ?? 0), 0);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cylinder_exchanges").delete().eq("id", id);
      if (error) throw error;
      await logAudit({
        action: "delete",
        entity: "cylinder_exchange",
        entityId: id,
        summary: "Cylinder exchange deleted",
      });
    },
    onSuccess: () => {
      toast.success("Exchange deleted");
      qc.invalidateQueries();
      setDeleteId(null);
    },
    onError: (e: any) => {
      toast.error(e.message);
      setDeleteId(null);
    },
  });

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ArrowRightLeft className="size-6" /> Supplier Cylinder Exchange
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Empty cylinders supplier ko diye, filled wapas aaye. Owned count same rehta hai, sirf
            plant filled/empty adjust.
          </p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" /> New Exchange
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Cylinder Exchange</SheetTitle>
            </SheetHeader>
            <ExchangeForm onDone={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Empties Out
          </div>
          <div className="font-display font-bold text-2xl mt-1">{totalOut.toLocaleString()}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Filled In
          </div>
          <div className="font-display font-bold text-2xl mt-1">{totalIn.toLocaleString()}</div>
        </Card>
      </div>

      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search supplier / gas / invoice"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      <div className="space-y-2">
        {isLoading && <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>}
        {!isLoading && filtered.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">No exchanges yet.</Card>
        )}
        {(filtered as any[]).map((r) => (
          <Card key={r.id} className="p-4 flex items-center gap-3">
            <div
              className="size-10 rounded-lg grid place-items-center text-white font-bold text-xs"
              style={{ background: r.gas_types?.color || "var(--brand)" }}
            >
              {(r.gas_types?.name ?? "—").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{r.suppliers?.name ?? "Supplier"}</div>
              <div className="text-xs text-muted-foreground truncate">
                {r.gas_types?.name ?? ""} {r.cylinder_sizes?.name ?? ""} • {formatDate(r.date)}
                {r.invoice_number ? ` • ${r.invoice_number}` : ""}
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="font-display font-bold">
                <span className="text-muted-foreground">↑{r.empties_out}</span> /{" "}
                <span className="text-success">↓{r.filled_in}</span>
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                out / in
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9 shrink-0">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setDeleteId(r.id)}
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
            <AlertDialogTitle>Delete exchange?</AlertDialogTitle>
            <AlertDialogDescription>
              Ye action permanent hai. Plant filled/empty stock update ho jaega.
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

function ExchangeForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [supplier, setSupplier] = useState("");
  const [gas, setGas] = useState("");
  const [size, setSize] = useState("");
  const [emptiesOut, setEmptiesOut] = useState<number>(0);
  const [filledIn, setFilledIn] = useState<number>(0);
  const [date, setDate] = useState(todayISO());

  const { data: lookups } = useQuery({
    queryKey: ["exchange-lookups"],
    queryFn: async () => {
      const [sup, g, s] = await Promise.all([
        supabase.from("suppliers").select("id,name").eq("active", true).order("name"),
        supabase.from("gas_types").select("id,name").eq("active", true).order("name"),
        supabase.from("cylinder_sizes").select("id,name").eq("active", true).order("name"),
      ]);
      return { suppliers: sup.data ?? [], gases: g.data ?? [], sizes: s.data ?? [] };
    },
  });

  const save = useMutation({
    mutationFn: async (f: FormData) => {
      if (!gas || !size) throw new Error("Gas and size required");
      if (emptiesOut <= 0 && filledIn <= 0) throw new Error("Enter empties out or filled in");

      let invoice_number: string | null = null;
      const { data: invNum } = await supabase.rpc("next_invoice_number");
      if (invNum) invoice_number = invNum as string;

      const { data: inserted, error } = await supabase
        .from("cylinder_exchanges")
        .insert({
          date,
          supplier_id: supplier || null,
          gas_type_id: gas,
          cylinder_size_id: size,
          empties_out: Number(emptiesOut || 0),
          filled_in: Number(filledIn || 0),
          invoice_number,
          remarks: String(f.get("remarks") ?? "").trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      await logAudit({
        action: "create",
        entity: "cylinder_exchange",
        entityId: inserted?.id,
        summary: `Exchange out ${emptiesOut} / in ${filledIn}`,
      });
    },
    onSuccess: () => {
      toast.success("Exchange recorded — plant stock updated");
      qc.invalidateQueries();
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(new FormData(e.currentTarget));
      }}
      className="mt-6 space-y-4"
    >
      <div>
        <Label className="text-xs">Supplier</Label>
        <Select value={supplier} onValueChange={setSupplier}>
          <SelectTrigger className="mt-1.5 h-11">
            <SelectValue placeholder="Select supplier" />
          </SelectTrigger>
          <SelectContent>
            {lookups?.suppliers.map((s: any) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Gas*</Label>
          <Select value={gas} onValueChange={setGas}>
            <SelectTrigger className="mt-1.5 h-11">
              <SelectValue placeholder="Gas" />
            </SelectTrigger>
            <SelectContent>
              {lookups?.gases.map((g: any) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Size*</Label>
          <Select value={size} onValueChange={setSize}>
            <SelectTrigger className="mt-1.5 h-11">
              <SelectValue placeholder="Size" />
            </SelectTrigger>
            <SelectContent>
              {lookups?.sizes.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Empties Out (to supplier)</Label>
          <Input
            type="number"
            min={0}
            value={emptiesOut || ""}
            onChange={(e) => setEmptiesOut(Number(e.target.value))}
            className="mt-1.5 h-11"
          />
        </div>
        <div>
          <Label className="text-xs">Filled In (from supplier)</Label>
          <Input
            type="number"
            min={0}
            value={filledIn || ""}
            onChange={(e) => setFilledIn(Number(e.target.value))}
            className="mt-1.5 h-11"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">Date</Label>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1.5 h-11"
        />
      </div>

      <div className="rounded-lg border p-3 bg-muted/30 text-xs">
        <RefreshCw className="size-3.5 inline mr-1" />
        Owned cylinder count <b>change nahi</b> hota. Plant empty ↓ {emptiesOut || 0}, plant filled
        ↑ {filledIn || 0}.
      </div>

      <div>
        <Label className="text-xs">Remarks</Label>
        <Textarea name="remarks" rows={2} className="mt-1.5" />
      </div>
      <Button type="submit" disabled={save.isPending} className="w-full h-11">
        {save.isPending ? "Saving…" : "Record Exchange"}
      </Button>
    </form>
  );
}
