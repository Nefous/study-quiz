import type { PropsWithChildren } from "react";
import { cn } from "./cn";

export type CardProps = PropsWithChildren<{
  className?: string;
  variant?: "default" | "elevated" | "subtle";
  padding?: "none" | "sm" | "md" | "lg";
}>;

const variants = {
  default: "border-white/[0.08] bg-white/[0.03] backdrop-blur-sm",
  elevated: "border-white/[0.08] bg-white/[0.04] backdrop-blur-md shadow-xl shadow-black/20",
  subtle: "border-white/[0.05] bg-white/[0.02]"
};

const paddings = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6"
};

export default function Card({
  children,
  className,
  variant = "default",
  padding = "lg"
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border",
        variants[variant],
        paddings[padding],
        className
      )}
    >
      {children}
    </div>
  );
}
