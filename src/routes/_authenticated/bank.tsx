import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { computeBankBalance, type BankAccount } from "@/lib/finance";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Landmark, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/bank")({
  head: () => ({ meta: [{ title: "Bank — Life Care Plant" }] }),
  component: BankPage,
});

type EditState = {
  id: string;
  bank_name: string;
  account_title: string;
  account_number: string;
  opening_balance: number;
  notes: string;
} | null;

function BankPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditState>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["bank-accounts-balances"],
    queryFn: async () => {
      const [accts, pays, supPays, exps] = await Promise.all([
        supabase.from("bank_accounts").select("*").order("bank_name"),
        supabase.from("payments").select("amount,account,bank_account_id"),
        supabase.from("supplier_payments").select("amount,account,bank_account_id"),
        supabase.from("expenses").select("amount,account,bank_account_id"),
      ]);
      return {
        accounts: accts.data ?? [],
        payments: pays.data ?? [],
        supplierPayments: supPays.data ?? [],
        expenses: exps.data ?? [],
      };
    },
  });

  const rows = useMemo(() => {
    return (data?.accounts ?? []).map((a: any) => {
      const bal = computeBankBalance(
        a as BankAccount,
        data?.payments ?? [],
        data?.supplierPayments ?? [],
        data?.expenses ?? [],
      );
      return { ...a, ...bal };
    });
  }, [data]);

  const totalBalance = rows.reduce((a, r: any) => a + Number(r.balance ?? 0), 0);

  const save = useMutation({
    mutationFn: async (vals: any) => {
      if (editing) {
        const { error } = await supabase.from("bank_accounts").update(vals).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bank_accounts").insert(vals);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Account updated" : "Bank account added");
      qc.invalidateQueries();
      setOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account deleted");
      qc.invalidateQueries();
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
    save.mutate({
      bank_name: String(f.get("bank_name") ?? "").trim(),
      account_title: String(f.get("account_title") ?? "").trim() || null,
      account_number: String(f.get("account_number") ?? "").trim() || null,
      opening_balance: Number(f.get("opening_balance") ?? 0),
      notes: String(f.get("notes") ?? "").trim() || null,
    });
  };

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (a: any) => {
    setEditing({
      id: a.id,
      bank_name: a.bank_name ?? "",
      account_title: a.account_title ?? "",
      account_number: a.account_number ?? "",
      opening_balance: Number(a.opening_balance ?? 0),
      notes: a.notes ?? "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Landmark className="size-6" /> Bank
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bank accounts and their live balances.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="size-4" /> New Account
        </Button>
      </header>

      <Card className="p-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Total Bank Balance
          </div>
          <div className="font-display font-bold text-2xl mt-1">{formatCurrency(totalBalance)}</div>
        </div>
        <div className="text-xs text-muted-foreground">{rows.length} accounts</div>
      </Card>

      <Sheet
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit Bank Account" : "New Bank Account"}</SheetTitle>
          </SheetHeader>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <Label className="text-xs">Bank Name*</Label>
              <Input
                name="bank_name"
                required
                defaultValue={editing?.bank_name}
                className="mt-1.5 h-11"
              />
            </div>
            <div>
              <Label className="text-xs">Account Title</Label>
              <Input
                name="account_title"
                defaultValue={editing?.account_title}
                className="mt-1.5 h-11"
              />
            </div>
            <div>
              <Label className="text-xs">Account Number</Label>
              <Input
                name="account_number"
                defaultValue={editing?.account_number}
                className="mt-1.5 h-11"
              />
            </div>
            <div>
              <Label className="text-xs">Opening Balance (Rs)</Label>
              <Input
                name="opening_balance"
                type="number"
                step="0.01"
                defaultValue={editing?.opening_balance ?? 0}
                className="mt-1.5 h-11"
              />
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea name="notes" rows={2} defaultValue={editing?.notes} className="mt-1.5" />
            </div>
            <Button type="submit" disabled={save.isPending} className="w-full h-11">
              {save.isPending ? "Saving…" : editing ? "Update Account" : "Save Account"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <div className="space-y-2">
        {rows.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No bank accounts yet. Add your first account.
          </Card>
        )}
        {rows.map((a: any) => (
          <Card key={a.id} className="p-4 flex items-center gap-3">
            <div className="size-11 rounded-full bg-brand/10 text-brand grid place-items-center">
              <Landmark className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">
                {a.bank_name}
                {a.account_title ? ` — ${a.account_title}` : ""}
              </div>
              <div className="text-xs text-muted-foreground">
                {a.account_number ? `A/C ${a.account_number} • ` : ""}
                Opening {formatCurrency(a.opening_balance)} • In {formatCurrency(a.inflow)} • Out{" "}
                {formatCurrency(a.outflow)}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display font-bold">{formatCurrency(a.balance)}</div>
              <div className="text-[10px] text-muted-foreground">Current balance</div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9 shrink-0">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEdit(a)} className="gap-2">
                  <Pencil className="size-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteId(a.id)}
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
            <AlertDialogTitle>Delete bank account?</AlertDialogTitle>
            <AlertDialogDescription>
              Payments linked to this account will keep their history but lose the account link.
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
