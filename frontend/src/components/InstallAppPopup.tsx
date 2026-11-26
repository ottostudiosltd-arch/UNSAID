import { Download, X } from "lucide-react";
import { usePwaInstall } from "../hooks/usePwaInstall";
import { assetUrl } from "../lib/assetUrl";

export function InstallAppPopup() {
  const {
    isInstalled,
    isPopupDismissed,
    installHint,
    dismissPopup,
    triggerInstall,
  } = usePwaInstall();

  if (isInstalled || isPopupDismissed) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-label="Install UNSAID App"
      className="fixed bottom-20 left-3 right-3 z-50 mx-auto max-w-sm rounded-[24px] border border-white bg-white/95 p-3.5 shadow-shell backdrop-blur-md lg:bottom-6 lg:left-auto lg:right-6"
    >
      <div className="flex items-center gap-3">
        <img
          src={assetUrl("icons/icon-192.png")}
          alt="UNSAID app icon"
          className="h-12 w-12 shrink-0 rounded-2xl border border-[#EFE7FA] object-cover shadow-sm"
        />

        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-ink">
            Install UNSAID. App
          </p>
          <p className="text-[11px] font-semibold text-muted">
            Add to your home screen for quick campus access
          </p>
        </div>

        <button
          type="button"
          onClick={() => void triggerInstall()}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#2C2742]"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Install</span>
        </button>

        <button
          type="button"
          onClick={dismissPopup}
          aria-label="Close install popup"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-pastel-lavender/60 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {installHint && (
        <p className="mt-2.5 rounded-xl bg-pastel-lavender/60 px-3 py-2 text-[11px] font-bold text-[#5D37B8]">
          {installHint}
        </p>
      )}
    </div>
  );
}
