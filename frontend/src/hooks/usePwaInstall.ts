import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "unsaid_pwa_popup_dismissed_v1";

// Keep event at module level so route changes never lose the captured browser prompt
let capturedPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    capturedPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((fn) => fn());
  });
}

function checkIsStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

function checkIsIos(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function usePwaInstall() {
  const [hasNativePrompt, setHasNativePrompt] = useState(Boolean(capturedPrompt));
  const [isInstalled, setIsInstalled] = useState<boolean>(() => checkIsStandalone());
  const [isPopupDismissed, setIsPopupDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [installHint, setInstallHint] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setHasNativePrompt(Boolean(capturedPrompt));
    listeners.add(sync);

    const onInstalled = () => {
      capturedPrompt = null;
      setHasNativePrompt(false);
      setIsInstalled(true);
      setInstallHint(null);
    };

    window.addEventListener("appinstalled", onInstalled);
    return () => {
      listeners.delete(sync);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismissPopup = useCallback(() => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore storage errors
    }
    setIsPopupDismissed(true);
    setInstallHint(null);
  }, []);

  const triggerInstall = useCallback(async () => {
    if (isInstalled) return;

    if (capturedPrompt) {
      await capturedPrompt.prompt();
      const choice = await capturedPrompt.userChoice;
      if (choice.outcome === "accepted") {
        capturedPrompt = null;
        setHasNativePrompt(false);
        setIsInstalled(true);
      }
      return;
    }

    if (checkIsIos()) {
      setInstallHint('Tap the Share button (↑) in Safari, then choose "Add to Home Screen".');
    } else {
      setInstallHint('Open your browser menu (⋮) and tap "Install app" or "Add to Home screen".');
    }
  }, [isInstalled]);

  return {
    isInstalled,
    isPopupDismissed,
    hasNativePrompt,
    installHint,
    dismissPopup,
    triggerInstall,
    clearHint: () => setInstallHint(null),
  };
}
