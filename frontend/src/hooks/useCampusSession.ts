import { useCallback, useEffect, useState } from "react";
import {
  clearCampusAccess,
  getCampusAccess,
  getGenderTheme,
  getPollVotesMap,
  getSavedConfessionIds,
  savePollVote,
  setGenderTheme,
  toggleSavedConfessionId,
  type CampusAccessState,
} from "../lib/session";
import type { GenderTheme } from "../types/confession";

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

  const recordPollVote = useCallback((confessionId: string, optionId: string) => {
    setPollVotes(savePollVote(confessionId, optionId));
  }, []);

  useEffect(() => {
    const onStorage = () => {
      setAccess(getCampusAccess());
      setSavedIds(getSavedConfessionIds());
      setThemeState(getGenderTheme());
      setPollVotes(getPollVotesMap());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return {
    access,
    savedIds,
    genderTheme,
    pollVotes,
    refreshAccess,
    exitCampus,
    toggleSave,
    updateGenderTheme,
    recordPollVote,
  };
}
