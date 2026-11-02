import type { ReactNode } from "react";

export const PageHeader = ({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) => (
  <header className="flex shrink-0 flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0 max-w-2xl">
      {eyebrow && <p className="workspace-eyebrow mb-2">{eyebrow}</p>}
      <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
        {title}
      </h1>
      {description && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
    {actions && (
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {actions}
      </div>
    )}
  </header>
);
