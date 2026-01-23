import type { PropsWithChildren } from "react";
import { cn } from "./cn";

export default function Badge({
  children,
  tone = "neutral",
  className
}: PropsWithChildren<{ tone?: "neutral" | "success" | "error"; className?: string }>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        tone === "success" && "bg-emerald-400/20 text-emerald-100 border border-emerald-400/30",
        tone === "error" && "bg-rose-400/20 text-rose-100 border border-rose-400/30",
        tone === "neutral" && "bg-white/10 text-slate-100 border border-white/10",
        className
      )}
    >
      {children}
    </span>
  );
}
