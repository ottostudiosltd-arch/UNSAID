import type { CommentItem, Confession } from "../types/confession";
import { demoCreateComment, demoGetConfession } from "./demoStore";
import { invokeEdge, isLiveBackendEnabled } from "./edgeApi";

export interface ConfessionDetailResponse {
  confession: Confession;
  liked: boolean;
  comments: CommentItem[];
  hasMoreComments: boolean;
  nextCommentCursor: string | null;
}

export async function fetchConfessionDetail(
  confessionId: string,
  commentCursor?: string | null,
): Promise<ConfessionDetailResponse> {
  if (!isLiveBackendEnabled()) {
    return demoGetConfession(confessionId);
  }

  return invokeEdge<ConfessionDetailResponse>("get-confession", {
    confessionId,
    commentCursor: commentCursor ?? null,
  });
}

export async function submitComment(
  confessionId: string,
  text: string,
): Promise<{ comment: CommentItem; commentsCount: number }> {
  if (!isLiveBackendEnabled()) {
    return demoCreateComment(confessionId, text);
  }

  return invokeEdge<{ comment: CommentItem; commentsCount: number }>(
    "create-comment",
    {
      confessionId,
      text,
    },
  );
}
