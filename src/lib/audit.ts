import { supabase } from "@/integrations/supabase/client";

export type AuditAction = "create" | "update" | "delete" | "export" | "login" | "other";

/**
 * Append an entry to the immutable audit_log. Best-effort: failures are logged
 * to the console but never throw, so they can't break the primary action.
 */
export async function logAudit(params: {
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  summary?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    const { error } = await supabase.from("audit_log").insert({
      action: params.action,
      entity: params.entity,
      entity_id: params.entityId ?? null,
      summary: params.summary ?? null,
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      meta: (params.meta ?? {}) as never,
    });
    if (error) console.warn("audit_log insert failed:", error.message);
  } catch (e) {
    console.warn("audit_log insert threw:", e);
  }
}
