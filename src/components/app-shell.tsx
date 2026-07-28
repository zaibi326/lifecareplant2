import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Users,
  Package,
  BarChart3,
  Settings,
  Plus,
  LogOut,
  ArrowDownToLine,
  ArrowUpFromLine,
  Wallet,
  Factory,
  Flame,
  Truck,
  PackagePlus,
  Receipt,
  Car,
  UserCog,
  History,
  DatabaseBackup,
  TrendingUp,
  ArrowRightLeft,
  Coins,
  Landmark,
  Sparkles,
  ChevronDown,
  QrCode,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlobalAiDrawer } from "@/components/global-ai-drawer";
import { BarcodeQrScanner } from "@/components/barcode-qr-scanner";

type NavLeaf = { to: string; label: string; icon: any };
type NavGroup = { label: string; icon: any; children: NavLeaf[] };
type NavEntry = NavLeaf | NavGroup;

const navItems: NavEntry[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/suppliers", label: "Suppliers", icon: Truck },
  { to: "/purchases", label: "Gas Purchases", icon: PackagePlus },
  { to: "/local-filling", label: "Local Filling", icon: Flame },
  { to: "/cylinder-exchange", label: "Cylinder Exchange", icon: ArrowRightLeft },
  { to: "/cylinder-purchases", label: "New Cylinders", icon: PackagePlus },
  { to: "/stock", label: "Stock", icon: Package },
  {
    label: "Payments",
    icon: Wallet,
    children: [
      { to: "/payments", label: "Customer Payments", icon: Wallet },
      { to: "/supplier-payments", label: "Supplier Payments", icon: Wallet },
    ],
  },
  { to: "/cash", label: "Cash in Hand", icon: Coins },
  { to: "/bank", label: "Bank", icon: Landmark },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  {
    label: "Fleet & Staff",
    icon: Car,
    children: [
      { to: "/vehicles", label: "Vehicles", icon: Car },
      { to: "/drivers", label: "Drivers", icon: UserCog },
      { to: "/employees", label: "Employees", icon: UserCog },
    ],
  },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/assistant", label: "AI Assistant", icon: Sparkles },
  { to: "/profit", label: "Profit & Loss", icon: TrendingUp },
  { to: "/audit-log", label: "Audit Log", icon: History },
  { to: "/backup", label: "Backup", icon: DatabaseBackup },
  { to: "/settings", label: "Settings", icon: Settings },
];

const mobileItems = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/customers", label: "Clients", icon: Users },
  { to: "/stock", label: "Stock", icon: Package },
  { to: "/reports", label: "Reports", icon: BarChart3 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [fab, setFab] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));

    // Listen to Electron hardware scanner shortcut if running in Electron
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      (window as any).electronAPI.onBarcodeScanner(() => {
        setScannerOpen(true);
      });
    }
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 border-r bg-card flex-col">
        <div className="px-5 py-4 flex items-center justify-between gap-2 border-b">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-9 rounded-xl bg-brand text-brand-foreground grid place-items-center shadow-md shadow-brand/20 shrink-0">
              <Flame className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold tracking-tight text-sm truncate">
                Life Care Plant
              </div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground truncate">
                Powered by Braintech
              </div>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setScannerOpen(true)}
            className="size-8 rounded-lg text-brand hover:bg-brand/10 shrink-0"
            title="Scan Barcode / QR Code"
          >
            <QrCode className="size-4" />
          </Button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            if ("children" in item) {
              return <NavGroupItem key={item.label} item={item} isActive={isActive} />;
            }
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand text-brand-foreground shadow-sm"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-muted/50">
            <div className="size-8 rounded-full bg-brand/10 text-brand grid place-items-center text-xs font-bold">
              {(email?.[0] ?? "U").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{email}</div>
            </div>
            <Button size="icon" variant="ghost" onClick={signOut} className="size-8">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top header */}
      <header className="md:hidden sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b px-4 py-3 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-brand text-brand-foreground grid place-items-center">
            <Flame className="size-4" />
          </div>
          <span className="font-display font-bold text-base tracking-tight">Life Care Plant</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setScannerOpen(true)}
            className="size-9 rounded-full bg-muted/60"
            title="Scan Barcode / QR Code"
          >
            <QrCode className="size-4 text-brand" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="size-9 rounded-full bg-muted border grid place-items-center text-xs font-bold">
                {(email?.[0] ?? "U").toUpperCase()}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem disabled className="text-xs">
                {email}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setScannerOpen(true)}>
                <QrCode className="size-4 mr-2 text-brand" /> Scan Barcode / QR
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                <Settings className="size-4 mr-2" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="size-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="md:pl-64 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto p-4 md:p-8">{children}</div>
      </main>

      {/* Barcode & QR Hardware Scanner Modal */}
      <BarcodeQrScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={(code) => {
          navigate({ to: "/movements", search: { type: "receive", open: true } as any });
        }}
      />

      {/* Floating AI Assistant */}
      <GlobalAiDrawer />

      {/* Floating action button */}
      <Sheet open={fab} onOpenChange={setFab}>
        <SheetTrigger asChild>
          <button
            aria-label="Quick action"
            className="fixed right-5 bottom-24 md:bottom-8 size-14 rounded-full bg-brand text-brand-foreground shadow-xl shadow-brand/30 grid place-items-center ring-4 ring-background active:scale-95 transition-transform z-40"
          >
            <Plus className="size-6" />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-3xl border-t-0 p-6 pb-10">
          <div className="w-10 h-1.5 bg-muted rounded-full mx-auto -mt-2 mb-4" />
          <h3 className="font-display text-xl font-bold mb-4">Quick action</h3>
          <div className="grid grid-cols-2 gap-3">
            <QuickAction
              icon={ArrowDownToLine}
              label="Receive"
              desc="Cylinders from customer"
              onClick={() => {
                setFab(false);
                navigate({ to: "/movements", search: { type: "receive" } as any });
              }}
              className="bg-brand text-brand-foreground"
            />
            <QuickAction
              icon={ArrowUpFromLine}
              label="Deliver"
              desc="Cylinders to customer"
              onClick={() => {
                setFab(false);
                navigate({ to: "/movements", search: { type: "deliver" } as any });
              }}
              className="bg-primary text-primary-foreground"
            />
            <QuickAction
              icon={Wallet}
              label="Payment"
              desc="Record received amount"
              onClick={() => {
                setFab(false);
                navigate({ to: "/payments" });
              }}
              className="bg-success text-success-foreground"
            />
            <QuickAction
              icon={Factory}
              label="Production"
              desc="Log filling output"
              onClick={() => {
                setFab(false);
                navigate({ to: "/production" });
              }}
              className="bg-warning text-warning-foreground"
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-md border-t z-30">
        <div className="grid grid-cols-4 px-2 pt-2 pb-[max(8px,env(safe-area-inset-bottom))]">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
                  active ? "text-brand" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  desc,
  onClick,
  className,
}: {
  icon: typeof ArrowDownToLine;
  label: string;
  desc: string;
  onClick: () => void;
  className: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start gap-2 p-4 rounded-2xl text-left active:scale-95 transition-transform ${className}`}
    >
      <Icon className="size-6" />
      <div>
        <div className="font-semibold">{label}</div>
        <div className="text-[11px] opacity-80">{desc}</div>
      </div>
    </button>
  );
}

function NavGroupItem({
  item,
  isActive,
}: {
  item: { label: string; icon: any; children: { to: string; label: string; icon: any }[] };
  isActive: (to: string) => boolean;
}) {
  const hasActive = item.children.some((c) => isActive(c.to));
  const [open, setOpen] = useState(hasActive);
  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);
  const Icon = item.icon;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
          hasActive ? "text-brand" : "text-foreground hover:bg-muted"
        }`}
      >
        <Icon className="size-4" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="ml-4 mt-1 space-y-1 border-l pl-2">
          {item.children.map((c) => {
            const CIcon = c.icon;
            const active = isActive(c.to);
            return (
              <Link
                key={c.to}
                to={c.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand text-brand-foreground shadow-sm"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <CIcon className="size-4" />
                {c.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
