import { cn } from "./cn";

export default function Progress({
  value,
  className,
  size = "md"
}: {
  value: number;
  className?: string;
  size?: "sm" | "md";
}) {
  const heights = {
    sm: "h-1",
    md: "h-2"
  };

  return (
    <div className={cn("w-full rounded-full bg-white/[0.08]", heights[size], className)}>
      <div
        className={cn(
          "rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-300",
          heights[size]
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
