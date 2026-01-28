import { cn } from "./cn";

export type TabOption<T extends string> = {
  label: string;
  value: T;
  count?: number;
};

export type TabsProps<T extends string> = {
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export default function Tabs<T extends string>({
  options,
  value,
  onChange,
  className
}: TabsProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1",
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70",
              active
                ? "bg-white/10 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            )}
          >
            {option.label}
            {typeof option.count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs tabular-nums",
                  active ? "bg-white/10" : "bg-white/5"
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
