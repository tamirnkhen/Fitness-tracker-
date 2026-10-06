import "server-only";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";

// Every admin read goes through here: verify the admin role against the database,
// then write an audit entry BEFORE returning any user data. Read-only by design.

async function audit(adminId: string, action: string, targetUserId: string | null, details: Record<string, unknown> = {}) {
  const { error } = await createServiceClient()
    .from("admin_audit_log")
    .insert({ admin_id: adminId, action, target_user_id: targetUserId, details });
  // No audit trail, no data.
  if (error) throw new Error(`audit log write failed: ${error.message}`);
}

export interface AdminMetrics {
  total_users: number;
  new_users_7d: number;
  dau: number;
  wau: number;
  mau: number;
  prev_week_active: number;
  churned: number;
  churn_rate: number | null;
  tasks_done_7d: number;
  avg_tasks_per_active_user_7d: number;
  onboarded_users: number;
}

export interface DirectoryRow {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  level: number;
  xp_total: number;
  created_at: string;
  last_active_at: string | null;
  onboarding_completed_at: string | null;
}

export async function getAdminOverview(search?: string) {
  const admin = await requireAdmin();
  const db = createServiceClient();
  const term = search?.trim().slice(0, 80) || null;
  await audit(admin.id, "view_user_list", null, term ? { search: term } : {});

  let query = db.from("admin_user_directory").select("*").order("created_at", { ascending: false }).limit(200);
  if (term) {
    const escaped = term.replace(/[%_,()]/g, "");
    query = query.or(`email.ilike.%${escaped}%,display_name.ilike.%${escaped}%`);
  }
  const [{ data: metrics }, { data: users }] = await Promise.all([db.rpc("admin_metrics"), query]);
  return { metrics: metrics as AdminMetrics, users: (users ?? []) as DirectoryRow[] };
}

export async function getAdminUserDetail(userId: string) {
  const admin = await requireAdmin();
  const db = createServiceClient();
  await audit(admin.id, "view_user", userId);

  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [user, goals, done, expired, open, xp, activity, character] = await Promise.all([
    db.from("admin_user_directory").select("*").eq("id", userId).maybeSingle(),
    db.from("goals").select("id, domain, custom_label, title, baseline, target, status, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    db.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "done"),
    db.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "expired"),
    db.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "open"),
    db.from("xp_events").select("id, domain, amount, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(25),
    db.from("activity_days").select("day").eq("user_id", userId).gte("day", since30),
    // Status only — admins never get the photo or avatar.
    db.from("characters").select("status, generation_count, updated_at").eq("user_id", userId).maybeSingle(),
  ]);

  return {
    user: user.data as DirectoryRow | null,
    goals: goals.data ?? [],
    counts: { done: done.count ?? 0, expired: expired.count ?? 0, open: open.count ?? 0 },
    recentXp: xp.data ?? [],
    activeDays30: activity.data?.length ?? 0,
    character: character.data as { status: string; generation_count: number; updated_at: string } | null,
  };
}

export async function getAuditLog() {
  const admin = await requireAdmin();
  await audit(admin.id, "view_audit_log", null);
  const { data } = await createServiceClient()
    .from("admin_audit_log")
    .select("id, admin_id, action, target_user_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  return data ?? [];
}
