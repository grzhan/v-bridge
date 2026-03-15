import type { PropsWithChildren } from 'react';

import { cn } from '@/lib/utils';

export function Table({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <table className={cn('w-full text-sm', className)}>{children}</table>;
}

export function Th({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <th className={cn('border-b px-3 py-2 text-left font-medium text-muted-foreground', className)}>{children}</th>;
}

export function Td({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <td className={cn('border-b px-3 py-2 align-middle', className)}>{children}</td>;
}

export function Tr({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <tr className={cn('hover:bg-slate-50', className)}>{children}</tr>;
}
