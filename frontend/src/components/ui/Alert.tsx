import type { PropsWithChildren } from "react";
import { cn } from "./cn";

export default function Alert({
  children,
  tone = "error",
  className
}: PropsWithChildren<{ tone?: "error" | "info"; className?: string }>) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        tone === "error"
          ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
          : "border-white/10 bg-white/5 text-slate-200",
        className
      )}
    >
      {children}
    </div>
  );
}
