import type { PropsWithChildren } from "react";
import { cn } from "./cn";

export default function Card({
  children,
  className
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.45)] backdrop-blur",
        className
      )}
    >
      {children}
    </div>
  );
}
