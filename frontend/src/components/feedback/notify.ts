import { toast } from 'sonner';

export const notify = {
  success(message: string, description?: string) {
    toast.success(message, { description });
  },
  error(message: string, description?: string) {
    toast.error(message, { description, duration: 5000 });
  },
  info(message: string, description?: string) {
    toast(message, { description });
  },
};

export function extractErrorMessage(error: any, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const loc = Array.isArray(item?.loc) ? item.loc.join('.') : '请求参数';
        const msg = item?.msg || '参数校验失败';
        return `${loc}: ${msg}`;
      })
      .join('\n');
  }
  return fallback;
}
