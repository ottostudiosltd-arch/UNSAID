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

interface ToggleLikeBody {
  confessionId?: string;
}

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

    const body = await parseJsonBody<ToggleLikeBody>(req, 1024);
    const confessionId = body?.confessionId?.trim() ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(confessionId)) {
      return errorResponse(req, "INVALID_ID", "Invalid confession ID.", 400);
    }

    const supabase = getServiceClient();
    const rate = await checkRateLimit(supabase, `like:sess:${sessionHash}`, 60, 60);
    if (!rate.allowed) {
      return errorResponse(req, "RATE_LIMITED", "Slow down on likes.", 429);
    }

    const { data, error } = await supabase.rpc("toggle_confession_like", {
      p_confession_id: confessionId,
      p_college_id: tokenPayload.collegeId,
      p_session_hash: sessionHash,
    });

    if (error || !data) {
      return errorResponse(req, "LIKE_FAILED", "Could not update like.", 500);
    }

    const result = data as { ok: boolean; liked?: boolean; likes_count?: number };
    if (!result.ok) {
      return errorResponse(req, "NOT_FOUND", "Confession not found.", 404);
    }

    return jsonResponse(req, {
      liked: result.liked,
      likesCount: result.likes_count,
    });
  } catch {
    return errorResponse(req, "SERVER_ERROR", "Unable to toggle like.", 500);
  }
});
