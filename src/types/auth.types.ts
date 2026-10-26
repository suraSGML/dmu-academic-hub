import type { User, Session } from "@supabase/supabase-js";
import type { AppRole, Permission } from "./roles.types";
import type { Profile } from "./profile.types";

export type { User, Session };

export interface AuthUser extends User {
  // extends Supabase User
}

export interface AuthState {
  user: AuthUser | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  permissions: Permission[];
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  full_name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface ResetPasswordCredentials {
  password: string;
  confirmPassword: string;
}
