import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, todayISO } from "@/lib/format";
import { formatM3 } from "@/lib/bulk-gas";
import { printDocument } from "@/lib/print";
import { downloadExcel } from "@/lib/excel";
import { SelfHelpCard, type SelfHelpInfo } from "@/components/self-help-card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  BarChart3,
  Download,
  Printer,
  Search,
  Calendar,
  Wallet,
  TrendingUp,
  Receipt,
  Users,
  Truck,
  Landmark,
  Coins,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Commercial Finance & Report Center — Life Care Plant" }] }),
  component: ReportsPage,
});

const helpInfo: SelfHelpInfo = {
  title: "Universal Finance & Commercial Report Center",
  whatIsIt:
    "A central hub for business performance reports including Cash Flow, Daily Closing, Income, Expenses, Outstanding Customer Dues, Supplier Payables, and Profitability.",
  whyUseIt:
    "Provides instant financial visibility without complex accounting jargon, allowing one-click PDF printing and Excel spreadsheet downloads.",
  firstStep: "Select your desired Date Range or choose a report category from the tabs.",
  requiredFields: "From Date and To Date for filtering transactions.",
  afterSaving: "Reports update dynamically. Use 'Download Excel' or 'Print PDF' to save reports.",
};

const CHART_COLORS = ["#0066cc", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

function ReportsPage() {
  const today = todayISO();
  const firstOfMonth = today.slice(0, 8) + "01";
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch complete financial data
  const { data, isLoading } = useQuery({
    queryKey: ["commercial-finance-reports", from, to],
    queryFn: async () => {
      const [moves, pays, prod, purchases, exps, custs, sups, supPays, banks, cashAdjs, settings] =
        await Promise.all([
          supabase
            .from("cylinder_movements")
            .select(
              "type,quantity,total_amount,date,customer_id,customers(name),gas_type_id,gas_types(name)",
            )
            .gte("date", from)
            .lte("date", to),
          supabase
            .from("payments")
            .select("amount,date,customer_id,customers(name),account,method")
            .gte("date", from)
            .lte("date", to),
          supabase
            .from("production")
            .select("quantity,date,gas_consumed")
            .gte("date", from)
            .lte("date", to),
          supabase
            .from("gas_purchases")
            .select("total_amount,cubic_meter,date,supplier_id,suppliers(name),gas_types(name)")
            .gte("date", from)
            .lte("date", to),
          supabase
            .from("expenses")
            .select("amount,category,date,payee,account")
            .gte("date", from)
            .lte("date", to),
          supabase.from("customers").select("id,name,opening_due,credit_limit"),
          supabase.from("suppliers").select("id,name,opening_balance"),
          supabase
            .from("supplier_payments")
            .select("amount,date,supplier_id,suppliers(name),account"),
          supabase
            .from("bank_accounts")
            .select("id,bank_name,opening_balance,account_title,account_number"),
          supabase
            .from("cash_adjustments")
            .select("amount,direction,date,reason")
            .gte("date", from)
            .lte("date", to),
          supabase.from("settings").select("currency").eq("id", 1).maybeSingle(),
        ]);

      return {
        movements: moves.data ?? [],
        payments: pays.data ?? [],
        production: prod.data ?? [],
        purchases: purchases.data ?? [],
        expenses: exps.data ?? [],
        customers: custs.data ?? [],
        suppliers: sups.data ?? [],
        supplierPayments: supPays.data ?? [],
        banks: banks.data ?? [],
        cashAdjustments: cashAdjs.data ?? [],
        currency: settings.data?.currency ?? "Rs",
      };
    },
  });

  const currency = data?.currency ?? "Rs";

  // Calculations
  const calculations = useMemo(() => {
    const ms = data?.movements ?? [];
    const ps = data?.payments ?? [];
    const pr = data?.production ?? [];
    const pur = data?.purchases ?? [];
    const exp = data?.expenses ?? [];
    const custs = data?.customers ?? [];
    const sups = data?.suppliers ?? [];
    const sps = data?.supplierPayments ?? [];
    const cashAdjs = data?.cashAdjustments ?? [];

    const totalDeliveredQty = ms
      .filter((m: any) => m.type === "deliver")
      .reduce((a: number, b: any) => a + Number(b.quantity ?? 0), 0);

    const totalReceivedQty = ms
      .filter((m: any) => m.type === "receive")
      .reduce((a: number, b: any) => a + Number(b.quantity ?? 0), 0);

    const totalRevenueBilled = ms
      .filter((m: any) => m.type === "deliver")
      .reduce((a: number, b: any) => a + Number(b.total_amount ?? 0), 0);

    const totalCustomerCollections = ps.reduce((a: number, b: any) => a + Number(b.amount ?? 0), 0);
    const totalGasPurchases = pur.reduce((a: number, b: any) => a + Number(b.total_amount ?? 0), 0);
    const totalOperatingExpenses = exp.reduce((a: number, b: any) => a + Number(b.amount ?? 0), 0);
    const totalSupplierPaymentsMade = sps.reduce(
      (a: number, b: any) => a + Number(b.amount ?? 0),
      0,
    );

    // Net Business Profit
    const netProfit = totalRevenueBilled - totalGasPurchases - totalOperatingExpenses;

    // Cash Summary
    const cashReceived = ps
      .filter((p: any) => p.account === "cash" || (p.method ?? "").toLowerCase() === "cash")
      .reduce((a: number, b: any) => a + Number(b.amount ?? 0), 0);

    const cashExpenses = exp
      .filter((e: any) => e.account === "cash")
      .reduce((a: number, b: any) => a + Number(e.amount ?? 0), 0);

    const cashSupplierPays = sps
      .filter((s: any) => s.account === "cash")
      .reduce((a: number, b: any) => a + Number(b.amount ?? 0), 0);

    const cashInjections = cashAdjs
      .filter((c: any) => c.direction === "in")
      .reduce((a: number, b: any) => a + Number(b.amount ?? 0), 0);

    const cashWithdrawals = cashAdjs
      .filter((c: any) => c.direction === "out")
      .reduce((a: number, b: any) => a + Number(b.amount ?? 0), 0);

    const netCashInHand =
      cashReceived + cashInjections - cashExpenses - cashSupplierPays - cashWithdrawals;

    // Outstanding Customer Dues Calculation
    const custDueMap = new Map<string, { id: string; name: string; due: number; limit: number }>();
    custs.forEach((c: any) =>
      custDueMap.set(c.id, {
        id: c.id,
        name: c.name,
        due: Number(c.opening_due ?? 0),
        limit: Number(c.credit_limit ?? 0),
      }),
    );
    ms.forEach((m: any) => {
      if (m.type !== "deliver" || !m.customer_id) return;
      const e = custDueMap.get(m.customer_id);
      if (e) e.due += Number(m.total_amount ?? 0);
    });
    ps.forEach((p: any) => {
      if (!p.customer_id) return;
      const e = custDueMap.get(p.customer_id);
      if (e) e.due -= Number(p.amount ?? 0);
    });
    const outstandingCustomers = Array.from(custDueMap.values())
      .filter((c) => c.due > 0)
      .sort((a, b) => b.due - a.due);
    const totalOutstandingCustomerDue = outstandingCustomers.reduce((a, b) => a + b.due, 0);

    // Outstanding Supplier Payables Calculation
    const supDueMap = new Map<string, { id: string; name: string; due: number }>();
    sups.forEach((s: any) =>
      supDueMap.set(s.id, { id: s.id, name: s.name, due: Number(s.opening_balance ?? 0) }),
    );
    pur.forEach((p: any) => {
      if (!p.supplier_id) return;
      const e = supDueMap.get(p.supplier_id);
      if (e) e.due += Number(p.total_amount ?? 0);
    });
    sps.forEach((sp: any) => {
      if (!sp.supplier_id) return;
      const e = supDueMap.get(sp.supplier_id);
      if (e) e.due -= Number(sp.amount ?? 0);
    });
    const outstandingSuppliers = Array.from(supDueMap.values())
      .filter((s) => s.due > 0)
      .sort((a, b) => b.due - a.due);
    const totalOutstandingSupplierDue = outstandingSuppliers.reduce((a, b) => a + b.due, 0);

    // Expense Breakdown
    const expCatMap = new Map<string, number>();
    exp.forEach((e: any) => {
      const cat = e.category || "Miscellaneous";
      expCatMap.set(cat, (expCatMap.get(cat) ?? 0) + Number(e.amount ?? 0));
    });
    const expenseBreakdown = Array.from(expCatMap.entries()).map(([name, value]) => ({
      name,
      value,
    }));

    return {
      totalDeliveredQty,
      totalReceivedQty,
      totalRevenueBilled,
      totalCustomerCollections,
      totalGasPurchases,
      totalOperatingExpenses,
      totalSupplierPaymentsMade,
      netProfit,
      cashReceived,
      cashExpenses,
      netCashInHand,
      outstandingCustomers,
      totalOutstandingCustomerDue,
      outstandingSuppliers,
      totalOutstandingSupplierDue,
      expenseBreakdown,
    };
  }, [data]);

  // Export CSV / Excel for active report view
  const exportCurrentReport = () => {
    if (activeTab === "customer-dues") {
      downloadExcel(
        "Outstanding_Customer_Payments",
        ["Customer Name", "Remaining Due (Rs)", "Credit Limit (Rs)", "Status"],
        calculations.outstandingCustomers.map((c) => [
          c.name,
          c.due,
          c.limit,
          c.limit > 0 && c.due > c.limit ? "Exceeded Limit" : "Normal",
        ]),
      );
    } else if (activeTab === "supplier-payables") {
      downloadExcel(
        "Outstanding_Supplier_Payables",
        ["Supplier Name", "Pending Payable Balance (Rs)"],
        calculations.outstandingSuppliers.map((s) => [s.name, s.due]),
      );
    } else if (activeTab === "expenses") {
      downloadExcel(
        "Expense_Report",
        ["Category", "Amount (Rs)"],
        calculations.expenseBreakdown.map((e) => [e.name, e.value]),
      );
    } else {
      downloadExcel(
        "Commercial_Financial_Summary",
        ["Metric", "Value"],
        [
          ["Total Revenue Billed", calculations.totalRevenueBilled],
          ["Customer Payments Received", calculations.totalCustomerCollections],
          ["Bulk Gas Purchase Cost", calculations.totalGasPurchases],
          ["Total Operating Expenses", calculations.totalOperatingExpenses],
          ["Net Business Profit", calculations.netProfit],
          ["Outstanding Customer Due", calculations.totalOutstandingCustomerDue],
          ["Outstanding Supplier Payable", calculations.totalOutstandingSupplierDue],
        ],
      );
    }
  };

  // Print PDF helper
  const handlePrintPDF = () => {
    printDocument({
      title: "Commercial Financial & Performance Report",
      subtitle: `Date Period: ${formatDate(from)} to ${formatDate(to)}`,
      bodyHtml: `
        <div style="font-family: sans-serif; font-size: 13px;">
          <h3 style="margin-bottom: 8px;">Business Performance Summary</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr><td style="padding: 6px; border: 1px solid #ddd;">Total Billed Revenue</td><td style="padding: 6px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${formatCurrency(calculations.totalRevenueBilled, currency)}</td></tr>
            <tr><td style="padding: 6px; border: 1px solid #ddd;">Payment Received from Customers</td><td style="padding: 6px; border: 1px solid #ddd; text-align: right;">${formatCurrency(calculations.totalCustomerCollections, currency)}</td></tr>
            <tr><td style="padding: 6px; border: 1px solid #ddd;">Bulk Gas Purchase Cost</td><td style="padding: 6px; border: 1px solid #ddd; text-align: right;">${formatCurrency(calculations.totalGasPurchases, currency)}</td></tr>
            <tr><td style="padding: 6px; border: 1px solid #ddd;">Operating Expenses</td><td style="padding: 6px; border: 1px solid #ddd; text-align: right;">${formatCurrency(calculations.totalOperatingExpenses, currency)}</td></tr>
            <tr style="background: #f0fdf4;"><td style="padding: 6px; border: 1px solid #ddd; font-weight: bold;">Net Profit</td><td style="padding: 6px; border: 1px solid #ddd; text-align: right; font-weight: bold; color: #16a34a;">${formatCurrency(calculations.netProfit, currency)}</td></tr>
          </table>

          <h3 style="margin-bottom: 8px;">Outstanding Balances Summary</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 6px; border: 1px solid #ddd;">Remaining Due from Customers</td><td style="padding: 6px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${formatCurrency(calculations.totalOutstandingCustomerDue, currency)}</td></tr>
            <tr><td style="padding: 6px; border: 1px solid #ddd;">Pending Due to Suppliers</td><td style="padding: 6px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${formatCurrency(calculations.totalOutstandingSupplierDue, currency)}</td></tr>
          </table>
        </div>
      `,
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="size-7 text-brand" /> Universal Report & Finance Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Commercial financial closing, cash flow, profit & loss, customer dues, supplier
            payables, and Excel/PDF downloads.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={exportCurrentReport} variant="outline" className="gap-1.5 text-xs h-10">
            <Download className="size-4" /> Export Excel
          </Button>
          <Button
            onClick={handlePrintPDF}
            className="gap-1.5 text-xs h-10 bg-brand text-brand-foreground"
          >
            <Printer className="size-4" /> Download / Print PDF
          </Button>
        </div>
      </header>

      {/* Self-Help Banner */}
      <SelfHelpCard pageKey="reports" info={helpInfo} />

      {/* Universal Date Range & Search Filters */}
      <Card className="p-4 flex items-center gap-4 flex-wrap bg-card border-brand/20">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-brand" />
          <span className="text-xs font-semibold">Date Range:</span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 text-xs w-36"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 text-xs w-36"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFrom(today);
              setTo(today);
            }}
            className="text-xs h-8"
          >
            Today
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFrom(firstOfMonth);
              setTo(today);
            }}
            className="text-xs h-8"
          >
            This Month
          </Button>
        </div>
      </Card>

      {/* Overview Stat Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 border-l-4 border-l-brand">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Total Billed Sales Revenue
          </div>
          <div className="font-display font-bold text-2xl mt-1 text-brand">
            {formatCurrency(calculations.totalRevenueBilled, currency)}
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Customer Payments Received
          </div>
          <div className="font-display font-bold text-2xl mt-1 text-emerald-600">
            {formatCurrency(calculations.totalCustomerCollections, currency)}
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Total Operating Expenses
          </div>
          <div className="font-display font-bold text-2xl mt-1 text-amber-600">
            {formatCurrency(calculations.totalOperatingExpenses, currency)}
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-purple-500">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Net Business Profit
          </div>
          <div className="font-display font-bold text-2xl mt-1 text-purple-600">
            {formatCurrency(calculations.netProfit, currency)}
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex items-center overflow-x-auto w-full no-scrollbar">
          <TabsTrigger value="overview">Executive Overview</TabsTrigger>
          <TabsTrigger value="pnl">Profit & Loss</TabsTrigger>
          <TabsTrigger value="customer-dues">Customer Remaining Dues</TabsTrigger>
          <TabsTrigger value="supplier-payables">Supplier Payables</TabsTrigger>
          <TabsTrigger value="expenses">Expense Analysis</TabsTrigger>
          <TabsTrigger value="cash-summary">Cash & Bank Summary</TabsTrigger>
        </TabsList>

        {/* Tab 1: Executive Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <h3 className="font-display text-base font-bold mb-3 flex items-center gap-2">
                <TrendingUp className="size-4 text-brand" /> Financial Health Indicators
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between p-2.5 rounded bg-muted/30">
                  <span className="text-muted-foreground">Total Cylinders Delivered:</span>
                  <span className="font-bold">
                    {calculations.totalDeliveredQty.toLocaleString()} units
                  </span>
                </div>
                <div className="flex justify-between p-2.5 rounded bg-muted/30">
                  <span className="text-muted-foreground">Empty Cylinders Received:</span>
                  <span className="font-bold">
                    {calculations.totalReceivedQty.toLocaleString()} units
                  </span>
                </div>
                <div className="flex justify-between p-2.5 rounded bg-muted/30">
                  <span className="text-muted-foreground">Bulk Gas Purchase Cost:</span>
                  <span className="font-bold">
                    {formatCurrency(calculations.totalGasPurchases, currency)}
                  </span>
                </div>
                <div className="flex justify-between p-2.5 rounded bg-muted/30">
                  <span className="text-muted-foreground">Remaining Customer Dues:</span>
                  <span className="font-bold text-amber-600">
                    {formatCurrency(calculations.totalOutstandingCustomerDue, currency)}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="font-display text-base font-bold mb-3 flex items-center gap-2">
                <Receipt className="size-4 text-emerald-600" /> Expense Category Distribution
              </h3>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={calculations.expenseBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label
                    >
                      {calculations.expenseBreakdown.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Profit & Loss */}
        <TabsContent value="pnl" className="space-y-4">
          <Card className="p-5 space-y-4">
            <h3 className="font-display text-lg font-bold">
              Profit & Loss Report ({formatDate(from)} to {formatDate(to)})
            </h3>
            <div className="space-y-2 text-xs divide-y">
              <div className="flex justify-between py-2 font-bold text-sm">
                <span>TOTAL REVENUE (DELIVERIES BILLED)</span>
                <span className="text-brand">
                  {formatCurrency(calculations.totalRevenueBilled, currency)}
                </span>
              </div>
              <div className="flex justify-between py-2 text-muted-foreground">
                <span>LESS: BULK GAS PURCHASES</span>
                <span>- {formatCurrency(calculations.totalGasPurchases, currency)}</span>
              </div>
              <div className="flex justify-between py-2 font-semibold">
                <span>GROSS PROFIT</span>
                <span>
                  {formatCurrency(
                    calculations.totalRevenueBilled - calculations.totalGasPurchases,
                    currency,
                  )}
                </span>
              </div>
              <div className="flex justify-between py-2 text-muted-foreground">
                <span>LESS: OPERATING EXPENSES</span>
                <span>- {formatCurrency(calculations.totalOperatingExpenses, currency)}</span>
              </div>
              <div className="flex justify-between py-3 font-bold text-base text-emerald-600 pt-2">
                <span>NET BUSINESS PROFIT</span>
                <span>{formatCurrency(calculations.netProfit, currency)}</span>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 3: Customer Remaining Dues */}
        <TabsContent value="customer-dues" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-display text-lg font-bold mb-3 flex items-center justify-between">
              <span>
                Outstanding Customer Payments ({calculations.outstandingCustomers.length})
              </span>
              <span className="text-sm font-semibold text-amber-600">
                Total Due: {formatCurrency(calculations.totalOutstandingCustomerDue, currency)}
              </span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b bg-muted/40 font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Credit Limit</th>
                    <th className="p-3 text-right">Remaining Due Balance</th>
                    <th className="p-3 text-right">Credit Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {calculations.outstandingCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/20">
                      <td className="p-3 font-semibold">{c.name}</td>
                      <td className="p-3">
                        {c.limit > 0 ? formatCurrency(c.limit, currency) : "No Limit"}
                      </td>
                      <td className="p-3 text-right font-bold text-amber-600">
                        {formatCurrency(c.due, currency)}
                      </td>
                      <td className="p-3 text-right font-semibold">
                        {c.limit > 0 && c.due > c.limit ? (
                          <span className="px-2 py-0.5 rounded bg-destructive/10 text-destructive">
                            Limit Exceeded
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600">
                            Normal
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {calculations.outstandingCustomers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-muted-foreground">
                        No outstanding customer dues found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 4: Supplier Payables */}
        <TabsContent value="supplier-payables" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-display text-lg font-bold mb-3 flex items-center justify-between">
              <span>
                Outstanding Supplier Payables ({calculations.outstandingSuppliers.length})
              </span>
              <span className="text-sm font-semibold text-rose-600">
                Total Payable: {formatCurrency(calculations.totalOutstandingSupplierDue, currency)}
              </span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b bg-muted/40 font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Supplier Name</th>
                    <th className="p-3 text-right">Pending Balance Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {calculations.outstandingSuppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/20">
                      <td className="p-3 font-semibold">{s.name}</td>
                      <td className="p-3 text-right font-bold text-rose-600">
                        {formatCurrency(s.due, currency)}
                      </td>
                    </tr>
                  ))}
                  {calculations.outstandingSuppliers.length === 0 && (
                    <tr>
                      <td colSpan={2} className="p-4 text-center text-muted-foreground">
                        No pending supplier balances.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 5: Expense Analysis */}
        <TabsContent value="expenses" className="space-y-4">
          <Card className="p-5">
            <h3 className="font-display text-lg font-bold mb-3">Operating Expense Summary</h3>
            <div className="space-y-2">
              {calculations.expenseBreakdown.map((e) => (
                <div
                  key={e.name}
                  className="flex justify-between items-center p-3 rounded border bg-muted/20 text-xs"
                >
                  <span className="font-semibold">{e.name}</span>
                  <span className="font-bold text-brand">{formatCurrency(e.value, currency)}</span>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Tab 6: Cash & Bank Summary */}
        <TabsContent value="cash-summary" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5 border-l-4 border-l-emerald-500">
              <h3 className="font-display text-base font-bold mb-2 flex items-center gap-2">
                <Coins className="size-5 text-emerald-600" /> Cash in Hand Summary
              </h3>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {formatCurrency(calculations.netCashInHand, currency)}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Net cash collected minus cash expenses and supplier cash payments.
              </p>
            </Card>

            <Card className="p-5 border-l-4 border-l-blue-500">
              <h3 className="font-display text-base font-bold mb-2 flex items-center gap-2">
                <Landmark className="size-5 text-blue-600" /> Bank Accounts Overview
              </h3>
              <div className="space-y-2 mt-2">
                {(data?.banks ?? []).map((b: any) => (
                  <div key={b.id} className="flex justify-between text-xs p-2 rounded bg-muted/30">
                    <div>
                      <div className="font-semibold">{b.bank_name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {b.account_number || "No account #"}
                      </div>
                    </div>
                    <div className="font-bold text-blue-600">
                      {formatCurrency(Number(b.opening_balance ?? 0), currency)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
