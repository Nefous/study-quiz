import { cn } from "./cn";

export type SegmentedOption<T extends string> = {
  label: string;
  value: T;
  helper?: string;
};

export default function SegmentedControl<T extends string>({
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
      <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
                active
                  ? "bg-white text-slate-900 shadow"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <div className="text-xs text-slate-500">
        {options.find((option) => option.value === value)?.helper}
      </div>
    </div>
  );
}
