import type {
  AppearanceMode,
  CollegeInfo,
  GenderTheme,
  ResolvedTheme,
} from "../types/confession";

const SESSION_ID_KEY = "unsaid_anon_session_v1";
const CAMPUS_AUTH_KEY = "unsaid_campus_access_v2";
const SAVED_IDS_KEY = "unsaid_saved_confessions_v1";
const GENDER_THEME_KEY = "unsaid_gender_theme_v1";
const APPEARANCE_MODE_KEY = "unsaid_appearance_mode_v1";
const MANUAL_THEME_KEY = "unsaid_manual_theme_v1";
const POLL_VOTES_KEY = "unsaid_poll_votes_v1";

export interface CampusAccessState {
  token: string;
  expiresAt: string;
  college: CollegeInfo;
}

function generateRandomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${crypto.randomUUID()}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

export function getOrCreateSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_ID_KEY);
    if (existing && existing.length >= 16) {
      return existing;
    }
    const created = generateRandomId();
    localStorage.setItem(SESSION_ID_KEY, created);
    return created;
  } catch {
    return generateRandomId();
  }
}

export function getCampusAccess(): CampusAccessState | null {
  try {
    const raw = localStorage.getItem(CAMPUS_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CampusAccessState;
    if (!parsed.token || !parsed.college?.id || !parsed.college?.code || !parsed.expiresAt) {
      return null;
    }
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(CAMPUS_AUTH_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setCampusAccess(state: CampusAccessState): void {
  localStorage.setItem(CAMPUS_AUTH_KEY, JSON.stringify(state));
}

export function clearCampusAccess(): void {
  localStorage.removeItem(CAMPUS_AUTH_KEY);
}

export function getSavedConfessionIds(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function toggleSavedConfessionId(id: string): string[] {
  const current = getSavedConfessionIds();
  const next = current.includes(id)
    ? current.filter((item) => item !== id)
    : [id, ...current].slice(0, 100);
  localStorage.setItem(SAVED_IDS_KEY, JSON.stringify(next));
  return next;
}

export function getGenderTheme(): GenderTheme {
  try {
    const raw = localStorage.getItem(GENDER_THEME_KEY);
    return raw === "male" ? "male" : "female";
  } catch {
    return "female";
  }
}

export function setGenderTheme(theme: GenderTheme): void {
  localStorage.setItem(GENDER_THEME_KEY, theme);
}

export function getAppearanceMode(): AppearanceMode {
  try {
    const raw = localStorage.getItem(APPEARANCE_MODE_KEY);
    return raw === "manual" ? "manual" : "auto";
  } catch {
    return "auto";
  }
}

export function setAppearanceMode(mode: AppearanceMode): void {
  localStorage.setItem(APPEARANCE_MODE_KEY, mode);
}

export function getManualTheme(): ResolvedTheme {
  try {
    const raw = localStorage.getItem(MANUAL_THEME_KEY);
    return raw === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function setManualTheme(theme: ResolvedTheme): void {
  localStorage.setItem(MANUAL_THEME_KEY, theme);
}

export function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(
  mode: AppearanceMode,
  manualTheme: ResolvedTheme,
): ResolvedTheme {
  if (mode === "manual") return manualTheme;
  return getSystemPrefersDark() ? "dark" : "light";
}

export function applyDocumentTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const isDark = resolved === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", isDark ? "#0E0D16" : "#FDF4E4");
  }
}

export function syncDocumentThemeFromStorage(): ResolvedTheme {
  const mode = getAppearanceMode();
  const manual = getManualTheme();
  const resolved = resolveTheme(mode, manual);
  applyDocumentTheme(resolved);
  return resolved;
}

export function getPollVotesMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(POLL_VOTES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function savePollVote(confessionId: string, optionId: string): Record<string, string> {
  const current = getPollVotesMap();
  const next = { ...current, [confessionId]: optionId };
  localStorage.setItem(POLL_VOTES_KEY, JSON.stringify(next));
  return next;
}

const READ_NOTIFS_KEY = "unsaid_read_notifs_v1";

export function getReadNotificationIds(): string[] {
  try {
    const raw = localStorage.getItem(READ_NOTIFS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function markNotificationIdsRead(ids: string[]): string[] {
  const merged = Array.from(new Set([...getReadNotificationIds(), ...ids])).slice(-100);
  localStorage.setItem(READ_NOTIFS_KEY, JSON.stringify(merged));
  return merged;
}
