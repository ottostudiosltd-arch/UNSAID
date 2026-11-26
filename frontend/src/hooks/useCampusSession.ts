import { useCallback, useEffect, useState } from "react";
import {
  applyDocumentTheme,
  clearCampusAccess,
  getAppearanceMode,
  getCampusAccess,
  getGenderTheme,
  getManualTheme,
  getPollVotesMap,
  getSavedConfessionIds,
  resolveTheme,
  savePollVote,
  setAppearanceMode,
  setGenderTheme,
  setManualTheme,
  toggleSavedConfessionId,
  type CampusAccessState,
} from "../lib/session";
import type {
  AppearanceMode,
  GenderTheme,
  ResolvedTheme,
} from "../types/confession";

const THEME_SYNC_EVENT = "unsaid-theme-change";

export function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function useCampusSession() {
  const [access, setAccess] = useState<CampusAccessState | null>(() => getCampusAccess());
  const [savedIds, setSavedIds] = useState<string[]>(() => getSavedConfessionIds());
  const [genderTheme, setThemeState] = useState<GenderTheme>(() => getGenderTheme());
  const [appearanceMode, setAppearanceModeState] = useState<AppearanceMode>(() =>
    getAppearanceMode(),
  );
  const [manualTheme, setManualThemeState] = useState<ResolvedTheme>(() =>
    getManualTheme(),
  );
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(getAppearanceMode(), getManualTheme()),
  );
  const [pollVotes, setPollVotes] = useState<Record<string, string>>(() => getPollVotesMap());

  const refreshAccess = useCallback(() => {
    setAccess(getCampusAccess());
  }, []);

  const exitCampus = useCallback(() => {
    clearCampusAccess();
    setAccess(null);
  }, []);

  const toggleSave = useCallback((id: string) => {
    setSavedIds(toggleSavedConfessionId(id));
  }, []);

  const updateGenderTheme = useCallback((theme: GenderTheme) => {
    setGenderTheme(theme);
    setThemeState(theme);
  }, []);

  const applyAndNotifyTheme = useCallback(
    (nextMode: AppearanceMode, nextManual: ResolvedTheme) => {
      const nextResolved = resolveTheme(nextMode, nextManual);
      applyDocumentTheme(nextResolved);
      setResolvedTheme(nextResolved);
      window.dispatchEvent(new Event(THEME_SYNC_EVENT));
    },
    [],
  );

  const updateAppearanceMode = useCallback(
    (mode: AppearanceMode) => {
      setAppearanceMode(mode);
      setAppearanceModeState(mode);
      // Switching to manual always defaults the Sun/Moon toggle to Sun ("light")
      if (mode === "manual") {
        setManualTheme("light");
        setManualThemeState("light");
        applyAndNotifyTheme("manual", "light");
      } else {
        applyAndNotifyTheme("auto", manualTheme);
      }
    },
    [applyAndNotifyTheme, manualTheme],
  );

  const updateManualTheme = useCallback(
    (theme: ResolvedTheme) => {
      setManualTheme(theme);
      setManualThemeState(theme);
      applyAndNotifyTheme("manual", theme);
    },
    [applyAndNotifyTheme],
  );

  const recordPollVote = useCallback((confessionId: string, optionId: string) => {
    setPollVotes(savePollVote(confessionId, optionId));
  }, []);

  useEffect(() => {
    const syncAll = () => {
      const nextMode = getAppearanceMode();
      const nextManual = getManualTheme();
      const nextResolved = resolveTheme(nextMode, nextManual);
      setAppearanceModeState(nextMode);
      setManualThemeState(nextManual);
      setResolvedTheme(nextResolved);
      applyDocumentTheme(nextResolved);
    };

    const onStorage = () => {
      setAccess(getCampusAccess());
      setSavedIds(getSavedConfessionIds());
      setThemeState(getGenderTheme());
      setPollVotes(getPollVotesMap());
      syncAll();
    };

    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onMediaChange = () => {
      if (getAppearanceMode() === "auto") {
        syncAll();
      }
    };

    syncAll();
    window.addEventListener("storage", onStorage);
    window.addEventListener(THEME_SYNC_EVENT, syncAll);
    mediaQuery?.addEventListener("change", onMediaChange);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(THEME_SYNC_EVENT, syncAll);
      mediaQuery?.removeEventListener("change", onMediaChange);
    };
  }, []);

  return {
    access,
    savedIds,
    genderTheme,
    appearanceMode,
    manualTheme,
    resolvedTheme,
    pollVotes,
    refreshAccess,
    exitCampus,
    toggleSave,
    updateGenderTheme,
    updateAppearanceMode,
    updateManualTheme,
    recordPollVote,
  };
}
