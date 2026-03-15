import type { PropsWithChildren } from 'react';

import { cn } from '@/lib/utils';

const colors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  EXPIRED: 'bg-slate-200 text-slate-700',
  CANCELLED: 'bg-red-100 text-red-700',
  IDLE: 'bg-blue-100 text-blue-700',
  BUSY: 'bg-amber-100 text-amber-700',
  DISABLED: 'bg-rose-100 text-rose-700',
};

const labels: Record<string, string> = {
  ACTIVE: '生效中',
  EXPIRED: '已过期',
  CANCELLED: '已取消',
  IDLE: '空闲',
  BUSY: '使用中',
  DISABLED: '已停用',
};

export function Badge({ children, className }: PropsWithChildren<{ className?: string }>) {
  const key = String(children);
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', colors[key] || 'bg-slate-100 text-slate-700', className)}>
      {labels[key] || children}
    </span>
  );
}
