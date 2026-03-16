import type { PropsWithChildren } from 'react';

import { useI18n, type TranslationKey } from '@/features/i18n/i18n-context';
import { cn } from '@/lib/utils';

const colors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  EXPIRED: 'bg-slate-200 text-slate-700',
  CANCELLED: 'bg-red-100 text-red-700',
  IDLE: 'bg-blue-100 text-blue-700',
  BUSY: 'bg-amber-100 text-amber-700',
  DISABLED: 'bg-rose-100 text-rose-700',
};

const labelKeys: Partial<Record<string, TranslationKey>> = {
  ACTIVE: 'status.ACTIVE',
  EXPIRED: 'status.EXPIRED',
  CANCELLED: 'status.CANCELLED',
  IDLE: 'status.IDLE',
  BUSY: 'status.BUSY',
  DISABLED: 'status.DISABLED',
};

export function Badge({ children, className }: PropsWithChildren<{ className?: string }>) {
  const key = String(children);
  const { t } = useI18n();
  const labelKey = labelKeys[key];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', colors[key] || 'bg-slate-100 text-slate-700', className)}>
      {labelKey ? t(labelKey) : children}
    </span>
  );
}
