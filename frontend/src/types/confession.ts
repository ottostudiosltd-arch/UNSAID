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
    pillBg: "bg-[#FFE2EE]",
    pillText: "text-[#B62B66]",
    cardBg: "bg-gradient-to-br from-[#FFF9FB] via-[#FFF6FA] to-[#FFE8F2]",
    cardBorder: "border-[#FFD6E8]",
    mascotSrc: assetUrl("assets/mascots/love-boy.webp"),
    mascotAlt: "Love confession illustration",
  },
  funny: {
    id: "funny",
    label: "Funny",
    emoji: "😆",
    pillBg: "bg-[#DDF8EA]",
    pillText: "text-[#16794F]",
    cardBg: "bg-gradient-to-br from-[#FAFFFC] via-[#F4FDF8] to-[#E2F9EC]",
    cardBorder: "border-[#C7F0DB]",
    mascotSrc: assetUrl("assets/mascots/funny-cat.webp"),
    mascotAlt: "Funny cat illustration",
  },
  college: {
    id: "college",
    label: "College",
    emoji: "🎓",
    pillBg: "bg-[#E9E0FF]",
    pillText: "text-[#5D37B8]",
    cardBg: "bg-gradient-to-br from-[#FCF9FF] via-[#F7F3FF] to-[#E9F9F1]",
    cardBorder: "border-[#E3D6FF]",
    mascotSrc: assetUrl("assets/mascots/college-pizza.svg"),
    mascotAlt: "College campus illustration",
  },
  secrets: {
    id: "secrets",
    label: "Secrets",
    emoji: "🔒",
    pillBg: "bg-[#FFF0C2]",
    pillText: "text-[#9A5B00]",
    cardBg: "bg-gradient-to-br from-[#FFFDF7] via-[#FFF9EA] to-[#FFEDC2]",
    cardBorder: "border-[#FDE09B]",
    mascotSrc: assetUrl("assets/mascots/secrets-lock.svg"),
    mascotAlt: "Secrets padlock illustration",
  },
  thoughts: {
    id: "thoughts",
    label: "Thoughts",
    emoji: "💭",
    pillBg: "bg-[#EDE4FF]",
    pillText: "text-[#5B3EB0]",
    cardBg: "bg-gradient-to-br from-[#FDFBFF] via-[#F7F2FF] to-[#EDE2FF]",
    cardBorder: "border-[#DFCEFF]",
    mascotSrc: assetUrl("assets/mascots/thoughts-girl.webp"),
    mascotAlt: "Thoughts illustration",
  },
  notice: {
    id: "notice",
    label: "Admin Notice",
    emoji: "📢",
    pillBg: "bg-[#DCEEFF]",
    pillText: "text-[#1D4ED8]",
    cardBg: "bg-gradient-to-br from-[#F7FBFF] via-[#EFF6FF] to-[#DFF0FF]",
    cardBorder: "border-[#BFDBFE]",
    mascotSrc: assetUrl("assets/mascots/admin-notice.svg"),
    mascotAlt: "Official Admin Notice illustration",
  },
};
