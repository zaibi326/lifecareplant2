// Guarded service-worker registration. Registers only in production browsers
// outside Lovable preview / iframes. Supports `?sw=off` kill switch.

const SW_PATH = "/sw.js";

function isPreviewHost(host: string): boolean {
  return (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  );
}

async function unregisterAppSW() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const r of regs) {
    const url = r.active?.scriptURL ?? r.installing?.scriptURL ?? r.waiting?.scriptURL ?? "";
    if (url.endsWith(SW_PATH)) await r.unregister();
  }
}

export async function registerPWA() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const url = new URL(window.location.href);
  const inIframe = window.self !== window.top;
  const refused =
    !import.meta.env.PROD ||
    inIframe ||
    isPreviewHost(window.location.hostname) ||
    url.searchParams.get("sw") === "off";

  if (refused) {
    await unregisterAppSW();
    return;
  }

  try {
    await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  } catch (err) {
    console.warn("[pwa] register failed", err);
  }
}
