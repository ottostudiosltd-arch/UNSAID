import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { errorResponse, getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabaseAdmin.ts";
import { inferVibe, parseJsonBody, sha256Hex } from "../_shared/security.ts";

interface AdminActionBody {
  action?:
    | "dashboard"
    | "approve_confession"
    | "reject_confession"
    | "hide_confession"
    | "delete_confession"
    | "admin_create_confession"
    | "hide_comment"
    | "resolve_report"
    | "dismiss_report"
    | "toggle_submissions"
    | "run_cleanup";
  targetId?: string;
  reportId?: string;
  enabled?: boolean;
  note?: string;
  collegeId?: string;
  vibe?: string;
  authorName?: string;
  text?: string;
  pollOptions?: string[];
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

    const body = (await parseJsonBody<AdminActionBody>(req, 8192)) ?? {};
    const action = body.action ?? "dashboard";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 250) : null;

    if (action === "dashboard") {
      const [
        { data: colleges },
        { data: allConfessions },
        { data: pending },
        { data: reports },
        { data: logs },
        { data: health },
      ] = await Promise.all([
        supabase
          .from("colleges")
          .select("id, code, name, short_name")
          .eq("is_active", true)
          .order("code", { ascending: true }),
        supabase
          .from("confessions")
          .select(
            "id, college_id, college_code, college_name, author_name, category, content, status, likes_count, comments_count, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("confessions")
          .select("id, college_id, college_code, college_name, category, content, status, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(50),
        supabase
          .from("reports")
          .select(
            "id, college_id, target_type, target_id, reason, details, status, preserve_for_safety, created_at",
          )
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

      // Attach reported content text preview for easier single-post moderation
      const reportRows = reports ?? [];
      const confIds = reportRows
        .filter((r) => r.target_type === "confession")
        .map((r) => r.target_id);
      const commentIds = reportRows
        .filter((r) => r.target_type === "comment")
        .map((r) => r.target_id);

      const previewMap = new Map<string, string>();
      if (confIds.length > 0) {
        const { data: cPreviews } = await supabase
          .from("confessions")
          .select("id, content")
          .in("id", confIds);
        for (const c of cPreviews ?? []) {
          previewMap.set(c.id, c.content);
        }
      }
      if (commentIds.length > 0) {
        const { data: cmPreviews } = await supabase
          .from("comments")
          .select("id, content")
          .in("id", commentIds);
        for (const cm of cmPreviews ?? []) {
          previewMap.set(cm.id, cm.content);
        }
      }

      const enrichedReports = reportRows.map((r) => ({
        ...r,
        target_preview: previewMap.get(r.target_id) ?? null,
      }));

      return jsonResponse(req, {
        role: adminRow.role,
        colleges: colleges ?? [],
        allConfessions: allConfessions ?? [],
        pendingConfessions: pending ?? [],
        reports: enrichedReports,
        recentLogs: logs ?? [],
        health: health ?? null,
      });
    }

    if (action === "admin_create_confession") {
      const collegeId = body.collegeId?.trim() ?? "";
      const isAllColleges = collegeId === "all";
      if (!isAllColleges && !/^[0-9a-f-]{36}$/i.test(collegeId)) {
        return errorResponse(req, "INVALID_COLLEGE", "Please select a valid college.", 400);
      }

      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (text.length < 5 || text.length > 1000) {
        return errorResponse(
          req,
          "INVALID_LENGTH",
          "Notice must be between 5 and 1,000 characters.",
          400,
        );
      }

      let targetColleges: Array<{ id: string; code: string | null; name: string; short_name: string | null }> = [];
      if (isAllColleges) {
        const { data: list } = await supabase
          .from("colleges")
          .select("id, code, name, short_name")
          .eq("is_active", true);
        targetColleges = list ?? [];
      } else {
        const { data: single } = await supabase
          .from("colleges")
          .select("id, code, name, short_name")
          .eq("id", collegeId)
          .maybeSingle();
        if (single) targetColleges = [single];
      }

      if (targetColleges.length === 0) {
        return errorResponse(req, "NOT_FOUND", "Selected college not found.", 404);
      }

      const authorName =
        typeof body.authorName === "string" && body.authorName.trim()
          ? body.authorName.trim().slice(0, 28)
          : "Campus Admin";
      const vibe = inferVibe(text, body.vibe);
      const contentHash = await sha256Hex(text.toLowerCase().replace(/\s+/g, " "));

      // Prevent accidental double-tap duplicates within 5 minutes
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: existingNotice } = await supabase
        .from("confessions")
        .select("id")
        .eq("category", "notice")
        .eq("content_hash", contentHash)
        .gte("created_at", fiveMinsAgo)
        .limit(1)
        .maybeSingle();

      if (existingNotice) {
        return errorResponse(
          req,
          "DUPLICATE_SUBMISSION",
          "This exact Admin Notice was just published.",
          409,
        );
      }

      let pollPayload: { options: Array<{ id: string; label: string; votes: number }> } | null =
        null;
      if (Array.isArray(body.pollOptions) && body.pollOptions.length > 0) {
        const cleanOpts = body.pollOptions
          .filter((o): o is string => typeof o === "string")
          .map((o) => o.trim().slice(0, 60))
          .filter(Boolean)
          .slice(0, 4);
        if (cleanOpts.length >= 2) {
          pollPayload = {
            options: cleanOpts.map((label, idx) => ({
              id: `opt-${idx + 1}`,
              label,
              votes: 0,
            })),
          };
        }
      }

      const rowsToInsert = targetColleges.map((c) => ({
        college_id: c.id,
        college_code: c.code ?? "",
        college_name: c.short_name ?? c.name,
        author_name: authorName,
        category: "notice",
        vibe,
        content: text,
        poll: pollPayload,
        status: "approved",
        session_hash: `admin:${userData.user.id}`,
        content_hash: contentHash,
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("confessions")
        .insert(rowsToInsert)
        .select("id, college_id");

      if (insertError || !inserted || inserted.length === 0) {
        return errorResponse(req, "INSERT_FAILED", "Could not publish admin notice.", 500);
      }

      await supabase.from("moderation_logs").insert({
        admin_user_id: userData.user.id,
        action: "admin_create_confession",
        target_type: "notice",
        target_id: inserted[0].id,
        college_id: isAllColleges ? null : inserted[0].college_id,
        note: (isAllColleges
          ? `Admin Notice published to all ${inserted.length} colleges`
          : `Admin Notice published to ${targetColleges[0].code ?? targetColleges[0].name}`
        ).slice(0, 250),
      });

      return jsonResponse(req, { ok: true, count: inserted.length }, 201);
    }

    if (action === "delete_confession") {
      const targetId = body.targetId?.trim() ?? "";
      if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
        return errorResponse(req, "INVALID_ID", "Invalid post ID.", 400);
      }

      const { data: deleted, error } = await supabase
        .from("confessions")
        .delete()
        .eq("id", targetId)
        .select("id, college_id")
        .maybeSingle();

      if (error || !deleted) {
        return errorResponse(req, "NOT_FOUND", "Post not found.", 404);
      }

      // Auto-resolve any open reports targeting this deleted confession
      await supabase
        .from("reports")
        .update({ status: "resolved" })
        .eq("target_type", "confession")
        .eq("target_id", deleted.id)
        .in("status", ["open", "reviewed"]);

      await supabase.from("moderation_logs").insert({
        admin_user_id: userData.user.id,
        action: "delete_confession",
        target_type: "confession",
        target_id: deleted.id,
        college_id: deleted.college_id,
        note,
      });

      return jsonResponse(req, { ok: true });
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
