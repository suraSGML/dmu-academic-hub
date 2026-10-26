import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/types/roles.types";

interface RoleGuardProps {
  allowedRoles: AppRole[];
}

/**
 * Route-level role guard.
 * Renders child routes only if the authenticated user has an allowed role.
 * Redirects to /forbidden otherwise.
 *
 * NOTE: This is a UX layer only.
 * Database RLS policies enforce the actual security boundary.
 */
export function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const { role, isLoading } = useAuth();

  if (isLoading) return null;

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
}
