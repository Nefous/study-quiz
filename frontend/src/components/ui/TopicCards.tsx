import type { ReactNode } from "react";
import { cn } from "./cn";

export type TopicCardOption<T extends string> = {
  value: T;
  title: string;
  description: string;
  icon: ReactNode;
};

export default function TopicCards<T extends string>({
  options,
  value,
  onChange
}: {
  options: TopicCardOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "group flex flex-col gap-3 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60",
              active
                ? "border-indigo-400/60 bg-white/10 shadow-[0_0_0_1px_rgba(99,102,241,0.35)]"
                : "border-white/10 bg-white/5 hover:border-indigo-400/30"
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl border",
                  active
                    ? "border-indigo-400/40 bg-indigo-400/20 text-indigo-100"
                    : "border-white/10 bg-white/5 text-slate-300"
                )}
              >
                {option.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{option.title}</p>
                <p className="text-xs text-slate-400">{option.description}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
