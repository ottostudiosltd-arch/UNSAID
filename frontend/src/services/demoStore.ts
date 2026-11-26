import {
  findCollegeByCode,
  OFFICIAL_COLLEGES,
  type OfficialCollege,
} from "../data/colleges";
import {
  getCampusAccess,
  getPollVotesMap,
  savePollVote,
  setCampusAccess,
} from "../lib/session";
import type {
  CampusVibe,
  CampusVibesSummary,
  CategoryFilter,
  CommentItem,
  Confession,
  ConfessionCategory,
  FeedSort,
} from "../types/confession";

const DEMO_CONFESSIONS_KEY = "unsaid_demo_confessions_v2";
const DEMO_COMMENTS_KEY = "unsaid_demo_comments_v2";
const DEMO_LIKES_KEY = "unsaid_demo_likes_v2";

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();

const INITIAL_CONFESSIONS: Confession[] = [
  {
    id: "conf-raisoni-1",
    college_code: "06155",
    college_name: "G.H. Raisoni",
    author_name: "Anonymous",
    category: "love",
    vibe: "excited",
    content: "I'm in love with my best friend... but I'm too scared to tell them. 💔",
    poll: {
      question: "Should I confess before semester ends?",
      options: [
        { id: "opt-1", label: "Yes, go for it! 💖", votes: 68 },
        { id: "opt-2", label: "Drop a subtle hint first 👀", votes: 41 },
        { id: "opt-3", label: "Wait till exams finish 📚", votes: 19 },
      ],
    },
    likes_count: 782,
    comments_count: 23,
    created_at: hoursAgo(1),
  },
  {
    id: "conf-raisoni-2",
    college_code: "06155",
    college_name: "G.H. Raisoni",
    author_name: "Anonymous",
    category: "college",
    vibe: "happy",
    content: "Our college canteen is actually underrated! 🍕",
    likes_count: 421,
    comments_count: 14,
    created_at: hoursAgo(2),
  },
  {
    id: "conf-raisoni-3",
    college_code: "06155",
    college_name: "G.H. Raisoni",
    author_name: "NightOwl",
    category: "thoughts",
    vibe: "stressed",
    content: "Sometimes I feel lost in my own thoughts...",
    likes_count: 376,
    comments_count: 11,
    created_at: hoursAgo(3),
  },
  {
    id: "conf-raisoni-4",
    college_code: "06155",
    college_name: "G.H. Raisoni",
    author_name: "Anonymous",
    category: "funny",
    vibe: "happy",
    content: "Attendance ka 75% but class me 0% present 😂",
    poll: {
      question: "Current attendance situation?",
      options: [
        { id: "opt-a", label: "Safely above 80% 😇", votes: 24 },
        { id: "opt-b", label: "Living on 75.1% edge 😅", votes: 89 },
        { id: "opt-c", label: "Medical certificate loading 🏥", votes: 54 },
      ],
    },
    likes_count: 296,
    comments_count: 9,
    created_at: hoursAgo(4),
  },
  {
    id: "conf-pccoe-1",
    college_code: "06175",
    college_name: "PCCOE",
    author_name: "Anonymous",
    category: "college",
    vibe: "excited",
    content: "Coding club hackathon prep at 2 AM with endless chai was peak college energy!",
    poll: {
      question: "Best late-night study fuel?",
      options: [
        { id: "p1", label: "Cutting Chai ☕", votes: 73 },
        { id: "p2", label: "Black Coffee ⚡", votes: 52 },
        { id: "p3", label: "Maggi at 1 AM 🍜", votes: 95 },
      ],
    },
    likes_count: 512,
    comments_count: 18,
    created_at: hoursAgo(2),
  },
  {
    id: "conf-mit-1",
    college_code: "06146",
    college_name: "MIT AOE",
    author_name: "Anonymous",
    category: "love",
    vibe: "happy",
    content: "To the person wearing the pastel hoodie near the Alandi library steps — your smile made my whole week.",
    likes_count: 344,
    comments_count: 8,
    created_at: hoursAgo(3),
  },
  {
    id: "conf-iiit-1",
    college_code: "06754",
    college_name: "IIIT Pune",
    author_name: "DebugCat",
    category: "funny",
    vibe: "stressed",
    content: "Fixed a bug at 4 AM only to realize I was editing the wrong branch the whole time 💀",
    likes_count: 465,
    comments_count: 15,
    created_at: hoursAgo(5),
  },
  {
    id: "conf-jspm-1",
    college_code: "06145",
    college_name: "JSPM JSCOE",
    author_name: "Anonymous",
    category: "secrets",
    vibe: "other",
    content: "I actually enjoy 8 AM labs only because the campus breeze feels peaceful before everyone arrives.",
    likes_count: 198,
    comments_count: 5,
    created_at: hoursAgo(6),
  },
  {
    id: "conf-dypit-1",
    college_code: "06207",
    college_name: "DYPIT Pimpri",
    author_name: "Anonymous",
    category: "thoughts",
    vibe: "other",
    content: "First year felt endless, now final year feels like it blinked past in a week.",
    likes_count: 610,
    comments_count: 27,
    created_at: hoursAgo(7),
  },
];

const INITIAL_COMMENTS: Record<string, CommentItem[]> = {
  "conf-raisoni-1": [
    {
      id: "demo-c-1",
      confession_id: "conf-raisoni-1",
      author_name: "Anonymous",
      content: "Tell them after finals so there's zero awkward study tension! Rooting for you.",
      created_at: hoursAgo(0.8),
    },
    {
      id: "demo-c-2",
      confession_id: "conf-raisoni-1",
      author_name: "Anonymous",
      content: "Half of campus is secretly in the exact same boat tbh.",
      created_at: hoursAgo(0.5),
    },
  ],
  "conf-raisoni-2": [
    {
      id: "demo-c-3",
      confession_id: "conf-raisoni-2",
      author_name: "Anonymous",
      content: "Samosa + masala chai between 11am lectures hits different.",
      created_at: hoursAgo(1.2),
    },
  ],
};

function readConfessions(): Confession[] {
  try {
    const raw = localStorage.getItem(DEMO_CONFESSIONS_KEY);
    if (raw) return JSON.parse(raw) as Confession[];
  } catch {
    // ignore
  }
  localStorage.setItem(DEMO_CONFESSIONS_KEY, JSON.stringify(INITIAL_CONFESSIONS));
  return INITIAL_CONFESSIONS;
}

function writeConfessions(items: Confession[]): void {
  localStorage.setItem(DEMO_CONFESSIONS_KEY, JSON.stringify(items));
}

function readCommentsMap(): Record<string, CommentItem[]> {
  try {
    const raw = localStorage.getItem(DEMO_COMMENTS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, CommentItem[]>;
  } catch {
    // ignore
  }
  localStorage.setItem(DEMO_COMMENTS_KEY, JSON.stringify(INITIAL_COMMENTS));
  return INITIAL_COMMENTS;
}

function writeCommentsMap(map: Record<string, CommentItem[]>): void {
  localStorage.setItem(DEMO_COMMENTS_KEY, JSON.stringify(map));
}

function readLikedIds(): string[] {
  try {
    const raw = localStorage.getItem(DEMO_LIKES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

const DEMO_CUSTOM_COLLEGES_KEY = "unsaid_demo_custom_colleges_v1";

function readCustomColleges(): OfficialCollege[] {
  try {
    const raw = localStorage.getItem(DEMO_CUSTOM_COLLEGES_KEY);
    return raw ? (JSON.parse(raw) as OfficialCollege[]) : [];
  } catch {
    return [];
  }
}

export function demoListColleges(): OfficialCollege[] {
  const map = new Map<string, OfficialCollege>();
  for (const c of [...OFFICIAL_COLLEGES, ...readCustomColleges()]) {
    map.set(c.code.toUpperCase(), c);
  }
  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
}

export function demoRegisterCollege(name: string, rawCode: string) {
  const cleanName = name.trim().replace(/\s+/g, " ");
  const code = rawCode.trim().toUpperCase();
  const existing = demoListColleges().find((c) => c.code.toUpperCase() === code);
  if (existing) {
    throw new Error(
      `Code ${code} is already registered (${existing.name}). Select it from the list or enter the code.`,
    );
  }
  const shortName = cleanName.length <= 28 ? cleanName : cleanName.slice(0, 28).trim();
  const slugBase = cleanName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const newItem: OfficialCollege = {
    code,
    name: cleanName,
    shortName,
    slug: `${slugBase || "campus"}-${code.toLowerCase()}`,
  };
  localStorage.setItem(
    DEMO_CUSTOM_COLLEGES_KEY,
    JSON.stringify([...readCustomColleges(), newItem]),
  );

  const college = {
    id: newItem.slug,
    code: newItem.code,
    name: newItem.name,
    shortName: newItem.shortName,
    slug: newItem.slug,
  };
  setCampusAccess({
    token: `campus-session-${newItem.code}`,
    expiresAt: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    college,
  });
  return { college };
}

export function demoVerifyCollege(rawCode: string) {
  const normalized = rawCode.trim().toUpperCase();
  const matched =
    findCollegeByCode(normalized) ??
    readCustomColleges().find((c) => c.code.toUpperCase() === normalized);
  if (!matched) {
    throw new Error(
      "Invalid college code. Pick your college from the list or add a new college.",
    );
  }
  const college = {
    id: matched.slug,
    code: matched.code,
    name: matched.name,
    shortName: matched.shortName,
    slug: matched.slug,
  };
  setCampusAccess({
    token: `campus-session-${matched.code}`,
    expiresAt: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    college,
  });
  return { college };
}

export function demoGetFeed(params: {
  category: CategoryFilter;
  sort: FeedSort;
  scope?: "campus" | "explore";
  collegeFilter?: string;
}) {
  const access = getCampusAccess();
  if (!access) {
    throw new Error("Campus session required.");
  }

  const all = readConfessions();
  let scoped: Confession[];

  if (params.scope === "explore") {
    scoped =
      params.collegeFilter && params.collegeFilter !== "all"
        ? all.filter((c) => c.college_code === params.collegeFilter)
        : [...all];
  } else {
    scoped = all.filter((c) => c.college_code === access.college.code);
  }

  const filtered =
    params.category === "all"
      ? scoped
      : scoped.filter((c) => c.category === params.category);

  if (params.sort === "trending") {
    filtered.sort((a, b) => b.likes_count - a.likes_count);
  } else if (params.sort === "most_discussed") {
    filtered.sort((a, b) => b.comments_count - a.comments_count);
  } else {
    filtered.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }

  const vibeSource = scoped.length > 0 ? scoped : all;
  const counts = { happy: 0, stressed: 0, excited: 0, other: 0 };
  for (const item of vibeSource) counts[item.vibe]++;
  const total = Math.max(1, vibeSource.length);
  const vibes: CampusVibesSummary = {
    happy: Math.round((counts.happy / total) * 100),
    stressed: Math.round((counts.stressed / total) * 100),
    excited: Math.round((counts.excited / total) * 100),
    other: Math.round((counts.other / total) * 100),
    sampleSize: vibeSource.length,
  };

  return {
    items: filtered.slice(0, 15),
    likedIds: readLikedIds(),
    nextCursor: null,
    hasMore: false,
    vibes,
  };
}

export function demoGetConfession(confessionId: string) {
  const all = readConfessions();
  const confession = all.find((c) => c.id === confessionId);
  if (!confession) {
    throw new Error("Confession not found.");
  }
  const commentsMap = readCommentsMap();
  const comments = commentsMap[confessionId] ?? [];
  const liked = readLikedIds().includes(confessionId);
  return {
    confession,
    liked,
    comments: comments.slice(0, 20),
    hasMoreComments: false,
    nextCommentCursor: null,
  };
}

export function demoCreateConfession(input: {
  text: string;
  category: ConfessionCategory;
  vibe?: CampusVibe;
  authorName?: string;
  pollOptions?: string[];
}) {
  const access = getCampusAccess();
  if (!access) throw new Error("Campus session required.");

  const all = readConfessions();
  const cleanOptions = (input.pollOptions ?? [])
    .map((o) => o.trim())
    .filter(Boolean)
    .slice(0, 4);

  const newItem: Confession = {
    id: `conf-${Date.now()}`,
    college_code: access.college.code,
    college_name: access.college.shortName ?? access.college.name,
    author_name: input.authorName?.trim() || "Anonymous",
    category: input.category,
    vibe: input.vibe ?? "other",
    content: input.text.trim(),
    poll:
      cleanOptions.length >= 2
        ? {
            options: cleanOptions.map((label, idx) => ({
              id: `opt-${Date.now()}-${idx}`,
              label,
              votes: 0,
            })),
          }
        : null,
    likes_count: 0,
    comments_count: 0,
    is_owner: true,
    created_at: new Date().toISOString(),
  };

  writeConfessions([newItem, ...all]);
  return {
    status: "approved" as const,
    message: "Your confession is live on campus!",
    confession: newItem,
  };
}

export function demoCreateComment(confessionId: string, text: string) {
  const all = readConfessions();
  const idx = all.findIndex((c) => c.id === confessionId);
  if (idx === -1) throw new Error("Confession not found.");
  if (all[idx].comments_count >= 100) {
    throw new Error("Maximum 100 comments reached for this confession.");
  }
  const map = readCommentsMap();
  const existing = map[confessionId] ?? [];
  const comment: CommentItem = {
    id: `demo-c-${Date.now()}`,
    confession_id: confessionId,
    author_name: "Anonymous",
    content: text.trim(),
    is_owner: true,
    created_at: new Date().toISOString(),
  };
  map[confessionId] = [...existing, comment];
  writeCommentsMap(map);

  all[idx] = { ...all[idx], comments_count: all[idx].comments_count + 1 };
  writeConfessions(all);

  return { comment, commentsCount: all[idx].comments_count };
}

export function demoDeleteConfession(confessionId: string) {
  const all = readConfessions();
  const next = all.filter((c) => c.id !== confessionId);
  writeConfessions(next);
  const map = readCommentsMap();
  delete map[confessionId];
  writeCommentsMap(map);
  return { ok: true, id: confessionId };
}

export function demoDeleteComment(commentId: string) {
  const map = readCommentsMap();
  const all = readConfessions();
  let targetConfessionId = "";
  let nextCount = 0;

  for (const [confId, list] of Object.entries(map)) {
    if (list.some((c) => c.id === commentId)) {
      targetConfessionId = confId;
      map[confId] = list.filter((c) => c.id !== commentId);
      break;
    }
  }
  writeCommentsMap(map);

  if (targetConfessionId) {
    const idx = all.findIndex((c) => c.id === targetConfessionId);
    if (idx !== -1) {
      nextCount = Math.max(0, all[idx].comments_count - 1);
      all[idx] = { ...all[idx], comments_count: nextCount };
      writeConfessions(all);
    }
  }

  return { ok: true, id: commentId, confessionId: targetConfessionId, commentsCount: nextCount };
}

export function demoToggleLike(confessionId: string) {
  const all = readConfessions();
  const idx = all.findIndex((c) => c.id === confessionId);
  if (idx === -1) throw new Error("Confession not found.");
  const liked = readLikedIds();
  const isLiked = liked.includes(confessionId);
  const nextLiked = isLiked
    ? liked.filter((id) => id !== confessionId)
    : [...liked, confessionId];
  localStorage.setItem(DEMO_LIKES_KEY, JSON.stringify(nextLiked));

  const nextCount = Math.max(0, all[idx].likes_count + (isLiked ? -1 : 1));
  all[idx] = { ...all[idx], likes_count: nextCount };
  writeConfessions(all);

  return { liked: !isLiked, likesCount: nextCount };
}

export function demoVotePoll(confessionId: string, optionId: string): Confession {
  const votesMap = getPollVotesMap();
  const previousOptionId = votesMap[confessionId];
  const all = readConfessions();
  const idx = all.findIndex((c) => c.id === confessionId);
  if (idx === -1 || !all[idx].poll) {
    throw new Error("Poll not found.");
  }

  const updatedOptions = all[idx].poll!.options.map((opt) => {
    let votes = opt.votes;
    if (previousOptionId && opt.id === previousOptionId) {
      votes = Math.max(0, votes - 1);
    }
    if (opt.id === optionId) {
      votes += 1;
    }
    return { ...opt, votes };
  });

  const updatedConfession: Confession = {
    ...all[idx],
    poll: { ...all[idx].poll!, options: updatedOptions },
  };
  all[idx] = updatedConfession;
  writeConfessions(all);
  savePollVote(confessionId, optionId);

  return updatedConfession;
}
