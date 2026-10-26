export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
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
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email: string;
          avatar_url?: string | null;
          phone?: string | null;
          student_id?: string | null;
          staff_id?: string | null;
          department_id?: string | null;
          program_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string;
          avatar_url?: string | null;
          phone?: string | null;
          student_id?: string | null;
          staff_id?: string | null;
          department_id?: string | null;
          program_id?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      roles: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          display_name?: string;
          description?: string | null;
        };
        Relationships: [];
      };
      permissions: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          module: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          module: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          module?: string;
        };
        Relationships: [];
      };
      role_permissions: {
        Row: {
          role_id: string;
          permission_id: string;
        };
        Insert: {
          role_id: string;
          permission_id: string;
        };
        Update: {
          role_id?: string;
          permission_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          user_id: string;
          role_id: string;
          assigned_by: string | null;
          assigned_at: string;
        };
        Insert: {
          user_id: string;
          role_id: string;
          assigned_by?: string | null;
          assigned_at?: string;
        };
        Update: {
          role_id?: string;
          assigned_by?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: string;
          is_read: boolean;
          resource_type: string | null;
          resource_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message: string;
          type: string;
          is_read?: boolean;
          resource_type?: string | null;
          resource_id?: string | null;
          created_at?: string;
        };
        Update: {
          is_read?: boolean;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          resource_type: string | null;
          resource_id: string | null;
          metadata: Json | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          resource_type?: string | null;
          resource_id?: string | null;
          metadata?: Json | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_user_role: {
        Args: { p_user_id: string };
        Returns: string;
      };
      is_assigned_to_course: {
        Args: { p_course_id: string };
        Returns: boolean;
      };
      can_upload_course_material: {
        Args: { p_course_id: string };
        Returns: boolean;
      };
      has_permission: {
        Args: { p_user_id: string; p_permission_name: string };
        Returns: boolean;
      };
      import_academic_records: {
        Args: {
          p_courses: Json;
          p_enrollments: Json;
          p_assignments: Json;
        };
        Returns: Json;
      };
      import_student_ids: {
        Args: { p_rows: Json };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
  };
}
