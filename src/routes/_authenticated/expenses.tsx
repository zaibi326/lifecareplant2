import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
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
import { Badge } from "@/components/ui/badge";
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
import { Plus, Receipt, MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Expenses — Life Care Plant" }] }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const total = (data ?? []).reduce((a, e: any) => a + Number(e.amount ?? 0), 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    (data ?? []).forEach((e: any) =>
      map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount ?? 0)),
    );
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [data]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense deleted");
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
            <Receipt className="size-6" /> Expenses
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Operating costs: electricity, diesel, labour and more.
          </p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" /> New Expense
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Record Expense</SheetTitle>
            </SheetHeader>
            <ExpenseForm onDone={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>

      <Card className="p-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Recent total
          </div>
          <div className="font-display font-bold text-2xl mt-1">{formatCurrency(total)}</div>
        </div>
        <div className="text-xs text-muted-foreground">{(data ?? []).length} entries</div>
      </Card>

      {byCategory.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {byCategory.map(([cat, amt]) => (
            <Badge key={cat} variant="secondary" className="text-[11px]">
              {cat}: {formatCurrency(amt)}
            </Badge>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {isLoading && <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>}
        {!isLoading && (data ?? []).length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">No expenses yet.</Card>
        )}
        {(data ?? []).map((e: any) => (
          <Card key={e.id} className="p-4 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-destructive/10 text-destructive grid place-items-center">
              <Receipt className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">
                {e.category}
                {e.payee ? ` • ${e.payee}` : ""}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDate(e.date)}
                {e.reference_number ? ` • Ref ${e.reference_number}` : ""}
                {e.notes ? ` • ${e.notes}` : ""}
              </div>
            </div>
            <div className="font-display font-bold">{formatCurrency(e.amount)}</div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9 shrink-0">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>This action is permanent.</AlertDialogDescription>
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

function ExpenseForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [category, setCategory] = useState<string>("");
  const [newCategory, setNewCategory] = useState("");
  const [account, setAccount] = useState("cash");
  const [bankAccountId, setBankAccountId] = useState("");
  const [date, setDate] = useState(todayISO());

  const { data: lookups } = useQuery({
    queryKey: ["expense-form-lookups"],
    queryFn: async () => {
      const [cats, banks] = await Promise.all([
        supabase.from("expense_categories").select("id,name").eq("active", true).order("name"),
        supabase.from("bank_accounts").select("id,bank_name,account_title").eq("active", true),
      ]);
      return { categories: cats.data ?? [], banks: banks.data ?? [] };
    },
  });

  const save = useMutation({
    mutationFn: async (f: FormData) => {
      const amount = Number(f.get("amount") ?? 0);
      if (!amount || amount <= 0) throw new Error("Amount must be greater than 0");
      if (account === "bank" && !bankAccountId) throw new Error("Select a bank account");

      // Resolve category — allow creating a new one on the fly.
      let finalCategory = category;
      if (category === "__new__") {
        const name = newCategory.trim();
        if (!name) throw new Error("Enter the new category name");
        finalCategory = name;
        // Create the category if it does not exist yet (unique name).
        await supabase.from("expense_categories").upsert({ name }, { onConflict: "name" });
      }
      if (!finalCategory) throw new Error("Category required");

      const { error } = await supabase.from("expenses").insert({
        category: finalCategory,
        amount,
        date,
        account,
        bank_account_id: account === "bank" ? bankAccountId : null,
        method: account === "bank" ? "Bank" : "Cash",
        payee: String(f.get("payee") ?? "").trim() || null,
        reference_number: String(f.get("reference_number") ?? "").trim() || null,
        notes: String(f.get("notes") ?? "").trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense recorded");
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
        <Label className="text-xs">Category*</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="mt-1.5 h-11">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {(lookups?.categories ?? []).map((c: any) => (
              <SelectItem key={c.id} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
            <SelectItem value="__new__">+ New category…</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {category === "__new__" && (
        <div>
          <Label className="text-xs">New Category Name*</Label>
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="mt-1.5 h-11"
            placeholder="e.g. Security"
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Amount (Rs)*</Label>
          <Input name="amount" type="number" min={1} step="0.01" required className="mt-1.5 h-11" />
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
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Paid From</Label>
          <Select value={account} onValueChange={setAccount}>
            <SelectTrigger className="mt-1.5 h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash in Hand</SelectItem>
              <SelectItem value="bank">Bank Account</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Payee</Label>
          <Input name="payee" className="mt-1.5 h-11" />
        </div>
      </div>
      {account === "bank" && (
        <div>
          <Label className="text-xs">Bank Account*</Label>
          <Select value={bankAccountId} onValueChange={setBankAccountId}>
            <SelectTrigger className="mt-1.5 h-11">
              <SelectValue placeholder="Select bank account" />
            </SelectTrigger>
            <SelectContent>
              {(lookups?.banks ?? []).map((b: any) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.bank_name}
                  {b.account_title ? ` — ${b.account_title}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(lookups?.banks ?? []).length === 0 && (
            <p className="text-[11px] text-muted-foreground mt-1">
              No bank accounts yet. Add one in the Bank module first.
            </p>
          )}
        </div>
      )}
      <div>
        <Label className="text-xs">Reference #</Label>
        <Input name="reference_number" className="mt-1.5 h-11" />
      </div>
      <div>
        <Label className="text-xs">Notes</Label>
        <Textarea name="notes" rows={2} className="mt-1.5" />
      </div>
      <Button type="submit" disabled={save.isPending} className="w-full h-11">
        {save.isPending ? "Saving…" : "Save Expense"}
      </Button>
    </form>
  );
}
