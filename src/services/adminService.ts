import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export type AuditAction =
  | "USER_LOGIN"
  | "USER_REGISTER"
  | "USER_ROLE_CHANGED"
  | "USER_STATUS_CHANGED"
  | "BOOK_CREATED"
  | "BOOK_UPDATED"
  | "BOOK_DELETED"
  | "BOOK_BORROWED"
  | "BOOK_RETURNED"
  | "BOOK_RESERVED"
  | "RESERVATION_FULFILLED"
  | "RESERVATION_CANCELLED"
  | "MATERIAL_UPLOADED"
  | "MATERIAL_UPDATED"
  | "MATERIAL_PUBLISHED"
  | "MATERIAL_UNPUBLISHED"
  | "MATERIAL_ARCHIVED"
  | "MATERIAL_DELETED"
  | "RESEARCH_SUBMITTED"
  | "RESEARCH_APPROVED"
  | "RESEARCH_REJECTED"
  | "FINE_WAIVED"
  | "FINE_PAID"
  | "SETTING_UPDATED"
  | "ENROLLMENT_ADDED"
  | "ENROLLMENT_DROPPED"
  | "COURSE_LIST_VIEWED"
  | "COURSE_DETAIL_VIEWED"
  | "STUDENT_ID_UPDATED"
  | "STUDENT_IDS_IMPORTED";

// ── Audit Service ─────────────────────────────────────────────────────────────

export const auditService = {
  /** Log an action without masking the result of the operation being audited. */
  log: async (params: {
    action: AuditAction;
    resourceType?: string;
    resourceId?: string;
    details?: Record<string, unknown>;
  }): Promise<void> => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const { error } = await (supabase.from("audit_logs" as any) as any).insert({
        user_id:       user?.id ?? null,
        action:        params.action,
        resource_type: params.resourceType ?? null,
        resource_id:   params.resourceId ?? null,
        metadata:      params.details ?? null,
      });
      if (error) throw error;
    } catch (error) {
      console.error(`Failed to record audit event "${params.action}".`, error);
    }
  },

  list: async (filters?: {
    action?: string;
    userId?: string;
    resourceType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: AuditLog[]; count: number }> => {
    let query = (supabase
      .from("audit_logs" as any) as any)
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (filters?.action)       query = query.eq("action", filters.action);
    if (filters?.userId)       query = query.eq("user_id", filters.userId);
    if (filters?.resourceType) query = query.eq("resource_type", filters.resourceType);
    if (filters?.limit)        query = query.limit(filters.limit);
    if (filters?.offset)       query = query.range(filters.offset, (filters.offset + (filters.limit ?? 50)) - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: (data ?? []) as AuditLog[], count: count ?? 0 };
  },
};

// ── Types for System Settings ──────────────────────────────────────────────────

export interface SystemSetting {
  key: string;
  value: string;
  label: string;
  description: string | null;
  category: string;
  updated_by: string | null;
  updated_at: string;
}

// ── System Settings Service ───────────────────────────────────────────────────

export const systemSettingsService = {
  list: async (): Promise<SystemSetting[]> => {
    const { data, error } = await (supabase
      .from("system_settings" as any) as any)
      .select("*")
      .order("category")
      .order("key");
    if (error) throw error;
    return (data ?? []) as SystemSetting[];
  },

  get: async (key: string): Promise<string | null> => {
    const { data } = await (supabase
      .from("system_settings" as any) as any)
      .select("value")
      .eq("key", key)
      .maybeSingle();
    return (data as any)?.value ?? null;
  },

  update: async (key: string, value: string): Promise<void> => {
    const { error } = await (supabase
      .from("system_settings" as any) as any)
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", key);
    if (error) throw error;
  },

  updateMany: async (updates: Record<string, string>): Promise<void> => {
    await Promise.all(
      Object.entries(updates).map(([key, value]) =>
        systemSettingsService.update(key, value)
      )
    );
  },
};

// ── Types for Fines ───────────────────────────────────────────────────────────

export interface Fine {
  id: string;
  borrowing_id: string;
  student_id: string;
  amount: number;
  days_overdue: number;
  status: "PENDING" | "PAID" | "WAIVED";
  waived_by: string | null;
  waive_reason: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  borrowing?: {
    id: string;
    borrow_date: string;
    due_date: string;
    return_date: string | null;
    book?: { id: string; title: string; author: string };
    book_copy?: { id: string; accession_number: string };
  };
  student?: {
    id: string;
    full_name: string | null;
    email: string;
    student_id: string | null;
    avatar_url: string | null;
  };
}

// ── Fine Service ──────────────────────────────────────────────────────────────

export const fineService = {
  /** Calculate fine amount based on days overdue and rate per day */
  calculateAmount: (daysOverdue: number, ratePerDay = 5): number => {
    return Math.max(0, daysOverdue) * ratePerDay;
  },

  /** Create or upsert a fine record for a borrowing */
  createOrUpdate: async (params: {
    borrowingId: string;
    studentId: string;
    daysOverdue: number;
    ratePerDay?: number;
  }): Promise<Fine> => {
    const amount = fineService.calculateAmount(params.daysOverdue, params.ratePerDay);
    const { data, error } = await (supabase
      .from("fines" as any) as any)
      .upsert(
        {
          borrowing_id: params.borrowingId,
          student_id:   params.studentId,
          amount,
          days_overdue: params.daysOverdue,
          updated_at:   new Date().toISOString(),
        },
        { onConflict: "borrowing_id" }
      )
      .select()
      .single();
    if (error) throw error;
    return data as Fine;
  },

  list: async (filters?: {
    studentId?: string;
    status?: "PENDING" | "PAID" | "WAIVED";
    limit?: number;
    offset?: number;
  }): Promise<{ data: Fine[]; count: number }> => {
    let query = (supabase
      .from("fines" as any) as any)
      .select(
        `*,
         borrowing:borrowings(
           id, borrow_date, due_date, return_date,
           book:books(id,title,author),
           book_copy:book_copies(id,accession_number)
         ),
         student:profiles!student_id(id,full_name,email,student_id,avatar_url)`,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (filters?.studentId) query = query.eq("student_id", filters.studentId);
    if (filters?.status)    query = query.eq("status", filters.status);
    if (filters?.limit)     query = query.limit(filters.limit);
    if (filters?.offset)    query = query.range(filters.offset, (filters.offset + (filters.limit ?? 20)) - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: (data ?? []) as Fine[], count: count ?? 0 };
  },

  getForStudent: async (studentId: string): Promise<Fine[]> => {
    const { data, error } = await (supabase
      .from("fines" as any) as any)
      .select(
        `*,
         borrowing:borrowings(
           id, borrow_date, due_date, return_date,
           book:books(id,title,author),
           book_copy:book_copies(id,accession_number)
         )`
      )
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Fine[];
  },

  markPaid: async (fineId: string): Promise<void> => {
    const { error } = await (supabase
      .from("fines" as any) as any)
      .update({ status: "PAID", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", fineId);
    if (error) throw error;
  },

  waive: async (fineId: string, waivedBy: string, reason: string): Promise<void> => {
    const { error } = await (supabase
      .from("fines" as any) as any)
      .update({
        status:       "WAIVED",
        waived_by:    waivedBy,
        waive_reason: reason,
        updated_at:   new Date().toISOString(),
      })
      .eq("id", fineId);
    if (error) throw error;
  },

  getTotalsForStudent: async (studentId: string): Promise<{ pending: number; total: number }> => {
    const fines = await fineService.getForStudent(studentId);
    const pending = fines
      .filter(f => f.status === "PENDING")
      .reduce((s, f) => s + f.amount, 0);
    const total = fines.reduce((s, f) => s + f.amount, 0);
    return { pending, total };
  },
};
