import { useState } from "react";
import { Bookmark, CheckCircle2, Flag, Heart, MessageCircle, MoreVertical } from "lucide-react";
import { Link } from "react-router-dom";
import { formatRelativeTime } from "../hooks/useCampusSession";
import { CATEGORY_META, type Confession } from "../types/confession";

interface ConfessionCardProps {
  confession: Confession;
  liked: boolean;
  saved: boolean;
  votedOptionId?: string | null;
  showCollegeBadge?: boolean;
  onToggleLike: (id: string) => void;
  onToggleSave: (id: string) => void;
  onVotePoll?: (confessionId: string, optionId: string) => void;
}

export function ConfessionCard({
  confession,
  liked,
  saved,
  votedOptionId = null,
  showCollegeBadge = false,
  onToggleLike,
  onToggleSave,
  onVotePoll,
}: ConfessionCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const meta = CATEGORY_META[confession.category] ?? CATEGORY_META.thoughts;

  const totalVotes = confession.poll
    ? confession.poll.options.reduce((sum, opt) => sum + opt.votes, 0)
    : 0;

  return (
    <article
      className={`confession-card border ${meta.cardBorder} ${meta.cardBg} p-4 sm:p-5 shadow-card`}
    >
      {/* Top row: category badge + author name + relative timestamp + optional college badge + menu */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold ${meta.pillBg} ${meta.pillText}`}
          >
            <span>{meta.label}</span>
            <span>{meta.emoji}</span>
          </span>

          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-bold text-ink">
            <span className="text-[11px]">🐱</span>
            <span>{confession.author_name || "Anonymous"}</span>
          </span>

          <span className="text-xs font-semibold text-muted">
            {formatRelativeTime(confession.created_at)}
          </span>

          {showCollegeBadge && (
            <span className="inline-flex items-center gap-1 rounded-full border border-white bg-white/85 px-2.5 py-0.5 text-[11px] font-extrabold text-[#5D37B8]">
              <span>{confession.college_code}</span>
              <span>•</span>
              <span>{confession.college_name}</span>
            </span>
          )}
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            aria-label="More options"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-white/80 hover:text-ink"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div
              onMouseLeave={() => setMenuOpen(false)}
              className="absolute right-0 top-9 z-30 w-40 rounded-2xl border border-[#ECE4FA] bg-white p-1.5 shadow-lg"
            >
              <button
                type="button"
                onClick={() => {
                  onToggleSave(confession.id);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-ink hover:bg-pastel-lavender/60"
              >
                <Bookmark className="h-3.5 w-3.5" />
                <span>{saved ? "Remove Saved" : "Save Post"}</span>
              </button>
              <Link
                to={`/report/confession/${confession.id}`}
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#C81E4B] hover:bg-[#FFE4EC]"
              >
                <Flag className="h-3.5 w-3.5" />
                <span>Report Post</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Main confession text */}
      <Link
        to={`/confession/${confession.id}`}
        className="relative z-10 mt-3 block max-w-[68%] sm:max-w-[70%]"
      >
        <p className="whitespace-pre-wrap break-words font-display text-[17px] font-semibold leading-snug text-ink sm:text-[19px]">
          {confession.content}
        </p>
      </Link>

      {/* Interactive Poll (everyone can vote) */}
      {confession.poll && confession.poll.options.length >= 2 && (
        <div className="relative z-10 mt-3.5 max-w-[70%] space-y-1.5 rounded-2xl border border-white/90 bg-white/75 p-3 backdrop-blur-sm sm:max-w-[68%]">
          {confession.poll.question && (
            <p className="text-xs font-extrabold text-ink">{confession.poll.question}</p>
          )}
          {confession.poll.options.map((opt) => {
            const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
            const isSelected = votedOptionId === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onVotePoll?.(confession.id, opt.id)}
                className={`relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                  isSelected
                    ? "border-pastel-lavenderDeep bg-pastel-lavender/60 text-ink"
                    : "border-[#EDE6FA] bg-white/90 text-ink/85 hover:border-pastel-lavenderDeep/60"
                }`}
              >
                <span
                  className="pointer-events-none absolute inset-y-0 left-0 bg-pastel-lavender/70 transition-all duration-300"
                  style={{ width: `${votedOptionId ? pct : 0}%` }}
                />
                <span className="relative z-10 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 truncate">
                    {isSelected && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#5D37B8]" />}
                    <span className="truncate">{opt.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-[11px] text-muted">
                    {votedOptionId ? `${pct}% (${opt.votes})` : `${opt.votes}`}
                  </span>
                </span>
              </button>
            );
          })}
          <p className="pt-0.5 text-[11px] font-semibold text-muted">
            {totalVotes} {totalVotes === 1 ? "vote" : "votes"} • Tap an option to vote
          </p>
        </div>
      )}

      {/* Mascot Sticker on Right */}
      <img
        src={meta.mascotSrc}
        alt={meta.mascotAlt}
        aria-hidden="true"
        loading="lazy"
        className="card-mascot-img absolute -bottom-1 right-1 z-0 h-28 w-28 opacity-95 sm:right-3 sm:h-36 sm:w-36"
      />

      {/* Footer row: Likes & Comments only */}
      <div className="relative z-10 mt-5 flex items-center gap-4 text-xs font-bold text-ink/80 sm:text-sm">
        <button
          type="button"
          onClick={() => onToggleLike(confession.id)}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition ${
            liked
              ? "bg-[#FFE0EE] text-[#D81B60]"
              : "hover:bg-white/75 text-ink/75"
          }`}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-[#FF4D8D] text-[#FF4D8D]" : "text-[#FF6CA8]"}`} />
          <span className="tabular-nums">{confession.likes_count}</span>
        </button>

        <Link
          to={`/confession/${confession.id}`}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-ink/75 transition hover:bg-white/75 hover:text-ink"
        >
          <MessageCircle className="h-4 w-4 text-ink/70" />
          <span className="tabular-nums">{confession.comments_count}</span>
        </Link>
      </div>
    </article>
  );
}
