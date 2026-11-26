import type {
  CampusVibe,
  CampusVibesSummary,
  CategoryFilter,
  Confession,
  ConfessionCategory,
  FeedSort,
} from "../types/confession";
import {
  demoCreateConfession,
  demoDeleteConfession,
  demoGetFeed,
  demoToggleLike,
  demoVotePoll,
} from "./demoStore";
import { invokeEdge, isLiveBackendEnabled } from "./edgeApi";

export interface FeedResponse {
  items: Confession[];
  likedIds: string[];
  nextCursor: string | null;
  hasMore: boolean;
  vibes: CampusVibesSummary;
}

export interface CreateConfessionResponse {
  status: "approved" | "pending";
  message: string;
  confession: Confession | null;
}

export async function fetchFeed(params: {
  category: CategoryFilter;
  sort: FeedSort;
  cursor?: string | null;
  scope?: "campus" | "explore";
  collegeFilter?: string;
}): Promise<FeedResponse> {
  if (!isLiveBackendEnabled()) {
    return demoGetFeed(params);
  }

  return invokeEdge<FeedResponse>("get-feed", {
    category: params.category,
    sort: params.sort,
    cursor: params.cursor ?? null,
    scope: params.scope ?? "campus",
    collegeFilter: params.collegeFilter ?? "all",
    limit: 15,
  });
}

export async function submitConfession(input: {
  text: string;
  category: ConfessionCategory;
  vibe?: CampusVibe;
  authorName?: string;
  pollOptions?: string[];
}): Promise<CreateConfessionResponse> {
  if (!isLiveBackendEnabled()) {
    return demoCreateConfession(input);
  }

  return invokeEdge<CreateConfessionResponse>("create-confession", {
    text: input.text,
    category: input.category,
    vibe: input.vibe,
    authorName: input.authorName,
    pollOptions: input.pollOptions,
  });
}

export async function deleteOwnConfession(
  confessionId: string,
): Promise<{ ok: boolean; id: string }> {
  if (!isLiveBackendEnabled()) {
    return demoDeleteConfession(confessionId);
  }

  return invokeEdge<{ ok: boolean; id: string }>("delete-own-content", {
    targetType: "confession",
    targetId: confessionId,
  });
}

export async function toggleConfessionLike(
  confessionId: string,
): Promise<{ liked: boolean; likesCount: number }> {
  if (!isLiveBackendEnabled()) {
    return demoToggleLike(confessionId);
  }

  return invokeEdge<{ liked: boolean; likesCount: number }>("toggle-like", {
    confessionId,
  });
}

export async function voteOnPoll(
  confessionId: string,
  optionId: string,
): Promise<Confession> {
  if (!isLiveBackendEnabled()) {
    return demoVotePoll(confessionId, optionId);
  }

  return invokeEdge<Confession>("vote-poll", {
    confessionId,
    optionId,
  });
}

export async function submitContentReport(input: {
  targetType: "confession" | "comment";
  targetId: string;
  reason: string;
  details?: string;
}): Promise<{ ok: boolean; message: string }> {
  if (!isLiveBackendEnabled()) {
    return {
      ok: true,
      message: "Thank you. Your report has been recorded.",
    };
  }

  return invokeEdge<{ ok: boolean; message: string }>("report-content", {
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    details: input.details,
  });
}
