import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

const variants = {
  primary:
    "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:from-indigo-400 hover:to-indigo-500 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 border border-indigo-400/20",
  secondary:
    "bg-white/[0.06] text-white hover:bg-white/[0.1] border border-white/[0.08] hover:border-white/[0.15]",
  ghost:
    "bg-transparent text-slate-300 hover:bg-white/[0.06] hover:text-white border border-transparent"
};

const sizes = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-sm gap-2"
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export default function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
