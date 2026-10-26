import { useAuth } from "./useAuth";
import type { AppRole } from "@/types/roles.types";

export function useRole() {
  const { role } = useAuth();

  return {
    role,
    isStudent: role === "STUDENT",
    isLecturer: role === "LECTURER",
    isLibrarian: role === "LIBRARIAN",
    isAdmin: role === "ACADEMIC_LIBRARY_ADMIN",
    hasRole: (r: AppRole) => role === r,
    hasAnyRole: (roles: AppRole[]) => role !== null && roles.includes(role),
  };
}
