import { Flag } from "lucide-react";
import { Link } from "react-router-dom";
import { formatRelativeTime } from "../hooks/useCampusSession";
import type { CommentItem } from "../types/confession";

interface CommentCardProps {
  comment: CommentItem;
  index: number;
}

const AVATARS = ["🐱", "🐼", "🦊", "🐰", "🐻", "🐥"];

export function CommentCard({ comment, index }: CommentCardProps) {
  const avatar = AVATARS[index % AVATARS.length];

  return (
    <div className="rounded-2xl border border-[#EFE7FA] bg-white/90 p-3.5 shadow-sm dark:border-white/10 dark:bg-[#1B1829]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-pastel-lavender text-xs dark:bg-[#2E244F]">
            {avatar}
          </span>
          <span className="text-xs font-bold text-ink dark:text-[#F4F1FA]">Anonymous</span>
          <span className="text-[11px] font-semibold text-muted dark:text-[#A49DBB]">
            • {formatRelativeTime(comment.created_at)}
          </span>
        </div>

        <Link
          to={`/report/comment/${comment.id}`}
          title="Report comment"
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-muted transition hover:bg-[#FFE4EC] hover:text-[#C81E4B] dark:text-[#A49DBB] dark:hover:bg-[#3A1C2A] dark:hover:text-[#FF8EAE]"
        >
          <Flag className="h-3 w-3" />
          <span>Report</span>
        </Link>
      </div>

      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink dark:text-[#EFEBF8]">
        {comment.content}
      </p>
    </div>
  );
}
