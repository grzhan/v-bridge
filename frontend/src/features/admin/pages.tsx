import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useConfirm } from '@/components/feedback/confirm-provider';
import { extractErrorMessage, notify } from '@/components/feedback/notify';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/features/i18n/i18n-context';
import { deleteData, getData, patchData, postData } from '@/lib/api';
import {
  formatCurrency,
  formatDateTime,
  formatEnabled,
  formatHealthStatus,
  formatRole,
  formatUserStatus,
} from '@/lib/locale';
import type { AdminUser, Order, Product, Resource, UserInfo } from '@/lib/types';

function showError(error: any, fallback: string) {
  notify.error(extractErrorMessage(error, fallback));
}

export function AdminOverviewPage() {
  const { t } = useI18n();
  const { data: orders } = useQuery({ queryKey: ['admin-orders'], queryFn: () => getData<Order[]>('/api/admin/orders') });
  const { data: resources } = useQuery({ queryKey: ['admin-resources'], queryFn: () => getData<Resource[]>('/api/admin/resources') });
  const { data: users } = useQuery({ queryKey: ['admin-users'], queryFn: () => getData<AdminUser[]>('/api/admin/users') });

  const stats = useMemo(() => {
    const activeOrders = (orders || []).filter((x) => x.status === 'ACTIVE').length;
    const idleResources = (resources || []).filter((x) => x.status === 'IDLE' && x.enabled).length;
    const totalBalance = (users || []).reduce((sum, x) => sum + Number(x.balance), 0);
    return { activeOrders, idleResources, totalBalance };
  }, [orders, resources, users]);

  return (
    <div className="space-y-4">
      <PageHeader title={t('admin.overview.title')} description={t('admin.overview.description')} />
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardDescription>{t('admin.overview.stat.activeOrders')}</CardDescription>
          <CardTitle className="text-2xl">{stats.activeOrders}</CardTitle>
        </Card>
        <Card>
          <CardDescription>{t('admin.overview.stat.idleResources')}</CardDescription>
          <CardTitle className="text-2xl">{stats.idleResources}</CardTitle>
        </Card>
        <Card>
          <CardDescription>{t('admin.overview.stat.totalBalance')}</CardDescription>
          <CardTitle className="text-2xl">{formatCurrency(stats.totalBalance)}</CardTitle>
        </Card>
      </div>
      <Card>
        <CardTitle className="mb-2">{t('user.dashboard.recentOrdersTitle')}</CardTitle>
        <Table>
          <thead>
            <Tr>
              <Th>{t('user.table.orderNo')}</Th>
              <Th>{t('user.table.userId')}</Th>
              <Th>{t('user.table.resource')}</Th>
              <Th>{t('user.table.status')}</Th>
              <Th>{t('user.table.expireAt')}</Th>
            </Tr>
          </thead>
          <tbody>
            {(orders || []).slice(0, 10).map((order) => (
              <Tr key={order.id}>
                <Td>{order.order_no}</Td>
                <Td>{order.user_id}</Td>
                <Td>{order.resource_name || '-'}</Td>
                <Td><Badge>{order.status}</Badge></Td>
                <Td>{formatDateTime(order.expire_at)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

export function AdminResourcesPage() {
  const qc = useQueryClient();
  const confirmAction = useConfirm();
  const { t } = useI18n();
  const { data: resources } = useQuery({ queryKey: ['admin-resources'], queryFn: () => getData<Resource[]>('/api/admin/resources') });
  const [form, setForm] = useState({ name: '', host: '', port: '3389', auth_user: '', auth_pass: '', group_tag: 'windows' });

  const createMutation = useMutation({
    mutationFn: () =>
      postData<Resource>('/api/admin/resources', {
        ...form,
        port: Number(form.port),
        protocol: 'rdp',
      }),
    onSuccess: () => {
      setForm({ name: '', host: '', port: '3389', auth_user: '', auth_pass: '', group_tag: 'windows' });
      qc.invalidateQueries({ queryKey: ['admin-resources'] });
    },
    onError: (e: any) => showError(e, t('admin.resources.create.error')),
  });

  const healthMutation = useMutation({
    mutationFn: (id: number) => postData<{ health_status: string }>(`/api/admin/resources/${id}/health-check`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-resources'] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => patchData<Resource>(`/api/admin/resources/${id}`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-resources'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteData<{ resource_id: number; deleted: boolean }>(`/api/admin/resources/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-resources'] });
      notify.success(t('admin.resources.delete.success'));
    },
    onError: (e: any) => showError(e, t('admin.resources.delete.error')),
  });

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate();
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('admin.resources.title')} description={t('admin.resources.description')} />
      <Card>
        <CardTitle className="mb-2">{t('admin.resources.form.title')}</CardTitle>
        <form className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-12" onSubmit={handleCreate}>
          <Input
            className="xl:col-span-2"
            placeholder={t('admin.resources.form.namePlaceholder')}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <Input
            className="xl:col-span-3"
            placeholder={t('admin.resources.form.hostPlaceholder')}
            value={form.host}
            onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
            required
          />
          <Input
            className="xl:col-span-1"
            placeholder={t('admin.resources.form.portPlaceholder')}
            value={form.port}
            onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
            required
          />
          <Input
            className="xl:col-span-2"
            placeholder={t('admin.resources.form.userPlaceholder')}
            value={form.auth_user}
            onChange={(e) => setForm((f) => ({ ...f, auth_user: e.target.value }))}
            required
          />
          <Input
            className="xl:col-span-2"
            placeholder={t('admin.resources.form.passwordPlaceholder')}
            value={form.auth_pass}
            onChange={(e) => setForm((f) => ({ ...f, auth_pass: e.target.value }))}
            required
          />
          <Input
            className="xl:col-span-1"
            placeholder={t('admin.resources.form.groupPlaceholder')}
            value={form.group_tag}
            onChange={(e) => setForm((f) => ({ ...f, group_tag: e.target.value }))}
          />
          <Button className="w-full xl:col-span-1" type="submit" disabled={createMutation.isPending}>
            {t('admin.resources.form.submit')}
          </Button>
        </form>
      </Card>
      <Card>
        <Table>
          <thead>
            <Tr>
              <Th>{t('admin.table.name')}</Th>
              <Th>{t('admin.resources.form.hostPlaceholder')}</Th>
              <Th>{t('user.table.status')}</Th>
              <Th>{t('common.enable')}</Th>
              <Th>{t('admin.resources.table.health')}</Th>
              <Th>{t('admin.resources.table.currentUser')}</Th>
              <Th>{t('user.table.expireAt')}</Th>
              <Th>{t('user.table.actions')}</Th>
            </Tr>
          </thead>
          <tbody>
            {(resources || []).map((resource) => (
              <Tr key={resource.id}>
                <Td>{resource.name}</Td>
                <Td>
                  {resource.host}:{resource.port}
                </Td>
                <Td><Badge>{resource.status}</Badge></Td>
                <Td>{formatEnabled(resource.enabled)}</Td>
                <Td>{formatHealthStatus(resource.health_status)}</Td>
                <Td>{resource.current_user_id || '-'}</Td>
                <Td>{formatDateTime(resource.lease_expire_at)}</Td>
                <Td>
                  <div className="flex gap-2">
                    <Button className="h-8 bg-slate-700 px-2 text-xs" onClick={() => healthMutation.mutate(resource.id)}>
                      {t('admin.resources.actions.healthCheck')}
                    </Button>
                    <Button
                      className="h-8 bg-slate-700 px-2 text-xs"
                      onClick={() => toggleMutation.mutate({ id: resource.id, enabled: !resource.enabled })}
                    >
                      {resource.enabled ? t('admin.resources.actions.toggleDisable') : t('admin.resources.actions.toggleEnable')}
                    </Button>
                    <Button
                      className="h-8 bg-rose-600 px-2 text-xs"
                      disabled={deleteMutation.isPending}
                      onClick={async () => {
                        const ok = await confirmAction({
                          title: t('admin.resources.delete.confirmTitle'),
                          description: t('admin.resources.delete.confirmDescription', { name: resource.name }),
                          confirmText: t('common.confirmDelete'),
                          cancelText: t('common.cancel'),
                          variant: 'destructive',
                        });
                        if (!ok) {
                          return;
                        }
                        deleteMutation.mutate(resource.id);
                      }}
                    >
                      {t('common.delete')}
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

export function AdminResourceImportPage() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [text, setText] = useState('[\n  {"name":"Win-004","host":"192.168.1.14","port":3389,"protocol":"rdp","auth_user":"Administrator","auth_pass":"***","group_tag":"windows"}\n]');

  const mutation = useMutation({
    mutationFn: () => {
      const items = JSON.parse(text);
      return postData<{ created: number; failed: number; errors: string[] }>('/api/admin/resources/batch-import', { items });
    },
    onSuccess: (result) => {
      notify.success(t('admin.resourceImport.success', { created: result.created, failed: result.failed }));
      if (result.errors.length > 0) {
        notify.error(t('admin.resourceImport.partialErrorTitle'), result.errors.join('\n'));
      }
      qc.invalidateQueries({ queryKey: ['admin-resources'] });
    },
    onError: (e: any) => showError(e, t('admin.resourceImport.error')),
  });

  return (
    <div className="space-y-4">
      <PageHeader title={t('admin.resourceImport.title')} description={t('admin.resourceImport.description')} />
      <Card className="space-y-3">
        <CardDescription>{t('admin.resourceImport.instructions')}</CardDescription>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} />
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {t('admin.resourceImport.button')}
        </Button>
      </Card>
    </div>
  );
}

export function AdminOrdersPage() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const { data: orders } = useQuery({ queryKey: ['admin-orders'], queryFn: () => getData<Order[]>('/api/admin/orders') });
  const forceExpire = useMutation({
    mutationFn: (id: number) => postData(`/api/admin/orders/${id}/force-expire`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['admin-resources'] });
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader title={t('admin.orders.title')} description={t('admin.orders.description')} />
      <Card>
        <Table>
          <thead>
            <Tr>
              <Th>{t('user.table.orderNo')}</Th>
              <Th>{t('user.table.userId')}</Th>
              <Th>{t('user.table.resource')}</Th>
              <Th>{t('user.table.amount')}</Th>
              <Th>{t('user.table.status')}</Th>
              <Th>{t('user.table.startAt')}</Th>
              <Th>{t('user.table.expireAt')}</Th>
              <Th>{t('user.table.actions')}</Th>
            </Tr>
          </thead>
          <tbody>
            {(orders || []).map((order) => (
              <Tr key={order.id}>
                <Td>{order.order_no}</Td>
                <Td>{order.user_id}</Td>
                <Td>{order.resource_name}</Td>
                <Td>{formatCurrency(order.amount)}</Td>
                <Td><Badge>{order.status}</Badge></Td>
                <Td>{formatDateTime(order.start_at)}</Td>
                <Td>{formatDateTime(order.expire_at)}</Td>
                <Td>
                  <Button
                    className="h-8 bg-rose-600 px-2 text-xs"
                    disabled={order.status !== 'ACTIVE' || forceExpire.isPending}
                    onClick={() => forceExpire.mutate(order.id)}
                  >
                    {t('admin.orders.forceExpire')}
                  </Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

export function AdminWalletPage() {
  const { t } = useI18n();
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [remark, setRemark] = useState(t('admin.wallet.form.remarkPlaceholder'));

  const mutation = useMutation({
    mutationFn: () => {
      const uidRaw = userId.trim();
      const amountRaw = amount.trim();
      if (!/^\d+$/.test(uidRaw)) {
        throw new Error(t('admin.wallet.validation.userId'));
      }
      if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(amountRaw)) {
        throw new Error(t('admin.wallet.validation.amountFormat'));
      }
      if (Number(amountRaw) <= 0) {
        throw new Error(t('admin.wallet.validation.amountPositive'));
      }
      return postData('/api/admin/wallet/topup', {
        user_id: Number(uidRaw),
        amount: amountRaw,
        remark: remark.trim() || null,
      });
    },
    onSuccess: () => notify.success(t('admin.wallet.success')),
    onError: (e: any) => showError(e, t('admin.wallet.error')),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('admin.wallet.title')} description={t('admin.wallet.description')} />
      <Card>
        <form className="grid grid-cols-4 gap-2" onSubmit={onSubmit}>
          <Input
            type="number"
            min="1"
            step="1"
            placeholder={t('admin.wallet.form.userIdPlaceholder')}
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
          />
          <Input
            type="number"
            min="0.01"
            step="0.01"
            placeholder={t('admin.wallet.form.amountPlaceholder')}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <Input placeholder={t('admin.wallet.form.remarkPlaceholder')} value={remark} onChange={(e) => setRemark(e.target.value)} />
          <Button type="submit" disabled={mutation.isPending}>
            {t('admin.wallet.form.submit')}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export function AdminUsersPage() {
  const qc = useQueryClient();
  const confirmAction = useConfirm();
  const { t } = useI18n();
  const { data: users } = useQuery({ queryKey: ['admin-users'], queryFn: () => getData<AdminUser[]>('/api/admin/users') });
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => getData<UserInfo>('/api/auth/me') });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [status, setStatus] = useState<'active' | 'disabled'>('active');
  const [initialBalance, setInitialBalance] = useState('0');

  const createMutation = useMutation({
    mutationFn: () => {
      const usernameRaw = username.trim();
      const passwordRaw = password.trim();
      const balanceRaw = initialBalance.trim();
      if (usernameRaw.length < 3) {
        throw new Error(t('admin.users.validation.username'));
      }
      if (passwordRaw.length < 6) {
        throw new Error(t('admin.users.validation.password'));
      }
      if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(balanceRaw)) {
        throw new Error(t('admin.users.validation.balance'));
      }
      return postData<AdminUser>('/api/admin/users', {
        username: usernameRaw,
        password: passwordRaw,
        role,
        status,
        initial_balance: balanceRaw,
      });
    },
    onSuccess: () => {
      setUsername('');
      setPassword('');
      setRole('user');
      setStatus('active');
      setInitialBalance('0');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      notify.success(t('admin.users.create.success'));
    },
    onError: (e: any) => showError(e, t('admin.users.create.error')),
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, nextStatus }: { userId: number; nextStatus: 'active' | 'disabled' }) =>
      patchData<AdminUser>(`/api/admin/users/${userId}/status`, { status: nextStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      notify.success(t('admin.users.status.success'));
    },
    onError: (e: any) => showError(e, t('admin.users.status.error')),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: number) => deleteData(`/api/admin/users/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      notify.success(t('admin.users.delete.success'));
    },
    onError: (e: any) => showError(e, t('admin.users.delete.error')),
  });

  function onCreate(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate();
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t('admin.users.title')} description={t('admin.users.description')} />
      <Card>
        <CardTitle className="mb-2">{t('admin.users.create.title')}</CardTitle>
        <form className="grid grid-cols-6 gap-2" onSubmit={onCreate}>
          <Input placeholder={t('admin.users.create.usernamePlaceholder')} value={username} onChange={(e) => setUsername(e.target.value)} required />
          <Input type="password" placeholder={t('admin.users.create.passwordPlaceholder')} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <select
            className="flex h-9 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            value={role}
            onChange={(e) => setRole(e.target.value as 'user' | 'admin')}
          >
            <option value="user">{t('admin.users.create.role.user')}</option>
            <option value="admin">{t('admin.users.create.role.admin')}</option>
          </select>
          <select
            className="flex h-9 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'disabled')}
          >
            <option value="active">{t('admin.users.create.status.active')}</option>
            <option value="disabled">{t('admin.users.create.status.disabled')}</option>
          </select>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder={t('admin.users.create.balancePlaceholder')}
            value={initialBalance}
            onChange={(e) => setInitialBalance(e.target.value)}
            required
          />
          <Button type="submit" disabled={createMutation.isPending}>
            {t('admin.users.create.submit')}
          </Button>
        </form>
      </Card>
      <Card>
        <Table>
          <thead>
            <Tr>
              <Th>{t('user.table.id')}</Th>
              <Th>{t('admin.table.username')}</Th>
              <Th>{t('admin.table.role')}</Th>
              <Th>{t('user.table.status')}</Th>
              <Th>{t('admin.table.balance')}</Th>
              <Th>{t('admin.table.createdAt')}</Th>
              <Th>{t('user.table.actions')}</Th>
            </Tr>
          </thead>
          <tbody>
            {(users || []).map((user) => (
              <Tr key={user.id}>
                <Td>{user.id}</Td>
                <Td>{user.username}</Td>
                <Td>{formatRole(user.role)}</Td>
                <Td>{formatUserStatus(user.status)}</Td>
                <Td>{formatCurrency(user.balance)}</Td>
                <Td>{formatDateTime(user.created_at)}</Td>
                <Td>
                  <div className="flex gap-2">
                    <Button
                      className="h-8 bg-slate-700 px-2 text-xs"
                      disabled={statusMutation.isPending || me?.id === user.id}
                      onClick={() =>
                        statusMutation.mutate({
                          userId: user.id,
                          nextStatus: user.status === 'active' ? 'disabled' : 'active',
                        })
                      }
                    >
                      {user.status === 'active' ? t('admin.users.actions.ban') : t('admin.users.actions.unban')}
                    </Button>
                    <Button
                      className="h-8 bg-rose-600 px-2 text-xs"
                      disabled={deleteMutation.isPending || me?.id === user.id}
                      onClick={async () => {
                        const ok = await confirmAction({
                          title: t('admin.users.delete.confirmTitle'),
                          description: t('admin.users.delete.confirmDescription', { name: user.username }),
                          confirmText: t('common.confirmDelete'),
                          cancelText: t('common.cancel'),
                          variant: 'destructive',
                        });
                        if (!ok) {
                          return;
                        }
                        deleteMutation.mutate(user.id);
                      }}
                    >
                      {t('common.delete')}
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

export function AdminSettingsPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <PageHeader title={t('admin.settings.title')} description={t('admin.settings.description')} />
      <Card className="space-y-2">
        <div className="text-sm"><span className="text-slate-500">{t('admin.settings.protocolLabel')}</span> {t('admin.settings.protocolValue')}</div>
        <div className="text-sm"><span className="text-slate-500">{t('admin.settings.reclaimLabel')}</span> {t('admin.settings.reclaimValue')}</div>
        <div className="text-sm"><span className="text-slate-500">{t('admin.settings.paymentModeLabel')}</span> {t('admin.settings.paymentModeValue')}</div>
      </Card>
    </div>
  );
}

export function AdminProductsPage() {
  const qc = useQueryClient();
  const confirmAction = useConfirm();
  const { t } = useI18n();
  const { data: products } = useQuery({ queryKey: ['admin-products'], queryFn: () => getData<Product[]>('/api/admin/products') });
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('120');
  const [price, setPrice] = useState('10');
  const [groupTag, setGroupTag] = useState('windows');

  const createMutation = useMutation({
    mutationFn: () => postData('/api/admin/products', { name, duration_minutes: Number(duration), price: Number(price), group_tag: groupTag }),
    onSuccess: () => {
      setName('');
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      notify.success(t('admin.products.create.success'));
    },
    onError: (e: any) => showError(e, t('admin.products.create.error')),
  });

  const deleteMutation = useMutation({
    mutationFn: (productId: number) => deleteData<{ product_id: number; deleted: boolean }>(`/api/admin/products/${productId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      notify.success(t('admin.products.delete.success'));
    },
    onError: (e: any) => showError(e, t('admin.products.delete.error')),
  });

  return (
    <div className="space-y-4">
      <PageHeader title={t('admin.products.title')} description={t('admin.products.description')} />
      <Card>
        <form
          className="grid grid-cols-5 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <Input placeholder={t('admin.products.form.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} required />
          <Input placeholder={t('admin.products.form.durationPlaceholder')} value={duration} onChange={(e) => setDuration(e.target.value)} required />
          <Input placeholder={t('admin.products.form.pricePlaceholder')} value={price} onChange={(e) => setPrice(e.target.value)} required />
          <Input placeholder={t('admin.products.form.groupPlaceholder')} value={groupTag} onChange={(e) => setGroupTag(e.target.value)} />
          <Button type="submit">{t('admin.products.form.submit')}</Button>
        </form>
      </Card>
      <Card>
        <Table>
          <thead>
            <Tr>
              <Th>{t('user.table.id')}</Th>
              <Th>{t('admin.table.name')}</Th>
              <Th>{t('user.table.duration')}</Th>
              <Th>{t('user.table.price')}</Th>
              <Th>{t('common.enable')}</Th>
              <Th>{t('admin.table.group')}</Th>
              <Th>{t('user.table.actions')}</Th>
            </Tr>
          </thead>
          <tbody>
            {(products || []).map((product) => (
              <Tr key={product.id}>
                <Td>{product.id}</Td>
                <Td>{product.name}</Td>
                <Td>
                  {product.duration_minutes} {t('admin.products.table.durationUnit')}
                </Td>
                <Td>{formatCurrency(product.price)}</Td>
                <Td>{formatEnabled(product.enabled)}</Td>
                <Td>{product.group_tag || '-'}</Td>
                <Td>
                  <Button
                    className="h-8 bg-rose-600 px-2 text-xs"
                    disabled={deleteMutation.isPending}
                    onClick={async () => {
                      const ok = await confirmAction({
                        title: t('admin.products.delete.confirmTitle'),
                        description: t('admin.products.delete.confirmDescription', { name: product.name }),
                        confirmText: t('common.confirmDelete'),
                        cancelText: t('common.cancel'),
                        variant: 'destructive',
                      });
                      if (!ok) {
                        return;
                      }
                      deleteMutation.mutate(product.id);
                    }}
                  >
                    {t('common.delete')}
                  </Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

export function AdminProfilePage() {
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
      <PageHeader title={t('admin.profile.title')} description={t('admin.profile.description')} />
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
