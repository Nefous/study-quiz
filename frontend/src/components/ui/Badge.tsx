import type { PropsWithChildren } from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "success" | "error" | "warning" | "info" | "primary";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-white/[0.08] text-slate-300 border-white/[0.08]",
  success: "bg-emerald-400/15 text-emerald-300 border-emerald-400/20",
  error: "bg-rose-400/15 text-rose-300 border-rose-400/20",
  warning: "bg-amber-400/15 text-amber-300 border-amber-400/20",
  info: "bg-sky-400/15 text-sky-300 border-sky-400/20",
  primary: "bg-indigo-400/15 text-indigo-300 border-indigo-400/20"
};

export default function Badge({
  children,
  tone = "neutral",
  className
}: PropsWithChildren<{ tone?: BadgeTone; className?: string }>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
