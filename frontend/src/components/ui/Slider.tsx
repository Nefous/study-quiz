import type { InputHTMLAttributes } from "react";
import { cn } from "./cn";

export default function Slider({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="range"
      className={cn("h-2 w-full cursor-pointer accent-indigo-400", className)}
      {...props}
    />
  );
}
