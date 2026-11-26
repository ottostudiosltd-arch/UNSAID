interface CharacterCounterProps {
  current: number;
  max: number;
}

export function CharacterCounter({ current, max }: CharacterCounterProps) {
  const ratio = current / max;
  const colorClass =
    current > max
      ? "bg-[#FFE0E6] text-[#C81E4B] border-[#FFB3C4]"
      : ratio >= 0.85
      ? "bg-pastel-amber text-[#9A5B00] border-[#FCD36D]"
      : "bg-pastel-lavender/70 text-[#5B3EB0] border-[#DECFFF]";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums ${colorClass}`}
    >
      {current.toLocaleString()} / {max.toLocaleString()}
    </span>
  );
}
