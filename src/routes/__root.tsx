import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/geist/500.css";
import "@fontsource/geist/600.css";
import "@fontsource/geist/700.css";
import { Toaster } from "@/components/ui/sonner";
import { OfflineIndicator } from "@/components/offline-indicator";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
import { registerPWA } from "@/lib/pwa-register";
import { startOfflineSync } from "@/lib/offline-queue";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error("[ERP ERROR]", error);
  const router = useRouter();

  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  const errorMessage = error?.message || "Unknown system anomaly";
  const isNetwork = errorMessage.toLowerCase().includes("fetch") || errorMessage.toLowerCase().includes("network") || errorMessage.toLowerCase().includes("failed to fetch");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-12 text-slate-100 font-sans">
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-2xl md:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white">System Diagnostics Alert</h2>
            <p className="text-xs text-slate-400">Gas Cylinder Plant ERP Session Error</p>
          </div>
        </div>

        <div className="mt-6 rounded-lg bg-slate-900/60 p-4 border border-slate-800/80">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Error Details</div>
          <div className="mt-2 text-xs font-mono text-amber-300 break-words leading-relaxed">
            {errorMessage}
          </div>
          {isNetwork && (
            <p className="mt-2 text-[11px] text-slate-400 leading-normal">
              💡 This seems like a connection issue. Check your internet connectivity or connection to local ERP server.
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-between gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => {
                router.invalidate();
                reset();
              }}
              className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white transition-all hover:bg-brand/95 cursor-pointer shadow-lg active:scale-95"
            >
              Retry Session
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
            >
              Dashboard
            </a>
          </div>

          <button
            onClick={() => {
              navigator.clipboard.writeText(errorMessage + "\n\nStack:\n" + (error?.stack || ""));
              alert("System diagnostics copied to clipboard!");
            }}
            className="inline-flex items-center justify-center rounded-lg border border-dashed border-slate-800 bg-transparent px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-300"
          >
            Copy Logs
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Life Care Plant — Gas Cylinder Plant Management" },
      {
        name: "description",
        content:
          "Mobile-first plant management for gas cylinder operations — receive, deliver, payments, stock & production.",
      },
      { name: "theme-color", content: "#0f172a" },
      { name: "application-name", content: "Life Care Plant" },
      { name: "apple-mobile-web-app-title", content: "Life Care Plant" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "mobile-web-app-capable", content: "yes" },
      { property: "og:title", content: "Life Care Plant — Gas Cylinder Plant Management" },
      {
        property: "og:description",
        content:
          "Mobile-first plant management for gas cylinder operations — receive, deliver, payments, stock & production.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Life Care Plant — Gas Cylinder Plant Management" },
      {
        name: "twitter:description",
        content:
          "Mobile-first plant management for gas cylinder operations — receive, deliver, payments, stock & production.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/57b4ea18-cc82-4197-8ad2-f66e23880ebb/id-preview-620e5de3--c58e9277-f726-4011-9ace-fba48443f619.lovable.app-1782634805671.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/57b4ea18-cc82-4197-8ad2-f66e23880ebb/id-preview-620e5de3--c58e9277-f726-4011-9ace-fba48443f619.lovable.app-1782634805671.png",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    void registerPWA();
    startOfflineSync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <OfflineIndicator />
      <PwaInstallBanner />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
