import { useAuthContext } from "@/features/auth/AuthContext";

/**
 * Primary auth hook. Returns auth state and auth actions.
 * Must be used inside <AuthProvider>.
 */
export const useAuth = useAuthContext;
