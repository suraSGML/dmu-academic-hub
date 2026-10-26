import type { ReactNode } from "react";
import { useRole } from "@/hooks/useRole";
import type { AppRole } from "@/types/roles.types";

interface RoleGuardProps {
  roles: AppRole[];
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * UX-layer role guard component (distinct from the route-level RoleGuard).
 * Use inside page components to conditionally show UI sections.
 *
 * IMPORTANT: This is a UI convenience only.
 * Real authorization is enforced by Supabase RLS and database policies.
 */
export function RoleGuard({ roles, fallback = null, children }: RoleGuardProps) {
  const { hasAnyRole } = useRole();
  return hasAnyRole(roles) ? <>{children}</> : <>{fallback}</>;
}
