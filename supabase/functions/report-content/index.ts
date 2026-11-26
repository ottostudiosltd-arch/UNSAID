import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { errorResponse, getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabaseAdmin.ts";
import {
  checkRateLimit,
  extractSessionId,
  hashSessionId,
  parseJsonBody,
  verifyCollegeToken,
} from "../_shared/security.ts";

interface ReportContentBody {
  targetType?: "confession" | "comment";
  targetId?: string;
  reason?: string;
  details?: string;
}

const VALID_REASONS = new Set([
  "spam",
  "harassment",
  "hate_speech",
  "doxxing",
  "self_harm",
  "other",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }
  if (req.method !== "POST") {
    return errorResponse(req, "METHOD_NOT_ALLOWED", "Only POST is allowed.", 405);
  }

  const sessionId = extractSessionId(req);
  if (!sessionId) {
    return errorResponse(req, "INVALID_SESSION", "Valid anonymous session ID is required.", 401);
  }

  try {
    const sessionHash = await hashSessionId(sessionId);
    const tokenPayload = await verifyCollegeToken(
      req.headers.get("x-college-token"),
      sessionHash,
    );
    if (!tokenPayload) {
      return errorResponse(req, "UNAUTHORIZED", "Invalid or expired campus access token.", 401);
    }

    const body = await parseJsonBody<ReportContentBody>(req, 2048);
    const targetType = body?.targetType;
    const targetId = body?.targetId?.trim() ?? "";
    const reason = body?.reason ?? "";
    const details = typeof body?.details === "string" ? body.details.trim().slice(0, 300) : null;

    if (targetType !== "confession" && targetType !== "comment") {
      return errorResponse(req, "INVALID_TARGET", "Invalid report target type.", 400);
    }
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
      return errorResponse(req, "INVALID_ID", "Invalid target ID.", 400);
    }
    if (!VALID_REASONS.has(reason)) {
      return errorResponse(req, "INVALID_REASON", "Please select a valid report reason.", 400);
    }

    const supabase = getServiceClient();

    const rate = await checkRateLimit(supabase, `report:sess:${sessionHash}`, 5, 60 * 60);
    if (!rate.allowed) {
      return errorResponse(req, "RATE_LIMITED", "Report limit reached (5 per hour).", 429);
    }

    const table = targetType === "confession" ? "confessions" : "comments";
    const { data: targetRow } = await supabase
      .from(table)
      .select("id, college_id, status")
      .eq("id", targetId)
      .maybeSingle();

    if (!targetRow || (targetRow.status !== "approved" && targetRow.college_id !== tokenPayload.collegeId)) {
      return errorResponse(req, "NOT_FOUND", "Reported content was not found.", 404);
    }

    const preserveForSafety = reason === "self_harm" || reason === "doxxing";

    const { error: insertError } = await supabase.from("reports").insert({
      college_id: targetRow.college_id,
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details || null,
      preserve_for_safety: preserveForSafety,
      session_hash: sessionHash,
    });

    if (insertError) {
      return errorResponse(req, "REPORT_FAILED", "Could not submit report.", 500);
    }

    return jsonResponse(
      req,
      { ok: true, message: "Thank you. Our moderation team will review this report." },
      201,
    );
  } catch {
    return errorResponse(req, "SERVER_ERROR", "Unable to submit report.", 500);
  }
});
