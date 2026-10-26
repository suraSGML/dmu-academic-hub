import { useAuth } from "./useAuth";
import type { Permission } from "@/types/roles.types";

export function usePermissions() {
  const { permissions } = useAuth();

  return {
    permissions,
    hasPermission: (permission: Permission): boolean =>
      permissions.includes(permission),
    hasAllPermissions: (perms: Permission[]): boolean =>
      perms.every((p) => permissions.includes(p)),
    hasAnyPermission: (perms: Permission[]): boolean =>
      perms.some((p) => permissions.includes(p)),
  };
}
