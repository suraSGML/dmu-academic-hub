import { supabase } from "@/lib/supabase";
import type {
  Department,
  Program,
  AcademicYear,
  Course,
} from "@/types/academic.types";
import type { Json } from "@/types/database.types";
import { auditService } from "@/services/adminService";

// ── Departments ───────────────────────────────────────────────────────────────

export const departmentService = {
  list: async (collegeId?: string): Promise<Department[]> => {
    let query = supabase
      .from("departments")
      .select("*, college:colleges(id,name,code)")
      .order("name");
    if (collegeId) query = query.eq("college_id", collegeId);
    const { data, error } = await query;
    if (error) throw error;
    return data as Department[];
  },
};

// ── Programs ──────────────────────────────────────────────────────────────────

export const programService = {
  list: async (departmentId?: string): Promise<Program[]> => {
    let query = supabase
      .from("programs")
      .select("*, department:departments(id,name,code,college_id)")
      .order("name");
    if (departmentId) query = query.eq("department_id", departmentId);
    const { data, error } = await query;
    if (error) throw error;
    return data as Program[];
  },
};

// ── Academic Years ────────────────────────────────────────────────────────────

export const academicYearService = {
  list: async (): Promise<AcademicYear[]> => {
    const { data, error } = await supabase
      .from("academic_years")
      .select("*")
      .order("start_date", { ascending: false });
    if (error) throw error;
    return data as AcademicYear[];
  },
};

// ── Courses ───────────────────────────────────────────────────────────────────

export const courseService = {
  get: async (id: string): Promise<Course> => {
    const { data, error } = await supabase
      .from("courses")
      .select(`
        *,
        department:departments(id,name,code),
        program:programs(id,name,code),
        academic_year:academic_years(id,name),
        semester:semesters(id,name,semester_number),
        lecturers:course_lecturers(
          id, is_primary,
          lecturer:profiles!course_lecturers_lecturer_id_fkey(id,full_name,email,avatar_url)
        )
      `)
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as Course;
  },

  getForStudent: async (studentId: string): Promise<Course[]> => {
    const { data, error } = await supabase
      .from("course_enrollments")
      .select(`
        course:courses(
          *,
          department:departments(id,name,code),
          academic_year:academic_years(id,name),
          semester:semesters(id,name,semester_number),
          lecturers:course_lecturers(
            id, is_primary,
            lecturer:profiles!course_lecturers_lecturer_id_fkey(id,full_name,email,avatar_url)
          )
        )
      `)
      .eq("student_id", studentId)
      .eq("status", "ACTIVE");
    if (error) throw error;
    const enrollments = data as Array<{ course: Course | null }> | null;
    return enrollments?.flatMap(({ course }) => course ? [course] : []) ?? [];
  },

  getForLecturer: async (lecturerId: string): Promise<Course[]> => {
    const { data, error } = await supabase
      .from("course_lecturers")
      .select(`
        course:courses(
          *,
          department:departments(id,name,code),
          academic_year:academic_years(id,name),
          semester:semesters(id,name,semester_number)
        )
      `)
      .eq("lecturer_id", lecturerId);
    if (error) throw error;
    const assignments = data as Array<{ course: Course | null }> | null;
    return assignments?.flatMap(({ course }) => course ? [course] : []) ?? [];
  },
};

export const enrollmentService = {
  countActiveByCourse: async (courseId: string): Promise<number> => {
    const { count, error } = await supabase
      .from("course_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId)
      .eq("status", "ACTIVE");
    if (error) throw error;
    return count ?? 0;
  },
};

export interface AcademicImportResult {
  courses: number;
  enrollments: number;
  assignments: number;
  unassignments: number;
}

export interface StudentIdsImportResult {
  studentIds: true;
  updated: number;
}

export const academicImportService = {
  importRecords: async (
    kind: "courses" | "enrollments" | "assignments",
    rows: Array<Record<string, string>>,
  ): Promise<AcademicImportResult> => {
    const { data, error } = await supabase.rpc(
      "import_academic_records" as never,
      {
        p_courses: kind === "courses" ? rows : [],
        p_enrollments: kind === "enrollments" ? rows : [],
        p_assignments: kind === "assignments" ? rows : [],
      } as never,
    );
    if (error) {
      const details = [error.message, error.details, error.hint, error.code]
        .filter(Boolean)
        .join(" — ");
      throw new Error(details || "The database rejected the academic-record import.");
    }
    const result = data as Json;
    if (
      result === null ||
      typeof result !== "object" ||
      Array.isArray(result) ||
      !("courses" in result) ||
      !("enrollments" in result) ||
      !("assignments" in result) ||
      !("unassignments" in result) ||
      typeof result.courses !== "number" ||
      typeof result.enrollments !== "number" ||
      typeof result.assignments !== "number" ||
      typeof result.unassignments !== "number"
    ) {
      throw new Error("The import completed but returned an invalid result.");
    }
    return {
      courses: result.courses,
      enrollments: result.enrollments,
      assignments: result.assignments,
      unassignments: result.unassignments,
    };
  },

  importStudentIds: async (
    rows: Array<Record<string, string>>,
  ): Promise<StudentIdsImportResult> => {
    const { data, error } = await supabase.rpc("import_student_ids" as never, {
      p_rows: rows,
    } as never);
    if (error) {
      const details = [error.message, error.details, error.hint, error.code]
        .filter(Boolean)
        .join(" — ");
      throw new Error(details || "The database rejected the student ID import.");
    }

    const result = data as Json;
    if (
      result === null ||
      typeof result !== "object" ||
      Array.isArray(result) ||
      !("updated" in result) ||
      typeof result.updated !== "number"
    ) {
      throw new Error("The import completed but returned an invalid result.");
    }
    return { studentIds: true, updated: result.updated };
  },
};

// ── Users (for admin) ─────────────────────────────────────────────────────────

export type UserWithRole = {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  student_id: string | null;
  staff_id: string | null;
  is_active: boolean;
  created_at: string;
  user_roles: Array<{ role: { id: string; name: string; display_name: string } }>;
};

export const userService = {
  listWithRoles: async (): Promise<UserWithRole[]> => {
    // Step 1: fetch all profiles
    const { data: profiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, student_id, staff_id, is_active, created_at")
      .order("full_name");
    if (profilesErr) throw new Error(`Failed to load users: ${profilesErr.message}`);

    if (!profiles || profiles.length === 0) return [];

    // Step 2: fetch all user_role rows with role details in one query
    const { data: userRoles, error: rolesErr } = await supabase
      .from("user_roles")
      .select("user_id, role:roles(id,name,display_name)");
    if (rolesErr) {
      throw new Error(
        `Failed to load user roles: ${rolesErr.message}. Ensure migration 007_fix_rls_user_roles_admin.sql has been applied.`,
      );
    }

    // Step 3: merge
    const rolesByUser = new Map<string, Array<{ role: { id: string; name: string; display_name: string } }>>();
    for (const ur of (userRoles ?? []) as any[]) {
      if (!ur.user_id) continue;
      if (!rolesByUser.has(ur.user_id)) rolesByUser.set(ur.user_id, []);
      if (ur.role) rolesByUser.get(ur.user_id)!.push({ role: ur.role });
    }

    return profiles.map((p) => ({
      ...p,
      user_roles: rolesByUser.get(p.id) ?? [],
    })) as UserWithRole[];
  },

  changeRole: async (userId: string, newRoleName: string): Promise<void> => {
    // Get role id
    const { data: roleData, error: roleErr } = await supabase
      .from("roles")
      .select("id")
      .eq("name", newRoleName)
      .single();
    if (roleErr || !roleData) throw roleErr ?? new Error("Role not found");

    // Check if user already has a role row — upsert accordingly
    const { data: existing } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("user_roles")
        .update({ role_id: roleData.id })
        .eq("user_id", userId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role_id: roleData.id });
      if (error) throw error;
    }
    await auditService.log({
      action: "USER_ROLE_CHANGED",
      resourceType: "user",
      resourceId: userId,
      details: { new_role: newRoleName },
    });
  },

  toggleActive: async (userId: string, isActive: boolean): Promise<void> => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) throw error;
    await auditService.log({
      action: "USER_STATUS_CHANGED",
      resourceType: "user",
      resourceId: userId,
      details: { is_active: isActive },
    });
  },

};
