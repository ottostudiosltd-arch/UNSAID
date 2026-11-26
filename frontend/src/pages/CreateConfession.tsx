import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, BarChart3, Plus, Send, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { CharacterCounter } from "../components/CharacterCounter";
import { useCampusSession } from "../hooks/useCampusSession";
import { checkContentAllowed } from "../lib/moderation";
import { confessionSchema } from "../lib/validation";
import { submitConfession } from "../services/confessionService";
import {
  CATEGORY_META,
  type CampusVibe,
  type ConfessionCategory,
} from "../types/confession";

const CATEGORIES: ConfessionCategory[] = [
  "love",
  "funny",
  "college",
  "secrets",
  "thoughts",
];

const VIBES: Array<{ id: CampusVibe; label: string; emoji: string }> = [
  { id: "happy", label: "Happy", emoji: "😊" },
  { id: "excited", label: "Excited", emoji: "✨" },
  { id: "stressed", label: "Stressed", emoji: "😵‍💫" },
  { id: "other", label: "Chill", emoji: "🌙" },
];

export function CreateConfession() {
  const navigate = useNavigate();
  const { access } = useCampusSession();
  const [category, setCategory] = useState<ConfessionCategory>("thoughts");
  const [vibe, setVibe] = useState<CampusVibe>("other");
  const [authorName, setAuthorName] = useState("");
  const [text, setText] = useState("");
  const [includePoll, setIncludePoll] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);
  const submitLockRef = useRef(false);

  const meta = CATEGORY_META[category];

  function handlePollOptionChange(index: number, value: string) {
    setPollOptions((prev) => prev.map((opt, idx) => (idx === index ? value : opt)));
  }

  function addPollOption() {
    if (pollOptions.length < 4) {
      setPollOptions((prev) => [...prev, ""]);
    }
  }

  function removePollOption(index: number) {
    if (pollOptions.length > 2) {
      setPollOptions((prev) => prev.filter((_, idx) => idx !== index));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitLockRef.current) return;

    setError(null);
    setPendingNotice(null);

    const cleanPoll = includePoll
      ? pollOptions.map((o) => o.trim()).filter(Boolean)
      : undefined;

    if (includePoll && (!cleanPoll || cleanPoll.length < 2)) {
      setError("Please fill at least 2 poll options, or turn off the poll.");
      return;
    }

    const parsed = confessionSchema.safeParse({
      category,
      vibe,
      authorName,
      text,
      pollOptions: cleanPoll,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your confession.");
      return;
    }

    const textMod = checkContentAllowed(parsed.data.text);
    if (!textMod.ok) {
      setError(textMod.message);
      return;
    }

    if (parsed.data.authorName) {
      const nameMod = checkContentAllowed(parsed.data.authorName, { isShortLabel: true });
      if (!nameMod.ok) {
        setError(nameMod.message);
        return;
      }
    }

    if (parsed.data.pollOptions) {
      for (const opt of parsed.data.pollOptions) {
        const optMod = checkContentAllowed(opt, { isShortLabel: true });
        if (!optMod.ok) {
          setError(optMod.message);
          return;
        }
      }
    }

    submitLockRef.current = true;
    setSubmitting(true);
    try {
      const res = await submitConfession({
        text: parsed.data.text,
        category: parsed.data.category,
        vibe: parsed.data.vibe,
        authorName: parsed.data.authorName || "Anonymous",
        pollOptions: parsed.data.pollOptions,
      });

      if (res.status === "pending") {
        setPendingNotice(res.message);
        setText("");
      } else {
        navigate("/feed");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not submit confession.",
      );
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <AppShell college={access?.college ?? null}>
      <div className="mb-4 flex items-center gap-3">
        <Link
          to="/feed"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white bg-white/90 text-ink shadow-sm hover:bg-pastel-lavender/60"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            Write a Confession
          </h1>
          <p className="text-xs font-semibold text-muted">
            Posting to {access?.college.code} • {access?.college.name ?? "your campus"}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className={`relative overflow-hidden rounded-[28px] border ${meta.cardBorder} ${meta.cardBg} p-5 shadow-card sm:p-6`}
      >
        {/* Category Selector */}
        <div>
          <label className="text-xs font-extrabold uppercase tracking-wider text-muted">
            Pick a Category
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const item = CATEGORY_META[cat];
              const active = cat === category;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                    active
                      ? `${item.pillBg} ${item.pillText} border-ink/30 ring-2 ring-ink/15`
                      : "border-white bg-white/80 text-ink/75 hover:bg-white"
                  }`}
                >
                  <span>{item.label}</span>
                  <span>{item.emoji}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Display Name (Optional — defaults to Anonymous) */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="author-name"
              className="text-xs font-extrabold uppercase tracking-wider text-muted"
            >
              Name (optional)
            </label>
            <input
              id="author-name"
              type="text"
              maxLength={28}
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Anonymous (leave blank)"
              className="mt-1.5 w-full rounded-2xl border border-white/90 bg-white/90 px-3.5 py-2 text-xs font-bold text-ink placeholder:font-medium placeholder:text-muted/65 focus:border-pastel-lavenderDeep focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-extrabold uppercase tracking-wider text-muted">
              Campus Mood
            </label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {VIBES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVibe(v.id)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-bold transition ${
                    vibe === v.id
                      ? "border-ink bg-ink text-white"
                      : "border-white bg-white/80 text-ink/75 hover:bg-white"
                  }`}
                >
                  <span>{v.emoji}</span>
                  <span>{v.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Textarea + Mascot preview */}
        <div className="relative mt-5">
          <div className="mb-2 flex items-center justify-between">
            <label
              htmlFor="confession-text"
              className="text-xs font-extrabold uppercase tracking-wider text-muted"
            >
              Your Story
            </label>
            <CharacterCounter current={text.length} max={1000} />
          </div>

          <div className="relative">
            <textarea
              id="confession-text"
              rows={5}
              maxLength={1000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's been on your mind lately on campus?"
              className="w-full resize-none rounded-2xl border border-white/90 bg-white/90 p-4 pr-20 text-base font-medium text-ink shadow-inner placeholder:text-muted/60 focus:border-pastel-lavenderDeep focus:outline-none focus:ring-4 focus:ring-pastel-lavender/50"
            />
            <img
              src={meta.mascotSrc}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute bottom-2 right-2 h-16 w-16 object-contain opacity-90"
            />
          </div>
        </div>

        {/* Poll Builder Toggle */}
        <div className="mt-4 rounded-2xl border border-white/90 bg-white/75 p-3.5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-extrabold text-ink">
              <BarChart3 className="h-4 w-4 text-[#5D37B8]" />
              <span>Attach a Campus Poll (everyone can vote)</span>
            </span>
            <button
              type="button"
              onClick={() => setIncludePoll((prev) => !prev)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                includePoll
                  ? "bg-ink text-white"
                  : "bg-pastel-lavender text-[#5D37B8]"
              }`}
            >
              {includePoll ? "Remove Poll" : "+ Add Poll"}
            </button>
          </div>

          {includePoll && (
            <div className="mt-3 space-y-2">
              {pollOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={60}
                    value={opt}
                    onChange={(e) => handlePollOptionChange(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    className="flex-1 rounded-xl border border-[#E6DCFB] bg-white px-3 py-2 text-xs font-bold text-ink focus:border-pastel-lavenderDeep focus:outline-none"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removePollOption(idx)}
                      aria-label="Remove option"
                      className="rounded-lg p-1.5 text-muted hover:bg-[#FFE4EC] hover:text-[#C81E4B]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {pollOptions.length < 4 && (
                <button
                  type="button"
                  onClick={addPollOption}
                  className="inline-flex items-center gap-1 rounded-full bg-pastel-lavender/70 px-3 py-1 text-[11px] font-bold text-[#5D37B8]"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add option</span>
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-[#FFC4D4] bg-[#FFE8EF] px-4 py-2.5 text-xs font-bold text-[#B81D48]"
          >
            {error}
          </div>
        )}

        {pendingNotice && (
          <div className="mt-4 rounded-2xl border border-[#FCD36D] bg-pastel-amber px-4 py-3 text-xs font-bold text-[#7A4900]">
            {pendingNotice}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={submitting || text.trim().length < 5}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ink px-6 py-3 font-display text-sm font-bold text-white shadow-pill transition hover:bg-[#2C2742] disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            <span>{submitting ? "Sending..." : "Post Confession"}</span>
          </button>
        </div>
      </form>
    </AppShell>
  );
}
