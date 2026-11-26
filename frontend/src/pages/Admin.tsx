import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Check,
  Database,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  adminSignIn,
  adminSignOut,
  fetchAdminDashboard,
  runAdminAction,
  type AdminDashboardData,
} from "../services/adminService";

export function Admin() {
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const data = await fetchAdminDashboard();
      setDashboard(data);
    } catch (err) {
      setDashboard(null);
      setAuthError(err instanceof Error ? err.message : "Unauthorized");
    } finally {
      setLoading(false);
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
        void loadDashboard();
      } else {
        setLoading(false);
      }
    });
  }, [loadDashboard]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      await adminSignIn(email.trim(), password);
      setSignedIn(true);
      await loadDashboard();
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
    try {
      await runAdminAction(body);
      setStatusMsg(label);
      await loadDashboard();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              to="/"
              className="text-xs font-bold text-[#5D37B8] hover:underline"
            >
              ← Back to UNSAID.
            </Link>
            <h1 className="mt-1 font-display text-3xl font-bold text-ink">
              Moderation Dashboard
            </h1>
          </div>

          {signedIn && (
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex items-center gap-1.5 rounded-full border border-white bg-white px-4 py-2 text-xs font-bold text-ink shadow-sm"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out</span>
            </button>
          )}
        </div>

        {!supabase ? (
          <div className="rounded-[28px] border border-white bg-white/95 p-7 shadow-card">
            <ShieldAlert className="h-8 w-8 text-pastel-amberDeep" />
            <h2 className="mt-2 font-display text-xl font-bold text-ink">
              Supabase Not Connected
            </h2>
            <p className="mt-1 text-sm font-medium text-muted">
              Admin authentication uses Supabase Auth + verified rows in{" "}
              <code className="rounded bg-pastel-lavender px-1.5 py-0.5 text-xs">
                public.admin_users
              </code>
              .
            </p>
          </div>
        ) : !signedIn ? (
          <form
            onSubmit={handleLogin}
            className="mx-auto max-w-md rounded-[28px] border border-white bg-white/95 p-6 shadow-card"
          >
            <div className="flex items-center gap-2 text-[#5D37B8]">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="font-display text-xl font-bold text-ink">
                Moderator Sign In
              </h2>
            </div>
            <p className="mt-1 text-xs font-medium text-muted">
              Sign in with your Supabase Auth moderator email and password.
            </p>

            <div className="mt-4 space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Moderator email"
                className="w-full rounded-2xl border border-[#ECE4FA] bg-[#FCF9FF] px-4 py-2.5 text-sm font-medium focus:border-pastel-lavenderDeep focus:outline-none"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-2xl border border-[#ECE4FA] bg-[#FCF9FF] px-4 py-2.5 text-sm font-medium focus:border-pastel-lavenderDeep focus:outline-none"
              />
            </div>

            {authError && (
              <p className="mt-3 text-xs font-bold text-[#B81D48]">{authError}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full rounded-2xl bg-ink py-3 text-sm font-bold text-white shadow-pill disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : loading ? (
          <div className="h-48 animate-pulse rounded-[28px] bg-white/80" />
        ) : dashboard ? (
          <div className="space-y-6">
            {statusMsg && (
              <div className="rounded-2xl border border-[#C7F0DB] bg-pastel-mint px-4 py-2.5 text-xs font-bold text-[#16794F]">
                {statusMsg}
              </div>
            )}

            {dashboard.health && (
              <section className="rounded-[24px] border border-white bg-white/95 p-5 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-[#5D37B8]" />
                    <h2 className="font-display text-lg font-bold text-ink">
                      Database Capacity Guardrail
                    </h2>
                  </div>
                  <span className="rounded-full bg-pastel-lavender px-3 py-1 text-xs font-extrabold uppercase text-[#5D37B8]">
                    {dashboard.health.tier.replace("_", " ")} • {dashboard.health.db_mb} MB / 500 MB
                  </span>
                </div>

                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#ECE7F6]">
                  <div
                    className="h-full rounded-full bg-pastel-lavenderDeep"
                    style={{
                      width: `${Math.min(100, (dashboard.health.db_mb / 500) * 100)}%`,
                    }}
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-muted">
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
                      className="rounded-full border border-[#E6DCFB] bg-white px-3.5 py-1.5 text-ink hover:bg-pastel-amber/60"
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
                      className="inline-flex items-center gap-1 rounded-full bg-ink px-3.5 py-1.5 text-white"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Run 90-Day Cleanup</span>
                    </button>
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-[24px] border border-white bg-white/95 p-5 shadow-card">
              <h2 className="font-display text-lg font-bold text-ink">
                Pending Moderation ({dashboard.pendingConfessions.length})
              </h2>

              <div className="mt-3 space-y-3">
                {dashboard.pendingConfessions.length === 0 ? (
                  <p className="text-xs font-semibold text-muted">
                    All caught up — no pending confessions.
                  </p>
                ) : (
                  dashboard.pendingConfessions.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-[#ECE4FA] bg-[#FCF9FF] p-3.5"
                    >
                      <p className="text-sm font-medium text-ink">{item.content}</p>
                      <div className="mt-2.5 flex items-center justify-between text-xs">
                        <span className="font-bold uppercase text-muted">
                          {item.category}
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
                            className="inline-flex items-center gap-1 rounded-full bg-pastel-mint px-3 py-1 font-bold text-[#16794F]"
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
                            className="inline-flex items-center gap-1 rounded-full bg-[#FFE4EC] px-3 py-1 font-bold text-[#C81E4B]"
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

            <section className="rounded-[24px] border border-white bg-white/95 p-5 shadow-card">
              <h2 className="font-display text-lg font-bold text-ink">
                Open Reports ({dashboard.reports.length})
              </h2>

              <div className="mt-3 space-y-3">
                {dashboard.reports.length === 0 ? (
                  <p className="text-xs font-semibold text-muted">No open reports.</p>
                ) : (
                  dashboard.reports.map((rep) => (
                    <div
                      key={rep.id}
                      className="rounded-2xl border border-[#FFE0EB] bg-[#FFF8FA] p-3.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-extrabold uppercase text-[#C81E4B]">
                          {rep.target_type} • {rep.reason}
                          {rep.preserve_for_safety ? " (SAFETY PRESERVED)" : ""}
                        </span>
                        <span className="font-mono text-[11px] text-muted">
                          {rep.target_id}
                        </span>
                      </div>
                      {rep.details && (
                        <p className="mt-1.5 font-medium text-ink">{rep.details}</p>
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
                          className="rounded-full bg-pastel-mint px-3 py-1 font-bold text-[#16794F]"
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
                          className="rounded-full bg-white px-3 py-1 font-bold text-muted"
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
          <div className="rounded-2xl bg-[#FFE8EF] p-5 text-sm font-bold text-[#B81D48]">
            {authError ?? "Access denied. Ensure your account is registered in public.admin_users."}
          </div>
        )}
      </div>
    </div>
  );
}
