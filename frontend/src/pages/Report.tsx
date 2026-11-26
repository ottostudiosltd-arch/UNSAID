import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Flag } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { CharacterCounter } from "../components/CharacterCounter";
import { useCampusSession } from "../hooks/useCampusSession";
import { reportSchema } from "../lib/validation";
import { submitContentReport } from "../services/confessionService";

const REASONS = [
  { id: "spam", label: "Spam or repetitive ads" },
  { id: "harassment", label: "Harassment or bullying" },
  { id: "hate_speech", label: "Hate speech or slurs" },
  { id: "doxxing", label: "Personal info / doxxing" },
  { id: "self_harm", label: "Self-harm or safety concern" },
  { id: "other", label: "Other guideline violation" },
] as const;

export function Report() {
  const { targetType = "confession", targetId = "" } = useParams();
  const navigate = useNavigate();
  const { access } = useCampusSession();

  const [reason, setReason] = useState<(typeof REASONS)[number]["id"]>("spam");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const safeType = targetType === "comment" ? "comment" : "confession";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = reportSchema.safeParse({ reason, details });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid report.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitContentReport({
        targetType: safeType,
        targetId,
        reason: parsed.data.reason,
        details: parsed.data.details,
      });
      setDoneMessage(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell college={access?.college ?? null}>
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white bg-white/90 text-ink shadow-sm dark:border-white/15 dark:bg-[#1B1829] dark:text-[#F4F1FA]"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink dark:text-[#F4F1FA]">
            Report {safeType === "comment" ? "Comment" : "Confession"}
          </h1>
          <p className="text-xs font-semibold text-muted dark:text-[#A49DBB]">
            Help keep {access?.college.name ?? "your campus"} safe and kind.
          </p>
        </div>
      </div>

      {doneMessage ? (
        <div className="rounded-[28px] border border-white bg-white/95 p-7 text-center shadow-card dark:border-white/10 dark:bg-[#171522]/95">
          <CheckCircle2 className="mx-auto h-12 w-12 text-pastel-mintDeep" />
          <h2 className="mt-3 font-display text-xl font-bold text-ink dark:text-[#F4F1FA]">
            Report Received
          </h2>
          <p className="mt-1 text-sm font-medium text-muted dark:text-[#A49DBB]">
            {doneMessage}
          </p>
          <Link
            to="/feed"
            className="mt-5 inline-flex rounded-full bg-ink px-5 py-2.5 text-xs font-bold text-white dark:bg-[#FF6FA9]"
          >
            Return to Feed
          </Link>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-[28px] border border-white bg-white/95 p-5 shadow-card dark:border-white/10 dark:bg-[#171522]/95 sm:p-6"
        >
          <label className="text-xs font-extrabold uppercase tracking-wider text-muted dark:text-[#A49DBB]">
            Why are you reporting this?
          </label>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            {REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setReason(r.id)}
                className={`rounded-2xl border px-3.5 py-2.5 text-left text-xs font-bold transition ${
                  reason === r.id
                    ? "border-[#FF6CA8] bg-pastel-pink/60 text-ink dark:border-[#FF6CA8] dark:bg-[#491D34] dark:text-white"
                    : "border-[#ECE4FA] bg-[#FCF9FF] text-ink/75 hover:bg-pastel-lavender/30 dark:border-white/10 dark:bg-[#211E30] dark:text-[#DED8F0] dark:hover:bg-[#2A253D]"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="report-details"
                className="text-xs font-extrabold uppercase tracking-wider text-muted dark:text-[#A49DBB]"
              >
                Additional context (optional)
              </label>
              <CharacterCounter current={details.length} max={300} />
            </div>
            <textarea
              id="report-details"
              rows={3}
              maxLength={300}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Share anything moderators should know..."
              className="w-full resize-none rounded-2xl border border-[#ECE4FA] bg-[#FCF9FF] p-3 text-sm font-medium text-ink focus:border-pastel-lavenderDeep focus:outline-none dark:border-white/15 dark:bg-[#211E30] dark:text-[#F4F1FA] dark:placeholder:text-[#8E86A6]"
            />
          </div>

          {error && (
            <p className="mt-3 text-xs font-bold text-[#B81D48] dark:text-[#FF8EAE]">
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#D81B60] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#BE1553] disabled:opacity-50"
            >
              <Flag className="h-3.5 w-3.5" />
              <span>{submitting ? "Submitting..." : "Submit Report"}</span>
            </button>
          </div>
        </form>
      )}
    </AppShell>
  );
}
