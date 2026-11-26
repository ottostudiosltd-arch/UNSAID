import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { errorResponse, getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabaseAdmin.ts";
import { parseJsonBody } from "../_shared/security.ts";

interface AdminActionBody {
  action?:
    | "dashboard"
    | "approve_confession"
    | "reject_confession"
    | "hide_confession"
    | "hide_comment"
    | "resolve_report"
    | "dismiss_report"
    | "toggle_submissions"
    | "run_cleanup";
  targetId?: string;
  reportId?: string;
  enabled?: boolean;
  note?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }
  if (req.method !== "POST") {
    return errorResponse(req, "METHOD_NOT_ALLOWED", "Only POST is allowed.", 405);
  }

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!jwt) {
      return errorResponse(req, "UNAUTHORIZED", "Admin authentication required.", 401);
    }

    const supabase = getServiceClient();
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return errorResponse(req, "UNAUTHORIZED", "Invalid admin session.", 401);
    }

    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("user_id, role, is_active")
      .eq("user_id", userData.user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!adminRow) {
      return errorResponse(req, "FORBIDDEN", "Admin privileges required.", 403);
    }

    const body = (await parseJsonBody<AdminActionBody>(req, 4096)) ?? {};
    const action = body.action ?? "dashboard";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 250) : null;

    if (action === "dashboard") {
      const [{ data: pending }, { data: reports }, { data: logs }, { data: health }] =
        await Promise.all([
          supabase
            .from("confessions")
            .select("id, college_id, category, content, status, created_at")
            .eq("status", "pending")
            .order("created_at", { ascending: true })
            .limit(50),
          supabase
            .from("reports")
            .select("id, college_id, target_type, target_id, reason, details, status, preserve_for_safety, created_at")
            .in("status", ["open", "reviewed"])
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("moderation_logs")
            .select("id, admin_user_id, action, target_type, target_id, note, created_at")
            .order("created_at", { ascending: false })
            .limit(30),
          supabase.rpc("get_database_health"),
        ]);

      return jsonResponse(req, {
        role: adminRow.role,
        pendingConfessions: pending ?? [],
        reports: reports ?? [],
        recentLogs: logs ?? [],
        health: health ?? null,
      });
    }

    if (action === "approve_confession" || action === "reject_confession" || action === "hide_confession") {
      const targetId = body.targetId?.trim() ?? "";
      if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
        return errorResponse(req, "INVALID_ID", "Invalid confession ID.", 400);
      }
      const nextStatus =
        action === "approve_confession"
          ? "approved"
          : action === "reject_confession"
          ? "rejected"
          : "hidden";

      const { data: updated, error } = await supabase
        .from("confessions")
        .update({ status: nextStatus })
        .eq("id", targetId)
        .select("id, college_id")
        .maybeSingle();

      if (error || !updated) {
        return errorResponse(req, "NOT_FOUND", "Confession not found.", 404);
      }

      await supabase.from("moderation_logs").insert({
        admin_user_id: userData.user.id,
        action,
        target_type: "confession",
        target_id: updated.id,
        college_id: updated.college_id,
        note,
      });

      return jsonResponse(req, { ok: true, status: nextStatus });
    }

    if (action === "hide_comment") {
      const targetId = body.targetId?.trim() ?? "";
      if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
        return errorResponse(req, "INVALID_ID", "Invalid comment ID.", 400);
      }

      const { data: updated, error } = await supabase
        .from("comments")
        .update({ status: "hidden" })
        .eq("id", targetId)
        .select("id, college_id")
        .maybeSingle();

      if (error || !updated) {
        return errorResponse(req, "NOT_FOUND", "Comment not found.", 404);
      }

      await supabase.from("moderation_logs").insert({
        admin_user_id: userData.user.id,
        action: "hide_comment",
        target_type: "comment",
        target_id: updated.id,
        college_id: updated.college_id,
        note,
      });

      return jsonResponse(req, { ok: true });
    }

    if (action === "resolve_report" || action === "dismiss_report") {
      const reportId = (body.reportId ?? body.targetId)?.trim() ?? "";
      if (!/^[0-9a-f-]{36}$/i.test(reportId)) {
        return errorResponse(req, "INVALID_ID", "Invalid report ID.", 400);
      }
      const nextStatus = action === "resolve_report" ? "resolved" : "dismissed";

      const { data: updated, error } = await supabase
        .from("reports")
        .update({ status: nextStatus })
        .eq("id", reportId)
        .select("id, college_id")
        .maybeSingle();

      if (error || !updated) {
        return errorResponse(req, "NOT_FOUND", "Report not found.", 404);
      }

      await supabase.from("moderation_logs").insert({
        admin_user_id: userData.user.id,
        action,
        target_type: "report",
        target_id: updated.id,
        college_id: updated.college_id,
        note,
      });

      return jsonResponse(req, { ok: true, status: nextStatus });
    }

    if (action === "toggle_submissions") {
      const enabled = Boolean(body.enabled);
      await supabase
        .from("system_controls")
        .upsert({
          key: "submissions_enabled",
          value: { enabled, reason: note },
          updated_at: new Date().toISOString(),
        });

      await supabase.from("moderation_logs").insert({
        admin_user_id: userData.user.id,
        action: "toggle_submissions",
        target_type: "system",
        note: `submissions_enabled=${enabled}${note ? `: ${note}` : ""}`.slice(0, 250),
      });

      return jsonResponse(req, { ok: true, enabled });
    }

    if (action === "run_cleanup") {
      const { data: cleanupResult, error } = await supabase.rpc("cleanup_expired_records");
      if (error) {
        return errorResponse(req, "CLEANUP_FAILED", "Cleanup failed.", 500);
      }

      await supabase.from("moderation_logs").insert({
        admin_user_id: userData.user.id,
        action: "run_cleanup",
        target_type: "system",
        note: JSON.stringify(cleanupResult).slice(0, 250),
      });

      return jsonResponse(req, { ok: true, result: cleanupResult });
    }

    return errorResponse(req, "INVALID_ACTION", "Unsupported moderation action.", 400);
  } catch {
    return errorResponse(req, "SERVER_ERROR", "Moderation request failed.", 500);
  }
});
