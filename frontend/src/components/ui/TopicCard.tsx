import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "./cn";

export type TopicCardProps = {
  label: string;
  description?: string;
  icon?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
};

export default function TopicCard({
  label,
  description,
  icon,
  selected = false,
  disabled = false,
  onClick,
  className
}: TopicCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative flex items-start gap-4 rounded-2xl border p-4 text-left transition",
        selected
          ? "border-indigo-400/50 bg-indigo-400/10"
          : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      {/* Icon */}
      {icon ? (
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition",
            selected
              ? "bg-indigo-400/20 text-indigo-300"
              : "bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-slate-300"
          )}
        >
          {icon}
        </div>
      ) : null}

      {/* Content */}
      <div className="flex-1 space-y-0.5">
        <p
          className={cn(
            "text-sm font-semibold transition",
            selected ? "text-white" : "text-slate-200"
          )}
        >
          {label}
        </p>
        {description ? (
          <p className="text-xs text-slate-400">{description}</p>
        ) : null}
      </div>

      {/* Check indicator */}
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition",
          selected
            ? "border-indigo-400/60 bg-indigo-400/30 text-white"
            : "border-white/20 bg-transparent"
        )}
      >
        {selected ? <Check size={14} strokeWidth={3} /> : null}
      </div>
    </button>
  );
}
