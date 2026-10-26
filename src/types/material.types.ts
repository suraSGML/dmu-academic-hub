export type MaterialType =
  | "LECTURE_NOTE"
  | "PRESENTATION"
  | "HANDOUT"
  | "ASSIGNMENT"
  | "LABORATORY_MANUAL"
  | "TUTORIAL"
  | "READING_MATERIAL"
  | "REFERENCE_MATERIAL"
  | "EXAM_PREPARATION"
  | "OTHER";

export type PublicationStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type MaterialVisibility =
  | "PRIVATE"
  | "COURSE"
  | "DEPARTMENT"
  | "UNIVERSITY"
  | "PUBLIC";

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  LECTURE_NOTE:      "Lecture Note",
  PRESENTATION:      "Presentation",
  HANDOUT:           "Handout",
  ASSIGNMENT:        "Assignment",
  LABORATORY_MANUAL: "Lab Manual",
  TUTORIAL:          "Tutorial",
  READING_MATERIAL:  "Reading Material",
  REFERENCE_MATERIAL:"Reference",
  EXAM_PREPARATION:  "Exam Preparation",
  OTHER:             "Other",
};

export const VISIBILITY_LABELS: Record<MaterialVisibility, string> = {
  PRIVATE:    "Private (only you)",
  COURSE:     "Course (enrolled students + assigned lecturers)",
  DEPARTMENT: "Department (same department users)",
  UNIVERSITY: "University (all authenticated DMU users)",
  PUBLIC:     "Public (anyone)",
};

export const ALLOWED_FILE_TYPES: Record<string, string> = {
  "application/pdf":                                                      "PDF",
  "application/vnd.ms-powerpoint":                                        "PPT",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "application/msword":                                                   "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":  "DOCX",
  "application/vnd.ms-excel":                                             "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":   "XLSX",
  "application/zip":                                                      "ZIP",
  "image/jpeg":                                                           "JPEG",
  "image/png":                                                            "PNG",
};

export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export interface CourseMaterial {
  id: string;
  course_id: string;
  uploaded_by: string;
  title: string;
  description: string | null;
  material_type: MaterialType;
  file_name: string | null;
  storage_path: string | null;
  file_size: number | null;
  file_type: string | null;
  module_chapter: string | null;
  publication_status: PublicationStatus;
  visibility: MaterialVisibility;
  version: number;
  download_count: number;
  view_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // joined
  course?: {
    id: string;
    name: string;
    code: string;
    department?: { id: string; name: string };
  };
  uploader?: {
    id: string;
    full_name: string | null;
    email: string;
  };
}

export interface MaterialVersion {
  id: string;
  material_id: string;
  version: number;
  file_name: string | null;
  storage_path: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface UploadMaterialPayload {
  course_id: string;
  title: string;
  description?: string;
  material_type: MaterialType;
  module_chapter?: string;
  visibility: MaterialVisibility;
  file: File;
}

export interface UpdateMaterialPayload {
  title?: string;
  description?: string;
  material_type?: MaterialType;
  module_chapter?: string;
  visibility?: MaterialVisibility;
  publication_status?: PublicationStatus;
}
