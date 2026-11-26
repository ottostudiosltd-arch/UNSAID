import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  Flag,
  Heart,
  MessageCircle,
  Send,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { CharacterCounter } from "../components/CharacterCounter";
import { CommentCard } from "../components/CommentCard";
import { formatRelativeTime, useCampusSession } from "../hooks/useCampusSession";
import { assetUrl } from "../lib/assetUrl";
import { checkContentAllowed } from "../lib/moderation";
import { commentSchema } from "../lib/validation";
import {
  deleteOwnComment,
  fetchConfessionDetail,
  submitComment,
} from "../services/commentService";
import {
  deleteOwnConfession,
  toggleConfessionLike,
  voteOnPoll,
} from "../services/confessionService";
import { CATEGORY_META, type CommentItem, type Confession } from "../types/confession";

const MAX_COMMENTS = 100;

export function ConfessionDetails() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { access, savedIds, pollVotes, toggleSave, recordPollVote } =
    useCampusSession();

  const [confession, setConfession] = useState<Confession | null>(null);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [replyText, setReplyText] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [confirmDeletePost, setConfirmDeletePost] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const replyLockRef = useRef(false);

  const loadDetail = useCallback(
    async (cursor: string | null = null, append = false) => {
      if (!id) return;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const res = await fetchConfessionDetail(id, cursor);
        setConfession(res.confession);
        setLiked(res.liked);
        setComments((prev) => {
          const combined = append ? [...prev, ...res.comments] : res.comments;
          const seen = new Set<string>();
          return combined.filter((c) => {
            if (seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
          });
        });
        setHasMoreComments(res.hasMoreComments);
        setNextCursor(res.nextCommentCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load confession.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void loadDetail(null, false);
  }, [loadDetail]);

  async function handleLike() {
    if (!confession) return;
    try {
      const res = await toggleConfessionLike(confession.id);
      setLiked(res.liked);
      setConfession((prev) => (prev ? { ...prev, likes_count: res.likesCount } : prev));
    } catch {
      // ignore transient error
    }
  }

  async function handleVotePoll(optionId: string) {
    if (!confession) return;
    try {
      const updated = await voteOnPoll(confession.id, optionId);
      recordPollVote(confession.id, optionId);
      setConfession(updated);
    } catch {
      // ignore
    }
  }

  async function handlePostComment(e: FormEvent) {
    e.preventDefault();
    if (!confession || replyLockRef.current) return;
    setReplyError(null);

    const parsed = commentSchema.safeParse({ text: replyText });
    if (!parsed.success) {
      setReplyError(parsed.error.issues[0]?.message ?? "Invalid comment.");
      return;
    }

    const mod = checkContentAllowed(parsed.data.text, { isShortLabel: true });
    if (!mod.ok) {
      setReplyError(mod.message);
      return;
    }

    replyLockRef.current = true;
    setPosting(true);
    try {
      const res = await submitComment(confession.id, parsed.data.text);
      setComments((prev) =>
        prev.some((c) => c.id === res.comment.id) ? prev : [...prev, res.comment],
      );
      setConfession((prev) =>
        prev ? { ...prev, comments_count: res.commentsCount } : prev,
      );
      setReplyText("");
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Could not post reply.");
    } finally {
      replyLockRef.current = false;
      setPosting(false);
    }
  }

  async function handleDeletePost() {
    if (!confession || deletingPost) return;
    setDeletingPost(true);
    try {
      await deleteOwnConfession(confession.id);
      if (savedIds.includes(confession.id)) {
        toggleSave(confession.id);
      }
      navigate("/feed", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete confession.");
      setDeletingPost(false);
      setConfirmDeletePost(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      const res = await deleteOwnComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setConfession((prev) =>
        prev ? { ...prev, comments_count: res.commentsCount } : prev,
      );
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Could not delete comment.");
    }
  }

  const saved = confession ? savedIds.includes(confession.id) : false;
  const meta = confession
    ? CATEGORY_META[confession.category] ?? CATEGORY_META.thoughts
    : CATEGORY_META.thoughts;
  const commentLimitReached = (confession?.comments_count ?? 0) >= MAX_COMMENTS;
  const votedOptionId = confession ? pollVotes[confession.id] ?? null : null;
  const totalVotes = confession?.poll
    ? confession.poll.options.reduce((sum, opt) => sum + opt.votes, 0)
    : 0;

  return (
    <AppShell college={access?.college ?? null}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link
          to="/feed"
          className="inline-flex items-center gap-2 rounded-full border border-white bg-white/90 px-3.5 py-2 text-xs font-bold text-ink shadow-sm hover:bg-pastel-lavender/60 dark:border-white/15 dark:bg-[#1B1829] dark:text-[#F4F1FA] dark:hover:bg-[#2A2442]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Feed</span>
        </Link>

        {confession && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleSave(confession.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                saved
                  ? "border-pastel-lavenderDeep bg-pastel-lavender text-[#5D37B8] dark:border-[#8E63F3] dark:bg-[#2E244F] dark:text-[#C4B5FD]"
                  : "border-white bg-white/90 text-ink/75 dark:border-white/15 dark:bg-[#1B1829] dark:text-[#D5CEE6]"
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" />
              <span>{saved ? "Saved" : "Save"}</span>
            </button>
            {confession.is_owner ? (
              <button
                type="button"
                disabled={deletingPost}
                onClick={() => {
                  if (confirmDeletePost) {
                    void handleDeletePost();
                  } else {
                    setConfirmDeletePost(true);
                  }
                }}
                onMouseLeave={() => setConfirmDeletePost(false)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  confirmDeletePost
                    ? "border-[#D81B60] bg-[#D81B60] text-white"
                    : "border-white bg-white/90 text-[#C81E4B] hover:bg-[#FFE4EC] dark:border-white/15 dark:bg-[#1B1829] dark:text-[#FF8EAE] dark:hover:bg-[#3A1C2A]"
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>
                  {deletingPost ? "Deleting..." : confirmDeletePost ? "Confirm Delete?" : "Delete"}
                </span>
              </button>
            ) : (
              <Link
                to={`/report/confession/${confession.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-white bg-white/90 px-3 py-1.5 text-xs font-bold text-[#C81E4B] hover:bg-[#FFE4EC] dark:border-white/15 dark:bg-[#1B1829] dark:text-[#FF8EAE] dark:hover:bg-[#3A1C2A]"
              >
                <Flag className="h-3.5 w-3.5" />
                <span>Report</span>
              </Link>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-52 animate-pulse rounded-[24px] border border-white bg-white/80 dark:border-white/10 dark:bg-[#1B1829]/80" />
      ) : error || !confession ? (
        <div className="rounded-[24px] border border-[#FFC4D4] bg-[#FFE8EF] p-6 text-center text-sm font-bold text-[#B81D48] dark:border-[#6B253B] dark:bg-[#3A1724] dark:text-[#FF8EAE]">
          {error ?? "Confession not found."}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Full Confession Card */}
          <article
            className={`relative overflow-hidden rounded-[28px] border ${meta.cardBorder} ${meta.cardBg} p-5 shadow-card sm:p-6`}
          >
            <div className="relative z-10 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold ${meta.pillBg} ${meta.pillText}`}
              >
                <span>{meta.label}</span>
                <span>{meta.emoji}</span>
              </span>

              <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-bold text-ink dark:bg-white/10 dark:text-[#F4F1FA]">
                <span className="text-[11px]">
                  {confession.category === "notice" ? "🛡️" : "🐱"}
                </span>
                <span>{confession.author_name || "Anonymous"}</span>
              </span>

              <span className="text-xs font-semibold text-muted dark:text-[#A49DBB]">
                {formatRelativeTime(confession.created_at)}
              </span>

              <span className="inline-flex items-center gap-1 rounded-full border border-white bg-white/85 px-2.5 py-0.5 text-[11px] font-extrabold text-[#5D37B8] dark:border-white/15 dark:bg-white/10 dark:text-[#C4B5FD]">
                <span>{confession.college_code}</span>
                <span>•</span>
                <span>{confession.college_name}</span>
              </span>
            </div>

            <p className="relative z-10 mt-4 max-w-[74%] whitespace-pre-wrap break-words font-display text-xl font-semibold leading-snug text-ink dark:text-[#F4F1FA]">
              {confession.content}
            </p>

            {confession.poll && confession.poll.options.length >= 2 && (
              <div className="relative z-10 mt-4 max-w-[72%] space-y-1.5 rounded-2xl border border-white/90 bg-white/75 p-3.5 dark:border-white/10 dark:bg-black/25">
                {confession.poll.question && (
                  <p className="text-xs font-extrabold text-ink dark:text-[#F4F1FA]">
                    {confession.poll.question}
                  </p>
                )}
                {confession.poll.options.map((opt) => {
                  const pct =
                    totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                  const isSelected = votedOptionId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => void handleVotePoll(opt.id)}
                      className={`relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                        isSelected
                          ? "border-pastel-lavenderDeep bg-pastel-lavender/60 text-ink dark:border-[#8E63F3] dark:bg-[#312554] dark:text-white"
                          : "border-[#EDE6FA] bg-white/90 text-ink/85 hover:border-pastel-lavenderDeep/60 dark:border-white/10 dark:bg-[#1A1727]/90 dark:text-[#EBE6F7]"
                      }`}
                    >
                      <span
                        className="pointer-events-none absolute inset-y-0 left-0 bg-pastel-lavender/70 transition-all duration-300 dark:bg-[#8E63F3]/35"
                        style={{ width: `${votedOptionId ? pct : 0}%` }}
                      />
                      <span className="relative z-10 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5">
                          {isSelected && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#5D37B8] dark:text-[#C4B5FD]" />
                          )}
                          <span>{opt.label}</span>
                        </span>
                        <span className="tabular-nums text-[11px] text-muted dark:text-[#B4ADC8]">
                          {votedOptionId ? `${pct}% (${opt.votes})` : `${opt.votes}`}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <img
              src={meta.mascotSrc}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-1 right-2 h-28 w-28 object-contain opacity-90 sm:h-36 sm:w-36"
            />

            <div className="relative z-10 mt-6 flex items-center gap-4 text-sm font-bold">
              <button
                type="button"
                onClick={() => void handleLike()}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${
                  liked
                    ? "bg-[#FFE0EE] text-[#D81B60] dark:bg-[#491D34] dark:text-[#FF84B2]"
                    : "bg-white/75 text-ink/80 dark:bg-white/10 dark:text-[#D5CEE6]"
                }`}
              >
                <Heart
                  className={`h-4 w-4 ${
                    liked ? "fill-[#FF4D8D] text-[#FF4D8D]" : "text-[#FF6CA8]"
                  }`}
                />
                <span>{confession.likes_count}</span>
              </button>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-3 py-1.5 text-ink/80 dark:bg-white/10 dark:text-[#D5CEE6]">
                <MessageCircle className="h-4 w-4" />
                <span>
                  {confession.comments_count} / {MAX_COMMENTS} comments
                </span>
              </span>
            </div>
          </article>

          {/* Comment Composer */}
          <form
            onSubmit={handlePostComment}
            className="rounded-[24px] border border-white bg-white/90 p-4 shadow-card dark:border-white/10 dark:bg-[#171522]/90"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted dark:text-[#A49DBB]">
                Reply Anonymously
              </span>
              <CharacterCounter current={replyText.length} max={500} />
            </div>

            {commentLimitReached ? (
              <div className="rounded-2xl bg-pastel-amber/70 px-4 py-3 text-xs font-bold text-[#7A4900] dark:bg-[#3C2E14] dark:text-[#FCD34D]">
                This confession has reached the maximum of 100 comments.
              </div>
            ) : (
              <>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a kind or helpful anonymous reply..."
                  className="w-full resize-none rounded-2xl border border-[#ECE4FA] bg-[#FCF9FF] p-3 text-sm font-medium text-ink placeholder:text-muted/60 focus:border-pastel-lavenderDeep focus:outline-none dark:border-white/15 dark:bg-[#211E30] dark:text-[#F4F1FA] dark:placeholder:text-[#8E86A6]"
                />
                {replyError && (
                  <p className="mt-2 text-xs font-bold text-[#B81D48] dark:text-[#FF8EAE]">
                    {replyError}
                  </p>
                )}
                <div className="mt-2.5 flex justify-end">
                  <button
                    type="submit"
                    disabled={posting || replyText.trim().length === 0}
                    className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#2C2742] disabled:opacity-50 dark:bg-[#FF6FA9] dark:hover:bg-[#F45998]"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{posting ? "Posting..." : "Post Reply"}</span>
                  </button>
                </div>
              </>
            )}
          </form>

          {/* Comments List */}
          <section className="space-y-3">
            <h2 className="font-display text-base font-bold text-ink dark:text-[#F4F1FA]">
              Replies ({confession.comments_count})
            </h2>

            {comments.length === 0 ? (
              <div className="rounded-2xl border border-white bg-white/80 p-6 text-center dark:border-white/10 dark:bg-[#171522]/85">
                <img
                  src={assetUrl("assets/mascots/quiet-paperplane.webp")}
                  alt=""
                  aria-hidden="true"
                  className="mx-auto w-36"
                />
                <p className="mt-1 text-xs font-bold text-muted dark:text-[#A49DBB]">
                  No replies yet — start the conversation kindly!
                </p>
              </div>
            ) : (
              <>
                {comments.map((comment, idx) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    index={idx}
                    onDelete={handleDeleteComment}
                  />
                ))}

                {hasMoreComments && nextCursor && (
                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={() => void loadDetail(nextCursor, true)}
                      className="rounded-full border border-white bg-white px-5 py-2 text-xs font-bold text-ink shadow-sm hover:bg-pastel-lavender/60 dark:border-white/15 dark:bg-[#1B1829] dark:text-[#F4F1FA]"
                    >
                      {loadingMore ? "Loading..." : "Load more comments"}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
