import type { SelectHTMLAttributes } from "react";
import { cn } from "./cn";

export default function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full appearance-none rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/60",
        className
      )}
      {...props}
    />
  );
}
