import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { errorResponse, getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { assertSubmissionsAllowed, getServiceClient } from "../_shared/supabaseAdmin.ts";
import {
  checkRateLimit,
  extractSessionId,
  hashIpSignal,
  hashSessionId,
  inferVibe,
  moderateText,
  parseJsonBody,
  sha256Hex,
  verifyCollegeToken,
} from "../_shared/security.ts";

interface CreateConfessionBody {
  text?: string;
  category?: string;
  vibe?: string;
  authorName?: string;
  pollOptions?: string[];
}

const VALID_CATEGORIES = new Set(["love", "funny", "college", "secrets", "thoughts"]);

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

    const body = await parseJsonBody<CreateConfessionBody>(req, 6144);
    if (!body) {
      return errorResponse(req, "INVALID_BODY", "Invalid request body.", 400);
    }

    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (text.length < 5 || text.length > 1000) {
      return errorResponse(
        req,
        "INVALID_LENGTH",
        "Confession must be between 5 and 1,000 characters.",
        400,
      );
    }

    const rawAuthor = typeof body.authorName === "string" ? body.authorName.trim() : "";
    const authorName = rawAuthor ? rawAuthor.slice(0, 28) : "Anonymous";
    if (rawAuthor) {
      const authorMod = moderateText(rawAuthor, { isShortLabel: true });
      if (authorMod.decision !== "approved") {
        return errorResponse(req, "INVALID_NAME", authorMod.reason ?? "Please choose a respectful display name.", 422);
      }
    }

    let pollPayload: { options: Array<{ id: string; label: string; votes: number }> } | null = null;
    if (Array.isArray(body.pollOptions) && body.pollOptions.length > 0) {
      const cleanOpts = body.pollOptions
        .filter((o): o is string => typeof o === "string")
        .map((o) => o.trim().slice(0, 60))
        .filter(Boolean)
        .slice(0, 4);

      if (cleanOpts.length >= 2) {
        for (const opt of cleanOpts) {
          const optMod = moderateText(opt, { isShortLabel: true });
          if (optMod.decision === "rejected") {
            return errorResponse(req, "INVALID_POLL", optMod.reason ?? "Poll option violates campus rules.", 422);
          }
        }
        pollPayload = {
          options: cleanOpts.map((label, idx) => ({
            id: `opt-${idx + 1}`,
            label,
            votes: 0,
          })),
        };
      }
    }

    const category = VALID_CATEGORIES.has(body.category ?? "")
      ? (body.category as string)
      : "thoughts";

    const supabase = getServiceClient();

    const capacityCheck = await assertSubmissionsAllowed(supabase);
    if (!capacityCheck.allowed) {
      return errorResponse(req, "CAPACITY_PROTECTED", capacityCheck.message!, 503);
    }

    const ipHash = await hashIpSignal(req);
    const [sessRate, ipRate] = await Promise.all([
      checkRateLimit(supabase, `confess:sess:${sessionHash}`, 3, 30 * 60),
      checkRateLimit(supabase, `confess:ip:${ipHash}`, 10, 30 * 60),
    ]);
    if (!sessRate.allowed || !ipRate.allowed) {
      return errorResponse(
        req,
        "RATE_LIMITED",
        "Confession limit reached (3 every 30 minutes). Please wait a bit.",
        429,
      );
    }

    const contentHash = await sha256Hex(text.toLowerCase().replace(/\s+/g, " "));
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: duplicate } = await supabase
      .from("confessions")
      .select("id")
      .eq("college_id", tokenPayload.collegeId)
      .eq("session_hash", sessionHash)
      .eq("content_hash", contentHash)
      .gte("created_at", oneHourAgo)
      .maybeSingle();

    if (duplicate) {
      return errorResponse(
        req,
        "DUPLICATE_SUBMISSION",
        "You already submitted this confession recently.",
        409,
      );
    }

    const moderation = moderateText(text);
    if (moderation.decision === "rejected") {
      return errorResponse(
        req,
        "MODERATION_REJECTED",
        moderation.reason ?? "Confession could not be accepted.",
        422,
      );
    }

    const vibe = inferVibe(text, body.vibe);

    const { data: inserted, error: insertError } = await supabase
      .from("confessions")
      .insert({
        college_id: tokenPayload.collegeId,
        college_code: tokenPayload.collegeCode,
        college_name: tokenPayload.collegeShortName,
        author_name: authorName,
        category,
        vibe,
        content: text,
        poll: pollPayload,
        status: moderation.decision,
        session_hash: sessionHash,
        content_hash: contentHash,
      })
      .select(
        "id, college_code, college_name, author_name, category, vibe, content, poll, status, likes_count, comments_count, created_at",
      )
      .single();

    if (insertError || !inserted) {
      return errorResponse(req, "INSERT_FAILED", "Could not save confession.", 500);
    }

    return jsonResponse(
      req,
      {
        status: inserted.status,
        message:
          inserted.status === "pending"
            ? "Your confession was received and is awaiting quick moderator approval."
            : "Your confession is live on campus!",
        confession:
          inserted.status === "approved" ? { ...inserted, is_owner: true } : null,
      },
      201,
    );
  } catch {
    return errorResponse(req, "SERVER_ERROR", "Unable to submit confession.", 500);
  }
});
