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

interface VotePollBody {
  confessionId?: string;
  optionId?: string;
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

    const body = await parseJsonBody<VotePollBody>(req, 1024);
    const confessionId = body?.confessionId?.trim() ?? "";
    const optionId = body?.optionId?.trim() ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(confessionId) || !optionId || optionId.length > 64) {
      return errorResponse(req, "INVALID_INPUT", "Invalid poll vote parameters.", 400);
    }

    const supabase = getServiceClient();
    const rate = await checkRateLimit(supabase, `poll:sess:${sessionHash}`, 60, 60);
    if (!rate.allowed) {
      return errorResponse(req, "RATE_LIMITED", "Too many poll votes. Please slow down.", 429);
    }

    const { data, error } = await supabase.rpc("vote_poll_atomic", {
      p_confession_id: confessionId,
      p_option_id: optionId,
      p_session_hash: sessionHash,
    });

    if (error || !data) {
      return errorResponse(req, "VOTE_FAILED", "Could not record poll vote.", 500);
    }

    const resObj = data as {
      ok: boolean;
      code?: string;
      message?: string;
      confession?: unknown;
    };

    if (!resObj.ok || !resObj.confession) {
      return errorResponse(
        req,
        resObj.code ?? "VOTE_FAILED",
        resObj.message ?? "Could not record vote.",
        400,
      );
    }

    return jsonResponse(req, resObj.confession);
  } catch {
    return errorResponse(req, "SERVER_ERROR", "Unable to vote on poll.", 500);
  }
});
