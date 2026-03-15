import { Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute, RoleRoute } from '@/app/guards';
import { AppShell } from '@/components/layout/app-shell';
import {
  AdminOrdersPage,
  AdminOverviewPage,
  AdminProfilePage,
  AdminProductsPage,
  AdminResourceImportPage,
  AdminResourcesPage,
  AdminSettingsPage,
  AdminUsersPage,
  AdminWalletPage,
} from '@/features/admin/pages';
import { ForbiddenPage, LoginPage, NotFoundPage, RegisterPage } from '@/features/auth/pages';
import {
  UserDashboardPage,
  UserOrdersPage,
  UserProductsPage,
  UserProfilePage,
  UserWalletPage,
} from '@/features/user/pages';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/403" element={<ForbiddenPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<RoleRoute allowed={['user']} />}>
          <Route path="/app" element={<AppShell role="user" />}>
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<UserDashboardPage />} />
            <Route path="products" element={<UserProductsPage />} />
            <Route path="orders" element={<UserOrdersPage />} />
            <Route path="wallet" element={<UserWalletPage />} />
            <Route path="profile" element={<UserProfilePage />} />
          </Route>
        </Route>

        <Route element={<RoleRoute allowed={['admin']} />}>
          <Route path="/admin" element={<AppShell role="admin" />}>
            <Route index element={<Navigate to="/admin/overview" replace />} />
            <Route path="overview" element={<AdminOverviewPage />} />
            <Route path="products" element={<AdminProductsPage />} />
            <Route path="resources" element={<AdminResourcesPage />} />
            <Route path="resources/import" element={<AdminResourceImportPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="wallet" element={<AdminWalletPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="profile" element={<AdminProfilePage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
