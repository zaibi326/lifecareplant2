import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, todayISO } from "@/lib/format";
import { formatM3, gasConsumed } from "@/lib/bulk-gas";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SelfHelpCard, FormTip, type SelfHelpInfo } from "@/components/self-help-card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { Plus, Factory, Activity, Gauge, Flame, Calendar, Search, Filter } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/production")({
  validateSearch: (s: Record<string, unknown>) => ({
    open: s.open === true || s.open === "true",
  }),
  head: () => ({ meta: [{ title: "Production Management — Life Care Plant" }] }),
  component: ProductionPage,
});

const helpInfo: SelfHelpInfo = {
  title: "Filling Production & Batches",
  whatIsIt:
    "Log daily cylinder filling batches at the plant, track operator output, bulk gas consumption, wastage, and filling efficiency.",
  whyUseIt:
    "Auto-deducts bulk gas inventory, monitors plant production efficiency, tracks gas loss, and maintains a complete digital batch register.",
  firstStep: "Click the '+ Log New Batch' button on the top right.",
  requiredFields: "Select Gas Type, Cylinder Size, Cylinders Filled, Shift, and Bulk Gas Used.",
  afterSaving:
    "Bulk gas is automatically deducted from stock, and production KPI charts update instantly.",
};

function ProductionPage() {
  const searchRoute = Route.useSearch();
  const [open, setOpen] = useState(searchRoute.open ?? false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [shiftFilter, setShiftFilter] = useState("all");

  useEffect(() => {
    if (searchRoute.open) {
      setOpen(true);
    }
  }, [searchRoute.open]);

  const { data, isLoading } = useQuery({
    queryKey: ["production-full"],
    queryFn: async () => {
      const { data } = await supabase
        .from("production")
        .select("*,gas_types(name,color),cylinder_sizes(name,capacity,capacity_unit)")
        .order("created_at", { ascending: false })
        .limit(300);
      return data ?? [];
    },
  });

  const records = useMemo(() => data ?? [], [data]);

  // Key KPI Metrics
  const totalFilled = records.reduce((a, b: any) => a + Number(b.quantity ?? 0), 0);
  const totalConsumed = records.reduce((a, b: any) => a + Number(b.gas_consumed ?? 0), 0);
  const totalWastage = records.reduce((a, b: any) => a + Number(b.gas_loss ?? 0), 0);

  const avgEfficiency = useMemo(() => {
    const valid = records.filter(
      (r: any) => r.efficiency_percentage && r.efficiency_percentage > 0,
    );
    if (valid.length === 0) return 100;
    const sum = valid.reduce((a, b: any) => a + Number(b.efficiency_percentage), 0);
    return Math.round(sum / valid.length);
  }, [records]);

  // Filtered Production Register
  const filteredRecords = useMemo(() => {
    return records.filter((r: any) => {
      const matchSearch =
        !search ||
        (r.batch_number ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (r.operator_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (r.gas_types?.name ?? "").toLowerCase().includes(search.toLowerCase());

      const matchShift = shiftFilter === "all" || r.shift === shiftFilter;
      return matchSearch && matchShift;
    });
  }, [records, search, shiftFilter]);

  // Daily Chart Series
  const dailyChartData = useMemo(() => {
    const map = new Map<string, { date: string; filled: number; gasUsed: number }>();
    records.slice(0, 30).forEach((r: any) => {
      const key = r.date;
      const e = map.get(key) ?? {
        date: formatDate(key),
        filled: 0,
        gasUsed: 0,
      };
      e.filled += Number(r.quantity ?? 0);
      e.gasUsed += Number(r.gas_consumed ?? 0);
      map.set(key, e);
    });
    return Array.from(map.values()).reverse();
  }, [records]);

  // Monthly Summary
  const monthlySummary = useMemo(() => {
    const map = new Map<
      string,
      { month: string; filled: number; gasUsed: number; wastage: number; batches: number }
    >();
    records.forEach((r: any) => {
      const monthKey = (r.date ?? todayISO()).slice(0, 7);
      const e = map.get(monthKey) ?? {
        month: monthKey,
        filled: 0,
        gasUsed: 0,
        wastage: 0,
        batches: 0,
      };
      e.filled += Number(r.quantity ?? 0);
      e.gasUsed += Number(r.gas_consumed ?? 0);
      e.wastage += Number(r.gas_loss ?? 0);
      e.batches += 1;
      map.set(monthKey, e);
    });
    return Array.from(map.values());
  }, [records]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Factory className="size-7 text-brand" /> Production Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Plant filling batches, operator logs, bulk gas wastage tracking, and efficiency
            analytics.
          </p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button className="gap-2 bg-brand text-brand-foreground hover:bg-brand/90 shadow-md">
              <Plus className="size-4" /> Log New Batch
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Log Production Batch</SheetTitle>
            </SheetHeader>
            <ProductionBatchForm onDone={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>

      {/* Self-Help Guide */}
      <SelfHelpCard pageKey="production" info={helpInfo} />

      {/* KPI Dashboard Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 flex items-center gap-3 border-l-4 border-l-brand">
          <div className="size-10 rounded-xl bg-brand/10 text-brand grid place-items-center">
            <Flame className="size-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Total Cylinders Filled
            </div>
            <div className="font-display font-bold text-2xl mt-0.5">
              {totalFilled.toLocaleString()} <span className="text-xs font-normal">cyl</span>
            </div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3 border-l-4 border-l-blue-500">
          <div className="size-10 rounded-xl bg-blue-500/10 text-blue-500 grid place-items-center">
            <Activity className="size-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Bulk Gas Used
            </div>
            <div className="font-display font-bold text-2xl mt-0.5">{formatM3(totalConsumed)}</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3 border-l-4 border-l-emerald-500">
          <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 grid place-items-center">
            <Gauge className="size-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Avg Filling Efficiency
            </div>
            <div className="font-display font-bold text-2xl mt-0.5">{avgEfficiency}%</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3 border-l-4 border-l-amber-500">
          <div className="size-10 rounded-xl bg-amber-500/10 text-amber-500 grid place-items-center">
            <Activity className="size-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Total Gas Wastage / Loss
            </div>
            <div className="font-display font-bold text-2xl mt-0.5">{formatM3(totalWastage)}</div>
          </div>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="dashboard">KPI Dashboard</TabsTrigger>
          <TabsTrigger value="register">Daily Register</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Summary</TabsTrigger>
          <TabsTrigger value="charts">Production Charts</TabsTrigger>
        </TabsList>

        {/* Tab 1: KPI Dashboard & Recent Batches */}
        <TabsContent value="dashboard" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
              <Activity className="size-5 text-brand" /> Production Output & Gas Consumption Trend
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="filled"
                    name="Cylinders Filled"
                    fill="var(--brand, #0066cc)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="gasUsed"
                    name="Bulk Gas Used (m³)"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 2: Daily Register with Filters */}
        <TabsContent value="register" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search batch #, operator, gas..."
                className="pl-9 h-10"
              />
            </div>
            <div className="w-44">
              <Select value={shiftFilter} onValueChange={setShiftFilter}>
                <SelectTrigger className="h-10">
                  <Filter className="size-3.5 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shifts</SelectItem>
                  <SelectItem value="Morning">Morning Shift</SelectItem>
                  <SelectItem value="Evening">Evening Shift</SelectItem>
                  <SelectItem value="Night">Night Shift</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            {isLoading && (
              <Card className="p-6 text-sm text-muted-foreground">Loading production batches…</Card>
            )}
            {!isLoading && filteredRecords.length === 0 && (
              <Card className="p-8 text-center text-sm text-muted-foreground">
                No production batches found.
              </Card>
            )}

            {filteredRecords.map((p: any) => (
              <Card
                key={p.id}
                className="p-4 flex items-center gap-4 hover:border-brand/40 transition-colors"
              >
                <div
                  className="size-12 rounded-xl grid place-items-center text-white font-bold text-xs shrink-0 shadow-sm"
                  style={{ background: p.gas_types?.color || "var(--brand, #0066cc)" }}
                >
                  {(p.gas_types?.name ?? "—").slice(0, 2).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">
                      {p.gas_types?.name ?? "—"} • {p.cylinder_sizes?.name ?? ""}
                    </span>
                    {p.batch_number && (
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-muted">
                        {p.batch_number}
                      </span>
                    )}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-brand/10 text-brand">
                      {p.shift || "Morning"} Shift
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                    <span>Date: {formatDate(p.date)}</span>
                    {p.operator_name && <span>Operator: {p.operator_name}</span>}
                    {p.gas_consumed != null && <span>Gas Used: {formatM3(p.gas_consumed)}</span>}
                    {p.gas_loss != null && Number(p.gas_loss) > 0 && (
                      <span className="text-amber-600">Loss: {formatM3(p.gas_loss)}</span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-display font-bold text-xl">{p.quantity} cyl</div>
                  {p.efficiency_percentage && (
                    <div className="text-[11px] font-semibold text-emerald-600">
                      {Math.round(p.efficiency_percentage)}% Efficiency
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab 3: Monthly Production Summary */}
        <TabsContent value="monthly" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
              <Calendar className="size-5 text-brand" /> Monthly Filling Summary
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b bg-muted/40 font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Month</th>
                    <th className="p-3">Batches Logged</th>
                    <th className="p-3">Total Cylinders Filled</th>
                    <th className="p-3">Bulk Gas Consumed</th>
                    <th className="p-3">Gas Wastage / Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {monthlySummary.map((m) => (
                    <tr key={m.month} className="hover:bg-muted/20">
                      <td className="p-3 font-semibold">{m.month}</td>
                      <td className="p-3">{m.batches}</td>
                      <td className="p-3 font-bold text-brand">{m.filled.toLocaleString()} cyl</td>
                      <td className="p-3 font-medium">{formatM3(m.gasUsed)}</td>
                      <td className="p-3 text-amber-600">{formatM3(m.wastage)}</td>
                    </tr>
                  ))}
                  {monthlySummary.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-muted-foreground">
                        No monthly records available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 4: Production Charts & Trends */}
        <TabsContent value="charts" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
              <Gauge className="size-5 text-emerald-600" /> Daily Production Efficiency Trend
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyChartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="filled"
                    name="Cylinders Output"
                    stroke="var(--brand, #0066cc)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProductionBatchForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [gas, setGas] = useState("");
  const [size, setSize] = useState("");
  const [shift, setShift] = useState("Morning");
  const [qty, setQty] = useState<number>(0);
  const [customBulkUsed, setCustomBulkUsed] = useState<string>("");
  const [date, setDate] = useState(todayISO());
  const [batchNum, setBatchNum] = useState(
    `BATCH-${todayISO().replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`,
  );

  const { data: lookups } = useQuery({
    queryKey: ["prod-lookups"],
    queryFn: async () => {
      const [g, s] = await Promise.all([
        supabase.from("gas_types").select("id,name").eq("active", true).order("name"),
        supabase
          .from("cylinder_sizes")
          .select("id,name,capacity,capacity_unit")
          .eq("active", true)
          .order("name"),
      ]);
      return { gases: g.data ?? [], sizes: s.data ?? [] };
    },
  });

  const selectedSize = (lookups?.sizes ?? []).find((s: any) => s.id === size);
  const capacity = selectedSize?.capacity ?? null;
  const capacityUnit = selectedSize?.capacity_unit ?? "m3";

  // Expected standard consumption
  const expectedConsumed = gasConsumed(capacity, qty, capacityUnit);
  // Actual bulk gas used (from user input or default to expected)
  const actualBulkUsed = customBulkUsed ? Number(customBulkUsed) : expectedConsumed;
  // Gas loss / wastage
  const gasLoss = Math.max(0, actualBulkUsed - expectedConsumed);
  // Filling efficiency
  const efficiency =
    actualBulkUsed > 0 ? Math.min(100, Math.round((expectedConsumed / actualBulkUsed) * 100)) : 100;

  const save = useMutation({
    mutationFn: async (f: FormData) => {
      if (!gas) throw new Error("Please select a Gas Type first.");
      if (!size) throw new Error("Please select a Cylinder Size.");
      if (!qty || qty <= 0) throw new Error("Cylinders Filled must be greater than 0.");

      const { error } = await supabase.from("production").insert({
        batch_number: batchNum,
        shift,
        gas_type_id: gas,
        cylinder_size_id: size,
        quantity: qty,
        expected_gas_consumed: expectedConsumed,
        gas_consumed: actualBulkUsed,
        gas_loss: gasLoss,
        efficiency_percentage: efficiency,
        consumed_unit: "m3",
        date,
        operator_name: String(f.get("operator_name") ?? "").trim() || null,
        remarks: String(f.get("remarks") ?? "").trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Production batch logged successfully! Bulk gas inventory auto-updated.");
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
      className="mt-4 space-y-4"
    >
      <div>
        <Label className="text-xs font-semibold">Batch Number*</Label>
        <Input
          value={batchNum}
          onChange={(e) => setBatchNum(e.target.value)}
          className="mt-1 h-10 font-mono text-xs"
          required
        />
        <FormTip text="Auto-generated batch reference number for tracking." />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-semibold">Batch Date*</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 h-10 text-xs"
            required
          />
        </div>
        <div>
          <Label className="text-xs font-semibold">Shift*</Label>
          <Select value={shift} onValueChange={setShift}>
            <SelectTrigger className="mt-1 h-10 text-xs">
              <SelectValue placeholder="Shift" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Morning">Morning Shift</SelectItem>
              <SelectItem value="Evening">Evening Shift</SelectItem>
              <SelectItem value="Night">Night Shift</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-semibold">Gas Type*</Label>
          <Select value={gas} onValueChange={setGas}>
            <SelectTrigger className="mt-1 h-10 text-xs">
              <SelectValue placeholder="Select Gas" />
            </SelectTrigger>
            <SelectContent>
              {lookups?.gases.map((g: any) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormTip text="Select the gas being filled into cylinders." />
        </div>

        <div>
          <Label className="text-xs font-semibold">Cylinder Size*</Label>
          <Select value={size} onValueChange={setSize}>
            <SelectTrigger className="mt-1 h-10 text-xs">
              <SelectValue placeholder="Select Size" />
            </SelectTrigger>
            <SelectContent>
              {lookups?.sizes.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.capacity} {s.capacity_unit})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormTip text="Physical cylinder capacity." />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-semibold">Cylinders Filled*</Label>
          <Input
            type="number"
            min="1"
            value={qty || ""}
            onChange={(e) => setQty(Number(e.target.value))}
            placeholder="Quantity filled"
            className="mt-1 h-10 text-xs"
            required
          />
          <FormTip text="Number of cylinders completed in batch." />
        </div>

        <div>
          <Label className="text-xs font-semibold">Bulk Gas Used (m³)</Label>
          <Input
            type="number"
            step="0.1"
            value={customBulkUsed}
            onChange={(e) => setCustomBulkUsed(e.target.value)}
            placeholder={expectedConsumed ? expectedConsumed.toFixed(1) : "Bulk gas m³"}
            className="mt-1 h-10 text-xs"
          />
          <FormTip text="Leave empty to auto-calculate from standard capacity." />
        </div>
      </div>

      {/* Real-time efficiency calculation preview */}
      {qty > 0 && capacity != null && (
        <Card className="p-3 bg-muted/40 border-brand/20 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Standard Expected Gas:</span>
            <span className="font-semibold">{formatM3(expectedConsumed)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Actual Bulk Used:</span>
            <span className="font-semibold">{formatM3(actualBulkUsed)}</span>
          </div>
          <div className="flex justify-between text-amber-600">
            <span>Calculated Gas Wastage:</span>
            <span className="font-semibold">{formatM3(gasLoss)}</span>
          </div>
          <div className="flex justify-between text-emerald-600 pt-1 border-t">
            <span className="font-semibold">Batch Efficiency:</span>
            <span className="font-bold">{efficiency}%</span>
          </div>
        </Card>
      )}

      <div>
        <Label className="text-xs font-semibold">Operator / Filling Supervisor</Label>
        <Input name="operator_name" placeholder="Operator name" className="mt-1 h-10 text-xs" />
        <FormTip text="Name of operator managing this filling batch." />
      </div>

      <div>
        <Label className="text-xs font-semibold">Remarks & Notes</Label>
        <Textarea
          name="remarks"
          placeholder="Optional batch notes..."
          className="mt-1 text-xs"
          rows={2}
        />
      </div>

      <Button
        type="submit"
        disabled={save.isPending}
        className="w-full h-11 bg-brand text-brand-foreground font-semibold"
      >
        {save.isPending ? "Logging Batch..." : "Save Production Batch"}
      </Button>
    </form>
  );
}
