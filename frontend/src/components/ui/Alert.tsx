import type { PropsWithChildren } from "react";
import { AlertCircle, Info } from "lucide-react";
import { cn } from "./cn";

export default function Alert({
  children,
  tone = "error",
  className
}: PropsWithChildren<{ tone?: "error" | "info" | "warning"; className?: string }>) {
  const tones = {
    error: "border-rose-400/20 bg-rose-400/10 text-rose-200",
    warning: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    info: "border-sky-400/20 bg-sky-400/10 text-sky-200"
  };

  const icons = {
    error: <AlertCircle size={16} className="shrink-0 text-rose-400" />,
    warning: <AlertCircle size={16} className="shrink-0 text-amber-400" />,
    info: <Info size={16} className="shrink-0 text-sky-400" />
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        tones[tone],
        className
      )}
    >
      {icons[tone]}
      <span>{children}</span>
    </div>
  );
}
