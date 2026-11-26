import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { ChevronDown, ChevronUp, Flag, Loader2, Send, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { formatRelativeTime } from "../hooks/useCampusSession";
import { assetUrl } from "../lib/assetUrl";
import { checkContentAllowed } from "../lib/moderation";
import { commentSchema } from "../lib/validation";
import {
  deleteOwnComment,
  fetchConfessionDetail,
  submitComment,
} from "../services/commentService";
import { CATEGORY_META, type CommentItem, type Confession } from "../types/confession";

const MAX_COMMENTS = 100;
const AVATARS = ["🐱", "🐼", "🦊", "🐰", "🐻", "🐥"];
const QUICK_EMOJIS = ["❤️", "🙌", "🔥", "👏", "😂", "😍", "😮", "😢"];

interface CommentsSheetProps {
  confession: Confession | null;
  onClose: () => void;
  onCommentCountChange?: (confessionId: string, commentsCount: number) => void;
}

type SheetSnap = "mini" | "full";

export function CommentsSheet({
  confession,
  onClose,
  onCommentCountChange,
}: CommentsSheetProps) {
  const [snap, setSnap] = useState<SheetSnap>("mini");
  const [visible, setVisible] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsCount, setCommentsCount] = useState(0);
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [replyText, setReplyText] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  const replyLockRef = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const touchListStartYRef = useRef<number | null>(null);
  const activeFetchIdRef = useRef(0);
  const onCloseRef = useRef(onClose);
  const onCommentCountChangeRef = useRef(onCommentCountChange);
  const initialCountRef = useRef(confession?.comments_count ?? 0);

  onCloseRef.current = onClose;
  onCommentCountChangeRef.current = onCommentCountChange;
  initialCountRef.current = confession?.comments_count ?? 0;

  const confessionId = confession?.id ?? "";

  const loadComments = useCallback(
    async (id: string, cursor: string | null = null, append = false) => {
      if (!id) return;
      const fetchSeq = ++activeFetchIdRef.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const res = await fetchConfessionDetail(id, cursor);
        if (fetchSeq !== activeFetchIdRef.current) return;

        setComments((prev) => {
          const combined = append ? [...prev, ...res.comments] : res.comments;
          const seen = new Set<string>();
          return combined.filter((c) => {
            if (seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
          });
        });
        setCommentsCount(res.confession.comments_count);
        setHasMoreComments(res.hasMoreComments);
        setNextCursor(res.nextCommentCursor);
        onCommentCountChangeRef.current?.(id, res.confession.comments_count);
      } catch (err) {
        if (fetchSeq !== activeFetchIdRef.current) return;
        setError(err instanceof Error ? err.message : "Could not load comments.");
      } finally {
        if (fetchSeq === activeFetchIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!confessionId) {
      activeFetchIdRef.current += 1;
      setVisible(false);
      return;
    }

    setSnap("mini");
    setDragOffsetY(0);
    setIsDragging(false);
    setComments([]);
    setCommentsCount(initialCountRef.current);
    setHasMoreComments(false);
    setNextCursor(null);
    setReplyText("");
    setReplyError(null);
    setConfirmDeleteCommentId(null);
    setDeletingCommentId(null);

    const frame = requestAnimationFrame(() => setVisible(true));
    void loadComments(confessionId, null, false);

    return () => cancelAnimationFrame(frame);
  }, [confessionId, loadComments]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setDragOffsetY(0);
    window.setTimeout(() => {
      onCloseRef.current();
    }, 200);
  }, []);

  useEffect(() => {
    if (!confessionId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [confessionId, handleClose]);

  if (!confession) return null;

  const meta = CATEGORY_META[confession.category] ?? CATEGORY_META.thoughts;
  const limitReached = commentsCount >= MAX_COMMENTS;

  function startDrag(clientY: number) {
    dragStartYRef.current = clientY;
    setIsDragging(true);
  }

  function moveDrag(clientY: number) {
    if (dragStartYRef.current === null) return;
    const delta = clientY - dragStartYRef.current;
    // Allow subtle upward pull in mini mode and smooth downward pull in both modes
    const clamped = snap === "full" ? Math.max(-24, delta) : Math.max(-140, delta);
    setDragOffsetY(clamped);
  }

  function endDrag() {
    if (dragStartYRef.current === null) return;
    const delta = dragOffsetY;
    dragStartYRef.current = null;
    setIsDragging(false);
    setDragOffsetY(0);

    if (snap === "mini") {
      if (delta <= -45) {
        setSnap("full");
      } else if (delta >= 90) {
        handleClose();
      }
    } else {
      if (delta >= 165) {
        handleClose();
      } else if (delta >= 55) {
        setSnap("mini");
      }
    }
  }

  function handleHandlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    // Ignore button clicks inside header
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startDrag(e.clientY);
  }

  function handleHandlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isDragging) return;
    moveDrag(e.clientY);
  }

  function handleHandlePointerUp() {
    endDrag();
  }

  // Also allow natural swipe-up on mini list when not scrolled or pull-down when at top of list
  function handleListTouchStart(e: ReactTouchEvent<HTMLDivElement>) {
    touchListStartYRef.current = e.touches[0]?.clientY ?? null;
  }

  function handleListTouchEnd(e: ReactTouchEvent<HTMLDivElement>) {
    if (touchListStartYRef.current === null) return;
    const endY = e.changedTouches[0]?.clientY ?? touchListStartYRef.current;
    const delta = endY - touchListStartYRef.current;
    touchListStartYRef.current = null;

    const listEl = listRef.current;
    if (!listEl) return;

    if (snap === "mini" && delta < -55) {
      setSnap("full");
    } else if (listEl.scrollTop <= 2 && delta > 75) {
      if (snap === "full") {
        setSnap("mini");
      } else {
        handleClose();
      }
    }
  }

  function appendQuickEmoji(emoji: string) {
    setReplyText((prev) => {
      const next = prev + emoji;
      return next.length <= 500 ? next : prev;
    });
    inputRef.current?.focus();
  }

  async function handlePostComment(e: FormEvent) {
    e.preventDefault();
    if (!confessionId || replyLockRef.current) return;
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
      const res = await submitComment(confessionId, parsed.data.text);
      setComments((prev) =>
        prev.some((c) => c.id === res.comment.id) ? prev : [...prev, res.comment],
      );
      setCommentsCount(res.commentsCount);
      onCommentCountChange?.(confessionId, res.commentsCount);
      setReplyText("");

      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollTo({
            top: listRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      });
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Could not post comment.");
    } finally {
      replyLockRef.current = false;
      setPosting(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!confessionId || deletingCommentId) return;
    setDeletingCommentId(commentId);
    setError(null);
    try {
      const res = await deleteOwnComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCommentsCount(res.commentsCount);
      onCommentCountChangeRef.current?.(confessionId, res.commentsCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete comment.");
    } finally {
      setDeletingCommentId(null);
      setConfirmDeleteCommentId(null);
    }
  }

  const sheetHeightClass =
    snap === "full"
      ? "h-[92dvh] max-h-[92dvh]"
      : "h-[60dvh] min-h-[380px] max-h-[60dvh] sm:h-[64vh] sm:max-h-[560px]";

  // Visual live drag follow: upward drag temporarily increases perceived height subtly via translateY
  const sheetStyle = isDragging
    ? {
        transform:
          dragOffsetY >= 0
            ? `translateY(${dragOffsetY}px)`
            : `translateY(${Math.max(-24, dragOffsetY * 0.25)}px)`,
        transition: "none",
      }
    : undefined;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Comments"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-end"
    >
      {/* Dimmed Backdrop */}
      <div
        onClick={handleClose}
        className={`absolute inset-0 bg-[#1E1B2E]/40 backdrop-blur-[2px] transition-opacity duration-200 dark:bg-black/65 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Instagram-style Bottom Sheet */}
      <div
        style={sheetStyle}
        className={`relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] border border-[#F5E4BE] bg-[#FFFDF8] shadow-2xl transition-all duration-300 ease-out dark:border-white/15 dark:bg-[#161422] sm:rounded-t-[30px] ${sheetHeightClass} ${
          visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
        }`}
      >
        {/* Drag Handle + Header (Swipe Up -> Full, Swipe Down -> Mini/Close) */}
        <div
          onPointerDown={handleHandlePointerDown}
          onPointerMove={handleHandlePointerMove}
          onPointerUp={handleHandlePointerUp}
          onPointerCancel={handleHandlePointerUp}
          className="shrink-0 cursor-grab touch-none select-none border-b border-[#F4E7CA] bg-[#FFFDF8] px-4 pb-3 pt-2.5 active:cursor-grabbing dark:border-white/10 dark:bg-[#161422]"
        >
          <div className="mx-auto mb-2.5 h-1.5 w-11 rounded-full bg-[#DFD2B5] dark:bg-white/25" />

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSnap((prev) => (prev === "mini" ? "full" : "mini"))}
              title={snap === "mini" ? "Expand comments" : "Minimize comments"}
              className="inline-flex items-center gap-1 rounded-full bg-[#FFF4DC] px-2.5 py-1 text-[11px] font-bold text-[#7A5200] transition hover:bg-[#FFE9BA] dark:bg-[#2F2413] dark:text-[#FCD34D] dark:hover:bg-[#3E3019]"
            >
              {snap === "mini" ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  <span>Full</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  <span>Mini</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-1.5">
              <h2 className="font-display text-base font-bold text-ink dark:text-[#F4F1FA]">
                Comments
              </h2>
              <span className="rounded-full bg-[#F3EBF9] px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-[#5D37B8] dark:bg-[#2E244F] dark:text-[#C4B5FD]">
                {commentsCount}
              </span>
            </div>

            <button
              type="button"
              onClick={handleClose}
              aria-label="Close comments"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F7F1E3] text-muted transition hover:bg-[#EFE4CC] hover:text-ink dark:bg-white/10 dark:text-[#B9B1CE] dark:hover:bg-white/20 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Original Confession Context Strip */}
        <div className="shrink-0 border-b border-[#F6EBD4] bg-[#FFF9EC]/80 px-4 py-2.5 dark:border-white/10 dark:bg-[#1D1A2B]">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${meta.pillBg} ${meta.pillText}`}
            >
              <span>{meta.label}</span>
              <span>{meta.emoji}</span>
            </span>
            <span className="text-xs font-bold text-ink dark:text-[#F4F1FA]">
              {confession.author_name || "Anonymous"}
            </span>
            <span className="text-[11px] font-semibold text-muted dark:text-[#A49DBB]">
              • {formatRelativeTime(confession.created_at)}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-ink/85 dark:text-[#DDD7EE]">
            {confession.content}
          </p>
        </div>

        {/* Scrollable Comments Feed */}
        <div
          ref={listRef}
          onTouchStart={handleListTouchStart}
          onTouchEnd={handleListTouchEnd}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3.5"
        >
          {error && (
            <div className="rounded-2xl border border-[#FFC4D4] bg-[#FFE8EF] p-3 text-xs font-bold text-[#B81D48] dark:border-[#6B253B] dark:bg-[#3A1724] dark:text-[#FF8EAE]">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3 py-2">
              {[1, 2, 3].map((idx) => (
                <div key={idx} className="flex animate-pulse items-start gap-2.5">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-[#EFE6D2] dark:bg-white/10" />
                  <div className="flex-1 space-y-1.5 pt-0.5">
                    <div className="h-3 w-28 rounded-full bg-[#EFE6D2] dark:bg-white/10" />
                    <div className="h-3.5 w-4/5 rounded-full bg-[#F5EEE0] dark:bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <img
                src={assetUrl("assets/mascots/quiet-paperplane.webp")}
                alt=""
                aria-hidden="true"
                className="w-32"
              />
              <p className="mt-1 font-display text-sm font-bold text-ink dark:text-[#F4F1FA]">
                No comments yet
              </p>
              <p className="mt-0.5 text-xs font-medium text-muted dark:text-[#A49DBB]">
                Start the conversation kindly below.
              </p>
            </div>
          ) : (
            <>
              {comments.map((comment, idx) => {
                const avatar = AVATARS[idx % AVATARS.length];
                return (
                  <div
                    key={comment.id}
                    className="flex items-start gap-2.5 rounded-2xl px-1 py-1 transition hover:bg-[#FFF6E5]/70 dark:hover:bg-white/5"
                  >
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#F2E4C4] bg-[#FFF5DE] text-sm shadow-sm dark:border-white/15 dark:bg-[#252136]">
                      {avatar}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-extrabold text-ink dark:text-[#F4F1FA]">
                            Anonymous
                          </span>
                          <span className="text-[11px] font-semibold text-muted dark:text-[#A49DBB]">
                            {formatRelativeTime(comment.created_at)}
                          </span>
                        </div>

                        {comment.is_owner ? (
                          <button
                            type="button"
                            disabled={deletingCommentId === comment.id}
                            onClick={() => {
                              if (confirmDeleteCommentId === comment.id) {
                                void handleDeleteComment(comment.id);
                              } else {
                                setConfirmDeleteCommentId(comment.id);
                              }
                            }}
                            onMouseLeave={() => {
                              if (confirmDeleteCommentId === comment.id) {
                                setConfirmDeleteCommentId(null);
                              }
                            }}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition ${
                              confirmDeleteCommentId === comment.id
                                ? "bg-[#D81B60] text-white"
                                : "text-[#C81E4B] hover:bg-[#FFE4EC] dark:text-[#FF8EAE] dark:hover:bg-[#3A1C2A]"
                            }`}
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                            <span>
                              {deletingCommentId === comment.id
                                ? "Deleting..."
                                : confirmDeleteCommentId === comment.id
                                ? "Confirm?"
                                : "Delete"}
                            </span>
                          </button>
                        ) : (
                          <Link
                            to={`/report/comment/${comment.id}`}
                            onClick={onClose}
                            title="Report comment"
                            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-muted transition hover:bg-[#FFE4EC] hover:text-[#C81E4B] dark:text-[#A49DBB] dark:hover:bg-[#3A1C2A] dark:hover:text-[#FF8EAE]"
                          >
                            <Flag className="h-2.5 w-2.5" />
                            <span>Report</span>
                          </Link>
                        )}
                      </div>

                      <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] leading-snug text-ink/90 dark:text-[#EFEBF8]">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                );
              })}

              {hasMoreComments && nextCursor && (
                <div className="pt-1 text-center">
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => void loadComments(confessionId, nextCursor, true)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#EFE2C6] bg-white px-4 py-1.5 text-xs font-bold text-ink shadow-sm transition hover:bg-[#FFF6E2] disabled:opacity-60 dark:border-white/15 dark:bg-[#221E32] dark:text-[#F4F1FA] dark:hover:bg-[#2D2842]"
                  >
                    {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>{loadingMore ? "Loading..." : "View earlier comments"}</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sticky Instagram-Style Bottom Comment Composer */}
        <div className="shrink-0 border-t border-[#F4E7CA] bg-[#FFFDF8] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 dark:border-white/10 dark:bg-[#161422]">
          {limitReached ? (
            <div className="rounded-2xl bg-pastel-amber/70 px-4 py-2.5 text-center text-xs font-bold text-[#7A4900] dark:bg-[#3C2E14] dark:text-[#FCD34D]">
              This confession has reached the maximum of {MAX_COMMENTS} comments.
            </div>
          ) : (
            <>
              {/* Quick Emoji Bar (Instagram style) */}
              <div className="no-scrollbar mb-2 flex items-center justify-between gap-1 overflow-x-auto px-1">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => appendQuickEmoji(emoji)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg transition hover:scale-110 hover:bg-[#FFF3D6] active:scale-95 dark:hover:bg-white/10"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {replyError && (
                <p className="mb-1.5 px-2 text-xs font-bold text-[#B81D48] dark:text-[#FF8EAE]">
                  {replyError}
                </p>
              )}

              <form onSubmit={handlePostComment} className="flex items-end gap-2">
                <span className="mb-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#F2E4C4] bg-[#FFF5DE] text-sm dark:border-white/15 dark:bg-[#252136]">
                  🐱
                </span>

                <div className="flex flex-1 items-end gap-2 rounded-3xl border border-[#ECDDBB] bg-white px-3.5 py-1.5 focus-within:border-[#E6A935] focus-within:ring-2 focus-within:ring-[#FFE39A]/50 dark:border-white/15 dark:bg-[#211E30] dark:focus-within:border-[#F5B942] dark:focus-within:ring-[#F5B942]/20">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    maxLength={500}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (replyText.trim().length > 0 && !posting) {
                          e.currentTarget.form?.requestSubmit();
                        }
                      }
                    }}
                    placeholder="Add a comment anonymously..."
                    className="max-h-24 min-h-[26px] w-full resize-none bg-transparent py-1 text-sm font-medium text-ink placeholder:text-muted/60 focus:outline-none dark:text-[#F4F1FA] dark:placeholder:text-[#8E86A6]"
                  />

                  {replyText.length > 400 && (
                    <span className="mb-1 shrink-0 text-[10px] font-bold tabular-nums text-muted dark:text-[#A49DBB]">
                      {500 - replyText.length}
                    </span>
                  )}

                  <button
                    type="submit"
                    disabled={posting || replyText.trim().length === 0}
                    aria-label="Post comment"
                    className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF6FA9] text-white shadow-sm transition hover:bg-[#F45998] disabled:bg-[#E7DFD0] disabled:text-muted/60 dark:disabled:bg-white/10 dark:disabled:text-white/30"
                  >
                    {posting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
