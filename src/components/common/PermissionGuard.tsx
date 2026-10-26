import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import type { Permission } from "@/types/roles.types";

interface PermissionGuardProps {
  permission: Permission;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * UX-layer permission guard. Renders children only when the current user
 * has the specified permission.
 *
 * IMPORTANT: This is a UI convenience only.
 * Real authorization is enforced by Supabase RLS and database policies.
 * Never rely on this component as the sole security mechanism.
 */
export function PermissionGuard({
  permission,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { hasPermission } = usePermissions();
  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
}
