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
import { getData, postData } from '@/lib/api';
import { formatCurrency, formatDateTime, formatRole, formatUserStatus, formatWalletType } from '@/lib/locale';
import type { Order, Product, ReleaseOrderResult, UserInfo, Wallet, WalletTransaction } from '@/lib/types';

function showError(error: any, fallback: string) {
  notify.error(extractErrorMessage(error, fallback));
}

export function UserDashboardPage() {
  const qc = useQueryClient();
  const confirmAction = useConfirm();
  const { data: wallet } = useQuery({ queryKey: ['wallet'], queryFn: () => getData<Wallet>('/api/me/wallet') });
  const { data: orders } = useQuery({ queryKey: ['my-orders'], queryFn: () => getData<Order[]>('/api/me/orders') });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => getData<Product[]>('/api/products') });
  const enterMutation = useMutation({
    mutationFn: (order_id: number) => postData<{ order_id: number; guac_entry_url: string }>(`/api/me/orders/${order_id}/enter`),
    onSuccess: (payload) => {
      window.open(payload.guac_entry_url, '_blank');
    },
    onError: (e: any) => {
      showError(e, '无法进入该订单会话');
    },
  });
  const releaseMutation = useMutation({
    mutationFn: (order_id: number) => postData<ReleaseOrderResult>(`/api/me/orders/${order_id}/release`),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['my-orders'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['wallet-transactions'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      notify.success(`释放成功，退款 ${result.refund_ratio}%（${formatCurrency(result.refund_amount)}）`);
    },
    onError: (e: any) => {
      showError(e, '释放失败');
    },
  });

  async function handleRelease(order: Order) {
    const confirmed = await confirmAction({
      title: '确认释放当前机器？',
      description: '释放后会立即回收资源，并按剩余时长比例退款。',
      confirmText: '确认释放',
      cancelText: '取消',
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
      <PageHeader title="控制台" description="账户概览与快捷操作" />
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardDescription>余额</CardDescription>
          <CardTitle className="text-2xl">{formatCurrency(wallet?.balance || 0)}</CardTitle>
        </Card>
        <Card>
          <CardDescription>当前有效订单</CardDescription>
          <CardTitle className="text-2xl">{activeOrder ? activeOrder.order_no : '无'}</CardTitle>
        </Card>
        <Card>
          <CardDescription>可用库存</CardDescription>
          <CardTitle className="text-2xl">{stock}</CardTitle>
        </Card>
      </div>
      <Card>
        <CardTitle className="mb-2">最近订单</CardTitle>
        <Table>
          <thead>
            <Tr>
              <Th>订单号</Th>
              <Th>资源</Th>
              <Th>状态</Th>
              <Th>到期时间</Th>
              <Th>操作</Th>
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
                      进入
                    </Button>
                    <Button
                      className="h-8 bg-rose-600 px-2 text-xs text-white hover:bg-rose-700"
                      disabled={order.status !== 'ACTIVE' || enterMutation.isPending || releaseMutation.isPending}
                      onClick={() => handleRelease(order)}
                    >
                      释放并退款
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
  const { data: products, isLoading } = useQuery({ queryKey: ['products'], queryFn: () => getData<Product[]>('/api/products') });

  const mutation = useMutation({
    mutationFn: (product_id: number) => postData<Order>('/api/me/orders', { product_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['my-orders'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      notify.success('购买成功，请到“我的订单”查看。');
    },
    onError: (e: any) => {
      showError(e, '购买失败');
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader title="套餐购买" description="购买远程访问时长套餐" />
      <Card>
        <Table>
          <thead>
            <Tr>
              <Th>套餐名称</Th>
              <Th>时长</Th>
              <Th>价格</Th>
              <Th>库存</Th>
              <Th>操作</Th>
            </Tr>
          </thead>
          <tbody>
            {(products || []).map((product) => (
              <Tr key={product.id}>
                <Td>{product.name}</Td>
                <Td>{product.duration_minutes} 分钟</Td>
                <Td>{formatCurrency(product.price)}</Td>
                <Td>{product.available_stock}</Td>
                <Td>
                  <Button
                    disabled={mutation.isPending || product.available_stock <= 0}
                    onClick={() => mutation.mutate(product.id)}
                  >
                    购买
                  </Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        {!isLoading && (products || []).length === 0 ? <p className="pt-3 text-sm text-slate-500">暂无可购买套餐。</p> : null}
      </Card>
    </div>
  );
}

export function UserOrdersPage() {
  const qc = useQueryClient();
  const confirmAction = useConfirm();
  const { data: orders } = useQuery({ queryKey: ['my-orders'], queryFn: () => getData<Order[]>('/api/me/orders') });
  const enterMutation = useMutation({
    mutationFn: (order_id: number) => postData<{ order_id: number; guac_entry_url: string }>(`/api/me/orders/${order_id}/enter`),
    onSuccess: (payload) => {
      window.open(payload.guac_entry_url, '_blank');
    },
    onError: (e: any) => {
      showError(e, '无法进入该订单会话');
    },
  });
  const releaseMutation = useMutation({
    mutationFn: (order_id: number) => postData<ReleaseOrderResult>(`/api/me/orders/${order_id}/release`),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['my-orders'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
      qc.invalidateQueries({ queryKey: ['wallet-transactions'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      notify.success(`释放成功，退款 ${result.refund_ratio}%（${formatCurrency(result.refund_amount)}）`);
    },
    onError: (e: any) => {
      showError(e, '释放失败');
    },
  });

  async function handleRelease(order: Order) {
    const confirmed = await confirmAction({
      title: '确认释放当前机器？',
      description: '释放后会立即回收资源，并按剩余时长比例退款。',
      confirmText: '确认释放',
      cancelText: '取消',
      variant: 'destructive',
    });
    if (!confirmed) {
      return;
    }
    releaseMutation.mutate(order.id);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="我的订单" description="查看并进入远程会话" />
      <Card>
        <Table>
          <thead>
            <Tr>
              <Th>订单号</Th>
              <Th>资源</Th>
              <Th>开始时间</Th>
              <Th>到期时间</Th>
              <Th>状态</Th>
              <Th>操作</Th>
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
                      进入
                    </Button>
                    <Button
                      className="bg-rose-600 text-white hover:bg-rose-700"
                      disabled={order.status !== 'ACTIVE' || enterMutation.isPending || releaseMutation.isPending}
                      onClick={() => handleRelease(order)}
                    >
                      释放并退款
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
  const { data: wallet } = useQuery({ queryKey: ['wallet'], queryFn: () => getData<Wallet>('/api/me/wallet') });
  const { data: txs } = useQuery({ queryKey: ['wallet-transactions'], queryFn: () => getData<WalletTransaction[]>('/api/me/wallet/transactions') });

  return (
    <div className="space-y-4">
      <PageHeader title="钱包" description="余额与资金流水" />
      <Card>
        <CardDescription>当前余额</CardDescription>
        <CardTitle className="text-2xl">{formatCurrency(wallet?.balance || 0)}</CardTitle>
      </Card>
      <Card>
        <CardTitle className="mb-2">交易记录</CardTitle>
        <Table>
          <thead>
            <Tr>
              <Th>ID</Th>
              <Th>类型</Th>
              <Th>金额</Th>
              <Th>变更后余额</Th>
              <Th>时间</Th>
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

  const changePasswordMutation = useMutation({
    mutationFn: () => {
      if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
        throw new Error('请完整填写密码信息');
      }
      if (newPassword.length < 6) {
        throw new Error('新密码至少 6 位');
      }
      if (newPassword !== confirmPassword) {
        throw new Error('两次输入的新密码不一致');
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
      notify.success('密码修改成功');
    },
    onError: (e: any) => {
      showError(e, '修改密码失败');
    },
  });

  function onChangePassword(event: FormEvent) {
    event.preventDefault();
    changePasswordMutation.mutate();
  }

  return (
    <div className="space-y-4">
      <PageHeader title="个人信息" description="查看当前账户信息" />
      <Card className="space-y-2">
        <div className="text-sm"><span className="text-slate-500">用户名：</span> {me?.username}</div>
        <div className="text-sm"><span className="text-slate-500">角色：</span> {formatRole(me?.role)}</div>
        <div className="text-sm"><span className="text-slate-500">状态：</span> {formatUserStatus(me?.status)}</div>
        <div className="text-sm"><span className="text-slate-500">创建时间：</span> {me ? formatDateTime(me.created_at) : '-'}</div>
      </Card>
      <Card className="space-y-3">
        <CardTitle>修改密码</CardTitle>
        <form className="grid gap-2 md:grid-cols-3" onSubmit={onChangePassword}>
          <Input
            type="password"
            placeholder="当前密码"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="新密码（至少6位）"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="确认新密码"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <div className="md:col-span-3">
            <Button type="submit" disabled={changePasswordMutation.isPending}>
              {changePasswordMutation.isPending ? '提交中...' : '确认修改'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
