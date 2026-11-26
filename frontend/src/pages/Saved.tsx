import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { ConfessionCard } from "../components/ConfessionCard";
import { useCampusSession } from "../hooks/useCampusSession";
import { assetUrl } from "../lib/assetUrl";
import {
  fetchFeed,
  toggleConfessionLike,
  voteOnPoll,
} from "../services/confessionService";
import type { Confession } from "../types/confession";

export function Saved() {
  const { access, savedIds, pollVotes, toggleSave, recordPollVote } =
    useCampusSession();
  const [items, setItems] = useState<Confession[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetchFeed({
          category: "all",
          sort: "latest",
          scope: "explore",
        });
        if (!active) return;
        setItems(res.items.filter((item) => savedIds.includes(item.id)));
        setLikedIds(new Set(res.likedIds));
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [savedIds]);

  async function handleLike(id: string) {
    try {
      const res = await toggleConfessionLike(id);
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (res.liked) next.add(id);
        else next.delete(id);
        return next;
      });
      setItems((prev) =>
        prev.map((c) => (c.id === id ? { ...c, likes_count: res.likesCount } : c)),
      );
    } catch {
      // ignore
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
      // ignore
    }
  }

  return (
    <AppShell college={access?.college ?? null}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-pastel-lavender text-[#5D37B8]">
          <Bookmark className="h-4 w-4" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Saved Posts</h1>
          <p className="text-xs font-semibold text-muted">
            Bookmarked on this device ({savedIds.length})
          </p>
        </div>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-[24px] bg-white/80" />
      ) : items.length === 0 ? (
        <div className="rounded-[28px] border border-white bg-white/90 p-8 text-center shadow-card">
          <img
            src={assetUrl("assets/mascots/quiet-paperplane.webp")}
            alt=""
            aria-hidden="true"
            className="mx-auto w-44"
          />
          <h2 className="mt-2 font-display text-lg font-bold text-ink">
            No saved confessions yet
          </h2>
          <p className="mt-1 text-xs font-medium text-muted">
            Tap the ⋮ menu on any card to bookmark it.
          </p>
          <Link
            to="/feed"
            className="mt-4 inline-flex rounded-full bg-ink px-5 py-2 text-xs font-bold text-white"
          >
            Browse Feed
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
              showCollegeBadge
              onToggleLike={(id) => void handleLike(id)}
              onToggleSave={toggleSave}
              onVotePoll={(cId, oId) => void handleVotePoll(cId, oId)}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
