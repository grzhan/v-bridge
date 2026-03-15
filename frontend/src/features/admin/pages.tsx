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
      <PageHeader title="概览" description="系统运行指标总览" />
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardDescription>有效订单数</CardDescription>
          <CardTitle className="text-2xl">{stats.activeOrders}</CardTitle>
        </Card>
        <Card>
          <CardDescription>空闲资源数</CardDescription>
          <CardTitle className="text-2xl">{stats.idleResources}</CardTitle>
        </Card>
        <Card>
          <CardDescription>用户总余额</CardDescription>
          <CardTitle className="text-2xl">{formatCurrency(stats.totalBalance)}</CardTitle>
        </Card>
      </div>
      <Card>
        <CardTitle className="mb-2">最近订单</CardTitle>
        <Table>
          <thead>
            <Tr>
              <Th>订单号</Th>
              <Th>用户ID</Th>
              <Th>资源</Th>
              <Th>状态</Th>
              <Th>到期时间</Th>
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
    onError: (e: any) => showError(e, '新增资源失败'),
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
      notify.success('资源删除成功');
    },
    onError: (e: any) => showError(e, '删除资源失败'),
  });

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate();
  }

  return (
    <div className="space-y-4">
      <PageHeader title="资源池" description="管理虚拟机库存与健康状态" />
      <Card>
        <CardTitle className="mb-2">新增资源</CardTitle>
        <form className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-12" onSubmit={handleCreate}>
          <Input
            className="xl:col-span-2"
            placeholder="名称"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <Input
            className="xl:col-span-3"
            placeholder="主机地址"
            value={form.host}
            onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
            required
          />
          <Input
            className="xl:col-span-1"
            placeholder="端口"
            value={form.port}
            onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
            required
          />
          <Input
            className="xl:col-span-2"
            placeholder="登录用户"
            value={form.auth_user}
            onChange={(e) => setForm((f) => ({ ...f, auth_user: e.target.value }))}
            required
          />
          <Input
            className="xl:col-span-2"
            placeholder="登录密码"
            value={form.auth_pass}
            onChange={(e) => setForm((f) => ({ ...f, auth_pass: e.target.value }))}
            required
          />
          <Input
            className="xl:col-span-1"
            placeholder="分组标签"
            value={form.group_tag}
            onChange={(e) => setForm((f) => ({ ...f, group_tag: e.target.value }))}
          />
          <Button className="w-full xl:col-span-1" type="submit" disabled={createMutation.isPending}>新增</Button>
        </form>
      </Card>
      <Card>
        <Table>
          <thead>
            <Tr>
              <Th>名称</Th>
              <Th>主机</Th>
              <Th>状态</Th>
              <Th>启用</Th>
              <Th>健康状态</Th>
              <Th>当前用户</Th>
              <Th>到期时间</Th>
              <Th>操作</Th>
            </Tr>
          </thead>
          <tbody>
            {(resources || []).map((resource) => (
              <Tr key={resource.id}>
                <Td>{resource.name}</Td>
                <Td>{resource.host}:{resource.port}</Td>
                <Td><Badge>{resource.status}</Badge></Td>
                <Td>{formatEnabled(resource.enabled)}</Td>
                <Td>{formatHealthStatus(resource.health_status)}</Td>
                <Td>{resource.current_user_id || '-'}</Td>
                <Td>{formatDateTime(resource.lease_expire_at)}</Td>
                <Td>
                  <div className="flex gap-2">
                    <Button className="h-8 bg-slate-700 px-2 text-xs" onClick={() => healthMutation.mutate(resource.id)}>检测</Button>
                    <Button
                      className="h-8 bg-slate-700 px-2 text-xs"
                      onClick={() => toggleMutation.mutate({ id: resource.id, enabled: !resource.enabled })}
                    >
                      {resource.enabled ? '停用' : '启用'}
                    </Button>
                    <Button
                      className="h-8 bg-rose-600 px-2 text-xs"
                      disabled={deleteMutation.isPending}
                      onClick={async () => {
                        const ok = await confirmAction({
                          title: '确认删除资源',
                          description: `资源「${resource.name}」将从资源池移除，该操作不可恢复。`,
                          confirmText: '确认删除',
                          cancelText: '取消',
                          variant: 'destructive',
                        });
                        if (!ok) {
                          return;
                        }
                        deleteMutation.mutate(resource.id);
                      }}
                    >
                      删除
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
  const [text, setText] = useState('[\n  {"name":"Win-004","host":"192.168.1.14","port":3389,"protocol":"rdp","auth_user":"Administrator","auth_pass":"***","group_tag":"windows"}\n]');

  const mutation = useMutation({
    mutationFn: () => {
      const items = JSON.parse(text);
      return postData<{ created: number; failed: number; errors: string[] }>('/api/admin/resources/batch-import', { items });
    },
    onSuccess: (result) => {
      notify.success(`导入完成：成功 ${result.created}，失败 ${result.failed}`);
      if (result.errors.length > 0) {
        notify.error('部分资源导入失败', result.errors.join('\n'));
      }
      qc.invalidateQueries({ queryKey: ['admin-resources'] });
    },
    onError: (e: any) => showError(e, '导入失败'),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="批量导入" description="通过 JSON 数组批量导入资源" />
      <Card className="space-y-3">
        <CardDescription>请粘贴资源 JSON 数组。</CardDescription>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} />
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>导入</Button>
      </Card>
    </div>
  );
}

export function AdminOrdersPage() {
  const qc = useQueryClient();
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
      <PageHeader title="订单管理" description="查看并控制全部订单" />
      <Card>
        <Table>
          <thead>
            <Tr>
              <Th>订单号</Th>
              <Th>用户ID</Th>
              <Th>资源</Th>
              <Th>金额</Th>
              <Th>状态</Th>
              <Th>开始时间</Th>
              <Th>到期时间</Th>
              <Th>操作</Th>
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
                    强制过期
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
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [remark, setRemark] = useState('手工充值');

  const mutation = useMutation({
    mutationFn: () => {
      const uidRaw = userId.trim();
      const amountRaw = amount.trim();
      if (!/^\d+$/.test(uidRaw)) {
        throw new Error('用户ID必须是正整数');
      }
      if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(amountRaw)) {
        throw new Error('金额格式不正确，最多保留2位小数');
      }
      if (Number(amountRaw) <= 0) {
        throw new Error('金额必须大于 0');
      }
      return postData('/api/admin/wallet/topup', {
        user_id: Number(uidRaw),
        amount: amountRaw,
        remark: remark.trim() || null,
      });
    },
    onSuccess: () => notify.success('充值成功'),
    onError: (e: any) => showError(e, '充值失败'),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <div className="space-y-4">
      <PageHeader title="钱包管理" description="手工充值与资金调整" />
      <Card>
        <form className="grid grid-cols-4 gap-2" onSubmit={onSubmit}>
          <Input type="number" min="1" step="1" placeholder="用户ID（如 1）" value={userId} onChange={(e) => setUserId(e.target.value)} required />
          <Input type="number" min="0.01" step="0.01" placeholder="金额（如 100.00）" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <Input placeholder="备注" value={remark} onChange={(e) => setRemark(e.target.value)} />
          <Button type="submit" disabled={mutation.isPending}>提交</Button>
        </form>
      </Card>
    </div>
  );
}

export function AdminUsersPage() {
  const qc = useQueryClient();
  const confirmAction = useConfirm();
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
        throw new Error('用户名至少 3 位');
      }
      if (passwordRaw.length < 6) {
        throw new Error('密码至少 6 位');
      }
      if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(balanceRaw)) {
        throw new Error('初始余额格式不正确，最多保留 2 位小数');
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
      notify.success('用户创建成功');
    },
    onError: (e: any) => showError(e, '用户创建失败'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, nextStatus }: { userId: number; nextStatus: 'active' | 'disabled' }) =>
      patchData<AdminUser>(`/api/admin/users/${userId}/status`, { status: nextStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      notify.success('用户状态更新成功');
    },
    onError: (e: any) => showError(e, '用户状态更新失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: number) => deleteData(`/api/admin/users/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      notify.success('用户删除成功');
    },
    onError: (e: any) => showError(e, '用户删除失败'),
  });

  function onCreate(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate();
  }

  return (
    <div className="space-y-4">
      <PageHeader title="用户管理" description="用户列表与余额信息" />
      <Card>
        <CardTitle className="mb-2">创建用户</CardTitle>
        <form className="grid grid-cols-6 gap-2" onSubmit={onCreate}>
          <Input placeholder="用户名（至少3位）" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <Input type="password" placeholder="密码（至少6位）" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <select
            className="flex h-9 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            value={role}
            onChange={(e) => setRole(e.target.value as 'user' | 'admin')}
          >
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
          </select>
          <select
            className="flex h-9 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'disabled')}
          >
            <option value="active">正常</option>
            <option value="disabled">已禁用</option>
          </select>
          <Input type="number" min="0" step="0.01" placeholder="初始余额" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} required />
          <Button type="submit" disabled={createMutation.isPending}>创建</Button>
        </form>
      </Card>
      <Card>
        <Table>
          <thead>
            <Tr>
              <Th>ID</Th>
              <Th>用户名</Th>
              <Th>角色</Th>
              <Th>状态</Th>
              <Th>余额</Th>
              <Th>创建时间</Th>
              <Th>操作</Th>
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
                      {user.status === 'active' ? '封禁' : '解封'}
                    </Button>
                    <Button
                      className="h-8 bg-rose-600 px-2 text-xs"
                      disabled={deleteMutation.isPending || me?.id === user.id}
                      onClick={async () => {
                        const ok = await confirmAction({
                          title: '确认删除用户',
                          description: `用户「${user.username}」将被永久删除，该操作不可恢复。`,
                          confirmText: '确认删除',
                          cancelText: '取消',
                          variant: 'destructive',
                        });
                        if (!ok) {
                          return;
                        }
                        deleteMutation.mutate(user.id);
                      }}
                    >
                      删除
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
  return (
    <div className="space-y-4">
      <PageHeader title="系统设置" description="V1 版本固定参数" />
      <Card className="space-y-2">
        <div className="text-sm"><span className="text-slate-500">默认协议：</span> RDP</div>
        <div className="text-sm"><span className="text-slate-500">回收间隔：</span> 60 秒</div>
        <div className="text-sm"><span className="text-slate-500">支付模式：</span> 手工充值</div>
      </Card>
    </div>
  );
}

export function AdminProductsPage() {
  const qc = useQueryClient();
  const confirmAction = useConfirm();
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
      notify.success('套餐创建成功');
    },
    onError: (e: any) => showError(e, '创建套餐失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: (productId: number) => deleteData<{ product_id: number; deleted: boolean }>(`/api/admin/products/${productId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      notify.success('套餐删除成功');
    },
    onError: (e: any) => showError(e, '删除套餐失败'),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="套餐管理" description="创建可售卖的时长套餐" />
      <Card>
        <form
          className="grid grid-cols-5 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <Input placeholder="名称" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input placeholder="时长(分钟)" value={duration} onChange={(e) => setDuration(e.target.value)} required />
          <Input placeholder="价格" value={price} onChange={(e) => setPrice(e.target.value)} required />
          <Input placeholder="分组标签" value={groupTag} onChange={(e) => setGroupTag(e.target.value)} />
          <Button type="submit">创建</Button>
        </form>
      </Card>
      <Card>
        <Table>
          <thead>
            <Tr>
              <Th>ID</Th>
              <Th>名称</Th>
              <Th>时长</Th>
              <Th>价格</Th>
              <Th>启用</Th>
              <Th>分组</Th>
              <Th>操作</Th>
            </Tr>
          </thead>
          <tbody>
            {(products || []).map((product) => (
              <Tr key={product.id}>
                <Td>{product.id}</Td>
                <Td>{product.name}</Td>
                <Td>{product.duration_minutes} 分钟</Td>
                <Td>{formatCurrency(product.price)}</Td>
                <Td>{formatEnabled(product.enabled)}</Td>
                <Td>{product.group_tag || '-'}</Td>
                <Td>
                  <Button
                    className="h-8 bg-rose-600 px-2 text-xs"
                    disabled={deleteMutation.isPending}
                    onClick={async () => {
                      const ok = await confirmAction({
                        title: '确认删除套餐',
                        description: `套餐「${product.name}」将被永久删除，且不可恢复。`,
                        confirmText: '确认删除',
                        cancelText: '取消',
                        variant: 'destructive',
                      });
                      if (!ok) {
                        return;
                      }
                      deleteMutation.mutate(product.id);
                    }}
                  >
                    删除
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
      <PageHeader title="个人中心" description="查看管理员账户信息并修改密码" />
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
