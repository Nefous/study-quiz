import { cn } from "./cn";

export type ChoiceChip = { label: string; value: number };

export default function ChoiceChips({
  options,
  value,
  onChange,
  className
}: {
  options: ChoiceChip[];
  value: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70",
              active
                ? "bg-indigo-400/20 text-white shadow-[0_0_20px_rgba(99,102,241,0.35)]"
                : "border border-white/10 bg-white/5 text-slate-300 hover:text-white"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
