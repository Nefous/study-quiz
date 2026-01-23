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
    <div className="grid gap-2">
      <div className="inline-flex flex-wrap rounded-2xl border border-white/10 bg-white/5 p-1">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70",
                active
                  ? "bg-white/15 text-white shadow"
                  : "text-slate-300 hover:text-white"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {options.find((option) => option.value === value)?.helper ? (
        <p className="text-xs text-slate-400">
          {options.find((option) => option.value === value)?.helper}
        </p>
      ) : null}
    </div>
  );
}
