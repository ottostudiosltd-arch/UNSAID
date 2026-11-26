import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  BarChart3,
  Check,
  Database,
  LogOut,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { CharacterCounter } from "../components/CharacterCounter";
import { formatRelativeTime } from "../hooks/useCampusSession";
import { assetUrl } from "../lib/assetUrl";
import { supabase } from "../lib/supabase";
import {
  adminSignIn,
  adminSignOut,
  fetchAdminDashboard,
  runAdminAction,
  type AdminDashboardData,
} from "../services/adminService";
import type { CampusVibe } from "../types/confession";

const VIBES: Array<{ id: CampusVibe; label: string; emoji: string }> = [
  { id: "happy", label: "Happy", emoji: "😊" },
  { id: "excited", label: "Excited", emoji: "✨" },
  { id: "stressed", label: "Stressed", emoji: "😵‍💫" },
  { id: "other", label: "Chill", emoji: "🌙" },
];

export function Admin() {
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Admin Notice composer state
  const [postCollegeId, setPostCollegeId] = useState("all");
  const [postVibe, setPostVibe] = useState<CampusVibe>("happy");
  const [postAuthor, setPostAuthor] = useState("");
  const [postText, setPostText] = useState("");
  const [includePoll, setIncludePoll] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [posting, setPosting] = useState(false);
  const publishLockRef = useRef(false);

  // All posts filter
  const [collegeFilter, setCollegeFilter] = useState("all");

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setAuthError(null);
    try {
      const data = await fetchAdminDashboard();
      setDashboard(data);
      setPostCollegeId((prev) => prev || data.colleges[0]?.id || "");
    } catch (err) {
      setDashboard(null);
      setAuthError(err instanceof Error ? err.message : "Unauthorized");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      const hasSession = Boolean(data.session);
      setSignedIn(hasSession);
      if (hasSession) {
        void loadDashboard(false);
      } else {
        setLoading(false);
      }
    });
  }, [loadDashboard]);

  const filteredAllPosts = useMemo(() => {
    if (!dashboard) return [];
    if (collegeFilter === "all") return dashboard.allConfessions;
    return dashboard.allConfessions.filter((c) => c.college_code === collegeFilter);
  }, [dashboard, collegeFilter]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      await adminSignIn(email.trim(), password);
      setSignedIn(true);
      await loadDashboard(false);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Sign-in failed.");
      setLoading(false);
    }
  }

  async function handleLogout() {
    await adminSignOut();
    setSignedIn(false);
    setDashboard(null);
  }

  async function performAction(id: string, body: Record<string, unknown>, label: string) {
    setBusyId(id);
    setStatusMsg(null);
    setAuthError(null);
    try {
      await runAdminAction(body);
      setStatusMsg(label);
      setConfirmDeleteId(null);
      await loadDashboard(true);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdminCreatePost(e: FormEvent) {
    e.preventDefault();
    if (publishLockRef.current) return;
    setAuthError(null);
    setStatusMsg(null);

    if (!postCollegeId) {
      setAuthError("Please select a target college.");
      return;
    }
    if (postText.trim().length < 5) {
      setAuthError("Post must be at least 5 characters.");
      return;
    }

    const cleanPoll = includePoll
      ? pollOptions.map((o) => o.trim()).filter(Boolean)
      : undefined;

    if (includePoll && (!cleanPoll || cleanPoll.length < 2)) {
      setAuthError("Please fill at least 2 poll options or remove the poll.");
      return;
    }

    publishLockRef.current = true;
    setPosting(true);
    try {
      await runAdminAction({
        action: "admin_create_confession",
        collegeId: postCollegeId,
        vibe: postVibe,
        authorName: postAuthor.trim() || "Campus Admin",
        text: postText.trim(),
        pollOptions: cleanPoll,
      });
      setPostText("");
      setPostAuthor("");
      setIncludePoll(false);
      setPollOptions(["", ""]);
      setStatusMsg("Official Admin Notice published!");
      await loadDashboard(true);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Failed to publish notice.");
    } finally {
      publishLockRef.current = false;
      setPosting(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              to="/"
              className="text-xs font-bold text-[#5D37B8] hover:underline dark:text-[#C4B5FD]"
            >
              ← Back to UNSAID.
            </Link>
            <h1 className="mt-1 font-display text-3xl font-bold text-ink dark:text-[#F4F1FA]">
              Moderation Dashboard
            </h1>
          </div>

          {signedIn && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={refreshing || loading}
                onClick={() => void loadDashboard(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white bg-white px-4 py-2 text-xs font-bold text-ink shadow-sm transition hover:bg-pastel-lavender/60 disabled:opacity-60 dark:border-white/15 dark:bg-[#1B1829] dark:text-[#F4F1FA] dark:hover:bg-[#2A2442]"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
              </button>

              <button
                type="button"
                onClick={() => void handleLogout()}
                className="inline-flex items-center gap-1.5 rounded-full border border-white bg-white px-4 py-2 text-xs font-bold text-ink shadow-sm hover:bg-[#FFE4EC] dark:border-white/15 dark:bg-[#1B1829] dark:text-[#F4F1FA] dark:hover:bg-[#3A1C2A]"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>

        {!supabase ? (
          <div className="rounded-[28px] border border-white bg-white/95 p-7 shadow-card dark:border-white/10 dark:bg-[#171522]/95">
            <ShieldAlert className="h-8 w-8 text-pastel-amberDeep" />
            <h2 className="mt-2 font-display text-xl font-bold text-ink dark:text-[#F4F1FA]">
              Supabase Not Connected
            </h2>
            <p className="mt-1 text-sm font-medium text-muted dark:text-[#A49DBB]">
              Admin authentication uses Supabase Auth + verified rows in{" "}
              <code className="rounded bg-pastel-lavender px-1.5 py-0.5 text-xs dark:bg-[#2E244F] dark:text-[#C4B5FD]">
                public.admin_users
              </code>
              .
            </p>
          </div>
        ) : !signedIn ? (
          <form
            onSubmit={handleLogin}
            className="mx-auto max-w-md rounded-[28px] border border-white bg-white/95 p-6 shadow-card dark:border-white/10 dark:bg-[#171522]/95"
          >
            <div className="flex items-center gap-2 text-[#5D37B8] dark:text-[#A78BFA]">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="font-display text-xl font-bold text-ink dark:text-[#F4F1FA]">
                Moderator Sign In
              </h2>
            </div>
            <p className="mt-1 text-xs font-medium text-muted dark:text-[#A49DBB]">
              Sign in with your Supabase Auth moderator email and password.
            </p>

            <div className="mt-4 space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Moderator email"
                className="w-full rounded-2xl border border-[#ECE4FA] bg-[#FCF9FF] px-4 py-2.5 text-sm font-medium text-ink focus:border-pastel-lavenderDeep focus:outline-none dark:border-white/15 dark:bg-[#211E30] dark:text-[#F4F1FA] dark:placeholder:text-[#8E86A6]"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-2xl border border-[#ECE4FA] bg-[#FCF9FF] px-4 py-2.5 text-sm font-medium text-ink focus:border-pastel-lavenderDeep focus:outline-none dark:border-white/15 dark:bg-[#211E30] dark:text-[#F4F1FA] dark:placeholder:text-[#8E86A6]"
              />
            </div>

            {authError && (
              <p className="mt-3 text-xs font-bold text-[#B81D48] dark:text-[#FF8EAE]">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full rounded-2xl bg-ink py-3 text-sm font-bold text-white shadow-pill disabled:opacity-50 dark:bg-[#FF6FA9] dark:hover:bg-[#F45998]"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : loading ? (
          <div className="h-48 animate-pulse rounded-[28px] bg-white/80 dark:bg-[#1B1829]/80" />
        ) : dashboard ? (
          <div className="space-y-6">
            {statusMsg && (
              <div className="rounded-2xl border border-[#C7F0DB] bg-pastel-mint px-4 py-2.5 text-xs font-bold text-[#16794F] dark:border-[#244D3D] dark:bg-[#163B2C] dark:text-[#6EE7B7]">
                {statusMsg}
              </div>
            )}

            {authError && (
              <div className="rounded-2xl border border-[#FFC4D4] bg-[#FFE8EF] px-4 py-2.5 text-xs font-bold text-[#B81D48] dark:border-[#6B253B] dark:bg-[#3A1724] dark:text-[#FF8EAE]">
                {authError}
              </div>
            )}

            {/* Database Capacity Guardrail */}
            {dashboard.health && (
              <section className="rounded-[24px] border border-white bg-white/95 p-5 shadow-card dark:border-white/10 dark:bg-[#171522]/95">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-[#5D37B8] dark:text-[#A78BFA]" />
                    <h2 className="font-display text-lg font-bold text-ink dark:text-[#F4F1FA]">
                      Database Capacity Guardrail
                    </h2>
                  </div>
                  <span className="rounded-full bg-pastel-lavender px-3 py-1 text-xs font-extrabold uppercase text-[#5D37B8] dark:bg-[#2E244F] dark:text-[#C4B5FD]">
                    {dashboard.health.tier.replace("_", " ")} • {dashboard.health.db_mb} MB / 500 MB
                  </span>
                </div>

                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#ECE7F6] dark:bg-[#28233A]">
                  <div
                    className="h-full rounded-full bg-pastel-lavenderDeep"
                    style={{
                      width: `${Math.min(100, (dashboard.health.db_mb / 500) * 100)}%`,
                    }}
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-muted dark:text-[#A49DBB]">
                  <span>
                    Confessions: {dashboard.health.confessions_count} • Comments:{" "}
                    {dashboard.health.comments_count} • Open Reports:{" "}
                    {dashboard.health.open_reports_count}
                  </span>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === "toggle"}
                      onClick={() =>
                        void performAction(
                          "toggle",
                          {
                            action: "toggle_submissions",
                            enabled: !dashboard.health?.submissions_enabled,
                          },
                          `Submissions ${
                            dashboard.health?.submissions_enabled ? "paused" : "resumed"
                          }.`,
                        )
                      }
                      className="rounded-full border border-[#E6DCFB] bg-white px-3.5 py-1.5 text-ink hover:bg-pastel-amber/60 dark:border-white/15 dark:bg-[#211E30] dark:text-[#F4F1FA] dark:hover:bg-[#2C2742]"
                    >
                      {dashboard.health.submissions_enabled
                        ? "Pause New Submissions"
                        : "Resume Submissions"}
                    </button>

                    <button
                      type="button"
                      disabled={busyId === "cleanup"}
                      onClick={() =>
                        void performAction(
                          "cleanup",
                          { action: "run_cleanup" },
                          "90-day expired record cleanup completed.",
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-full bg-ink px-3.5 py-1.5 text-white dark:bg-[#FF6FA9]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Run 90-Day Cleanup</span>
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Admin Notice Composer */}
            <section className="relative overflow-hidden rounded-[24px] border border-[#BFDBFE] bg-gradient-to-br from-[#F7FBFF] via-[#EFF6FF] to-[#DFF0FF] p-5 shadow-card dark:border-[#26426B] dark:from-[#152134] dark:via-[#131C2D] dark:to-[#101724]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#DCEEFF] px-3 py-1 text-xs font-extrabold text-[#1D4ED8] dark:bg-[#193052] dark:text-[#93C5FD]">
                    <span>📢</span>
                    <span>Official Admin Notice</span>
                  </span>
                  <h2 className="mt-2 font-display text-xl font-bold text-ink dark:text-[#F4F1FA]">
                    Publish Admin Notice
                  </h2>
                  <p className="text-xs font-medium text-muted dark:text-[#A49DBB]">
                    Send an official campus announcement or poll to one college or all campuses.
                  </p>
                </div>

                <img
                  src={assetUrl("assets/mascots/admin-notice.webp")}
                  alt="Official Admin Notice sticker"
                  className="h-20 w-20 shrink-0 object-contain"
                />
              </div>

              <form onSubmit={handleAdminCreatePost} className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-muted dark:text-[#A49DBB]">
                      Target Campus
                    </label>
                    <select
                      value={postCollegeId}
                      onChange={(e) => setPostCollegeId(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-white bg-white/90 px-3.5 py-2 text-xs font-bold text-ink focus:border-[#60A5FA] focus:outline-none dark:border-white/15 dark:bg-[#161E2E] dark:text-[#F4F1FA]"
                    >
                      <option value="all">All Colleges (Broadcast to all 18)</option>
                      {dashboard.colleges.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.short_name ?? c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-muted dark:text-[#A49DBB]">
                      Notice Sender Label
                    </label>
                    <input
                      type="text"
                      maxLength={28}
                      value={postAuthor}
                      onChange={(e) => setPostAuthor(e.target.value)}
                      placeholder="Campus Admin (default)"
                      className="mt-1 w-full rounded-2xl border border-white bg-white/90 px-3.5 py-2 text-xs font-bold text-ink focus:border-[#60A5FA] focus:outline-none dark:border-white/15 dark:bg-[#161E2E] dark:text-[#F4F1FA] dark:placeholder:text-[#8E86A6]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted dark:text-[#A49DBB]">
                    Mood:
                  </span>
                  {VIBES.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setPostVibe(v.id)}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${
                        postVibe === v.id
                          ? "border-ink bg-ink text-white dark:border-[#60A5FA] dark:bg-[#2563EB]"
                          : "border-white bg-white/85 text-muted dark:border-white/10 dark:bg-white/10 dark:text-[#D5CEE6]"
                      }`}
                    >
                      <span>{v.emoji}</span>
                      <span>{v.label}</span>
                    </button>
                  ))}
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted dark:text-[#A49DBB]">
                      Notice Message
                    </span>
                    <CharacterCounter current={postText.length} max={1000} />
                  </div>
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    placeholder="Write an official campus notice, event update, or announcement..."
                    className="w-full resize-none rounded-2xl border border-white bg-white/90 p-3 text-sm font-medium text-ink focus:border-[#60A5FA] focus:outline-none dark:border-white/15 dark:bg-[#161E2E] dark:text-[#F4F1FA] dark:placeholder:text-[#8E86A6]"
                  />
                </div>

                <div className="rounded-2xl border border-white bg-white/80 p-3 dark:border-white/10 dark:bg-black/25">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-ink dark:text-[#F4F1FA]">
                      <BarChart3 className="h-4 w-4 text-[#1D4ED8] dark:text-[#93C5FD]" />
                      <span>Attach Poll (optional)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIncludePoll((p) => !p)}
                      className="rounded-full bg-[#DCEEFF] px-3 py-1 text-xs font-bold text-[#1D4ED8] dark:bg-[#193052] dark:text-[#93C5FD]"
                    >
                      {includePoll ? "Remove Poll" : "+ Add Poll"}
                    </button>
                  </div>

                  {includePoll && (
                    <div className="mt-2.5 space-y-2">
                      {pollOptions.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            maxLength={60}
                            value={opt}
                            onChange={(e) =>
                              setPollOptions((prev) =>
                                prev.map((v, i) => (i === idx ? e.target.value : v)),
                              )
                            }
                            placeholder={`Option ${idx + 1}`}
                            className="flex-1 rounded-xl border border-[#BFDBFE] bg-white px-3 py-1.5 text-xs font-bold text-ink dark:border-white/15 dark:bg-[#161E2E] dark:text-[#F4F1FA]"
                          />
                          {pollOptions.length > 2 && (
                            <button
                              type="button"
                              onClick={() =>
                                setPollOptions((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="p-1 text-muted hover:text-[#C81E4B] dark:text-[#A49DBB] dark:hover:text-[#FF8EAE]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      {pollOptions.length < 4 && (
                        <button
                          type="button"
                          onClick={() => setPollOptions((prev) => [...prev, ""])}
                          className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#1D4ED8] dark:bg-[#193052] dark:text-[#93C5FD]"
                        >
                          <Plus className="h-3 w-3" /> Add option
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={posting || postText.trim().length < 5}
                    className="inline-flex items-center gap-2 rounded-full bg-[#1D4ED8] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#1E40AF] disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{posting ? "Publishing..." : "Publish Admin Notice"}</span>
                  </button>
                </div>
              </form>
            </section>

            {/* All Campus Posts (Browse & Delete Any Post) */}
            <section className="rounded-[24px] border border-white bg-white/95 p-5 shadow-card dark:border-white/10 dark:bg-[#171522]/95">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-lg font-bold text-ink dark:text-[#F4F1FA]">
                  All Campus Posts ({filteredAllPosts.length})
                </h2>

                <select
                  aria-label="Filter posts by college"
                  value={collegeFilter}
                  onChange={(e) => setCollegeFilter(e.target.value)}
                  className="rounded-full border border-[#ECE4FA] bg-[#FCF9FF] px-3.5 py-1.5 text-xs font-bold text-ink dark:border-white/15 dark:bg-[#211E30] dark:text-[#F4F1FA]"
                >
                  <option value="all">All Colleges</option>
                  {dashboard.colleges.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.code} — {c.short_name ?? c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3 space-y-2.5">
                {filteredAllPosts.length === 0 ? (
                  <p className="text-xs font-semibold text-muted dark:text-[#A49DBB]">
                    No posts found.
                  </p>
                ) : (
                  filteredAllPosts.map((post) => (
                    <div
                      key={post.id}
                      className="rounded-2xl border border-[#ECE4FA] bg-[#FCF9FF] p-3.5 dark:border-white/10 dark:bg-[#211E30]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-pastel-lavender px-2.5 py-0.5 font-extrabold text-[#5D37B8] dark:bg-[#2E244F] dark:text-[#C4B5FD]">
                            {post.college_code} • {post.college_name}
                          </span>
                          <span className="font-bold uppercase text-muted dark:text-[#A49DBB]">
                            {post.category}
                          </span>
                          <span className="font-semibold text-ink dark:text-[#F4F1FA]">
                            🐱 {post.author_name || "Anonymous"}
                          </span>
                          <span className="text-muted dark:text-[#A49DBB]">
                            {formatRelativeTime(post.created_at)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                              post.status === "approved"
                                ? "bg-pastel-mint text-[#16794F] dark:bg-[#163B2C] dark:text-[#6EE7B7]"
                                : post.status === "pending"
                                ? "bg-pastel-amber text-[#7A4900] dark:bg-[#463313] dark:text-[#FCD34D]"
                                : "bg-[#FFE4EC] text-[#C81E4B] dark:bg-[#491928] dark:text-[#FF8EAE]"
                            }`}
                          >
                            {post.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {confirmDeleteId === post.id ? (
                            <>
                              <button
                                type="button"
                                disabled={busyId === post.id}
                                onClick={() =>
                                  void performAction(
                                    post.id,
                                    { action: "delete_confession", targetId: post.id },
                                    "Post permanently deleted.",
                                  )
                                }
                                className="rounded-full bg-[#D81B60] px-3 py-1 text-[11px] font-bold text-white"
                              >
                                {busyId === post.id ? "Deleting..." : "Confirm Delete"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-muted dark:bg-white/10 dark:text-[#D5CEE6]"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(post.id)}
                              className="inline-flex items-center gap-1 rounded-full bg-[#FFE4EC] px-3 py-1 text-[11px] font-bold text-[#C81E4B] hover:bg-[#FFD0DF] dark:bg-[#491928] dark:text-[#FF8EAE] dark:hover:bg-[#5E2235]"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="mt-2 whitespace-pre-wrap text-sm font-medium text-ink dark:text-[#F4F1FA]">
                        {post.content}
                      </p>
                      <p className="mt-1.5 text-[11px] font-semibold text-muted dark:text-[#A49DBB]">
                        ♡ {post.likes_count} • 💬 {post.comments_count}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Pending Confessions */}
            <section className="rounded-[24px] border border-white bg-white/95 p-5 shadow-card dark:border-white/10 dark:bg-[#171522]/95">
              <h2 className="font-display text-lg font-bold text-ink dark:text-[#F4F1FA]">
                Pending Moderation ({dashboard.pendingConfessions.length})
              </h2>

              <div className="mt-3 space-y-3">
                {dashboard.pendingConfessions.length === 0 ? (
                  <p className="text-xs font-semibold text-muted dark:text-[#A49DBB]">
                    All caught up — no pending confessions.
                  </p>
                ) : (
                  dashboard.pendingConfessions.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-[#ECE4FA] bg-[#FCF9FF] p-3.5 dark:border-white/10 dark:bg-[#211E30]"
                    >
                      <p className="text-sm font-medium text-ink dark:text-[#F4F1FA]">
                        {item.content}
                      </p>
                      <div className="mt-2.5 flex items-center justify-between text-xs">
                        <span className="font-bold uppercase text-muted dark:text-[#A49DBB]">
                          {item.college_code} • {item.category}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() =>
                              void performAction(
                                item.id,
                                { action: "approve_confession", targetId: item.id },
                                "Confession approved.",
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-full bg-pastel-mint px-3 py-1 font-bold text-[#16794F] dark:bg-[#163B2C] dark:text-[#6EE7B7]"
                          >
                            <Check className="h-3.5 w-3.5" /> Approve
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() =>
                              void performAction(
                                item.id,
                                { action: "reject_confession", targetId: item.id },
                                "Confession rejected.",
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-full bg-[#FFE4EC] px-3 py-1 font-bold text-[#C81E4B] dark:bg-[#491928] dark:text-[#FF8EAE]"
                          >
                            <X className="h-3.5 w-3.5" /> Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Open Reports */}
            <section className="rounded-[24px] border border-white bg-white/95 p-5 shadow-card dark:border-white/10 dark:bg-[#171522]/95">
              <h2 className="font-display text-lg font-bold text-ink dark:text-[#F4F1FA]">
                Open Reports ({dashboard.reports.length})
              </h2>

              <div className="mt-3 space-y-3">
                {dashboard.reports.length === 0 ? (
                  <p className="text-xs font-semibold text-muted dark:text-[#A49DBB]">
                    No open reports.
                  </p>
                ) : (
                  dashboard.reports.map((rep) => (
                    <div
                      key={rep.id}
                      className="rounded-2xl border border-[#FFE0EB] bg-[#FFF8FA] p-3.5 text-xs dark:border-[#532B45] dark:bg-[#291724]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-extrabold uppercase text-[#C81E4B] dark:text-[#FF8EAE]">
                          {rep.target_type} • {rep.reason}
                          {rep.preserve_for_safety ? " (SAFETY PRESERVED)" : ""}
                        </span>
                        <span className="font-mono text-[11px] text-muted dark:text-[#A49DBB]">
                          {rep.target_id}
                        </span>
                      </div>
                      {rep.target_preview && (
                        <div className="mt-2 rounded-xl border border-white bg-white/90 p-2.5 text-xs font-semibold text-ink dark:border-white/10 dark:bg-[#161422] dark:text-[#F4F1FA]">
                          "{rep.target_preview}"
                        </div>
                      )}
                      {rep.details && (
                        <p className="mt-1.5 font-medium text-muted dark:text-[#B9B1CE]">
                          Reporter note: {rep.details}
                        </p>
                      )}
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyId === rep.id}
                          onClick={() =>
                            void performAction(
                              rep.id,
                              {
                                action:
                                  rep.target_type === "comment"
                                    ? "hide_comment"
                                    : "hide_confession",
                                targetId: rep.target_id,
                              },
                              "Content hidden from campus feed.",
                            )
                          }
                          className="rounded-full bg-[#D81B60] px-3 py-1 font-bold text-white"
                        >
                          Hide Content
                        </button>
                        {rep.target_type === "confession" && (
                          <button
                            type="button"
                            disabled={busyId === rep.id}
                            onClick={() =>
                              void performAction(
                                rep.id,
                                { action: "delete_confession", targetId: rep.target_id },
                                "Reported confession permanently deleted.",
                              )
                            }
                            className="rounded-full bg-ink px-3 py-1 font-bold text-white dark:bg-[#2E244F]"
                          >
                            Delete Post
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busyId === rep.id}
                          onClick={() =>
                            void performAction(
                              rep.id,
                              { action: "resolve_report", reportId: rep.id },
                              "Report resolved.",
                            )
                          }
                          className="rounded-full bg-pastel-mint px-3 py-1 font-bold text-[#16794F] dark:bg-[#163B2C] dark:text-[#6EE7B7]"
                        >
                          Mark Resolved
                        </button>
                        <button
                          type="button"
                          disabled={busyId === rep.id}
                          onClick={() =>
                            void performAction(
                              rep.id,
                              { action: "dismiss_report", reportId: rep.id },
                              "Report dismissed.",
                            )
                          }
                          className="rounded-full bg-white px-3 py-1 font-bold text-muted dark:bg-white/10 dark:text-[#D5CEE6]"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#FFE8EF] p-5 text-sm font-bold text-[#B81D48] dark:bg-[#3A1724] dark:text-[#FF8EAE]">
            {authError ?? "Access denied. Ensure your account is registered in public.admin_users."}
          </div>
        )}
      </div>
    </div>
  );
}
