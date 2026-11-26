import { Building2, CheckCircle2, Download, Hash, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useCampusSession } from "../hooks/useCampusSession";
import { usePwaInstall } from "../hooks/usePwaInstall";
import { assetUrl } from "../lib/assetUrl";

export function Profile() {
  const navigate = useNavigate();
  const { access, genderTheme, exitCampus, updateGenderTheme } = useCampusSession();
  const { isInstalled, installHint, triggerInstall } = usePwaInstall();

  const isMale = genderTheme === "male";
  const mascotSrc = isMale
    ? assetUrl("assets/mascots/love-boy.webp")
    : assetUrl("assets/mascots/thoughts-girl.webp");

  function handleSwitchCampus() {
    exitCampus();
    navigate("/", { replace: true });
  }

  return (
    <AppShell college={access?.college ?? null}>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold text-ink">Profile</h1>
        <p className="text-xs font-semibold text-muted">
          Your campus details & mascot theme
        </p>
      </div>

      <div className="space-y-4">
        <div
          className={`rounded-[28px] border border-white p-6 shadow-card transition-colors ${
            isMale
              ? "bg-gradient-to-br from-[#F7FBFF] via-[#F2F6FF] to-[#E6EEFF]"
              : "bg-gradient-to-br from-[#FFF9FB] via-[#FFF3F8] to-[#F4E8FF]"
          }`}
        >
          {/* Mascot Avatar + Male/Female Theme Switcher */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-20 w-20 items-center justify-center overflow-hidden rounded-[24px] border-2 border-white shadow-sm ${
                  isMale ? "bg-[#DCEEFF]" : "bg-[#FFE3F1]"
                }`}
              >
                <img
                  src={mascotSrc}
                  alt={isMale ? "Male campus mascot" : "Female campus mascot"}
                  className="h-full w-full object-contain"
                />
              </div>

              <div>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-extrabold ${
                    isMale
                      ? "bg-[#D9ECFF] text-[#1D5B9E]"
                      : "bg-[#FFE2EE] text-[#B62B66]"
                  }`}
                >
                  {isMale ? "Male Theme" : "Female Theme"}
                </span>
                <h2 className="mt-1.5 font-display text-xl font-bold text-ink">
                  Anonymous Student
                </h2>
              </div>
            </div>

            {/* Male / Female Tab Toggle */}
            <div className="inline-flex rounded-full border border-white bg-white/85 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => updateGenderTheme("male")}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  isMale
                    ? "bg-[#3B82F6] text-white shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                Male
              </button>
              <button
                type="button"
                onClick={() => updateGenderTheme("female")}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  !isMale
                    ? "bg-[#FF6FA9] text-white shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                Female
              </button>
            </div>
          </div>

          {/* Simple Campus Info: College Code & College Name Only */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white bg-white/85 p-4">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-muted">
                <Hash className="h-4 w-4 text-[#5D37B8]" />
                <span>College Code</span>
              </div>
              <p className="mt-1.5 font-display text-2xl font-bold tracking-wider text-ink">
                {access?.college.code ?? "—"}
              </p>
            </div>

            <div className="rounded-2xl border border-white bg-white/85 p-4">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-muted">
                <Building2 className="h-4 w-4 text-[#5D37B8]" />
                <span>College Name</span>
              </div>
              <p className="mt-1.5 font-display text-base font-bold leading-snug text-ink">
                {access?.college.name ?? "—"}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={handleSwitchCampus}
              className="inline-flex items-center gap-2 rounded-2xl bg-ink px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#2C2742]"
            >
              <LogOut className="h-4 w-4" />
              <span>Switch College Code</span>
            </button>
          </div>
        </div>

        {/* Permanent PWA Install Button Card */}
        <div className="rounded-[24px] border border-white bg-white/90 p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <img
                src={assetUrl("icons/icon-192.png")}
                alt="UNSAID app icon"
                className="h-12 w-12 rounded-2xl border border-[#EFE7FA] object-cover shadow-sm"
              />
              <div>
                <h3 className="font-display text-base font-bold text-ink">
                  UNSAID. Mobile & Desktop App
                </h3>
                <p className="text-xs font-semibold text-muted">
                  Install once for fast offline-ready campus access
                </p>
              </div>
            </div>

            {isInstalled ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-pastel-mint px-4 py-2 text-xs font-extrabold text-[#16794F]">
                <CheckCircle2 className="h-4 w-4" />
                <span>App Installed</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void triggerInstall()}
                className="inline-flex items-center gap-2 rounded-full bg-[#FF6FA9] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#F45998]"
              >
                <Download className="h-4 w-4" />
                <span>Install App</span>
              </button>
            )}
          </div>

          {installHint && (
            <p className="mt-3 rounded-xl bg-pastel-lavender/60 px-3.5 py-2.5 text-xs font-bold text-[#5D37B8]">
              {installHint}
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
