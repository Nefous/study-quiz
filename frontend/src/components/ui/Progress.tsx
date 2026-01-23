import { cn } from "./cn";

export default function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full rounded-full bg-white/10", className)}>
      <div
        className="h-2 rounded-full bg-indigo-400 transition"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
