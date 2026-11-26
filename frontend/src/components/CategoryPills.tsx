import { CATEGORY_META, type CategoryFilter, type ConfessionCategory } from "../types/confession";

interface CategoryPillsProps {
  selected: CategoryFilter;
  onSelect: (category: CategoryFilter) => void;
}

const CATEGORIES: ConfessionCategory[] = [
  "love",
  "funny",
  "college",
  "secrets",
  "thoughts",
  "notice",
];

export function CategoryPills({ selected, onSelect }: CategoryPillsProps) {
  return (
    <div className="no-scrollbar flex items-center gap-2 overflow-x-auto py-1">
      <button
        type="button"
        onClick={() => onSelect("all")}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-all ${
          selected === "all"
            ? "bg-ink text-white shadow-pill dark:bg-[#FF6FA9] dark:text-white"
            : "border border-[#E7DFF7] bg-white/90 text-ink hover:bg-pastel-lavender/50 dark:border-white/10 dark:bg-[#1B1829] dark:text-[#EFEBF8] dark:hover:bg-[#27223B]"
        }`}
      >
        <span>✨</span>
        <span>All</span>
      </button>

      {CATEGORIES.map((cat) => {
        const meta = CATEGORY_META[cat];
        const active = selected === cat;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onSelect(cat)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-bold transition-all ${
              active
                ? `${meta.pillBg} ${meta.pillText} border-ink/25 shadow-sm ring-2 ring-ink/15 dark:border-white/30 dark:ring-white/20`
                : `${meta.pillBg} ${meta.pillText} border-white/80 opacity-90 hover:opacity-100 dark:border-white/10`
            }`}
          >
            <span>{meta.label}</span>
            <span>{meta.emoji}</span>
          </button>
        );
      })}
    </div>
  );
}
