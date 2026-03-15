const roleLabels: Record<string, string> = {
  admin: '管理员',
  user: '普通用户',
};

const userStatusLabels: Record<string, string> = {
  active: '正常',
  disabled: '已禁用',
  ACTIVE: '正常',
  DISABLED: '已禁用',
};

const healthStatusLabels: Record<string, string> = {
  healthy: '健康',
  unreachable: '不可达',
  unknown: '未知',
  HEALTHY: '健康',
  UNREACHABLE: '不可达',
  UNKNOWN: '未知',
};

const walletTypeLabels: Record<string, string> = {
  manual_topup: '手工充值',
  manual_deduct: '手工扣减',
  purchase: '购买扣款',
  refund: '退款返还',
  MANUAL_TOPUP: '手工充值',
  MANUAL_DEDUCT: '手工扣减',
  PURCHASE: '购买扣款',
  REFUND: '退款返还',
};

export function formatCurrency(amount: string | number | null | undefined) {
  const n = typeof amount === 'string' ? Number(amount) : Number(amount ?? 0);
  const value = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
}

export function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

export function formatRole(role?: string | null) {
  if (!role) {
    return '-';
  }
  return roleLabels[role] || role;
}

export function formatUserStatus(status?: string | null) {
  if (!status) {
    return '-';
  }
  return userStatusLabels[status] || status;
}

export function formatHealthStatus(status?: string | null) {
  if (!status) {
    return '-';
  }
  return healthStatusLabels[status] || status;
}

export function formatWalletType(type?: string | null) {
  if (!type) {
    return '-';
  }
  return walletTypeLabels[type] || type;
}

export function formatEnabled(enabled: boolean) {
  return enabled ? '是' : '否';
}
