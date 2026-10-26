import { supabase } from "@/lib/supabase";
import { auditService } from "@/services/adminService";
import type {
  ResearchResource,
  ResearchAuthor,
  ResearchKeyword,
  SubmitResearchPayload,
  UpdateResearchPayload,
  ResearchType,
  ResearchVisibility,
  ResearchApprovalStatus,
} from "@/types/research.types";

const BUCKET = "research-resources";

function sanitiseFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
}

export const researchService = {

  list: async (filters?: {
    type?: ResearchType;
    departmentId?: string;
    academicYearId?: string;
    approvalStatus?: ResearchApprovalStatus;
    submittedBy?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: ResearchResource[]; count: number }> => {
    let query = supabase
      .from("research_resources")
      .select(
        `*, 
         department:departments(id,name,code),
         program:programs(id,name,code),
         academic_year:academic_years(id,name),
         submitter:profiles!submitted_by(id,full_name,email),
         authors:research_authors(id,author_name,author_order),
         keywords:research_keywords(id,keyword)`,
        { count: "exact" }
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (filters?.type)           query = query.eq("resource_type", filters.type);
    if (filters?.departmentId)   query = query.eq("department_id", filters.departmentId);
    if (filters?.academicYearId) query = query.eq("academic_year_id", filters.academicYearId);
    if (filters?.approvalStatus) query = query.eq("approval_status", filters.approvalStatus);
    if (filters?.submittedBy)    query = query.eq("submitted_by", filters.submittedBy);
    if (filters?.search) {
      query = query.or(
        `title.ilike.%${filters.search}%,abstract.ilike.%${filters.search}%,supervisor.ilike.%${filters.search}%`
      );
    }
    if (filters?.limit)  query = query.limit(filters.limit);
    if (filters?.offset) query = query.range(filters.offset, (filters.offset + (filters.limit ?? 20)) - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data as ResearchResource[], count: count ?? 0 };
  },

  get: async (id: string): Promise<ResearchResource> => {
    const { data, error } = await supabase
      .from("research_resources")
      .select(`
        *,
        department:departments(id,name,code),
        program:programs(id,name,code),
        academic_year:academic_years(id,name),
        submitter:profiles!submitted_by(id,full_name,email),
        authors:research_authors(id,author_name,author_order),
        keywords:research_keywords(id,keyword)
      `)
      .eq("id", id)
      .single();
    if (error) throw error;

    // increment view count
    supabase.from("research_resources" as any)
      .update({ view_count: ((data as any).view_count ?? 0) + 1 })
      .eq("id", id)
      .then(() => {});

    return data as ResearchResource;
  },

  submit: async (payload: SubmitResearchPayload, submittedBy: string): Promise<ResearchResource> => {
    // Validate role: only lecturers and admins can publish/submit research
    const { data: role, error: roleError } = await supabase.rpc("get_user_role", { p_user_id: submittedBy });
    if (roleError) throw new Error(`Could not verify account permissions: ${roleError.message}`);
    if (role !== "LECTURER" && role !== "ACADEMIC_LIBRARY_ADMIN") {
      throw new Error("Only lecturers and administrators are authorized to publish research.");
    }

    // Validate file
    const allowedTypes = ["application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip"];
    if (!allowedTypes.includes(payload.file.type)) {
      throw new Error("Only PDF, DOC, DOCX, and ZIP files are allowed for research submissions.");
    }
    const maxSize = 100 * 1024 * 1024; // 100 MB
    if (payload.file.size > maxSize) {
      throw new Error("File is too large. Maximum size is 100 MB.");
    }

    const resourceId   = crypto.randomUUID();
    const safeFilename = sanitiseFilename(payload.file.name);
    const storagePath  = `${resourceId}/${safeFilename}`;

    // Upload file to private bucket
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, payload.file, { contentType: payload.file.type, upsert: false });
    if (uploadError) throw uploadError;

    // Insert resource record
    const { error } = await supabase
      .from("research_resources")
      .insert({
        id:               resourceId,
        title:            payload.title,
        abstract:         payload.abstract || null,
        resource_type:    payload.resource_type,
        department_id:    payload.department_id || null,
        program_id:       payload.program_id || null,
        academic_year_id: payload.academic_year_id || null,
        supervisor:       payload.supervisor || null,
        publication_date: payload.publication_date || null,
        visibility:       payload.visibility,
        file_name:        payload.file.name,
        storage_path:     storagePath,
        file_size:        payload.file.size,
        submitted_by:     submittedBy,
        approval_status:  "PENDING",
      });

    if (error) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      if (error.code === "42501" || error.message?.toLowerCase().includes("policy")) {
        throw new Error(
          `Supabase rejected the research submission (${error.code ?? "policy"}): ${error.message}. ` +
          "Confirm migration 023 is applied in the Supabase SQL Editor."
        );
      }
      throw error;
    }

    // Insert authors
    if (payload.authors.length > 0) {
      await supabase.from("research_authors" as any).insert(
        payload.authors.map((name, idx) => ({
          resource_id:  resourceId,
          author_name:  name,
          author_order: idx + 1,
          profile_id:   idx === 0 ? submittedBy : null,
        }))
      );
    }

    // Insert keywords
    if (payload.keywords.length > 0) {
      await supabase.from("research_keywords" as any).insert(
        payload.keywords.map(keyword => ({ resource_id: resourceId, keyword: keyword.trim().toLowerCase() }))
      );
    }

    const { data: createdResource } = await supabase
      .from("research_resources")
      .select("*")
      .eq("id", resourceId)
      .maybeSingle();

    await auditService.log({
      action: "RESEARCH_SUBMITTED",
      resourceType: "research",
      resourceId: resourceId,
      details: { title: payload.title },
    });

    return (createdResource ?? {
      id:               resourceId,
      title:            payload.title,
      abstract:         payload.abstract || null,
      resource_type:    payload.resource_type,
      department_id:    payload.department_id || null,
      program_id:       payload.program_id || null,
      academic_year_id: payload.academic_year_id || null,
      supervisor:       payload.supervisor || null,
      publication_date: payload.publication_date || null,
      visibility:       payload.visibility,
      file_name:        payload.file.name,
      storage_path:     storagePath,
      file_size:        payload.file.size,
      submitted_by:     submittedBy,
      approval_status:  "PENDING",
      view_count:       0,
      download_count:   0,
      citation_count:   0,
      is_active:        true,
      created_at:       new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    }) as ResearchResource;
  },

  update: async (id: string, payload: UpdateResearchPayload): Promise<void> => {
    const { error } = await supabase
      .from("research_resources")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },

  approve: async (id: string, approvedBy: string): Promise<void> => {
    const { error } = await supabase
      .from("research_resources")
      .update({
        approval_status: "APPROVED",
        approved_by:     approvedBy,
        approved_at:     new Date().toISOString(),
        rejection_reason: null,
        updated_at:      new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
    await auditService.log({
      action: "RESEARCH_APPROVED",
      resourceType: "research",
      resourceId: id,
    });
  },

  reject: async (id: string, reason: string): Promise<void> => {
    const { error } = await supabase
      .from("research_resources")
      .update({
        approval_status:  "REJECTED",
        rejection_reason: reason,
        updated_at:       new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw error;
    await auditService.log({
      action: "RESEARCH_REJECTED",
      resourceType: "research",
      resourceId: id,
      details: { reason },
    });
  },

  updateVisibility: async (id: string, visibility: ResearchVisibility): Promise<void> => {
    const { error } = await supabase
      .from("research_resources")
      .update({ visibility, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },

  delete: async (id: string, storagePath?: string | null): Promise<void> => {
    let path = storagePath;
    if (!path) {
      const { data } = await supabase
        .from("research_resources")
        .select("storage_path")
        .eq("id", id)
        .maybeSingle();
      path = (data as any)?.storage_path;
    }

    if (path) {
      try {
        await supabase.storage.from(BUCKET).remove([path]);
      } catch (err) {
        console.warn("Could not delete research file from storage", err);
      }
    }

    const { error } = await supabase.from("research_resources" as never).delete().eq("id", id);
    if (error) {
      await supabase
        .from("research_resources" as never)
        .update({ is_active: false, updated_at: new Date().toISOString() } as never)
        .eq("id", id);
    }
  },

  getDownloadUrl: async (storagePath: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 300);
    if (error) throw error;
    return data.signedUrl;
  },

  recordDownload: async (id: string): Promise<void> => {
    const { data } = await supabase
      .from("research_resources")
      .select("download_count")
      .eq("id", id)
      .single();
    await supabase.from("research_resources" as any)
      .update({ download_count: ((data as any)?.download_count ?? 0) + 1 })
      .eq("id", id);
  },

  updateAuthors: async (resourceId: string, authors: string[]): Promise<void> => {
    await supabase.from("research_authors" as any).delete().eq("resource_id", resourceId);
    if (authors.length > 0) {
      await supabase.from("research_authors" as any).insert(
        authors.map((name, idx) => ({
          resource_id: resourceId, author_name: name, author_order: idx + 1,
        }))
      );
    }
  },

  updateKeywords: async (resourceId: string, keywords: string[]): Promise<void> => {
    await supabase.from("research_keywords" as any).delete().eq("resource_id", resourceId);
    if (keywords.length > 0) {
      await supabase.from("research_keywords" as any).insert(
        keywords.map(k => ({ resource_id: resourceId, keyword: k.trim().toLowerCase() }))
      );
    }
  },
};

