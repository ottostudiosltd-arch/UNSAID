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

interface GetConfessionBody {
  confessionId?: string;
  commentCursor?: string | null;
}

const COMMENTS_PAGE_SIZE = 20;

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

    const body = await parseJsonBody<GetConfessionBody>(req, 1024);
    const confessionId = body?.confessionId?.trim() ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(confessionId)) {
      return errorResponse(req, "INVALID_ID", "Invalid confession ID.", 400);
    }

    const supabase = getServiceClient();
    const rate = await checkRateLimit(supabase, `detail:sess:${sessionHash}`, 60, 60);
    if (!rate.allowed) {
      return errorResponse(req, "RATE_LIMITED", "Too many requests.", 429);
    }

    // Only approved confessions are readable
    const { data: confession, error: confError } = await supabase
      .from("confessions")
      .select(
        "id, college_id, college_code, college_name, author_name, category, vibe, content, poll, likes_count, comments_count, created_at",
      )
      .eq("id", confessionId)
      .eq("status", "approved")
      .maybeSingle();

    if (confError) {
      return errorResponse(req, "FETCH_FAILED", "Failed to load confession.", 500);
    }
    if (!confession) {
      return errorResponse(req, "NOT_FOUND", "Confession not found.", 404);
    }

    let commentQuery = supabase
      .from("comments")
      .select("id, confession_id, content, created_at")
      .eq("confession_id", confessionId)
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .limit(COMMENTS_PAGE_SIZE + 1);

    if (body?.commentCursor) {
      commentQuery = commentQuery.gt("created_at", body.commentCursor);
    }

    const { data: commentRows, error: commentError } = await commentQuery;
    if (commentError) {
      return errorResponse(req, "FETCH_FAILED", "Failed to load comments.", 500);
    }

    const comments = (commentRows ?? []).slice(0, COMMENTS_PAGE_SIZE);
    const hasMoreComments = (commentRows ?? []).length > COMMENTS_PAGE_SIZE;
    const nextCommentCursor =
      hasMoreComments && comments.length > 0
        ? comments[comments.length - 1].created_at
        : null;

    const { data: likedRow } = await supabase
      .from("confession_likes")
      .select("id")
      .eq("confession_id", confessionId)
      .eq("session_hash", sessionHash)
      .maybeSingle();

    const { college_id: _omit, ...publicConfession } = confession;

    return jsonResponse(req, {
      confession: publicConfession,
      liked: Boolean(likedRow),
      comments,
      hasMoreComments,
      nextCommentCursor,
    });
  } catch {
    return errorResponse(req, "SERVER_ERROR", "Unable to load confession details.", 500);
  }
});
