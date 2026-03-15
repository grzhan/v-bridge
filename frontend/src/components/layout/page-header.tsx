import type { PropsWithChildren, ReactNode } from 'react';

export function PageHeader({ title, description, actions }: PropsWithChildren<{ title: string; description?: string; actions?: ReactNode }>) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
