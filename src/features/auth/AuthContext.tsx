import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type {
  AuthState,
  AuthUser,
  LoginCredentials,
  RegisterCredentials,
} from "@/types/auth.types";
import type { Profile } from "@/types/profile.types";
import type { AppRole, Permission } from "@/types/roles.types";
import { ROLE_PERMISSIONS } from "@/types/roles.types";

interface AuthContextValue extends AuthState {
  signIn: (credentials: LoginCredentials) => Promise<{ error: Error | null; role: AppRole | null }>;
  signUp: (
    credentials: RegisterCredentials
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (value && typeof value === "object") {
    const error = value as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [error.message, error.details, error.hint]
      .filter((part): part is string => typeof part === "string" && part.length > 0);
    if (parts.length > 0) {
      const code = typeof error.code === "string" ? ` (${error.code})` : "";
      return new Error(`${parts.join(" ")}${code}`);
    }
  }
  if (typeof value === "string" && value.length > 0) return new Error(value);
  return new Error("An unexpected authentication error occurred. Check the browser console for details.");
}

async function fetchProfileAndRole(userId: string): Promise<{
  profile: Profile | null;
  role: AppRole | null;
  permissions: Permission[];
}> {
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profileData) {
    throw new Error(
      "Your account is missing its platform profile. Ask the administrator to apply Supabase migration 019_repair_missing_auth_profiles.sql, then try signing in again."
    );
  }

  const { data: roleData, error: roleError } = await supabase.rpc(
    "get_user_role",
    { p_user_id: userId }
  );

  if (roleError) throw roleError;
  if (!roleData || !(roleData in ROLE_PERMISSIONS)) {
    throw new Error("Your account does not have a valid platform role. Contact the administrator.");
  }

  const role = roleData as AppRole;
  return {
    profile: { ...profileData, role } as Profile,
    role,
    permissions: ROLE_PERMISSIONS[role] ?? [],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const loadRequestId = useRef(0);
  const authEventReceived = useRef(false);
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    role: null,
    permissions: [],
    isLoading: true,
    isAuthenticated: false,
  });

  const loadUserData = useCallback(
    async (session: Session | null) => {
      const requestId = ++loadRequestId.current;
      if (!session?.user) {
        setState({
          user: null,
          session: null,
          profile: null,
          role: null,
          permissions: [],
          isLoading: false,
          isAuthenticated: false,
        });
        return { role: null, error: null };
      }

      setState((previous) => ({
        ...previous,
        isLoading: previous.user?.id !== session.user.id,
      }));

      try {
        const { profile, role, permissions } = await fetchProfileAndRole(session.user.id);
        if (requestId !== loadRequestId.current) return { role, error: null };
        setState({
          user: session.user as AuthUser,
          session,
          profile,
          role,
          permissions,
          isLoading: false,
          isAuthenticated: true,
        });
        return { role, error: null };
      } catch (cause) {
        const error = toAuthError(cause);
        if (requestId === loadRequestId.current) {
          console.error("Could not load the signed-in user's profile and role.", error);
          setState({
            user: session.user as AuthUser,
            session,
            profile: null,
            role: null,
            permissions: [],
            isLoading: false,
            isAuthenticated: true,
          });
        }
        return { role: null, error };
      }
    },
    []
  );

  useEffect(() => {
    // Get initial session
    void supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (authEventReceived.current) return;
      if (error) {
        console.error("Could not restore the current authentication session.", error);
        void loadUserData(null);
        return;
      }
      void loadUserData(session);
    });

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventReceived.current = true;
      // Defer database reads until the Supabase auth callback releases its lock.
      setTimeout(() => void loadUserData(session), 0);
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  const signIn = useCallback(
    async (credentials: LoginCredentials) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });
      if (error) return { error: error as Error, role: null };

      const result = await loadUserData(data.session);
      if (result.error || !result.role) {
        await supabase.auth.signOut();
        return {
          error: result.error ?? new Error("Your account does not have a valid platform role. Contact the administrator."),
          role: null,
        };
      }
      return { error: null, role: result.role };
    },
    [loadUserData]
  );

  const signUp = useCallback(async (credentials: RegisterCredentials) => {
    const { error } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      options: {
        data: {
          full_name: credentials.full_name,
        },
      },
    });
    return { error: error as Error | null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!state.user) return;
    try {
      const { profile, role, permissions } = await fetchProfileAndRole(state.user.id);
      setState((prev) => ({ ...prev, profile, role, permissions }));
    } catch (cause) {
      const error = toAuthError(cause);
      console.error("Could not refresh the signed-in user's profile and role.", error);
      throw error;
    }
  }, [state.user]);

  return (
    <AuthContext.Provider
      value={{ ...state, signIn, signUp, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return ctx;
}
