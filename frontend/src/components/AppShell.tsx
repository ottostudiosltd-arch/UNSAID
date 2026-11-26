import { useState, type ReactNode } from "react";
import {
  Bell,
  Bookmark,
  CheckCheck,
  Compass,
  Home,
  Plus,
  PlusCircle,
  Settings,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { formatRelativeTime } from "../hooks/useCampusSession";
import { assetUrl } from "../lib/assetUrl";
import { getReadNotificationIds, markNotificationIdsRead } from "../lib/session";
import type {
  CampusNotification,
  CampusVibesSummary,
  CollegeInfo,
  Confession,
} from "../types/confession";

interface AppShellProps {
  college: CollegeInfo | null;
  vibes?: CampusVibesSummary;
  notices?: Confession[];
  topBarSlot?: ReactNode;
  children: ReactNode;
}

const DEFAULT_VIBES: CampusVibesSummary = {
  happy: 42,
  stressed: 36,
  excited: 14,
  other: 8,
  sampleSize: 0,
};

export function AppShell({
  college,
  vibes = DEFAULT_VIBES,
  notices = [],
  topBarSlot,
  children,
}: AppShellProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>(() => getReadNotificationIds());

  const uniqueNotices: Confession[] = [];
  const seenNoticeKeys = new Set<string>();
  for (const n of notices) {
    const key = `${n.author_name || "Campus Admin"}:${n.content}`;
    if (!seenNoticeKeys.has(key)) {
      seenNoticeKeys.add(key);
      uniqueNotices.push(n);
    }
  }

  const notifications: CampusNotification[] = uniqueNotices.map((n) => ({
    id: n.id,
    title: `${n.author_name || "Campus Admin"} 📢`,
    body: n.content.length > 90 ? `${n.content.slice(0, 90)}...` : n.content,
    timeAgo: formatRelativeTime(n.created_at),
    unread: !readIds.includes(n.id),
    linkTo: `/confession/${n.id}`,
  }));

  const unreadCount = notifications.filter((n) => n.unread).length;

  const navItems = [
    { to: "/feed", label: "Home", icon: Home },
    { to: "/explore", label: "Explore", icon: Compass },
    { to: "/create", label: "Confess", icon: PlusCircle },
    { to: "/saved", label: "Saved", icon: Bookmark },
    { to: "/profile", label: "Profile", icon: User },
  ];

  function handleMarkAllRead() {
    setReadIds(markNotificationIdsRead(notifications.map((n) => n.id)));
  }

  return (
    <div className="min-h-screen w-full pb-24 lg:px-6 lg:py-5 lg:pb-6">
      {/* MOBILE TOP HEADER (< lg) */}
      <header className="relative flex items-center justify-between px-4 pb-2 pt-4 lg:hidden">
        <div>
          <Link to="/feed" className="block font-display text-3xl font-bold tracking-tight text-ink">
            UNSAID<span className="text-pastel-pinkDeep">.</span>
          </Link>
          <p className="text-xs font-semibold text-muted">
            {college ? `${college.code} • ${college.shortName ?? college.name}` : "Your Campus. Your Stories."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <img
            src={assetUrl("assets/mascots/peeking-cat.svg")}
            alt=""
            aria-hidden="true"
            className="h-14 w-24 object-contain"
          />
          <button
            type="button"
            onClick={() => setNotifOpen((prev) => !prev)}
            aria-label="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white bg-white/90 text-ink shadow-sm"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-pastel-pinkDeep ring-2 ring-white" />
            )}
          </button>
        </div>
      </header>

      {/* FULL-SCREEN DESKTOP 3-COLUMN LAYOUT (Fixed Left & Right Sidebars) */}
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 lg:flex-row lg:items-start">
        {/* FIXED LEFT SIDEBAR (Desktop) */}
        <aside className="relative hidden w-[240px] shrink-0 flex-col pt-9 lg:sticky lg:top-5 lg:flex lg:h-[calc(100vh-2.5rem)]">
          <img
            src={assetUrl("assets/mascots/peeking-cat.svg")}
            alt="UNSAID mascot"
            className="pointer-events-none absolute left-1/2 top-0 z-20 w-36 -translate-x-1/2"
          />

          <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-[28px] border border-white bg-white/90 px-4 pb-3 pt-10 shadow-card">
            <div>
              <Link to="/feed" className="block text-center">
                <span className="font-display text-3xl font-bold tracking-tight text-ink">
                  UNSAID<span className="text-pastel-pinkDeep">.</span>
                </span>
              </Link>
              <p className="mt-0.5 text-center text-[11px] font-semibold text-muted">
                Your Campus. Your Stories.
              </p>

              {college && (
                <div className="mt-3 flex items-center justify-center">
                  <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-pastel-lavender/75 px-3 py-1 text-[11px] font-bold text-[#5D37B8]">
                    <span>🎓</span>
                    <span className="truncate">
                      {college.code} • {college.shortName ?? college.name}
                    </span>
                  </span>
                </div>
              )}

              <nav className="mt-5 space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
                          isActive
                            ? "bg-pastel-lavender text-ink shadow-sm"
                            : "text-ink/75 hover:bg-pastel-lavender/40 hover:text-ink"
                        }`
                      }
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            <div className="mt-2 flex justify-center">
              <img
                src={assetUrl("assets/mascots/sleeping-cat.svg")}
                alt=""
                aria-hidden="true"
                className="animate-float-slow w-40 select-none"
              />
            </div>
          </div>
        </aside>

        {/* SCROLLING CENTER COLUMN */}
        <main className="min-w-0 flex-1 px-3 sm:px-4 lg:px-0">
          {/* Desktop Top Row: Category Pills + Working Notification Bell ONLY */}
          <div className="mb-5 hidden items-center justify-between gap-4 lg:flex">
            <div className="min-w-0 flex-1">{topBarSlot}</div>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                aria-label="Notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white bg-white/90 text-ink shadow-sm transition hover:bg-pastel-lavender/60"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-pastel-pinkDeep ring-2 ring-white" />
                )}
              </button>
            </div>
          </div>

          {children}
        </main>

        {/* FIXED RIGHT SIDEBAR (Desktop xl+) */}
        <aside className="hidden w-[280px] shrink-0 flex-col gap-4 xl:sticky xl:top-5 xl:flex xl:h-[calc(100vh-2.5rem)] xl:justify-between">
          <div className="space-y-4">
            {/* Campus Vibes Card */}
            <section className="rounded-[24px] border border-white bg-white/90 p-4 shadow-card">
              <div className="flex items-center gap-2">
                <span className="text-base">📊</span>
                <h2 className="font-display text-base font-bold text-ink">Campus Vibes</h2>
              </div>

              <div className="mt-3.5 space-y-3 text-xs font-bold">
                <div>
                  <div className="mb-1 flex justify-between text-ink/85">
                    <span>Happy</span>
                    <span className="tabular-nums">{vibes.happy}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#ECE7F6]">
                    <div
                      className="h-full rounded-full bg-pastel-mintDeep transition-all duration-500"
                      style={{ width: `${vibes.happy}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-ink/85">
                    <span>Stressed</span>
                    <span className="tabular-nums">{vibes.stressed}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#ECE7F6]">
                    <div
                      className="h-full rounded-full bg-pastel-pinkDeep transition-all duration-500"
                      style={{ width: `${vibes.stressed}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-ink/85">
                    <span>Excited</span>
                    <span className="tabular-nums">{vibes.excited}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#ECE7F6]">
                    <div
                      className="h-full rounded-full bg-[#FBBF24] transition-all duration-500"
                      style={{ width: `${vibes.excited}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-ink/85">
                    <span>Other</span>
                    <span className="tabular-nums">{vibes.other}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#ECE7F6]">
                    <div
                      className="h-full rounded-full bg-pastel-lavenderDeep transition-all duration-500"
                      style={{ width: `${vibes.other}%` }}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Quick Access Card */}
            <section className="rounded-[24px] border border-white bg-gradient-to-br from-[#F1E9FF] via-[#EAE0FF] to-[#E2D4FF] p-4 shadow-card">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-ink">Quick Access</h2>
                <Sparkles className="h-4 w-4 text-[#6B48C8]" />
              </div>

              <div className="mt-3 space-y-1.5 text-sm font-bold text-ink/85">
                <Link
                  to="/feed"
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-white/60"
                >
                  <span>🎓</span>
                  <span>My Feed</span>
                </Link>
                <Link
                  to="/saved"
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-white/60"
                >
                  <Bookmark className="h-4 w-4 text-[#5D37B8]" />
                  <span>Saved Posts</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setNotifOpen(true)}
                  className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition hover:bg-white/60"
                >
                  <span className="flex items-center gap-2.5">
                    <Bell className="h-4 w-4 text-[#5D37B8]" />
                    <span>Notifications</span>
                  </span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-pastel-pinkDeep px-2 py-0.5 text-[10px] font-extrabold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
                <Link
                  to="/profile"
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition hover:bg-white/60"
                >
                  <Settings className="h-4 w-4 text-[#5D37B8]" />
                  <span>Profile & Theme</span>
                </Link>
              </div>
            </section>
          </div>

          {/* Sticky Note Card */}
          <div className="relative rounded-2xl border border-[#F5CE74] bg-[#FFE49B] px-4 py-4 shadow-card -rotate-1">
            <p className="max-w-[72%] font-display text-sm font-bold leading-snug text-ink">
              Stay Anonymous.
              <br />
              Stay Kind. ❤️
            </p>
            <img
              src={assetUrl("assets/mascots/peeking-cat.svg")}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-2 right-1 w-24"
            />
          </div>
        </aside>
      </div>

      {/* NOTIFICATIONS POPOVER / MODAL */}
      {notifOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-end bg-ink/15 p-4 backdrop-blur-[2px] sm:p-6"
          onClick={() => setNotifOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-12 w-full max-w-sm rounded-[26px] border border-white bg-white/95 p-4 shadow-shell"
          >
            <div className="flex items-center justify-between border-b border-[#F1EAFB] pb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#5D37B8]" />
                <h3 className="font-display text-base font-bold text-ink">
                  Campus Notifications
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="inline-flex items-center gap-1 rounded-full bg-pastel-lavender px-2.5 py-1 text-[11px] font-bold text-[#5D37B8]"
                  >
                    <CheckCheck className="h-3 w-3" />
                    <span>Mark read</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setNotifOpen(false)}
                  aria-label="Close notifications"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-pastel-lavender/50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="rounded-2xl border border-[#F3EEFA] bg-[#FCF9FF] p-5 text-center">
                  <p className="text-xs font-bold text-ink">No new notifications</p>
                  <p className="mt-1 text-[11px] font-medium text-muted">
                    Official campus notices will appear here.
                  </p>
                </div>
              ) : (
                notifications.map((item) => (
                  <Link
                    key={item.id}
                    to={item.linkTo ?? "/feed"}
                    onClick={() => setNotifOpen(false)}
                    className={`block rounded-2xl border p-3 transition ${
                      item.unread
                        ? "border-[#E3D6FF] bg-pastel-lavender/35"
                        : "border-[#F3EEFA] bg-white hover:bg-[#FCF9FF]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-ink">{item.title}</span>
                      <span className="text-[10px] font-semibold text-muted">{item.timeAgo}</span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-muted">{item.body}</p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION (< lg) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#EFE8FA] bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end">
          <NavLink
            to="/feed"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 text-[11px] font-bold ${
                isActive ? "text-pastel-pinkDeep" : "text-ink/70"
              }`
            }
          >
            <Home className="h-5 w-5" />
            <span>Home</span>
          </NavLink>

          <NavLink
            to="/explore"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 text-[11px] font-bold ${
                isActive ? "text-pastel-pinkDeep" : "text-ink/70"
              }`
            }
          >
            <Compass className="h-5 w-5" />
            <span>Explore</span>
          </NavLink>

          <Link
            to="/create"
            className="-mt-6 flex flex-col items-center gap-0.5 text-[11px] font-bold text-ink"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-[#FF6FA9] text-white shadow-lg">
              <Plus className="h-6 w-6" />
            </span>
            <span>Confess</span>
          </Link>

          <NavLink
            to="/saved"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 text-[11px] font-bold ${
                isActive ? "text-pastel-pinkDeep" : "text-ink/70"
              }`
            }
          >
            <Bookmark className="h-5 w-5" />
            <span>Saved</span>
          </NavLink>

          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 text-[11px] font-bold ${
                isActive ? "text-pastel-pinkDeep" : "text-ink/70"
              }`
            }
          >
            <User className="h-5 w-5" />
            <span>Profile</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
