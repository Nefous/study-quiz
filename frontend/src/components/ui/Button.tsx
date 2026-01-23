import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

const variants = {
  primary:
    "bg-indigo-500/90 text-white hover:bg-indigo-400 shadow-[0_10px_30px_rgba(79,70,229,0.25)]",
  secondary:
    "bg-white/10 text-white hover:bg-white/20 border border-white/10",
  ghost: "bg-transparent text-slate-200 hover:bg-white/10 border border-transparent"
};

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm"
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
        "inline-flex items-center justify-center rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/80 disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
