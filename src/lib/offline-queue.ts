// IndexedDB-backed outbox for offline writes. Used by Movements (and other
// modules later) so users can keep recording entries without a connection.
// Items are flushed when the browser regains connectivity.

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DB_NAME = "gasflow-offline";
const STORE = "outbox";
const VERSION = 1;

export type OutboxItem = {
  id: string;
  createdAt: number;
  table: string;
  payload: Record<string, unknown>;
  label?: string;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(item: Omit<OutboxItem, "id" | "createdAt">): Promise<OutboxItem> {
  const full: OutboxItem = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    ...item,
  };
  await tx("readwrite", (s) => s.add(full));
  notify();
  return full;
}

export async function listQueue(): Promise<OutboxItem[]> {
  const all = await tx<OutboxItem[]>("readonly", (s) => s.getAll() as IDBRequest<OutboxItem[]>);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeItem(id: string) {
  await tx("readwrite", (s) => s.delete(id));
  notify();
}

export async function pendingCount(): Promise<number> {
  return tx<number>("readonly", (s) => s.count());
}

const LISTENERS = new Set<() => void>();
export function subscribe(fn: () => void) {
  LISTENERS.add(fn);
  return () => LISTENERS.delete(fn);
}
function notify() {
  LISTENERS.forEach((fn) => {
    try { fn(); } catch { /* noop */ }
  });
}

let flushing = false;
export async function flushQueue(): Promise<{ ok: number; failed: number }> {
  if (flushing) return { ok: 0, failed: 0 };
  flushing = true;
  let ok = 0;
  let failed = 0;
  try {
    const items = await listQueue();
    for (const item of items) {
      try {
        const { error } = await supabase.from(item.table as any).insert(item.payload as any);
        if (error) throw error;
        await removeItem(item.id);
        ok++;
      } catch (e) {
        console.warn("[outbox] flush failed", item.id, e);
        failed++;
      }
    }
    if (ok > 0) toast.success(`Synced ${ok} offline entr${ok === 1 ? "y" : "ies"}`);
    if (failed > 0) toast.error(`${failed} offline entr${failed === 1 ? "y" : "ies"} could not sync`);
  } finally {
    flushing = false;
  }
  return { ok, failed };
}

let wired = false;
export function startOfflineSync() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener("online", () => { void flushQueue(); });
  // Attempt initial flush a moment after load.
  setTimeout(() => { if (navigator.onLine) void flushQueue(); }, 1500);
}
