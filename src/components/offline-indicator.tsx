import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { flushQueue, pendingCount, subscribe } from "@/lib/offline-queue";

export function OfflineIndicator() {
  const [mounted, setMounted] = useState(false);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOnline(navigator.onLine);
    const refresh = () => {
      void pendingCount().then(setPending);
    };
    refresh();
    const unsub = subscribe(refresh);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const id = setInterval(refresh, 5000);
    return () => {
      unsub();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearInterval(id);
    };
  }, []);

  if (!mounted || (online && pending === 0)) return null;

  const sync = async () => {
    if (!online) return;
    setSyncing(true);
    try {
      await flushQueue();
    } finally {
      setSyncing(false);
      pendingCount().then(setPending);
    }
  };

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-foreground text-background text-xs font-medium px-3 py-1.5 shadow-lg">
      <CloudOff className="size-3.5" />
      {!online ? "Offline — entries saved locally" : `${pending} pending sync`}
      {online && pending > 0 && (
        <button onClick={sync} className="ml-1 inline-flex items-center gap-1 underline">
          <RefreshCw className={`size-3 ${syncing ? "animate-spin" : ""}`} /> Sync now
        </button>
      )}
    </div>
  );
}
