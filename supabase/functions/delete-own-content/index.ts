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

interface DeleteOwnBody {
  targetType?: "confession" | "comment";
  targetId?: string;
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

    const body = await parseJsonBody<DeleteOwnBody>(req, 1024);
    const targetType = body?.targetType === "comment" ? "comment" : body?.targetType === "confession" ? "confession" : null;
    const targetId = body?.targetId?.trim() ?? "";

    if (!targetType || !/^[0-9a-f-]{36}$/i.test(targetId)) {
      return errorResponse(req, "INVALID_REQUEST", "Valid target type and ID are required.", 400);
    }

    const supabase = getServiceClient();

    const rate = await checkRateLimit(supabase, `del:sess:${sessionHash}`, 30, 10 * 60);
    if (!rate.allowed) {
      return errorResponse(req, "RATE_LIMITED", "Too many delete requests. Please wait a moment.", 429);
    }

    if (targetType === "confession") {
      const { data: deleted, error } = await supabase
        .from("confessions")
        .delete()
        .eq("id", targetId)
        .eq("session_hash", sessionHash)
        .select("id")
        .maybeSingle();

      if (error) {
        return errorResponse(req, "DELETE_FAILED", "Could not delete confession.", 500);
      }

      if (!deleted) {
        return errorResponse(
          req,
          "FORBIDDEN",
          "You can only delete confessions posted from this device.",
          403,
        );
      }

      await supabase
        .from("reports")
        .update({ status: "resolved" })
        .eq("target_type", "confession")
        .eq("target_id", deleted.id)
        .in("status", ["open", "reviewed"]);

      return jsonResponse(req, { ok: true, targetType: "confession", id: deleted.id });
    }

    // Comment deletion (atomic ownership + count decrement)
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "delete_comment_atomic",
      {
        p_comment_id: targetId,
        p_session_hash: sessionHash,
        p_is_admin: false,
      },
    );

    if (rpcError || !rpcResult) {
      return errorResponse(req, "DELETE_FAILED", "Could not delete comment.", 500);
    }

    const resObj = rpcResult as {
      ok: boolean;
      code?: string;
      message?: string;
      confession_id?: string;
      comments_count?: number;
    };

    if (!resObj.ok) {
      const status = resObj.code === "NOT_FOUND" ? 404 : resObj.code === "FORBIDDEN" ? 403 : 400;
      return errorResponse(
        req,
        resObj.code ?? "DELETE_REJECTED",
        resObj.message ?? "Could not delete comment.",
        status,
      );
    }

    return jsonResponse(req, {
      ok: true,
      targetType: "comment",
      id: targetId,
      confessionId: resObj.confession_id,
      commentsCount: resObj.comments_count ?? 0,
    });
  } catch {
    return errorResponse(req, "SERVER_ERROR", "Unable to delete item right now.", 500);
  }
});
