import type { ReactNode } from "react";
import { cn } from "./cn";

export type AccordionItem = {
  id: string;
  header: ReactNode;
  content: ReactNode;
};

export default function Accordion({
  items,
  openId,
  onToggle
}: {
  items: AccordionItem[];
  openId: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div
            key={item.id}
            className={cn(
              "rounded-2xl border border-white/10 bg-white/5 shadow-[0_20px_60px_rgba(15,23,42,0.4)]",
              isOpen && "border-white/30"
            )}
          >
            <button
              type="button"
              onClick={() => onToggle(item.id)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-slate-100"
            >
              <div className="flex-1">{item.header}</div>
              <span className="text-xs text-slate-400">{isOpen ? "Hide" : "Show"}</span>
            </button>
            {isOpen ? (
              <div className="border-t border-white/10 px-5 py-4 text-slate-200">
                {item.content}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
