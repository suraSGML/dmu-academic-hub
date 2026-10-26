export interface College {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  college_id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // joined
  college?: College;
}

export type DegreeType = "UNDERGRADUATE" | "POSTGRADUATE" | "DIPLOMA" | "CERTIFICATE";

export interface Program {
  id: string;
  department_id: string;
  name: string;
  code: string;
  degree_type: DegreeType;
  duration_years: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // joined
  department?: Department;
}

export interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface Semester {
  id: string;
  academic_year_id: string;
  name: string;
  semester_number: 1 | 2;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  created_at: string;
  updated_at: string;
  // joined
  academic_year?: AcademicYear;
}

export interface Course {
  id: string;
  department_id: string;
  program_id: string | null;
  academic_year_id: string;
  semester_id: string;
  name: string;
  code: string;
  credit_hours: number;
  year_level: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // joined
  department?: Department;
  program?: Program;
  academic_year?: AcademicYear;
  semester?: Semester;
  lecturers?: CourseLecturer[];
  enrollment_count?: number;
}

export interface CourseLecturer {
  id: string;
  course_id: string;
  lecturer_id: string;
  is_primary: boolean;
  assigned_at: string;
  // joined
  course?: Course;
  lecturer?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export type EnrollmentStatus = "ACTIVE" | "DROPPED" | "COMPLETED";

export interface CourseEnrollment {
  id: string;
  course_id: string;
  student_id: string;
  enrolled_at: string;
  status: EnrollmentStatus;
  // joined
  course?: Course;
  student?: {
    id: string;
    full_name: string | null;
    email: string;
    student_id: string | null;
    avatar_url: string | null;
  };
}

// ── Form payload types ────────────────────────────────────────────────────────

export interface CollegePayload {
  name: string;
  code: string;
  description?: string;
  is_active?: boolean;
}

export interface DepartmentPayload {
  college_id: string;
  name: string;
  code: string;
  description?: string;
  is_active?: boolean;
}

export interface ProgramPayload {
  department_id: string;
  name: string;
  code: string;
  degree_type: DegreeType;
  duration_years: number;
  description?: string;
  is_active?: boolean;
}

export interface AcademicYearPayload {
  name: string;
  start_date: string;
  end_date: string;
  is_current?: boolean;
}

export interface SemesterPayload {
  academic_year_id: string;
  name: string;
  semester_number: 1 | 2;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
}

export interface CoursePayload {
  department_id: string;
  program_id?: string | null;
  academic_year_id: string;
  semester_id: string;
  name: string;
  code: string;
  credit_hours?: number;
  year_level?: number;
  description?: string;
  is_active?: boolean;
}
