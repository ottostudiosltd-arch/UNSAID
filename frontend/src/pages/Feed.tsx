import { useCallback, useEffect, useState } from "react";
import { Clock, Flame, PenLine, RefreshCw, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { CategoryPills } from "../components/CategoryPills";
import { ConfessionCard } from "../components/ConfessionCard";
import { OFFICIAL_COLLEGES } from "../data/colleges";
import { useCampusSession } from "../hooks/useCampusSession";
import {
  fetchFeed,
  toggleConfessionLike,
  voteOnPoll,
} from "../services/confessionService";
import type {
  CampusVibesSummary,
  CategoryFilter,
  Confession,
  FeedSort,
} from "../types/confession";

interface FeedProps {
  mode?: "campus" | "explore";
  defaultSort?: FeedSort;
}

export function Feed({ mode = "campus", defaultSort = "latest" }: FeedProps) {
  const { access, savedIds, pollVotes, toggleSave, recordPollVote } =
    useCampusSession();
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [sort, setSort] = useState<FeedSort>(defaultSort);
  const [collegeFilter, setCollegeFilter] = useState<string>("all");
  const [items, setItems] = useState<Confession[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [vibes, setVibes] = useState<CampusVibesSummary | undefined>(undefined);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSort(defaultSort);
  }, [defaultSort, mode]);

  const loadFeed = useCallback(
    async (cursorToUse: string | null = null, append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const res = await fetchFeed({
          category,
          sort,
          cursor: cursorToUse,
          scope: mode,
          collegeFilter,
        });
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setLikedIds((prev) => {
          const next = new Set(append ? prev : []);
          for (const id of res.likedIds) next.add(id);
          return next;
        });
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
        setVibes(res.vibes);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load campus feed.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [category, sort, mode, collegeFilter],
  );

  useEffect(() => {
    void loadFeed(null, false);
  }, [loadFeed]);

  async function handleToggleLike(id: string) {
    const wasLiked = likedIds.has(id);
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (wasLiked) next.delete(id);
      else next.add(id);
      return next;
    });
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, likes_count: Math.max(0, item.likes_count + (wasLiked ? -1 : 1)) }
          : item,
      ),
    );

    try {
      const res = await toggleConfessionLike(id);
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (res.liked) next.add(id);
        else next.delete(id);
        return next;
      });
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, likes_count: res.likesCount } : item,
        ),
      );
    } catch {
      void loadFeed(null, false);
    }
  }

  async function handleVotePoll(confessionId: string, optionId: string) {
    try {
      const updated = await voteOnPoll(confessionId, optionId);
      recordPollVote(confessionId, optionId);
      setItems((prev) =>
        prev.map((item) => (item.id === confessionId ? updated : item)),
      );
    } catch {
      // ignore transient error
    }
  }

  return (
    <AppShell
      college={access?.college ?? null}
      vibes={vibes}
      topBarSlot={<CategoryPills selected={category} onSelect={setCategory} />}
    >
      {/* Mobile category pills */}
      <div className="mb-3 lg:hidden">
        <CategoryPills selected={category} onSelect={setCategory} />
      </div>

      {/* Explore Cross-College Filter Bar */}
      {mode === "explore" && (
        <div className="mb-4 rounded-[22px] border border-white bg-white/85 p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="font-display text-lg font-bold text-ink">
                Explore Campuses ✨
              </h1>
              <p className="text-[11px] font-semibold text-muted">
                Read stories & vote in polls across verified Pune colleges
              </p>
            </div>

            <select
              aria-label="Filter by college"
              value={collegeFilter}
              onChange={(e) => setCollegeFilter(e.target.value)}
              className="rounded-full border border-[#E4D9FB] bg-[#FCF9FF] px-3.5 py-1.5 text-xs font-bold text-ink focus:border-pastel-lavenderDeep focus:outline-none"
            >
              <option value="all">All Colleges</option>
              {OFFICIAL_COLLEGES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.shortName}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Sort tabs + Quick Confess CTA */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 rounded-full bg-white/75 p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setSort("trending")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
              sort === "trending"
                ? "bg-white text-ink shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            <Flame className="h-3.5 w-3.5 text-[#FF6B4A]" />
            <span>Trending</span>
          </button>

          <button
            type="button"
            onClick={() => setSort("latest")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
              sort === "latest"
                ? "bg-white text-ink shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            <Clock className="h-3.5 w-3.5 text-pastel-lavenderDeep" />
            <span>Latest</span>
          </button>

          <button
            type="button"
            onClick={() => setSort("most_discussed")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
              sort === "most_discussed"
                ? "bg-white text-ink shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            <Trophy className="h-3.5 w-3.5 text-pastel-amberDeep" />
            <span>Most Discussed</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadFeed(null, false)}
            title="Refresh feed"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white bg-white/85 text-muted shadow-sm transition hover:text-ink"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link
            to="/create"
            className="hidden items-center gap-1.5 rounded-full bg-[#FF6FA9] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#F45998] lg:inline-flex"
          >
            <PenLine className="h-3.5 w-3.5" />
            <span>Confess</span>
          </Link>
        </div>
      </div>

      {/* Feed Content */}
      {error && (
        <div className="mb-4 rounded-2xl border border-[#FFC4D4] bg-[#FFE8EF] p-4 text-sm font-bold text-[#B81D48]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-44 animate-pulse rounded-[24px] border border-white bg-white/75 p-5"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[28px] border border-white bg-white/90 p-8 text-center shadow-card">
          <img
            src="/assets/mascots/sleeping-cat.svg"
            alt="No confessions yet"
            className="mx-auto w-40"
          />
          <h2 className="mt-2 font-display text-xl font-bold text-ink">
            Quiet on campus right now...
          </h2>
          <p className="mt-1 text-sm font-medium text-muted">
            Be the first to share a story or poll here!
          </p>
          <Link
            to="/create"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white shadow-pill"
          >
            <PenLine className="h-4 w-4" />
            <span>Write a confession</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((confession) => (
            <ConfessionCard
              key={confession.id}
              confession={confession}
              liked={likedIds.has(confession.id)}
              saved={savedIds.includes(confession.id)}
              votedOptionId={pollVotes[confession.id] ?? null}
              showCollegeBadge={mode === "explore"}
              onToggleLike={(id) => void handleToggleLike(id)}
              onToggleSave={toggleSave}
              onVotePoll={(cId, oId) => void handleVotePoll(cId, oId)}
            />
          ))}

          {hasMore && nextCursor && (
            <div className="pt-2 text-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void loadFeed(nextCursor, true)}
                className="rounded-full border border-white bg-white px-6 py-2.5 text-sm font-bold text-ink shadow-card transition hover:bg-pastel-lavender/60 disabled:opacity-60"
              >
                {loadingMore ? "Loading more..." : "Load more confessions"}
              </button>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
