import type { Language } from '@/features/i18n/i18n-context';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY } from '@/features/i18n/i18n-context';

const roleLabels: Record<Language, Record<string, string>> = {
  'zh-CN': {
    admin: '管理员',
    user: '普通用户',
  },
  en: {
    admin: 'Admin',
    user: 'User',
  },
};

const userStatusLabels: Record<Language, Record<string, string>> = {
  'zh-CN': {
    active: '正常',
    disabled: '已禁用',
    ACTIVE: '正常',
    DISABLED: '已禁用',
  },
  en: {
    active: 'Active',
    disabled: 'Disabled',
    ACTIVE: 'Active',
    DISABLED: 'Disabled',
  },
};

const healthStatusLabels: Record<Language, Record<string, string>> = {
  'zh-CN': {
    healthy: '健康',
    unreachable: '不可达',
    unknown: '未知',
    HEALTHY: '健康',
    UNREACHABLE: '不可达',
    UNKNOWN: '未知',
  },
  en: {
    healthy: 'Healthy',
    unreachable: 'Unreachable',
    unknown: 'Unknown',
    HEALTHY: 'Healthy',
    UNREACHABLE: 'Unreachable',
    UNKNOWN: 'Unknown',
  },
};

const walletTypeLabels: Record<Language, Record<string, string>> = {
  'zh-CN': {
    manual_topup: '手工充值',
    manual_deduct: '手工扣减',
    purchase: '购买扣款',
    refund: '退款返还',
    MANUAL_TOPUP: '手工充值',
    MANUAL_DEDUCT: '手工扣减',
    PURCHASE: '购买扣款',
    REFUND: '退款返还',
  },
  en: {
    manual_topup: 'Manual top-up',
    manual_deduct: 'Manual deduction',
    purchase: 'Purchase',
    refund: 'Refund',
    MANUAL_TOPUP: 'Manual top-up',
    MANUAL_DEDUCT: 'Manual deduction',
    PURCHASE: 'Purchase',
    REFUND: 'Refund',
  },
};

function getLanguage(): Language {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === 'zh-CN' || stored === 'en') {
    return stored;
  }
  return DEFAULT_LANGUAGE;
}

function getLocaleTag(language: Language) {
  return language === 'zh-CN' ? 'zh-CN' : 'en-US';
}

export function formatCurrency(amount: string | number | null | undefined) {
  const n = typeof amount === 'string' ? Number(amount) : Number(amount ?? 0);
  const value = Number.isFinite(n) ? n : 0;
  const language = getLanguage();
  return new Intl.NumberFormat(getLocaleTag(language), { style: 'currency', currency: 'CNY' }).format(value);
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return '-';
  }
  return new Date(value).toLocaleString(getLocaleTag(getLanguage()), { hour12: false });
}

export function formatRole(role?: string | null) {
  if (!role) {
    return '-';
  }
  const labels = roleLabels[getLanguage()];
  return labels[role] || role;
}

export function formatUserStatus(status?: string | null) {
  if (!status) {
    return '-';
  }
  const labels = userStatusLabels[getLanguage()];
  return labels[status] || status;
}

export function formatHealthStatus(status?: string | null) {
  if (!status) {
    return '-';
  }
  const labels = healthStatusLabels[getLanguage()];
  return labels[status] || status;
}

export function formatWalletType(type?: string | null) {
  if (!type) {
    return '-';
  }
  const labels = walletTypeLabels[getLanguage()];
  return labels[type] || type;
}

export function formatEnabled(enabled: boolean) {
  const language = getLanguage();
  return enabled ? (language === 'zh-CN' ? '是' : 'Yes') : language === 'zh-CN' ? '否' : 'No';
}
