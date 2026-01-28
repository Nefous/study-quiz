import type { ReactNode } from "react";
import { cn } from "./cn";

export type StatCardProps = {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
};

export default function StatCard({
  label,
  value,
  icon,
  trend,
  className
}: StatCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.05]",
        className
      )}
    >
      {/* Subtle gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <p
            className={cn(
              "text-2xl font-semibold tabular-nums",
              trend === "up" && "text-emerald-400",
              trend === "down" && "text-rose-400",
              !trend && "text-white"
            )}
          >
            {value}
          </p>
        </div>
        {icon ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-400 transition group-hover:bg-white/10 group-hover:text-slate-300">
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
