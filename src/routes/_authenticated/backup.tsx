import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DatabaseBackup, Download, Upload, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/backup")({
  head: () => ({ meta: [{ title: "Backup & Restore — Life Care Plant" }] }),
  component: BackupPage,
});

// Tables included in a full backup. Order matters for restore (parents first).
const BACKUP_TABLES = [
  "settings",
  "gas_types",
  "cylinder_sizes",
  "part_sizes",
  "parts_stock",
  "suppliers",
  "customers",
  "customer_opening_balances",
  "gas_purchases",
  "cylinder_movements",
  "payments",
  "production",
  "expenses",
  "vehicles",
  "employees",
] as const;

function BackupPage() {
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [progress, setProgress] = useState<string>("");
  const [pendingFile, setPendingFile] = useState<{ name: string; payload: any } | null>(null);

  const exportAll = async () => {
    setBusy("export");
    setProgress("");
    try {
      const dump: Record<string, unknown[]> = {};
      for (const t of BACKUP_TABLES) {
        setProgress(`Exporting ${t}…`);
        const { data, error } = await supabase.from(t as any).select("*");
        if (error) throw new Error(`${t}: ${error.message}`);
        dump[t] = data ?? [];
      }
      const backup = {
        __meta: { app: "lifecareplant", version: 1, exported_at: new Date().toISOString() },
        tables: dump,
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lifecare-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await logAudit({
        action: "export",
        entity: "backup",
        summary: "Exported full database backup",
      });
      toast.success("Backup downloaded");
    } catch (e: any) {
      toast.error(e.message ?? "Export failed");
    } finally {
      setBusy(null);
      setProgress("");
    }
  };

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting same file
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload?.tables || typeof payload.tables !== "object") {
        throw new Error("Invalid backup file: missing 'tables'.");
      }
      setPendingFile({ name: file.name, payload });
    } catch (err: any) {
      toast.error(err.message ?? "Could not read file");
    }
  };

  const runRestore = async () => {
    if (!pendingFile) return;
    setBusy("import");
    setProgress("");
    try {
      const tables = pendingFile.payload.tables as Record<string, any[]>;
      // Upsert each table (insert or update by primary key). Parents first.
      for (const t of BACKUP_TABLES) {
        const rows = tables[t];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        setProgress(`Restoring ${t} (${rows.length})…`);
        const { error } = await supabase.from(t as any).upsert(rows as any);
        if (error) throw new Error(`${t}: ${error.message}`);
      }
      await logAudit({
        action: "other",
        entity: "backup",
        summary: `Restored backup from ${pendingFile.name}`,
      });
      toast.success("Restore complete");
      setPendingFile(null);
    } catch (e: any) {
      toast.error(e.message ?? "Restore failed");
    } finally {
      setBusy(null);
      setProgress("");
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <DatabaseBackup className="size-6" /> Backup & Restore
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Export a full JSON snapshot of your data, or restore from a backup file.
        </p>
      </header>

      <Card className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-xl bg-brand/10 text-brand grid place-items-center shrink-0">
            <Download className="size-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-display font-bold">Export Backup</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Downloads every table (customers, movements, payments, purchases, production,
              expenses, vehicles, employees and more) as a single JSON file.
            </p>
          </div>
        </div>
        <Button onClick={exportAll} disabled={busy !== null} className="gap-2">
          <Download className="size-4" />
          {busy === "export" ? progress || "Exporting…" : "Download Backup"}
        </Button>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-xl bg-warning/15 text-warning grid place-items-center shrink-0">
            <Upload className="size-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-display font-bold">Restore Backup</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Imports records from a backup file. Existing rows with the same ID are overwritten
              (upsert). New rows are added.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 flex gap-2">
          <ShieldAlert className="size-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">
            Restore overwrites records that share an ID with the backup. This cannot be undone.
            Export a fresh backup first if you're unsure.
          </p>
        </div>

        <div>
          <input
            id="restore-file"
            type="file"
            accept="application/json,.json"
            onChange={onFilePicked}
            disabled={busy !== null}
            className="hidden"
          />
          <Button asChild variant="outline" disabled={busy !== null} className="gap-2">
            <label htmlFor="restore-file" className="cursor-pointer">
              <Upload className="size-4" />
              {busy === "import" ? progress || "Restoring…" : "Choose Backup File"}
            </label>
          </Button>
        </div>
      </Card>

      <AlertDialog
        open={!!pendingFile}
        onOpenChange={(o) => {
          if (!o) setPendingFile(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore from backup?</AlertDialogTitle>
            <AlertDialogDescription>
              You're about to restore <b>{pendingFile?.name}</b>. Records with matching IDs will be
              overwritten. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={runRestore}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Restore Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
