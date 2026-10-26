import { supabase } from "@/lib/supabase";
import type {
  CourseMaterial,
  MaterialVersion,
  UploadMaterialPayload,
  UpdateMaterialPayload,
  PublicationStatus,
  MaterialType,
  MaterialVisibility,
} from "@/types/material.types";
import { MAX_FILE_SIZE_BYTES, ALLOWED_FILE_TYPES } from "@/types/material.types";
import { auditService } from "@/services/adminService";

// ── Validation ─────────────────────────────────────────────────────────────────

export function validateMaterialFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File is too large. Maximum size is 50 MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`;
  }
  if (!ALLOWED_FILE_TYPES[file.type]) {
    return `File type "${file.type}" is not allowed. Allowed types: PDF, PPT, PPTX, DOC, DOCX, XLS, XLSX, ZIP, JPEG, PNG.`;
  }
  // Basic filename sanitisation
  if (/[<>:"/\\|?*]/.test(file.name)) {
    return "File name contains invalid characters.";
  }
  return null;
}

function sanitiseFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
}

// ── Core CRUD ──────────────────────────────────────────────────────────────────

export const materialService = {

  // List materials (respects RLS — only returns what the caller can access)
  list: async (filters?: {
    courseId?: string;
    uploadedBy?: string;
    materialType?: MaterialType;
    status?: PublicationStatus;
    visibility?: MaterialVisibility;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: CourseMaterial[]; count: number }> => {
    let query = supabase
      .from("course_materials")
      .select(
        `*, 
         course:courses(id,name,code,department:departments(id,name)),
         uploader:profiles!uploaded_by(id,full_name,email)`,
        { count: "exact" }
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (filters?.courseId)    query = query.eq("course_id", filters.courseId);
    if (filters?.uploadedBy)  query = query.eq("uploaded_by", filters.uploadedBy);
    if (filters?.materialType) query = query.eq("material_type", filters.materialType);
    if (filters?.status)      query = query.eq("publication_status", filters.status);
    if (filters?.visibility)  query = query.eq("visibility", filters.visibility);
    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }
    if (filters?.limit)  query = query.limit(filters.limit);
    if (filters?.offset) query = query.range(filters.offset, (filters.offset + (filters.limit ?? 20)) - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data as CourseMaterial[], count: count ?? 0 };
  },

  get: async (id: string): Promise<CourseMaterial> => {
    const { data, error } = await supabase
      .from("course_materials")
      .select(`
        *,
        course:courses(id,name,code,department:departments(id,name)),
        uploader:profiles!uploaded_by(id,full_name,email)
      `)
      .eq("id", id)
      .single();
    if (error) throw error;

    // Increment view count (fire and forget)
    supabase.from("course_materials" as any)
      .update({ view_count: ((data as any).view_count ?? 0) + 1 })
      .eq("id", id)
      .then(() => {});

    return data as CourseMaterial;
  },

  // Upload a new material with file
  upload: async (payload: UploadMaterialPayload, uploadedBy: string): Promise<CourseMaterial> => {
    // 1. Validate file
    const validationError = validateMaterialFile(payload.file);
    if (validationError) throw new Error(validationError);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw new Error(`Could not verify your signed-in account: ${authError.message}`);
    if (!authData.user || authData.user.id !== uploadedBy) {
      throw new Error("Your session does not match the account profile. Sign out and sign in again.");
    }

    const { data: role, error: roleError } = await supabase.rpc("get_user_role", {
      p_user_id: authData.user.id,
    });
    if (roleError) throw new Error(`Could not verify your database role: ${roleError.message}`);
    if (role !== "LECTURER" && role !== "ACADEMIC_LIBRARY_ADMIN") {
      throw new Error(
        `Your database role is ${role || "not assigned"}, not Lecturer or Academic Resource & Library Administrator. Ask an administrator to correct your role assignment.`
      );
    }

    const { data: canUpload, error: accessError } = await supabase.rpc(
      "can_upload_course_material",
      { p_course_id: payload.course_id }
    );
    if (accessError) {
      throw new Error(`Could not verify upload permission: ${accessError.message}`);
    }
    if (!canUpload) {
      if (role === "LECTURER") {
        throw new Error("You are signed in as a lecturer, but are not assigned to the selected course in the university course records.");
      }
      throw new Error("Your account is not authorized to upload materials for the selected course.");
    }

    // 2. Generate a stable materialId up front so storage path and DB row share the same id
    const safeFilename = sanitiseFilename(payload.file.name);
    const materialId   = crypto.randomUUID();
    const storagePath  = `${payload.course_id}/${materialId}/${safeFilename}`;

    // 3. Insert the DB record FIRST (before touching storage).
    //    We execute insert without chaining .select(...) directly on the insert statement
    //    so PostgREST does not trigger the SELECT RLS policy on in-flight uncommitted rows.
    const { error: dbError } = await supabase
      .from("course_materials")
      .insert({
        id:                 materialId,
        course_id:          payload.course_id,
        uploaded_by:        uploadedBy,
        title:              payload.title,
        description:        payload.description || null,
        material_type:      payload.material_type,
        module_chapter:     payload.module_chapter || null,
        visibility:         payload.visibility,
        file_name:          payload.file.name,
        storage_path:       storagePath,
        file_size:          payload.file.size,
        file_type:          payload.file.type,
        publication_status: "DRAFT",
      });

    if (dbError) {
      if (dbError.code === "42501" || dbError.message?.toLowerCase().includes("policy")) {
        throw new Error(
          `Supabase rejected the material record (${dbError.code ?? "policy"}): ${dbError.message}. ` +
          "Confirm migration 022 is applied in the Supabase SQL Editor and that your lecturer assignment is active."
        );
      }
      throw new Error(`Failed to save material record: ${dbError.message}`);
    }

    // 4. Upload file to private storage bucket
    const { error: uploadError } = await supabase.storage
      .from("course-materials")
      .upload(storagePath, payload.file, {
        contentType: payload.file.type,
        upsert: false,
      });

    if (uploadError) {
      // Roll back the DB record so we don't have a dangling row with no file
      await supabase.from("course_materials" as any).delete().eq("id", materialId);
      if (uploadError.message?.toLowerCase().includes("policy") ||
          uploadError.message?.toLowerCase().includes("rls") ||
          uploadError.message?.toLowerCase().includes("violates")) {
        throw new Error(
          "Storage permission denied: run migration 008/022 in Supabase SQL Editor to create the " +
          "storage bucket policies for 'course-materials'."
        );
      }
      throw new Error(`File upload failed: ${uploadError.message}`);
    }

    // 5. Record initial version entry
    await supabase.from("material_versions" as any).insert({
      material_id:  materialId,
      version:      1,
      file_name:    payload.file.name,
      storage_path: storagePath,
      file_size:    payload.file.size,
      uploaded_by:  uploadedBy,
    });

    await auditService.log({
      action: "MATERIAL_UPLOADED",
      resourceType: "material",
      resourceId: materialId,
      details: { title: payload.title, course_id: payload.course_id, file_name: payload.file.name },
    });

    // 6. Return material record (query after commit or fallback to known record)
    const { data: createdMaterial } = await supabase
      .from("course_materials")
      .select(`
        *,
        course:courses(id,name,code),
        uploader:profiles!uploaded_by(id,full_name,email)
      `)
      .eq("id", materialId)
      .maybeSingle();

    return (createdMaterial ?? {
      id:                 materialId,
      course_id:          payload.course_id,
      uploaded_by:        uploadedBy,
      title:              payload.title,
      description:        payload.description || null,
      material_type:      payload.material_type,
      module_chapter:     payload.module_chapter || null,
      visibility:         payload.visibility,
      file_name:          payload.file.name,
      storage_path:       storagePath,
      file_size:          payload.file.size,
      file_type:          payload.file.type,
      publication_status: "DRAFT",
      version:            1,
      download_count:     0,
      view_count:         0,
      is_active:          true,
      created_at:         new Date().toISOString(),
      updated_at:         new Date().toISOString(),
    }) as CourseMaterial;
  },

  // Replace file (new version)
  uploadNewVersion: async (materialId: string, file: File, uploadedBy: string): Promise<void> => {
    const validationError = validateMaterialFile(file);
    if (validationError) throw new Error(validationError);

    // Get current material
    const { data: current, error: fetchErr } = await supabase
      .from("course_materials")
      .select("course_id, version, storage_path")
      .eq("id", materialId)
      .single();
    if (fetchErr) throw fetchErr;

    const newVersion  = ((current as any).version ?? 1) + 1;
    const safeFilename = sanitiseFilename(file.name);
    const storagePath  = `${(current as any).course_id}/${materialId}/v${newVersion}_${safeFilename}`;

    const { error: uploadError } = await supabase.storage
      .from("course-materials")
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;

    await supabase.from("course_materials" as any).update({
      file_name:    file.name,
      storage_path: storagePath,
      file_size:    file.size,
      file_type:    file.type,
      version:      newVersion,
      updated_at:   new Date().toISOString(),
    }).eq("id", materialId);

    await supabase.from("material_versions" as any).insert({
      material_id:  materialId,
      version:      newVersion,
      file_name:    file.name,
      storage_path: storagePath,
      file_size:    file.size,
      uploaded_by:  uploadedBy,
    });

    await auditService.log({
      action: "MATERIAL_UPLOADED",
      resourceType: "material",
      resourceId: materialId,
      details: { version: newVersion, file_name: file.name },
    });
  },

  update: async (id: string, payload: UpdateMaterialPayload): Promise<CourseMaterial> => {
    const { data, error } = await supabase
      .from("course_materials")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(`*, course:courses(id,name,code), uploader:profiles!uploaded_by(id,full_name,email)`)
      .single();
    if (error) throw error;
    await auditService.log({
      action: "MATERIAL_UPDATED",
      resourceType: "material",
      resourceId: id,
      details: { updated_fields: Object.keys(payload) },
    });
    return data as CourseMaterial;
  },

  publish: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from("course_materials")
      .update({ publication_status: "PUBLISHED", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await auditService.log({ action: "MATERIAL_PUBLISHED", resourceType: "material", resourceId: id });
  },

  unpublish: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from("course_materials")
      .update({ publication_status: "DRAFT", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await auditService.log({ action: "MATERIAL_UNPUBLISHED", resourceType: "material", resourceId: id });
  },

  archive: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from("course_materials")
      .update({ publication_status: "ARCHIVED", is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await auditService.log({ action: "MATERIAL_ARCHIVED", resourceType: "material", resourceId: id });
  },

  delete: async (id: string): Promise<void> => {
    // Get storage path first
    const { data } = await supabase
      .from("course_materials")
      .select("storage_path")
      .eq("id", id)
      .single();

    // Soft delete
    const { error } = await supabase
      .from("course_materials")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;

    // Remove from storage if path exists
    if ((data as any)?.storage_path) {
      await supabase.storage
        .from("course-materials")
        .remove([(data as any).storage_path]);
    }
    await auditService.log({ action: "MATERIAL_DELETED", resourceType: "material", resourceId: id });
  },

  // Generate a 5-minute signed download URL
  getDownloadUrl: async (storagePath: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from("course-materials")
      .createSignedUrl(storagePath, 300); // 5 minutes
    if (error) throw error;
    return data.signedUrl;
  },

  // Increment download count
  recordDownload: async (id: string): Promise<void> => {
    const { data } = await supabase
      .from("course_materials")
      .select("download_count")
      .eq("id", id)
      .single();
    await supabase
      .from("course_materials")
      .update({ download_count: ((data as any)?.download_count ?? 0) + 1 })
      .eq("id", id);
  },

  // Version history
  getVersions: async (materialId: string): Promise<MaterialVersion[]> => {
    const { data, error } = await supabase
      .from("material_versions")
      .select("*")
      .eq("material_id", materialId)
      .order("version", { ascending: false });
    if (error) throw error;
    return data as MaterialVersion[];
  },

  // Stats for lecturer dashboard
  getStatsForLecturer: async (lecturerId: string) => {
    const [total, published, drafts, downloads] = await Promise.all([
      supabase.from("course_materials" as any).select("id", { count: "exact", head: true })
        .eq("uploaded_by", lecturerId).eq("is_active", true),
      supabase.from("course_materials" as any).select("id", { count: "exact", head: true })
        .eq("uploaded_by", lecturerId).eq("publication_status", "PUBLISHED").eq("is_active", true),
      supabase.from("course_materials" as any).select("id", { count: "exact", head: true })
        .eq("uploaded_by", lecturerId).eq("publication_status", "DRAFT").eq("is_active", true),
      supabase.from("course_materials" as any).select("download_count")
        .eq("uploaded_by", lecturerId).eq("is_active", true),
    ]);

    const totalDownloads = (downloads.data ?? []).reduce(
      (sum: number, m: any) => sum + (m.download_count ?? 0), 0
    );

    return {
      total:     (total as any).count ?? 0,
      published: (published as any).count ?? 0,
      drafts:    (drafts as any).count ?? 0,
      totalDownloads,
    };
  },
};

