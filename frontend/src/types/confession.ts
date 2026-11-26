import { assetUrl } from "../lib/assetUrl";

export type ConfessionCategory =
  | "love"
  | "funny"
  | "college"
  | "secrets"
  | "thoughts"
  | "notice";
export type CategoryFilter = "all" | ConfessionCategory;
export type FeedSort = "trending" | "latest" | "most_discussed";
export type CampusVibe = "happy" | "stressed" | "excited" | "other";
export type GenderTheme = "female" | "male";
export type AppearanceMode = "auto" | "manual";
export type ResolvedTheme = "light" | "dark";

export interface CollegeInfo {
  id: string;
  code: string;
  name: string;
  shortName?: string;
  slug: string;
}

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface ConfessionPoll {
  question?: string;
  options: PollOption[];
}

export interface Confession {
  id: string;
  college_code: string;
  college_name: string;
  author_name: string;
  category: ConfessionCategory;
  vibe: CampusVibe;
  content: string;
  poll?: ConfessionPoll | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

export interface CommentItem {
  id: string;
  confession_id: string;
  author_name?: string;
  content: string;
  created_at: string;
}

export interface CampusVibesSummary {
  happy: number;
  stressed: number;
  excited: number;
  other: number;
  sampleSize: number;
}

export interface CampusNotification {
  id: string;
  title: string;
  body: string;
  timeAgo: string;
  unread: boolean;
  linkTo?: string;
}

export interface CategoryMeta {
  id: ConfessionCategory;
  label: string;
  emoji: string;
  pillBg: string;
  pillText: string;
  cardBg: string;
  cardBorder: string;
  mascotSrc: string;
  mascotAlt: string;
}

export const CATEGORY_META: Record<ConfessionCategory, CategoryMeta> = {
  love: {
    id: "love",
    label: "Love",
    emoji: "♡",
    pillBg: "bg-[#FFE2EE] dark:bg-[#4A1F36]",
    pillText: "text-[#B62B66] dark:text-[#FF9AC2]",
    cardBg:
      "bg-gradient-to-br from-[#FFF9FB] via-[#FFF6FA] to-[#FFE8F2] dark:from-[#291724] dark:via-[#221520] dark:to-[#1B131D]",
    cardBorder: "border-[#FFD6E8] dark:border-[#532B45]",
    mascotSrc: assetUrl("assets/mascots/love-boy.webp"),
    mascotAlt: "Love confession illustration",
  },
  funny: {
    id: "funny",
    label: "Funny",
    emoji: "😆",
    pillBg: "bg-[#DDF8EA] dark:bg-[#163B2C]",
    pillText: "text-[#16794F] dark:text-[#6EE7B7]",
    cardBg:
      "bg-gradient-to-br from-[#FAFFFC] via-[#F4FDF8] to-[#E2F9EC] dark:from-[#14261F] dark:via-[#12201B] dark:to-[#101A18]",
    cardBorder: "border-[#C7F0DB] dark:border-[#244D3D]",
    mascotSrc: assetUrl("assets/mascots/funny-cat.webp"),
    mascotAlt: "Funny cat illustration",
  },
  college: {
    id: "college",
    label: "College",
    emoji: "🎓",
    pillBg: "bg-[#E9E0FF] dark:bg-[#2F2452]",
    pillText: "text-[#5D37B8] dark:text-[#C4B5FD]",
    cardBg:
      "bg-gradient-to-br from-[#FCF9FF] via-[#F7F3FF] to-[#E9F9F1] dark:from-[#201933] dark:via-[#1B162B] dark:to-[#161B26]",
    cardBorder: "border-[#E3D6FF] dark:border-[#3D3163]",
    mascotSrc: assetUrl("assets/mascots/college-pizza.svg"),
    mascotAlt: "College campus illustration",
  },
  secrets: {
    id: "secrets",
    label: "Secrets",
    emoji: "🔒",
    pillBg: "bg-[#FFF0C2] dark:bg-[#463313]",
    pillText: "text-[#9A5B00] dark:text-[#FCD34D]",
    cardBg:
      "bg-gradient-to-br from-[#FFFDF7] via-[#FFF9EA] to-[#FFEDC2] dark:from-[#282013] dark:via-[#221B11] dark:to-[#1B1611]",
    cardBorder: "border-[#FDE09B] dark:border-[#523F1E]",
    mascotSrc: assetUrl("assets/mascots/secrets-lock.svg"),
    mascotAlt: "Secrets padlock illustration",
  },
  thoughts: {
    id: "thoughts",
    label: "Thoughts",
    emoji: "💭",
    pillBg: "bg-[#EDE4FF] dark:bg-[#2E244F]",
    pillText: "text-[#5B3EB0] dark:text-[#C4B5FD]",
    cardBg:
      "bg-gradient-to-br from-[#FDFBFF] via-[#F7F2FF] to-[#EDE2FF] dark:from-[#1F1A31] dark:via-[#1A1629] dark:to-[#161322]",
    cardBorder: "border-[#DFCEFF] dark:border-[#3B305E]",
    mascotSrc: assetUrl("assets/mascots/thoughts-girl.webp"),
    mascotAlt: "Thoughts illustration",
  },
  notice: {
    id: "notice",
    label: "Admin Notice",
    emoji: "📢",
    pillBg: "bg-[#DCEEFF] dark:bg-[#193052]",
    pillText: "text-[#1D4ED8] dark:text-[#93C5FD]",
    cardBg:
      "bg-gradient-to-br from-[#F7FBFF] via-[#EFF6FF] to-[#DFF0FF] dark:from-[#152134] dark:via-[#131C2D] dark:to-[#101724]",
    cardBorder: "border-[#BFDBFE] dark:border-[#26426B]",
    mascotSrc: assetUrl("assets/mascots/admin-notice.webp"),
    mascotAlt: "Official Admin Notice illustration",
  },
};
