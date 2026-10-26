import type { AppRole } from "./roles.types";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  student_id: string | null;
  staff_id: string | null;
  department_id: string | null;
  program_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields (not in DB directly)
  role?: AppRole;
}

export interface ProfileUpdatePayload {
  full_name?: string;
  phone?: string;
  avatar_url?: string;
}
