import { FormEvent, ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import { postData } from '@/lib/api';

function AuthContainer({ children, title, subtitle }: { children: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md space-y-4">
        <div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{subtitle}</CardDescription>
        </div>
        {children}
      </Card>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const role = await login(username, password);
      const target = role === 'admin' ? '/admin/overview' : '/app/dashboard';
      navigate(target);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === 'string' && detail.trim()) {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map((item) => item?.msg || '参数校验失败').join('；'));
      } else if (err?.response?.status === 404) {
        setError('登录接口不存在，请检查后端端口或配置。');
      } else if (err?.code === 'ERR_NETWORK') {
        setError('无法连接后端，请确认前端 API 地址与后端端口一致。');
      } else {
        setError('登录失败，请稍后重试。');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthContainer title="登录" subtitle="登录远程网关系统">
      <form className="space-y-3" onSubmit={onSubmit}>
        <div className="space-y-1">
          <label className="text-sm">用户名</label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-sm">密码</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? '登录中...' : '登录'}
        </Button>
      </form>
      <p className="text-xs text-slate-500">
        还没有账号？<Link className="text-blue-600" to="/register">去注册</Link>
      </p>
    </AuthContainer>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致。');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await postData('/api/auth/register', { username, password });
      navigate('/login');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === 'string' && detail.trim()) {
        setError(detail);
      } else if (err?.response?.status === 404) {
        setError('注册接口不存在，请检查后端端口或配置。');
      } else if (err?.code === 'ERR_NETWORK') {
        setError('无法连接后端，请确认后端已启动。');
      } else {
        setError('注册失败，请重试。');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthContainer title="注册" subtitle="创建新用户账号">
      <form className="space-y-3" onSubmit={onSubmit}>
        <div className="space-y-1">
          <label className="text-sm">用户名</label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-sm">密码</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-sm">确认密码</label>
          <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        </div>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? '注册中...' : '注册'}
        </Button>
      </form>
      <p className="text-xs text-slate-500">
        已有账号？<Link className="text-blue-600" to="/login">去登录</Link>
      </p>
    </AuthContainer>
  );
}

export function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <Card className="max-w-md space-y-2 text-center">
        <CardTitle>403</CardTitle>
        <CardDescription>你没有权限访问该页面。</CardDescription>
        <Link to="/login" className="text-sm text-blue-600">返回登录页</Link>
      </Card>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <Card className="max-w-md space-y-2 text-center">
        <CardTitle>404</CardTitle>
        <CardDescription>你访问的页面不存在。</CardDescription>
        <Link to="/login" className="text-sm text-blue-600">返回登录页</Link>
      </Card>
    </div>
  );
}
