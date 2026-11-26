import {
  Building2,
  CheckCircle2,
  Download,
  Hash,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useCampusSession } from "../hooks/useCampusSession";
import { usePwaInstall } from "../hooks/usePwaInstall";
import { assetUrl } from "../lib/assetUrl";

export function Profile() {
  const navigate = useNavigate();
  const {
    access,
    genderTheme,
    appearanceMode,
    manualTheme,
    exitCampus,
    updateGenderTheme,
    updateAppearanceMode,
    updateManualTheme,
  } = useCampusSession();
  const { isInstalled, installHint, triggerInstall } = usePwaInstall();

  const isMale = genderTheme === "male";
  const isManual = appearanceMode === "manual";
  const mascotSrc = isMale
    ? assetUrl("assets/mascots/love-boy.webp")
    : assetUrl("assets/mascots/thoughts-girl.webp");

  function handleSwitchCampus() {
    exitCampus();
    navigate("/", { replace: true });
  }

  return (
    <AppShell college={access?.college ?? null}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink dark:text-[#F4F1FA]">
            Profile
          </h1>
          <p className="text-xs font-semibold text-muted dark:text-[#A49DBB]">
            Your campus details & mascot theme
          </p>
        </div>

        {isManual && (
          <button
            type="button"
            onClick={() => updateManualTheme(manualTheme === "light" ? "dark" : "light")}
            aria-label={
              manualTheme === "light" ? "Switch to dark mode" : "Switch to light mode"
            }
            title={
              manualTheme === "light" ? "Sun mode (tap for Dark)" : "Moon mode (tap for Light)"
            }
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white bg-white/95 text-[#D97706] shadow-sm transition hover:scale-105 active:scale-95 dark:border-white/15 dark:bg-[#231F36] dark:text-[#FBBF24]"
          >
            {manualTheme === "dark" ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div
          className={`rounded-[28px] border border-white p-6 shadow-card transition-colors dark:border-white/10 ${
            isMale
              ? "bg-gradient-to-br from-[#F7FBFF] via-[#F2F6FF] to-[#E6EEFF] dark:from-[#161F33] dark:via-[#151B2C] dark:to-[#121624]"
              : "bg-gradient-to-br from-[#FFF9FB] via-[#FFF3F8] to-[#F4E8FF] dark:from-[#261626] dark:via-[#1F1526] dark:to-[#181426]"
          }`}
        >
          {/* Mascot Avatar & Identity */}
          <div className="flex items-center gap-4">
            <div
              className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[24px] border-2 border-white shadow-sm dark:border-white/15 ${
                isMale ? "bg-[#DCEEFF] dark:bg-[#1E3354]" : "bg-[#FFE3F1] dark:bg-[#411E34]"
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
                    ? "bg-[#D9ECFF] text-[#1D5B9E] dark:bg-[#1E3A63] dark:text-[#93C5FD]"
                    : "bg-[#FFE2EE] text-[#B62B66] dark:bg-[#4A1F36] dark:text-[#FF9AC2]"
                }`}
              >
                {isMale ? "Male Theme" : "Female Theme"}
              </span>
              <h2 className="mt-1.5 font-display text-xl font-bold text-ink dark:text-[#F4F1FA]">
                Anonymous Student
              </h2>
            </div>
          </div>

          {/* Controls Row: Male/Female on LEFT, Auto/Manual on RIGHT */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="inline-flex rounded-full border border-white bg-white/85 p-1 shadow-sm dark:border-white/10 dark:bg-[#181625]">
              <button
                type="button"
                onClick={() => updateGenderTheme("male")}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  isMale
                    ? "bg-[#3B82F6] text-white shadow-sm"
                    : "text-muted hover:text-ink dark:text-[#A49DBB] dark:hover:text-white"
                }`}
              >
                Male
              </button>
              <button
                type="button"
                onClick={() => updateGenderTheme("female")}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  !isMale
                    ? "bg-[#FF6FA9] text-white shadow-sm"
                    : "text-muted hover:text-ink dark:text-[#A49DBB] dark:hover:text-white"
                }`}
              >
                Female
              </button>
            </div>

            <div className="inline-flex rounded-full border border-white bg-white/85 p-1 shadow-sm dark:border-white/10 dark:bg-[#181625]">
              <button
                type="button"
                onClick={() => updateAppearanceMode("auto")}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  !isManual
                    ? "bg-ink text-white shadow-sm dark:bg-[#8E63F3]"
                    : "text-muted hover:text-ink dark:text-[#A49DBB] dark:hover:text-white"
                }`}
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => updateAppearanceMode("manual")}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  isManual
                    ? "bg-ink text-white shadow-sm dark:bg-[#8E63F3]"
                    : "text-muted hover:text-ink dark:text-[#A49DBB] dark:hover:text-white"
                }`}
              >
                Manual
              </button>
            </div>
          </div>

          {/* Simple Campus Info: College Code & College Name Only */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white bg-white/85 p-4 dark:border-white/10 dark:bg-[#1B1829]/85">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-muted dark:text-[#A49DBB]">
                <Hash className="h-4 w-4 text-[#5D37B8] dark:text-[#A78BFA]" />
                <span>College Code</span>
              </div>
              <p className="mt-1.5 font-display text-2xl font-bold tracking-wider text-ink dark:text-[#F4F1FA]">
                {access?.college.code ?? "—"}
              </p>
            </div>

            <div className="rounded-2xl border border-white bg-white/85 p-4 dark:border-white/10 dark:bg-[#1B1829]/85">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-muted dark:text-[#A49DBB]">
                <Building2 className="h-4 w-4 text-[#5D37B8] dark:text-[#A78BFA]" />
                <span>College Name</span>
              </div>
              <p className="mt-1.5 font-display text-base font-bold leading-snug text-ink dark:text-[#F4F1FA]">
                {access?.college.name ?? "—"}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={handleSwitchCampus}
              className="inline-flex items-center gap-2 rounded-2xl bg-ink px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#2C2742] dark:bg-[#2E2947] dark:hover:bg-[#3A3459]"
            >
              <LogOut className="h-4 w-4" />
              <span>Switch College Code</span>
            </button>
          </div>
        </div>

        {/* Permanent PWA Install Button Card */}
        <div className="rounded-[24px] border border-white bg-white/90 p-5 shadow-card dark:border-white/10 dark:bg-[#171522]/90">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <img
                src={assetUrl("icons/icon-192.png")}
                alt="UNSAID app icon"
                className="h-12 w-12 rounded-2xl border border-[#EFE7FA] object-cover shadow-sm dark:border-white/15"
              />
              <div>
                <h3 className="font-display text-base font-bold text-ink dark:text-[#F4F1FA]">
                  UNSAID. Mobile & Desktop App
                </h3>
                <p className="text-xs font-semibold text-muted dark:text-[#A49DBB]">
                  Install once for fast offline-ready campus access
                </p>
              </div>
            </div>

            {isInstalled ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-pastel-mint px-4 py-2 text-xs font-extrabold text-[#16794F] dark:bg-[#163B2C] dark:text-[#6EE7B7]">
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
            <p className="mt-3 rounded-xl bg-pastel-lavender/60 px-3.5 py-2.5 text-xs font-bold text-[#5D37B8] dark:bg-[#2A2244] dark:text-[#C4B5FD]">
              {installHint}
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
