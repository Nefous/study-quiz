import type { PropsWithChildren } from "react";
import { cn } from "./cn";

export type ContainerProps = PropsWithChildren<{
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}>;

const sizes = {
  sm: "max-w-2xl",
  md: "max-w-3xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl"
};

export default function Container({
  size = "xl",
  className,
  children
}: ContainerProps) {
  return (
    <div className={cn("mx-auto w-full", sizes[size], className)}>
      {children}
    </div>
  );
}
