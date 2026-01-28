import { cn } from "./cn";

export type SegmentedOption<T extends string> = {
  label: string;
  value: T;
  helper?: string;
};

export default function Segmented<T extends string>({
  options,
  value,
  onChange
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex w-full rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70",
                active
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {options.find((option) => option.value === value)?.helper ? (
        <p className="text-xs text-slate-500">
          {options.find((option) => option.value === value)?.helper}
        </p>
      ) : null}
    </div>
  );
}
