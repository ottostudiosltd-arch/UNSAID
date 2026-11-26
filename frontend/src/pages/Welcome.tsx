import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { OFFICIAL_COLLEGES, type OfficialCollege } from "../data/colleges";
import { assetUrl } from "../lib/assetUrl";
import { checkContentAllowed } from "../lib/moderation";
import { getCampusAccess } from "../lib/session";
import { addCollegeSchema, collegeCodeSchema } from "../lib/validation";
import {
  fetchCollegesList,
  registerCollege,
  verifyCollegeCode,
} from "../services/collegeService";

interface WelcomeProps {
  onSuccess: () => void;
}

export function Welcome({ onSuccess }: WelcomeProps) {
  const navigate = useNavigate();
  const existing = getCampusAccess();

  const [code, setCode] = useState("");
  const [colleges, setColleges] = useState<OfficialCollege[]>(OFFICIAL_COLLEGES);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [addMode, setAddMode] = useState(false);
  const [newCollegeName, setNewCollegeName] = useState("");
  const [newCollegeCode, setNewCollegeCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    void fetchCollegesList().then((list) => {
      if (active && list.length > 0) {
        setColleges(list);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);

    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  const filteredColleges = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return colleges;
    return colleges.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.shortName.toLowerCase().includes(q),
    );
  }, [colleges, searchQuery]);

  const matchedCollege = useMemo(
    () => colleges.find((c) => c.code.toUpperCase() === code.trim().toUpperCase()) ?? null,
    [colleges, code],
  );

  if (existing) {
    return <Navigate to="/feed" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = collegeCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid college code.");
      return;
    }

    setLoading(true);
    try {
      const result = await verifyCollegeCode(parsed.data);
      if (result.kind === "admin_gate") {
        navigate("/admin");
        return;
      }
      onSuccess();
      navigate("/feed", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not verify college code.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCollege(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = addCollegeSchema.safeParse({
      name: newCollegeName,
      code: newCollegeCode,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please fill valid college details.");
      return;
    }

    const mod = checkContentAllowed(parsed.data.name, { isShortLabel: true });
    if (!mod.ok) {
      setError(mod.message);
      return;
    }

    setLoading(true);
    try {
      await registerCollege(parsed.data.name, parsed.data.code);
      onSuccess();
      navigate("/feed", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not add your college right now.",
      );
    } finally {
      setLoading(false);
    }
  }

  function openAddForm() {
    setDropdownOpen(false);
    setError(null);
    setNewCollegeName(searchQuery.trim());
    setNewCollegeCode(code.trim().toUpperCase());
    setAddMode(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="relative w-full max-w-md">
        <div className="relative z-10 rounded-[32px] border border-[#F8E2B0] bg-gradient-to-b from-[#FFFDF7] via-[#FFF9EA] to-[#FFEFC8] p-6 shadow-shell backdrop-blur-md dark:border-[#4A3B22] dark:from-[#1E1A2A] dark:via-[#191625] dark:to-[#221B15] sm:p-8">
          <div className="flex justify-center">
            <img
              src={assetUrl("assets/mascots/unsaid-logo.webp")}
              alt="UNSAID. Your Campus. Your Stories."
              className="h-24 w-auto object-contain sm:h-28"
            />
          </div>

          {addMode ? (
            <>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddMode(false);
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-muted transition hover:text-ink dark:bg-white/10 dark:text-[#C5BED8] dark:hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to college list</span>
                </button>
              </div>

              <div className="mt-3 text-center">
                <h1 className="font-display text-2xl font-bold text-ink dark:text-[#F4F1FA]">
                  Add your college
                </h1>
                <p className="mt-1 text-xs font-medium text-muted dark:text-[#A49DBB]">
                  Create your campus space in 2 quick steps — name & code.
                </p>
              </div>

              <form onSubmit={handleAddCollege} className="mt-5 space-y-3.5">
                <div>
                  <label
                    htmlFor="new-college-name"
                    className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-muted dark:text-[#A49DBB]"
                  >
                    College Name
                  </label>
                  <input
                    id="new-college-name"
                    type="text"
                    maxLength={100}
                    value={newCollegeName}
                    onChange={(e) => setNewCollegeName(e.target.value)}
                    placeholder="e.g. COEP Technological University"
                    className="w-full rounded-2xl border-2 border-[#F5D692] bg-white px-4 py-3 text-sm font-bold text-ink placeholder:font-medium placeholder:text-muted/60 focus:border-[#E6A935] focus:outline-none focus:ring-4 focus:ring-[#FFE39A]/60 dark:border-[#524228] dark:bg-[#13111C] dark:text-[#F4F1FA] dark:placeholder:text-[#7E7696] dark:focus:border-[#F5B942] dark:focus:ring-[#F5B942]/25"
                  />
                </div>

                <div>
                  <label
                    htmlFor="new-college-code"
                    className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-muted dark:text-[#A49DBB]"
                  >
                    College Code
                  </label>
                  <input
                    id="new-college-code"
                    type="text"
                    autoCapitalize="characters"
                    maxLength={12}
                    value={newCollegeCode}
                    onChange={(e) => setNewCollegeCode(e.target.value.toUpperCase())}
                    placeholder="e.g. 06006"
                    className="w-full rounded-2xl border-2 border-[#F5D692] bg-white px-4 py-3 text-center font-display text-xl font-bold tracking-[0.2em] text-ink placeholder:tracking-normal placeholder:text-sm placeholder:font-medium placeholder:text-muted/60 focus:border-[#E6A935] focus:outline-none focus:ring-4 focus:ring-[#FFE39A]/60 dark:border-[#524228] dark:bg-[#13111C] dark:text-[#F4F1FA] dark:placeholder:text-[#7E7696] dark:focus:border-[#F5B942] dark:focus:ring-[#F5B942]/25"
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-2xl border border-[#FFC4D4] bg-[#FFE8EF] px-4 py-2.5 text-center text-xs font-bold text-[#B81D48] dark:border-[#6B253B] dark:bg-[#3A1724] dark:text-[#FF8EAE]"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3.5 font-display text-base font-bold text-white shadow-pill transition hover:bg-[#2C2742] active:scale-[0.99] disabled:opacity-60 dark:bg-[#FF6FA9] dark:hover:bg-[#F45998]"
                >
                  <span>{loading ? "Adding college..." : "Add College & Enter"}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mt-3 text-center">
                <h1 className="font-display text-2xl font-bold text-ink dark:text-[#F4F1FA]">
                  Enter your college code
                </h1>
                <p className="mt-1 text-sm font-medium text-muted dark:text-[#A49DBB]">
                  Type your code or pick your college from the directory below.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
                <div>
                  <label htmlFor="college-code" className="sr-only">
                    Official Campus Code
                  </label>
                  <input
                    id="college-code"
                    type="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    maxLength={12}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. 06155"
                    className="w-full rounded-2xl border-2 border-[#F5D692] bg-white px-4 py-3.5 text-center font-display text-2xl font-bold tracking-[0.25em] text-ink placeholder:tracking-normal placeholder:text-base placeholder:font-medium placeholder:text-muted/60 focus:border-[#E6A935] focus:outline-none focus:ring-4 focus:ring-[#FFE39A]/60 dark:border-[#524228] dark:bg-[#13111C] dark:text-[#F4F1FA] dark:placeholder:text-[#7E7696] dark:focus:border-[#F5B942] dark:focus:ring-[#F5B942]/25"
                  />

                  {matchedCollege && (
                    <div className="mt-2 flex items-center justify-center">
                      <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-[#C7F0DB] bg-[#E8FBF1] px-3 py-1 text-[11px] font-bold text-[#16794F] dark:border-[#244D3D] dark:bg-[#142D23] dark:text-[#6EE7B7]">
                        <Check className="h-3 w-3 shrink-0" />
                        <span className="truncate">{matchedCollege.name}</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Searchable College Directory Dropdown */}
                <div ref={dropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setDropdownOpen((prev) => !prev)}
                    aria-expanded={dropdownOpen}
                    className="flex w-full items-center justify-between gap-2 rounded-2xl border border-[#EED9A5] bg-white/90 px-3.5 py-2.5 text-left text-xs font-bold text-ink shadow-sm transition hover:bg-white dark:border-white/15 dark:bg-[#161422] dark:text-[#EFEBF8] dark:hover:bg-[#1F1C2E]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Building2 className="h-4 w-4 shrink-0 text-[#C27803] dark:text-[#FBBF24]" />
                      <span className="truncate">
                        {matchedCollege
                          ? `${matchedCollege.code} — ${matchedCollege.shortName}`
                          : "Find your college (Search list)"}
                      </span>
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 dark:text-[#A49DBB] ${
                        dropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {dropdownOpen && (
                    <div className="mt-2 overflow-hidden rounded-2xl border border-[#ECD6A4] bg-white shadow-xl dark:border-white/15 dark:bg-[#171522]">
                      {/* Search input */}
                      <div className="flex items-center gap-2 border-b border-[#F3E7CB] bg-[#FFFBF2] px-3 py-2 dark:border-white/10 dark:bg-[#1D1A2B]">
                        <Search className="h-3.5 w-3.5 shrink-0 text-muted dark:text-[#A49DBB]" />
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search college name or code..."
                          className="w-full bg-transparent text-xs font-semibold text-ink placeholder:text-muted/65 focus:outline-none dark:text-[#F4F1FA] dark:placeholder:text-[#8E86A6]"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            aria-label="Clear search"
                            className="rounded-full p-0.5 text-muted hover:text-ink dark:text-[#A49DBB] dark:hover:text-white"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Filtered college list */}
                      <div className="max-h-52 space-y-1 overflow-y-auto overscroll-contain p-1.5">
                        {filteredColleges.length === 0 ? (
                          <div className="px-3 py-4 text-center">
                            <p className="text-xs font-bold text-ink dark:text-[#F4F1FA]">
                              No college matched "{searchQuery.trim()}"
                            </p>
                            <p className="mt-0.5 text-[11px] font-medium text-muted dark:text-[#A49DBB]">
                              Add your college below with just name & code.
                            </p>
                          </div>
                        ) : (
                          filteredColleges.map((c) => {
                            const selected =
                              c.code.toUpperCase() === code.trim().toUpperCase();
                            return (
                              <button
                                key={c.slug}
                                type="button"
                                onClick={() => {
                                  setCode(c.code.toUpperCase());
                                  setDropdownOpen(false);
                                  setError(null);
                                }}
                                className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                                  selected
                                    ? "bg-[#FFF1CA] text-ink dark:bg-[#2E244F] dark:text-white"
                                    : "text-ink hover:bg-[#FFF8E8] dark:text-[#ECE7F8] dark:hover:bg-white/10"
                                }`}
                              >
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <span className="shrink-0 rounded-lg border border-[#F2D593] bg-[#FFF7DF] px-2 py-0.5 font-mono text-[11px] font-extrabold text-[#9A5B00] dark:border-[#493A78] dark:bg-[#2A2244] dark:text-[#C4B5FD]">
                                    {c.code}
                                  </span>
                                  <span className="truncate text-xs font-bold">
                                    {c.name}
                                  </span>
                                </div>
                                {selected && (
                                  <Check className="h-3.5 w-3.5 shrink-0 text-[#D97706] dark:text-[#FBBF24]" />
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>

                      {/* Add New College Action Footer */}
                      <div className="border-t border-[#F3E7CB] bg-[#FFFBF2] p-1.5 dark:border-white/10 dark:bg-[#1D1A2B]">
                        <button
                          type="button"
                          onClick={openAddForm}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#FFE7AE]/80 px-3 py-2 text-xs font-extrabold text-[#7A4900] transition hover:bg-[#FFDD8F] dark:bg-[#3A2C16] dark:text-[#FCD34D] dark:hover:bg-[#4A381C]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>College not in list? Add college</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-2xl border border-[#FFC4D4] bg-[#FFE8EF] px-4 py-2.5 text-center text-xs font-bold text-[#B81D48] dark:border-[#6B253B] dark:bg-[#3A1724] dark:text-[#FF8EAE]"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3.5 font-display text-base font-bold text-white shadow-pill transition hover:bg-[#2C2742] active:scale-[0.99] disabled:opacity-60 dark:bg-[#FF6FA9] dark:hover:bg-[#F45998]"
                >
                  <span>{loading ? "Verifying campus..." : "Enter Campus"}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </>
          )}

          <div className="mt-6 grid grid-cols-3 gap-2 border-t border-[#F2EBFA] pt-4 text-center text-[11px] font-bold text-muted dark:border-white/10 dark:text-[#A49DBB]">
            <div className="flex flex-col items-center gap-1">
              <Lock className="h-4 w-4 text-pastel-lavenderDeep dark:text-[#A78BFA]" />
              <span>No Login</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ShieldCheck className="h-4 w-4 text-pastel-mintDeep dark:text-[#34D399]" />
              <span>Verified Campuses</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Sparkles className="h-4 w-4 text-pastel-pinkDeep" />
              <span>Polls & Stories</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
