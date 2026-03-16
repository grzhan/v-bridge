import { LogOut } from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { LanguageToggle } from '@/features/i18n/language-toggle';
import { useI18n, type TranslationKey } from '@/features/i18n/i18n-context';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

type NavItem = { to: string; labelKey: TranslationKey };

const userNav = [
  { to: '/app/dashboard', labelKey: 'nav.user.dashboard' },
  { to: '/app/products', labelKey: 'nav.user.products' },
  { to: '/app/orders', labelKey: 'nav.user.orders' },
  { to: '/app/wallet', labelKey: 'nav.user.wallet' },
  { to: '/app/profile', labelKey: 'nav.user.profile' },
] as const satisfies readonly NavItem[];

const adminNav = [
  { to: '/admin/overview', labelKey: 'nav.admin.overview' },
  { to: '/admin/products', labelKey: 'nav.admin.products' },
  { to: '/admin/resources', labelKey: 'nav.admin.resources' },
  { to: '/admin/resources/import', labelKey: 'nav.admin.resourcesImport' },
  { to: '/admin/orders', labelKey: 'nav.admin.orders' },
  { to: '/admin/wallet', labelKey: 'nav.admin.wallet' },
  { to: '/admin/users', labelKey: 'nav.admin.users' },
  { to: '/admin/settings', labelKey: 'nav.admin.settings' },
  { to: '/admin/profile', labelKey: 'nav.admin.profile' },
] as const satisfies readonly NavItem[];

export function AppShell({ role }: { role: Role }) {
  const navItems = role === 'admin' ? adminNav : userNav;
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const needsExactMatch = (path: string) => navItems.some((item) => item.to !== path && item.to.startsWith(`${path}/`));

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1440px] grid-cols-[240px_1fr]">
        <aside className="border-r bg-white">
          <div className="border-b px-4 py-4">
            <Link to={role === 'admin' ? '/admin/overview' : '/app/dashboard'} className="text-lg font-semibold text-slate-900">
              {t('app.name')}
            </Link>
            <p className="text-xs text-slate-500">{role === 'admin' ? t('app.subtitle.admin') : t('app.subtitle.user')}</p>
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
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
        </aside>

        <section className="flex min-h-screen flex-col">
          <header className="flex items-center justify-between border-b bg-white px-6 py-3">
            <p className="text-sm text-slate-600">{role === 'admin' ? t('layout.header.tagline.admin') : t('layout.header.tagline.user')}</p>
            <div className="flex items-center gap-3">
              <LanguageToggle className="text-slate-600" />
              <Button
                className="h-8 gap-2 bg-slate-800 px-3 text-xs"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                <LogOut className="h-3.5 w-3.5" />
                {t('layout.logout')}
              </Button>
            </div>
          </header>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </section>
      </div>
    </div>
  );
}
