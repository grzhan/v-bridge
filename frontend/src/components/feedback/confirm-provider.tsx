import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type ConfirmVariant = 'default' | 'destructive';

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
};

type ConfirmRequest = ConfirmOptions & {
  confirmText: string;
  cancelText: string;
  variant: ConfirmVariant;
};

type QueueItem = {
  request: ConfirmRequest;
  resolve: (value: boolean) => void;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

function normalizeOptions(options: ConfirmOptions): ConfirmRequest {
  return {
    ...options,
    confirmText: options.confirmText || '确认',
    cancelText: options.cancelText || '取消',
    variant: options.variant || 'default',
  };
}

export function ConfirmProvider({ children }: PropsWithChildren) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [active, setActive] = useState<QueueItem | null>(null);
  const nextResultRef = useRef(false);
  const queueRef = useRef<QueueItem[]>([]);
  const activeRef = useRef<QueueItem | null>(null);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (active || queue.length === 0) {
      return;
    }
    const [next, ...rest] = queue;
    setActive(next);
    setQueue(rest);
  }, [active, queue]);

  useEffect(() => {
    return () => {
      activeRef.current?.resolve(false);
      queueRef.current.forEach((item) => item.resolve(false));
    };
  }, []);

  const confirm = useMemo<ConfirmFn>(() => {
    return (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setQueue((prev) => [...prev, { request: normalizeOptions(options), resolve }]);
      });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={Boolean(active)}
        onOpenChange={(open) => {
          if (!open) {
            const result = nextResultRef.current;
            nextResultRef.current = false;
            setActive((current) => {
              if (current) {
                current.resolve(result);
              }
              return null;
            });
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{active?.request.title}</AlertDialogTitle>
            {active?.request.description ? <AlertDialogDescription>{active.request.description}</AlertDialogDescription> : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                nextResultRef.current = false;
              }}
            >
              {active?.request.cancelText || '取消'}
            </AlertDialogCancel>
            <AlertDialogAction
              className={active?.request.variant === 'destructive' ? 'bg-rose-600 text-white hover:bg-rose-700' : ''}
              onClick={() => {
                nextResultRef.current = true;
              }}
            >
              {active?.request.confirmText || '确认'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm 必须在 ConfirmProvider 内使用');
  }
  return context;
}
