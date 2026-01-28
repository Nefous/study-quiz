import type { ReactNode } from "react";
import { cn } from "./cn";

export type OptionCardProps = {
  label: string;
  value: string;
  selected?: boolean;
  correct?: boolean;
  incorrect?: boolean;
  disabled?: boolean;
  prefix?: ReactNode;
  onClick?: () => void;
  className?: string;
};

export default function OptionCard({
  label,
  value,
  selected = false,
  correct = false,
  incorrect = false,
  disabled = false,
  prefix,
  onClick,
  className
}: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition",
        !correct && !incorrect && selected && "border-indigo-400/50 bg-indigo-400/10",
        !correct && !incorrect && !selected && "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
        correct && "border-emerald-400/50 bg-emerald-400/10",
        incorrect && "border-rose-400/50 bg-rose-400/10",
        disabled && "cursor-not-allowed opacity-70",
        className
      )}
    >
      {/* Prefix (e.g., A, B, C, D) */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition",
          !correct && !incorrect && selected && "bg-indigo-400/20 text-indigo-200",
          !correct && !incorrect && !selected && "bg-white/5 text-slate-400 group-hover:bg-white/10",
          correct && "bg-emerald-400/20 text-emerald-200",
          incorrect && "bg-rose-400/20 text-rose-200"
        )}
      >
        {prefix ?? value}
      </div>

      {/* Label */}
      <span
        className={cn(
          "flex-1 pt-1 text-sm leading-relaxed transition",
          correct && "text-emerald-100",
          incorrect && "text-rose-100",
          !correct && !incorrect && (selected ? "text-white" : "text-slate-200")
        )}
      >
        {label}
      </span>
    </button>
  );
}
