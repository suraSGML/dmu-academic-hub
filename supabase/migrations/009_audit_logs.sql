-- ──────────────────────────────────────────────────────────────────────────────
-- Migration 009: System Settings + Fines
-- NOTE: audit_logs already exists from migration 001 (skip re-creating it).
-- This migration only adds system_settings and fines tables.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── System Settings table ─────────────────────────────────────────────────────
-- Stores key-value platform configuration managed by admins.
CREATE TABLE IF NOT EXISTS public.system_settings (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  label       text NOT NULL,
  description text,
  category    text NOT NULL DEFAULT 'general',
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL
);

-- Seed default settings (no-op if already present)
INSERT INTO public.system_settings (key, value, label, description, category) VALUES
  ('borrowing_limit',            '5',    'Borrowing Limit',           'Maximum number of books a student can borrow at once',                  'library'),
  ('borrowing_duration_days',    '14',   'Default Borrowing Period',  'Default number of days a book is lent out',                            'library'),
  ('max_renewals',               '2',    'Maximum Renewals',          'Maximum number of times a borrowing can be renewed',                   'library'),
  ('fine_rate_per_day',          '5',    'Fine Rate (per day)',        'Fine amount in ETB per day for overdue books',                         'library'),
  ('reservation_expiry_days',    '7',    'Reservation Expiry',        'Days before an uncollected reservation expires',                       'library'),
  ('max_upload_size_mb',         '100',  'Max Upload Size (MB)',       'Maximum file size for material uploads in megabytes',                  'materials'),
  ('allowed_file_types',         'pdf,doc,docx,ppt,pptx,xls,xlsx,zip,jpg,png', 'Allowed File Types', 'Comma-separated list of allowed file extensions', 'materials'),
  ('research_approval_required', 'true', 'Research Approval Required','Whether research submissions require admin approval before publication','research'),
  ('platform_name',              'DMU Academic Hub',        'Platform Name',      'Display name of the platform',                 'general'),
  ('institution_name',           'Debre Markos University', 'Institution Name',   'Full name of the institution',                 'general'),
  ('academic_year',              '2024/2025',               'Current Academic Year','The currently active academic year',         'academic')
ON CONFLICT (key) DO NOTHING;

-- RLS for system_settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can READ settings
DROP POLICY IF EXISTS "system_settings_read_authenticated" ON public.system_settings;
CREATE POLICY "system_settings_read_authenticated" ON public.system_settings
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can UPDATE settings
DROP POLICY IF EXISTS "system_settings_update_admin" ON public.system_settings;
CREATE POLICY "system_settings_update_admin" ON public.system_settings
  FOR UPDATE USING (
    public.get_user_role(auth.uid()) = 'ACADEMIC_LIBRARY_ADMIN'
  );

-- ── Fines table ───────────────────────────────────────────────────────────────
-- Tracks per-borrowing fine amounts and payment status.
CREATE TABLE IF NOT EXISTS public.fines (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  borrowing_id uuid NOT NULL REFERENCES public.borrowings(id) ON DELETE CASCADE,
  student_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount       numeric(10,2) NOT NULL DEFAULT 0,
  days_overdue integer NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'WAIVED')),
  waived_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  waive_reason text,
  paid_at      timestamptz,
  created_at   timestamptz DEFAULT now() NOT NULL,
  updated_at   timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fines_student_id   ON public.fines (student_id);
CREATE INDEX IF NOT EXISTS idx_fines_borrowing_id ON public.fines (borrowing_id);
CREATE INDEX IF NOT EXISTS idx_fines_status       ON public.fines (status);

ALTER TABLE public.fines ENABLE ROW LEVEL SECURITY;

-- Students see their own fines
DROP POLICY IF EXISTS "fines_student_read_own" ON public.fines;
CREATE POLICY "fines_student_read_own" ON public.fines
  FOR SELECT USING (student_id = auth.uid());

-- Librarians and admins see all fines
DROP POLICY IF EXISTS "fines_librarian_read_all" ON public.fines;
CREATE POLICY "fines_librarian_read_all" ON public.fines
  FOR SELECT USING (
    public.get_user_role(auth.uid()) IN ('LIBRARIAN', 'ACADEMIC_LIBRARY_ADMIN')
  );

-- Librarians/admins can insert and update (waive/mark paid)
DROP POLICY IF EXISTS "fines_librarian_insert" ON public.fines;
CREATE POLICY "fines_librarian_insert" ON public.fines
  FOR INSERT WITH CHECK (
    public.get_user_role(auth.uid()) IN ('LIBRARIAN', 'ACADEMIC_LIBRARY_ADMIN')
  );

DROP POLICY IF EXISTS "fines_librarian_update" ON public.fines;
CREATE POLICY "fines_librarian_update" ON public.fines
  FOR UPDATE USING (
    public.get_user_role(auth.uid()) IN ('LIBRARIAN', 'ACADEMIC_LIBRARY_ADMIN')
  );

-- ── Audit log RLS additions ───────────────────────────────────────────────────
-- audit_logs table already exists. Add/replace policies using get_user_role().

-- Only admins can read audit logs
DROP POLICY IF EXISTS "audit_logs_read_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_read_admin" ON public.audit_logs
  FOR SELECT USING (
    public.get_user_role(auth.uid()) = 'ACADEMIC_LIBRARY_ADMIN'
  );

-- Any authenticated user can insert audit events
DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
