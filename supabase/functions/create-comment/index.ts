import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { errorResponse, getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { assertSubmissionsAllowed, getServiceClient } from "../_shared/supabaseAdmin.ts";
import {
  checkRateLimit,
  extractSessionId,
  hashIpSignal,
  hashSessionId,
  moderateText,
  parseJsonBody,
  verifyCollegeToken,
} from "../_shared/security.ts";

interface CreateCommentBody {
  confessionId?: string;
  text?: string;
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

    const body = await parseJsonBody<CreateCommentBody>(req, 2048);
    const confessionId = body?.confessionId?.trim() ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(confessionId)) {
      return errorResponse(req, "INVALID_ID", "Invalid confession ID.", 400);
    }

    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (text.length < 1 || text.length > 500) {
      return errorResponse(
        req,
        "INVALID_LENGTH",
        "Comment must be between 1 and 500 characters.",
        400,
      );
    }

    const moderation = moderateText(text);
    if (moderation.decision !== "approved") {
      return errorResponse(
        req,
        "MODERATION_REJECTED",
        moderation.reason ?? "Comment violates campus safety rules.",
        422,
      );
    }

    const supabase = getServiceClient();

    const capacityCheck = await assertSubmissionsAllowed(supabase);
    if (!capacityCheck.allowed) {
      return errorResponse(req, "CAPACITY_PROTECTED", capacityCheck.message!, 503);
    }

    // Rate limit: 5 comments / 10 min per session
    const ipHash = await hashIpSignal(req);
    const [sessRate, ipRate] = await Promise.all([
      checkRateLimit(supabase, `comment:sess:${sessionHash}`, 5, 10 * 60),
      checkRateLimit(supabase, `comment:ip:${ipHash}`, 20, 10 * 60),
    ]);
    if (!sessRate.allowed || !ipRate.allowed) {
      return errorResponse(
        req,
        "RATE_LIMITED",
        "Comment limit reached (5 every 10 minutes). Please wait a bit.",
        429,
      );
    }

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "create_comment_atomic",
      {
        p_confession_id: confessionId,
        p_college_id: tokenPayload.collegeId,
        p_content: text,
        p_session_hash: sessionHash,
      },
    );

    if (rpcError || !rpcResult) {
      return errorResponse(req, "COMMENT_FAILED", "Could not post comment.", 500);
    }

    const resObj = rpcResult as {
      ok: boolean;
      code?: string;
      message?: string;
      comment?: unknown;
      comments_count?: number;
    };

    if (!resObj.ok) {
      const status =
        resObj.code === "NOT_FOUND"
          ? 404
          : resObj.code === "COMMENT_LIMIT_REACHED"
          ? 409
          : 400;
      return errorResponse(
        req,
        resObj.code ?? "COMMENT_REJECTED",
        resObj.message ?? "Could not post comment.",
        status,
      );
    }

    return jsonResponse(
      req,
      {
        comment: resObj.comment,
        commentsCount: resObj.comments_count,
      },
      201,
    );
  } catch {
    return errorResponse(req, "SERVER_ERROR", "Unable to post comment.", 500);
  }
});
