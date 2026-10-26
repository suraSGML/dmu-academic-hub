export type ResearchType =
  | "THESIS"
  | "GRADUATION_PROJECT"
  | "RESEARCH_PAPER"
  | "DISSERTATION"
  | "SEMINAR"
  | "TECHNICAL_REPORT";

export type ResearchVisibility = "PRIVATE" | "DMU_ONLY" | "DEPARTMENT" | "PUBLIC";
export type ResearchApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export const RESEARCH_TYPE_LABELS: Record<ResearchType, string> = {
  THESIS:             "Thesis",
  GRADUATION_PROJECT: "Graduation Project",
  RESEARCH_PAPER:     "Research Paper",
  DISSERTATION:       "Dissertation",
  SEMINAR:            "Seminar Paper",
  TECHNICAL_REPORT:   "Technical Report",
};

export const RESEARCH_VISIBILITY_LABELS: Record<ResearchVisibility, string> = {
  PRIVATE:    "Private — only you and admins",
  DMU_ONLY:   "DMU Only — all authenticated DMU users",
  DEPARTMENT: "Department — users in same department",
  PUBLIC:     "Public — anyone (requires admin approval)",
};

export interface ResearchAuthor {
  id: string;
  resource_id: string;
  profile_id: string | null;
  author_name: string;
  author_order: number;
  created_at: string;
}

export interface ResearchKeyword {
  id: string;
  resource_id: string;
  keyword: string;
  created_at: string;
}

export interface ResearchResource {
  id: string;
  title: string;
  abstract: string | null;
  resource_type: ResearchType;
  department_id: string | null;
  program_id: string | null;
  academic_year_id: string | null;
  supervisor: string | null;
  publication_date: string | null;
  file_name: string | null;
  storage_path: string | null;
  file_size: number | null;
  visibility: ResearchVisibility;
  approval_status: ResearchApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  submitted_by: string;
  view_count: number;
  download_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // joined
  department?: { id: string; name: string; code: string };
  program?: { id: string; name: string; code: string };
  academic_year?: { id: string; name: string };
  submitter?: { id: string; full_name: string | null; email: string };
  authors?: ResearchAuthor[];
  keywords?: ResearchKeyword[];
}

export interface SubmitResearchPayload {
  title: string;
  abstract?: string;
  resource_type: ResearchType;
  department_id?: string;
  program_id?: string;
  academic_year_id?: string;
  supervisor?: string;
  publication_date?: string;
  visibility: ResearchVisibility;
  authors: string[];   // author names
  keywords: string[];  // keyword strings
  file: File;
}

export interface UpdateResearchPayload {
  title?: string;
  abstract?: string;
  resource_type?: ResearchType;
  department_id?: string;
  program_id?: string;
  academic_year_id?: string;
  supervisor?: string;
  publication_date?: string;
  visibility?: ResearchVisibility;
}
