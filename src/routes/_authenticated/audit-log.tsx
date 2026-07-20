import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { History, Search, Plus, Pencil, Trash2, Download, LogIn, Circle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/audit-log")({
  head: () => ({ meta: [{ title: "Audit Log — Life Care Plant" }] }),
  component: AuditLogPage,
});

const ACTION_META: Record<string, { icon: any; cls: string }> = {
  create: { icon: Plus, cls: "bg-success/15 text-success" },
  update: { icon: Pencil, cls: "bg-brand/10 text-brand" },
  delete: { icon: Trash2, cls: "bg-destructive/10 text-destructive" },
  export: { icon: Download, cls: "bg-warning/15 text-warning" },
  login: { icon: LogIn, cls: "bg-muted text-foreground" },
  other: { icon: Circle, cls: "bg-muted text-foreground" },
};

function AuditLogPage() {
  const [q, setQ] = useState("");
  const [action, setAction] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["audit-log"],
    queryFn: async () =>
      (
        await supabase
          .from("audit_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500)
      ).data ?? [],
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter((r: any) => {
      if (action !== "all" && r.action !== action) return false;
      if (!s) return true;
      return (
        (r.entity ?? "").toLowerCase().includes(s) ||
        (r.summary ?? "").toLowerCase().includes(s) ||
        (r.user_email ?? "").toLowerCase().includes(s)
      );
    });
  }, [data, q, action]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <History className="size-6" /> Audit Log
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Immutable trail of key actions across the system.
        </p>
      </header>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search entity, summary or user"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 h-11"
          />
        </div>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="h-11 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="export">Export</SelectItem>
            <SelectItem value="login">Login</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {isLoading && <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>}
        {!isLoading && filtered.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No audit entries match.
          </Card>
        )}
        {filtered.map((r: any) => {
          const meta = ACTION_META[r.action] ?? ACTION_META.other;
          const Icon = meta.icon;
          return (
            <Card key={r.id} className="p-3.5 flex items-center gap-3">
              <div className={`size-9 rounded-lg grid place-items-center shrink-0 ${meta.cls}`}>
                <Icon className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {r.summary || `${r.action} on ${r.entity}`}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[10px]">
                    {r.entity}
                  </Badge>
                  {r.user_email && <span className="truncate">{r.user_email}</span>}
                </div>
              </div>
              <div className="text-right shrink-0 text-[11px] text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
