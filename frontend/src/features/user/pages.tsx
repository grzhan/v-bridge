import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useConfirm } from '@/components/feedback/confirm-provider';
import { extractErrorMessage, notify } from '@/components/feedback/notify';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { useI18n } from '@/features/i18n/i18n-context';
import { getData, postData } from '@/lib/api';
import { formatCurrency, formatDateTime, formatRole, formatUserStatus, formatWalletType } from '@/lib/locale';
import type { Order, Product, ReleaseOrderResult, UserInfo, Wallet, WalletTransaction } from '@/lib/types';

function showError(error: any, fallback: string) {
  notify.error(extractErrorMessage(error, fallback));
}

export function UserDashboardPage() {
  const qc = useQueryClient();
  const confirmAction = useConfirm();
  const { t } = useI18n();
  const { data: wallet } = useQuery({ queryKey: ['wallet'], queryFn: () => getData<Wallet>('/api/me/wallet') });
  const { data: orders } = useQuery({ queryKey: ['my-orders'], queryFn: () => getData<Order[]>('/api/me/orders') });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => getData<Product[]>('/api/products') });
  const enterMutation = useMutation({
    mutationFn: (order_id: number) => postData<{ order_id: number; guac_entry_url: string }>(`/api/me/orders/${order_id}/enter`),
    onSuccess: (payload) => {
      window.open(payload.guac_entry_url, '_blank');
    },
    onError: (e: any) => {
      showError(e, t('user.orders.enter.error'));
    },
  });
  const releaseMutation = useMutation({
    mutationFn: (order_id: number) => postData<ReleaseOrderResult>(`/api/me/orders/${order_id}/release`),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['my-orders'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['wallet-transactions'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      notify.success(
        t('user.orders.release.success', {
          ratio: result.refund_ratio,
          amount: formatCurrency(result.refund_amount),
        })
      );
    },
    onError: (e: any) => {
      showError(e, t('user.orders.release.error'));
    },
  });

  async function handleRelease(order: Order) {
    const confirmed = await confirmAction({
      title: t('user.orders.releaseConfirm.title'),
      description: t('user.orders.releaseConfirm.description'),
      confirmText: t('user.orders.releaseConfirm.confirm'),
      cancelText: t('common.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) {
      return;
    }
    releaseMutation.mutate(order.id);
  }

  const activeOrder = orders?.find((x) => x.status === 'ACTIVE');
  const stock = (products || []).reduce((sum, item) => sum + item.available_stock, 0);

  return (
    <div className="space-y-4">
      <PageHeader title={t('user.dashboard.title')} description={t('user.dashboard.description')} />
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardDescription>{t('user.dashboard.balanceLabel')}</CardDescription>
          <CardTitle className="text-2xl">{formatCurrency(wallet?.balance || 0)}</CardTitle>
        </Card>
        <Card>
          <CardDescription>{t('user.dashboard.activeOrderLabel')}</CardDescription>
          <CardTitle className="text-2xl">{activeOrder ? activeOrder.order_no : t('user.dashboard.noActiveOrder')}</CardTitle>
        </Card>
        <Card>
          <CardDescription>{t('user.dashboard.stockLabel')}</CardDescription>
          <CardTitle className="text-2xl">{stock}</CardTitle>
        </Card>
      </div>
      <Card>
        <CardTitle className="mb-2">{t('user.dashboard.recentOrdersTitle')}</CardTitle>
        <Table>
          <thead>
            <Tr>
              <Th>{t('user.table.orderNo')}</Th>
              <Th>{t('user.table.resource')}</Th>
              <Th>{t('user.table.status')}</Th>
              <Th>{t('user.table.expireAt')}</Th>
              <Th>{t('user.table.actions')}</Th>
            </Tr>
          </thead>
          <tbody>
            {(orders || []).slice(0, 5).map((order) => (
              <Tr key={order.id}>
                <Td>{order.order_no}</Td>
                <Td>{order.resource_name || '-'}</Td>
                <Td><Badge>{order.status}</Badge></Td>
                <Td>{formatDateTime(order.expire_at)}</Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      className="h-8 px-2 text-xs"
                      disabled={order.status !== 'ACTIVE' || enterMutation.isPending || releaseMutation.isPending}
                      onClick={() => enterMutation.mutate(order.id)}
                    >
                      {t('user.actions.enter')}
                    </Button>
                    <Button
                      className="h-8 bg-rose-600 px-2 text-xs text-white hover:bg-rose-700"
                      disabled={order.status !== 'ACTIVE' || enterMutation.isPending || releaseMutation.isPending}
                      onClick={() => handleRelease(order)}
                    >
                      {t('user.actions.releaseAndRefund')}
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

export function UserProductsPage() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const { data: products, isLoading } = useQuery({ queryKey: ['products'], queryFn: () => getData<Product[]>('/api/products') });

  const mutation = useMutation({
    mutationFn: (product_id: number) => postData<Order>('/api/me/orders', { product_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['my-orders'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      notify.success(t('user.products.purchase.success'));
    },
    onError: (e: any) => {
      showError(e, t('user.products.purchase.error'));
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader title={t('user.products.title')} description={t('user.products.description')} />
      <Card>
        <Table>
          <thead>
            <Tr>
              <Th>{t('user.table.productName')}</Th>
              <Th>{t('user.table.duration')}</Th>
              <Th>{t('user.table.price')}</Th>
              <Th>{t('user.table.stock')}</Th>
              <Th>{t('user.table.actions')}</Th>
            </Tr>
          </thead>
          <tbody>
            {(products || []).map((product) => (
              <Tr key={product.id}>
                <Td>{product.name}</Td>
                <Td>
                  {product.duration_minutes} {t('user.products.durationUnit')}
                </Td>
                <Td>{formatCurrency(product.price)}</Td>
                <Td>{product.available_stock}</Td>
                <Td>
                  <Button
                    disabled={mutation.isPending || product.available_stock <= 0}
                    onClick={() => mutation.mutate(product.id)}
                  >
                    {t('user.actions.buy')}
                  </Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        {!isLoading && (products || []).length === 0 ? <p className="pt-3 text-sm text-slate-500">{t('user.products.empty')}</p> : null}
      </Card>
    </div>
  );
}

export function UserOrdersPage() {
  const qc = useQueryClient();
  const confirmAction = useConfirm();
  const { t } = useI18n();
  const { data: orders } = useQuery({ queryKey: ['my-orders'], queryFn: () => getData<Order[]>('/api/me/orders') });
  const enterMutation = useMutation({
    mutationFn: (order_id: number) => postData<{ order_id: number; guac_entry_url: string }>(`/api/me/orders/${order_id}/enter`),
    onSuccess: (payload) => {
      window.open(payload.guac_entry_url, '_blank');
    },
    onError: (e: any) => {
      showError(e, t('user.orders.enter.error'));
    },
  });
  const releaseMutation = useMutation({
    mutationFn: (order_id: number) => postData<ReleaseOrderResult>(`/api/me/orders/${order_id}/release`),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['my-orders'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['wallet-transactions'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      notify.success(
        t('user.orders.release.success', {
          ratio: result.refund_ratio,
          amount: formatCurrency(result.refund_amount),
        })
      );
    },
    onError: (e: any) => {
      showError(e, t('user.orders.release.error'));
    },
  });

  async function handleRelease(order: Order) {
    const confirmed = await confirmAction({
      title: t('user.orders.releaseConfirm.title'),
      description: t('user.orders.releaseConfirm.description'),
      confirmText: t('user.orders.releaseConfirm.confirm'),
      cancelText: t('common.cancel'),
      variant: 'destructive',
    });
    if (!confirmed) {
      return;
    }
    releaseMutation.mutate(order.id);
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('user.orders.title')} description={t('user.orders.description')} />
      <Card>
        <Table>
          <thead>
            <Tr>
              <Th>{t('user.table.orderNo')}</Th>
              <Th>{t('user.table.resource')}</Th>
              <Th>{t('user.table.startAt')}</Th>
              <Th>{t('user.table.expireAt')}</Th>
              <Th>{t('user.table.status')}</Th>
              <Th>{t('user.table.actions')}</Th>
            </Tr>
          </thead>
          <tbody>
            {(orders || []).map((order) => (
              <Tr key={order.id}>
                <Td>{order.order_no}</Td>
                <Td>{order.resource_name || '-'}</Td>
                <Td>{formatDateTime(order.start_at)}</Td>
                <Td>{formatDateTime(order.expire_at)}</Td>
                <Td><Badge>{order.status}</Badge></Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      disabled={order.status !== 'ACTIVE' || enterMutation.isPending || releaseMutation.isPending}
                      onClick={() => enterMutation.mutate(order.id)}
                    >
                      {t('user.actions.enter')}
                    </Button>
                    <Button
                      className="bg-rose-600 text-white hover:bg-rose-700"
                      disabled={order.status !== 'ACTIVE' || enterMutation.isPending || releaseMutation.isPending}
                      onClick={() => handleRelease(order)}
                    >
                      {t('user.actions.releaseAndRefund')}
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

export function UserWalletPage() {
  const { t } = useI18n();
  const { data: wallet } = useQuery({ queryKey: ['wallet'], queryFn: () => getData<Wallet>('/api/me/wallet') });
  const { data: txs } = useQuery({ queryKey: ['wallet-transactions'], queryFn: () => getData<WalletTransaction[]>('/api/me/wallet/transactions') });

  return (
    <div className="space-y-4">
      <PageHeader title={t('user.wallet.title')} description={t('user.wallet.description')} />
      <Card>
        <CardDescription>{t('user.wallet.currentBalance')}</CardDescription>
        <CardTitle className="text-2xl">{formatCurrency(wallet?.balance || 0)}</CardTitle>
      </Card>
      <Card>
        <CardTitle className="mb-2">{t('user.wallet.transactionsTitle')}</CardTitle>
        <Table>
          <thead>
            <Tr>
              <Th>{t('user.table.id')}</Th>
              <Th>{t('user.table.type')}</Th>
              <Th>{t('user.table.amount')}</Th>
              <Th>{t('user.table.balanceAfter')}</Th>
              <Th>{t('user.table.time')}</Th>
            </Tr>
          </thead>
          <tbody>
            {(txs || []).map((tx) => (
              <Tr key={tx.id}>
                <Td>{tx.id}</Td>
                <Td>{formatWalletType(tx.type)}</Td>
                <Td>{formatCurrency(tx.amount)}</Td>
                <Td>{formatCurrency(tx.balance_after)}</Td>
                <Td>{formatDateTime(tx.created_at)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

export function UserProfilePage() {
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => getData<UserInfo>('/api/auth/me') });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { t } = useI18n();

  const changePasswordMutation = useMutation({
    mutationFn: () => {
      if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
        throw new Error(t('user.profile.validation.fillAll'));
      }
      if (newPassword.length < 6) {
        throw new Error(t('user.profile.validation.minLength'));
      }
      if (newPassword !== confirmPassword) {
        throw new Error(t('user.profile.validation.mismatch'));
      }
      return postData('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
    },
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      notify.success(t('user.profile.changeSuccess'));
    },
    onError: (e: any) => {
      showError(e, t('user.profile.changeError'));
    },
  });

  function onChangePassword(event: FormEvent) {
    event.preventDefault();
    changePasswordMutation.mutate();
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('user.profile.title')} description={t('user.profile.description')} />
      <Card className="space-y-2">
        <div className="text-sm"><span className="text-slate-500">{t('user.profile.usernameLabel')}</span> {me?.username}</div>
        <div className="text-sm"><span className="text-slate-500">{t('user.profile.roleLabel')}</span> {formatRole(me?.role)}</div>
        <div className="text-sm"><span className="text-slate-500">{t('user.profile.statusLabel')}</span> {formatUserStatus(me?.status)}</div>
        <div className="text-sm"><span className="text-slate-500">{t('user.profile.createdAtLabel')}</span> {me ? formatDateTime(me.created_at) : '-'}</div>
      </Card>
      <Card className="space-y-3">
        <CardTitle>{t('user.profile.changePasswordTitle')}</CardTitle>
        <form className="grid gap-2 md:grid-cols-3" onSubmit={onChangePassword}>
          <Input
            type="password"
            placeholder={t('user.profile.currentPasswordPlaceholder')}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder={t('user.profile.newPasswordPlaceholder')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder={t('user.profile.confirmPasswordPlaceholder')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <div className="md:col-span-3">
            <Button type="submit" disabled={changePasswordMutation.isPending}>
              {changePasswordMutation.isPending ? t('user.profile.submitLoading') : t('user.profile.submit')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
