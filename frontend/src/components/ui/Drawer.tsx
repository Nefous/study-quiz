import type { PropsWithChildren } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";

export type DrawerProps = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  side?: "right" | "bottom";
  className?: string;
}>;

export default function Drawer({
  open,
  onClose,
  title,
  description,
  side = "right",
  className,
  children
}: DrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={cn(
          "absolute flex flex-col bg-slate-900/95 backdrop-blur-xl border-white/10 shadow-2xl",
          side === "right" && "right-0 top-0 h-full w-full max-w-md border-l animate-slide-in-right",
          side === "bottom" && "bottom-0 left-0 right-0 max-h-[85vh] rounded-t-3xl border-t animate-slide-in-bottom",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div className="space-y-1">
            {title ? (
              <h3 className="text-lg font-semibold text-white">{title}</h3>
            ) : null}
            {description ? (
              <p className="text-sm text-slate-400">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
