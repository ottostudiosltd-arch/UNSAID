import { useState, type FormEvent } from "react";
import { ArrowRight, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { getCampusAccess } from "../lib/session";
import { collegeCodeSchema } from "../lib/validation";
import { verifyCollegeCode } from "../services/collegeService";

interface WelcomeProps {
  onSuccess: () => void;
}

export function Welcome({ onSuccess }: WelcomeProps) {
  const navigate = useNavigate();
  const existing = getCampusAccess();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (existing) {
    return <Navigate to="/feed" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = collegeCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid college code.");
      return;
    }

    setLoading(true);
    try {
      await verifyCollegeCode(parsed.data);
      onSuccess();
      navigate("/feed", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not verify college code.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="relative w-full max-w-md pt-10">
        <img
          src="/assets/mascots/peeking-cat.svg"
          alt="UNSAID mascot"
          className="pointer-events-none relative z-20 mx-auto -mb-4 w-44 drop-shadow-sm"
        />

        <div className="relative z-10 rounded-[32px] border border-white bg-white/90 p-6 shadow-shell backdrop-blur-md sm:p-8">
          <div className="flex justify-center">
            <img
              src="/assets/mascots/unsaid-logo.webp"
              alt="UNSAID. Your Campus. Your Stories."
              className="h-28 w-auto object-contain"
            />
          </div>

          <div className="mt-3 text-center">
            <h1 className="font-display text-2xl font-bold text-ink">
              Enter your college code
            </h1>
            <p className="mt-1 text-sm font-medium text-muted">
              Your campus community awaits — anonymous confessions & polls, no sign-up.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="college-code" className="sr-only">
                Official Campus Code
              </label>
              <input
                id="college-code"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                maxLength={12}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. 06155"
                className="w-full rounded-2xl border-2 border-[#E6DCFB] bg-[#FCF9FF] px-4 py-3.5 text-center font-display text-2xl font-bold tracking-[0.25em] text-ink placeholder:tracking-normal placeholder:text-base placeholder:font-medium placeholder:text-muted/60 focus:border-pastel-lavenderDeep focus:outline-none focus:ring-4 focus:ring-pastel-lavender/60"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-2xl border border-[#FFC4D4] bg-[#FFE8EF] px-4 py-2.5 text-center text-xs font-bold text-[#B81D48]"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3.5 font-display text-base font-bold text-white shadow-pill transition hover:bg-[#2C2742] active:scale-[0.99] disabled:opacity-60"
            >
              <span>{loading ? "Verifying campus..." : "Enter Campus"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-6 grid grid-cols-3 gap-2 border-t border-[#F2EBFA] pt-4 text-center text-[11px] font-bold text-muted">
            <div className="flex flex-col items-center gap-1">
              <Lock className="h-4 w-4 text-pastel-lavenderDeep" />
              <span>No Login</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ShieldCheck className="h-4 w-4 text-pastel-mintDeep" />
              <span>Verified Campuses</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Sparkles className="h-4 w-4 text-pastel-pinkDeep" />
              <span>Polls & Stories</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
