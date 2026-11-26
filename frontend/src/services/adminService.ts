import { supabase } from "../lib/supabase";
import { invokeEdge } from "./edgeApi";

export interface AdminDashboardData {
  role: string;
  pendingConfessions: Array<{
    id: string;
    college_id: string;
    category: string;
    content: string;
    status: string;
    created_at: string;
  }>;
  reports: Array<{
    id: string;
    college_id: string;
    target_type: "confession" | "comment";
    target_id: string;
    reason: string;
    details: string | null;
    status: string;
    preserve_for_safety: boolean;
    created_at: string;
  }>;
  recentLogs: Array<{
    id: string;
    action: string;
    target_type: string;
    target_id: string | null;
    note: string | null;
    created_at: string;
  }>;
  health: {
    db_mb: number;
    tier: string;
    submissions_enabled: boolean;
    confessions_count: number;
    comments_count: number;
    open_reports_count: number;
  } | null;
}

async function getAdminJwt(): Promise<string> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("Please sign in with your admin account.");
  }
  return token;
}

export async function adminSignIn(email: string, password: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function adminSignOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function fetchAdminDashboard(): Promise<AdminDashboardData> {
  const jwt = await getAdminJwt();
  return invokeEdge<AdminDashboardData>(
    "admin-moderation",
    { action: "dashboard" },
    { requireCampusToken: false, bearerJwt: jwt },
  );
}

export async function runAdminAction(body: Record<string, unknown>) {
  const jwt = await getAdminJwt();
  return invokeEdge<{ ok: boolean; result?: unknown }>(
    "admin-moderation",
    body,
    { requireCampusToken: false, bearerJwt: jwt },
  );
}
