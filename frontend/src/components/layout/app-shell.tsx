import { LogOut } from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

const userNav = [
  { to: '/app/dashboard', label: '控制台' },
  { to: '/app/products', label: '套餐购买' },
  { to: '/app/orders', label: '我的订单' },
  { to: '/app/wallet', label: '钱包' },
  { to: '/app/profile', label: '个人信息' },
];

const adminNav = [
  { to: '/admin/overview', label: '概览' },
  { to: '/admin/products', label: '套餐管理' },
  { to: '/admin/resources', label: '资源池' },
  { to: '/admin/resources/import', label: '批量导入' },
  { to: '/admin/orders', label: '订单管理' },
  { to: '/admin/wallet', label: '钱包管理' },
  { to: '/admin/users', label: '用户管理' },
  { to: '/admin/settings', label: '系统设置' },
  { to: '/admin/profile', label: '个人中心' },
];

export function AppShell({ role }: { role: Role }) {
  const navItems = role === 'admin' ? adminNav : userNav;
  const { logout } = useAuth();
  const navigate = useNavigate();
  const needsExactMatch = (path: string) => navItems.some((item) => item.to !== path && item.to.startsWith(`${path}/`));

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1440px] grid-cols-[240px_1fr]">
        <aside className="border-r bg-white">
          <div className="border-b px-4 py-4">
            <Link to={role === 'admin' ? '/admin/overview' : '/app/dashboard'} className="text-lg font-semibold text-slate-900">
              远程网关
            </Link>
            <p className="text-xs text-slate-500">{role === 'admin' ? '管理后台' : '用户中心'}</p>
          </div>
          <nav className="space-y-1 p-3">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={needsExactMatch(item.to)}
                className={({ isActive }) =>
                  cn(
                    'block rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    isActive && 'bg-slate-900 text-white hover:bg-slate-900 hover:text-white'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <section className="flex min-h-screen flex-col">
          <header className="flex items-center justify-between border-b bg-white px-6 py-3">
            <p className="text-sm text-slate-600">{role === 'admin' ? '系统管理' : '远程桌面访问'}</p>
            <Button
              className="h-8 gap-2 bg-slate-800 px-3 text-xs"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
              退出登录
            </Button>
          </header>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </section>
      </div>
    </div>
  );
}
