import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '@/features/auth/auth-context';
import type { Role } from '@/lib/types';

export function ProtectedRoute() {
  const { token } = useAuth();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export function RoleRoute({ allowed }: { allowed: Role[] }) {
  const { role } = useAuth();
  if (!role || !allowed.includes(role)) {
    return <Navigate to="/403" replace />;
  }
  return <Outlet />;
}
