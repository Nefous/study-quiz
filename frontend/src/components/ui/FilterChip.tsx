import { X } from "lucide-react";
import { cn } from "./cn";

export type FilterChipProps = {
  label: string;
  active?: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
  className?: string;
};

export default function FilterChip({
  label,
  active = false,
  onToggle,
  onRemove,
  className
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onRemove ? undefined : onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active
          ? "border-indigo-400/40 bg-indigo-400/15 text-indigo-200"
          : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-300",
        className
      )}
    >
      {label}
      {onRemove ? (
        <span
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-full p-0.5 hover:bg-white/10"
        >
          <X size={12} />
        </span>
      ) : null}
    </button>
  );
}
