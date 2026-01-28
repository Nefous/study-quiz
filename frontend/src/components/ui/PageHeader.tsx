import type { ReactNode } from "react";

export type PageHeaderProps = {
  title: string;
  description?: string;
  badge?: string;
  actions?: ReactNode;
};

export default function PageHeader({
  title,
  description,
  badge,
  actions
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        {badge ? (
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-300">
            {badge}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-slate-400">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
}
