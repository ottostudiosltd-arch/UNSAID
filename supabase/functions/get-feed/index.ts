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

interface GetFeedBody {
  category?: string;
  sort?: "trending" | "latest" | "most_discussed";
  cursor?: string | null;
  scope?: "campus" | "explore";
  collegeFilter?: string;
  limit?: number;
}

const VALID_CATEGORIES = new Set([
  "all",
  "love",
  "funny",
  "college",
  "secrets",
  "thoughts",
  "notice",
]);
const PAGE_SIZE = 15;

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

    const supabase = getServiceClient();

    const rate = await checkRateLimit(supabase, `feed:sess:${sessionHash}`, 60, 60);
    if (!rate.allowed) {
      return errorResponse(req, "RATE_LIMITED", "Too many feed requests. Slow down slightly.", 429);
    }

    const body = (await parseJsonBody<GetFeedBody>(req, 2048)) ?? {};
    const category = VALID_CATEGORIES.has(body.category ?? "all")
      ? (body.category ?? "all")
      : "all";
    const sort = body.sort ?? "latest";
    const scope = body.scope === "explore" ? "explore" : "campus";
    const limit = Math.min(Math.max(Number(body.limit ?? PAGE_SIZE), 1), PAGE_SIZE);

    let query = supabase
      .from("confessions")
      .select(
        "id, college_code, college_name, author_name, category, vibe, content, poll, likes_count, comments_count, session_hash, created_at",
      )
      .eq("status", "approved");

    if (scope === "campus") {
      query = query.or(`college_id.eq.${tokenPayload.collegeId},is_global.eq.true`);
    } else if (body.collegeFilter && body.collegeFilter !== "all") {
      const code = body.collegeFilter.trim().toUpperCase();
      query = query.or(`college_code.eq.${code},is_global.eq.true`);
    }

    if (category !== "all") {
      query = query.eq("category", category);
    }

    if (sort === "trending") {
      query = query
        .order("likes_count", { ascending: false })
        .order("comments_count", { ascending: false })
        .order("created_at", { ascending: false });
    } else if (sort === "most_discussed") {
      query = query
        .order("comments_count", { ascending: false })
        .order("created_at", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
      if (body.cursor) {
        query = query.lt("created_at", body.cursor);
      }
    }

    const fetchLimit = scope === "explore" ? limit * 3 + 1 : limit + 1;
    if (sort !== "latest" && body.cursor) {
      const offset = Number(body.cursor);
      if (Number.isFinite(offset) && offset >= 0) {
        query = query.range(offset, offset + fetchLimit - 1);
      } else {
        query = query.limit(fetchLimit);
      }
    } else {
      query = query.limit(fetchLimit);
    }

    const { data: rows, error } = await query;
    if (error) {
      return errorResponse(req, "FEED_FETCH_FAILED", "Could not load campus confessions.", 500);
    }

    const rawRows = rows ?? [];
    const seenIds = new Set<string>();
    const seenBroadcasts = new Set<string>();
    const dedupedRows = rawRows.filter((row) => {
      if (seenIds.has(row.id)) return false;
      seenIds.add(row.id);

      // In Explore, collapse identical broadcast Admin Notices into 1 card
      if (scope === "explore" && row.category === "notice" && (!body.collegeFilter || body.collegeFilter === "all")) {
        const key = `${row.author_name}:${row.content}`;
        if (seenBroadcasts.has(key)) return false;
        seenBroadcasts.add(key);
      }
      return true;
    });

    const slicedItems = dedupedRows.slice(0, limit);
    const hasMore = dedupedRows.length > limit;

    let nextCursor: string | null = null;
    if (hasMore && slicedItems.length > 0) {
      if (sort === "latest") {
        nextCursor = slicedItems[slicedItems.length - 1].created_at;
      } else {
        const currentOffset = Number(body.cursor ?? 0);
        nextCursor = String((Number.isFinite(currentOffset) ? currentOffset : 0) + slicedItems.length);
      }
    }

    const ids = slicedItems.map((i) => i.id);
    let likedIds: string[] = [];
    if (ids.length > 0) {
      const { data: likes } = await supabase
        .from("confession_likes")
        .select("confession_id")
        .eq("session_hash", sessionHash)
        .in("confession_id", ids);
      likedIds = (likes ?? []).map((l) => l.confession_id);
    }

    let vibeQuery = supabase
      .from("confessions")
      .select("vibe")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(200);
    if (scope === "campus") {
      vibeQuery = vibeQuery.eq("college_id", tokenPayload.collegeId);
    }
    const { data: vibeRows } = await vibeQuery;

    const counts = { happy: 0, stressed: 0, excited: 0, other: 0 };
    for (const r of vibeRows ?? []) {
      const v = r.vibe as keyof typeof counts;
      if (v in counts) counts[v]++;
    }
    const totalVibes = Math.max(1, (vibeRows ?? []).length);
    const vibes = {
      happy: Math.round((counts.happy / totalVibes) * 100),
      stressed: Math.round((counts.stressed / totalVibes) * 100),
      excited: Math.round((counts.excited / totalVibes) * 100),
      other: Math.round((counts.other / totalVibes) * 100),
      sampleSize: (vibeRows ?? []).length,
    };

    const items = slicedItems.map(({ session_hash: rowSessionHash, ...rest }) => ({
      ...rest,
      is_owner: rowSessionHash === sessionHash,
    }));

    return jsonResponse(req, {
      items,
      likedIds,
      nextCursor,
      hasMore,
      vibes,
    });
  } catch {
    return errorResponse(req, "SERVER_ERROR", "Unable to load campus feed.", 500);
  }
});
