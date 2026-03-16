import { FormEvent, ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import { useI18n } from '@/features/i18n/i18n-context';
import { LanguageToggle } from '@/features/i18n/language-toggle';
import { postData } from '@/lib/api';

function AuthContainer({ children, title, subtitle }: { children: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{subtitle}</CardDescription>
          </div>
          <LanguageToggle />
        </div>
        {children}
      </Card>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const errorSeparator = language === 'zh-CN' ? '；' : '; ';

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
        setError(detail.map((item) => item?.msg || t('auth.login.error.validation')).join(errorSeparator));
      } else if (err?.response?.status === 404) {
        setError(t('auth.login.error.notFound'));
      } else if (err?.code === 'ERR_NETWORK') {
        setError(t('auth.login.error.network'));
      } else {
        setError(t('auth.login.error.generic'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthContainer title={t('auth.login.title')} subtitle={t('auth.login.subtitle')}>
      <form className="space-y-3" onSubmit={onSubmit}>
        <div className="space-y-1">
          <label className="text-sm">{t('auth.fields.username')}</label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-sm">{t('auth.fields.password')}</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t('auth.login.buttonLoading') : t('auth.login.button')}
        </Button>
      </form>
      <p className="text-xs text-slate-500">
        {t('auth.login.registerPrompt')}{' '}
        <Link className="text-blue-600" to="/register">{t('auth.login.registerLink')}</Link>
      </p>
    </AuthContainer>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError(t('auth.register.error.passwordMismatch'));
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
        setError(t('auth.register.error.notFound'));
      } else if (err?.code === 'ERR_NETWORK') {
        setError(t('auth.register.error.network'));
      } else {
        setError(t('auth.register.error.generic'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthContainer title={t('auth.register.title')} subtitle={t('auth.register.subtitle')}>
      <form className="space-y-3" onSubmit={onSubmit}>
        <div className="space-y-1">
          <label className="text-sm">{t('auth.fields.username')}</label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-sm">{t('auth.fields.password')}</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-sm">{t('auth.fields.confirmPassword')}</label>
          <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        </div>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t('auth.register.buttonLoading') : t('auth.register.button')}
        </Button>
      </form>
      <p className="text-xs text-slate-500">
        {t('auth.register.loginPrompt')}{' '}
        <Link className="text-blue-600" to="/login">{t('auth.register.loginLink')}</Link>
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
