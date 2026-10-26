# DMU Academic Hub — Implementation & Deployment Guide

## Overview

**DMU Academic Hub** is a role-based academic resource and digital library platform for Debre Markos University. It provides digital materials, library operations, and a research repository. It is not a student information system.

**Build Status**: Complete ✓  
**Framework**: React 18 + TypeScript  
**Backend**: Supabase (PostgreSQL + Auth + Realtime + Storage)  
**Styling**: TailwindCSS + shadcn/ui  

---

## Architecture Overview

### Technology Stack

- **Frontend**: React 18, TypeScript, React Router v6, TanStack Query, Vite
- **Styling**: TailwindCSS, shadcn/ui component library
- **Backend**: Supabase (PostgreSQL database, Auth, Realtime, Storage)
- **State**: TanStack Query (server state), React Context (auth state)
- **Forms**: React Hook Form + Zod schema validation
- **Icons**: Lucide React

### Key Features by Phase

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Authentication (Email/Password, OAuth) | ✓ Complete |
| 3 | Library Management (Books, Borrowing, Returns, Reservations, QR codes) | ✓ Complete |
| 4 | Course Materials (Upload, Publish, Download, Versioning, Visibility) | ✓ Complete |
| 5 | Research Repository (Theses, Papers, Projects, Approval Workflow) | ✓ Complete |
| 6 | Unified Search (Cross-platform search, filters, debounce) | ✓ Complete |
| 7 | Notifications (database-generated alerts, realtime, polling fallback, in-app actions) | ✓ Complete |
| 8 | Analytics (Lecturer & Admin dashboards, platform metrics) | ✓ Complete |

---

## Database Schema

### Migrations

Apply migrations in order:

```bash
# Run in Supabase SQL editor or via CLI
001_rbac_foundation.sql
002_academic_structure.sql  # Read-only academic references
003_library.sql
004_course_materials.sql
005_research_repository.sql
006_saved_resources.sql
007_fix_rls_user_roles_admin.sql
008_fix_materials_rls_and_storage.sql
009_audit_logs.sql
010_read_only_academic_references.sql
011_read_enrolled_course_lecturers.sql
012_csv_academic_record_import.sql
013_simplify_course_catalog_import.sql
014_auto_create_course_references.sql
015_fix_academic_year_import.sql
016_admin_set_student_id.sql
017_bulk_student_id_import.sql
018_working_notifications.sql
019_repair_missing_auth_profiles.sql
020_secure_lecturer_material_uploads.sql
021_fix_material_upload_rls.sql
```

Migration 018 must be applied to the Supabase project for automatic notifications
when course materials are published or updated, books are issued/returned or
become overdue, reservations become ready, and research submissions are reviewed.
It also enables the notifications table in Supabase Realtime and allows users to
delete their own notifications.

Migration 019 restores automatic profile creation for new signups and creates
profiles and default student roles for existing Auth users that are missing them.

Migration 020 restores database-side checks that material uploads come from a
lecturer assigned to the selected course or an academic library administrator.
Migration 021 applies that role-and-assignment check through one security-definer
function to avoid ambiguous role lookup results inside the RLS policy.

### Core Tables

#### Academic References
Colleges, departments, programs, academic years, semesters, courses, enrollments,
and lecturer assignments are references supplied by the university's student
information system. They support course discovery and course-material access checks;
this platform does not provide general SIS management screens. Authorized platform
administrators can use the CSV importer to load or update these records when a direct
university integration is unavailable.

### CSV course data import

After applying migrations `012_csv_academic_record_import.sql`,
`013_simplify_course_catalog_import.sql`, and
`014_auto_create_course_references.sql`, and
`015_fix_academic_year_import.sql`, an
`ACADEMIC_LIBRARY_ADMIN` can open **Admin → Import Course Data**. Download the
template for each data set, populate it with official university records, review the
preview, and explicitly start the import. The endpoint validates account roles and
course references and processes each upload atomically (all rows succeed or none do).
Files are limited to 5,000 data rows.

- **Course catalog:** requires only `course_code`, `course_name`, `college_name`,
  `department_name`, `academic_year`, and `semester_number`. The importer creates
  missing college, department, academic-year, and semester references. Newly created
  academic years use September 1 through June 30 for consecutive `YYYY/YYYY` years.
  Credit hours and year level default to 3 and 1.
- **Student enrollments:** requires course code, academic year, semester number, and
  an existing student's email. Status is optional and defaults to `ACTIVE`; allowed
  values are `ACTIVE`, `DROPPED`, and `COMPLETED`.
- **Lecturer assignments:** requires course code, academic year, semester number,
  and an existing lecturer's email. `action` defaults to `ASSIGN`; use `UNASSIGN`
  to remove a specific assignment. `is_primary` defaults to `true`.

Imports upsert submitted data; omitted rows are not deleted. Enrollment and lecturer
rows require existing active platform accounts with the matching role. Imports are
recorded in the audit log. Students and lecturers do not assign or self-enroll in
courses; authorized university staff provide those records via the controlled CSV
workflow.

Administrators can load student IDs in bulk from **Admin → Import Course Data →
Student accounts & IDs**. Download the two-column template
(`student_email,student_id`) and enter one
row per student. The email must match exactly one existing account with the STUDENT
role. This import does not create accounts or change roles, and all rows are applied
atomically. Student IDs must be unique. Apply migration
`017_bulk_student_id_import.sql` to enable this import; it removes the earlier
per-user student-ID endpoint.

#### Library
- `books` (ISBN, publisher, category)
- `book_copies` (instance tracking)
- `borrowings` (checkout/checkin events)
- `book_reservations` (waitlist)
- `book_categories`

#### Materials
- `course_materials` (per course, visibility-gated)
- `material_versions` (versioning)

#### Research
- `research_resources` (theses, papers, projects)
- `research_authors` (multi-author support)
- `research_keywords` (full-text search)

#### System
- `notifications` (user alerts, realtime subscriptions)
- `saved_resources` (user bookmarks)

---

## Authentication & Authorization

### Roles

| Role | Access |
|------|--------|
| STUDENT | Course materials available through reference enrollment data, library, research repository |
| LECTURER | Material upload/publish, research submission, analytics |
| LIBRARIAN | Book management, borrowing/return ops, QR scanning, reports |
| ACADEMIC_LIBRARY_ADMIN | Platform administration, library oversight, and research/material approvals |

### RLS Policies

All tables use PostgreSQL Row-Level Security:

- **Students** see only materials for courses they're enrolled in
- **Lecturers** manage only their own courses and materials
- **Librarians** see all books and borrowing records
- **Admins** see everything

Helper functions:
- `get_user_role(uid)` — resolve user role from `profiles` table
- `is_enrolled_in_course(uid, course_id)` — check student enrollment
- `is_assigned_to_course(uid, course_id)` — check lecturer assignment

---

## File Structure

```
src/
├── components/
│   ├── common/              # Reusable components (guards, badges, etc.)
│   ├── layout/              # AppShell, Sidebar, Topbar, MobileNav
│   └── ui/                  # shadcn/ui primitives
├── features/
│   └── auth/                # AuthContext, session management
├── hooks/
│   ├── useAuth.ts
│   ├── useRole.ts
│   ├── usePermissions.ts
│   └── use-toast.ts
├── lib/
│   ├── supabase/            # Supabase client initialization
│   ├── navigation/          # Route configuration
│   └── utils.ts             # Helper functions
├── pages/
│   ├── admin/               # Admin dashboards & management
│   ├── lecturer/            # Lecturer pages
│   ├── librarian/           # Librarian management pages
│   ├── student/             # Student pages
│   ├── shared/              # Cross-role pages (research, notifications)
│   ├── auth/                # Login, register, password reset
│   └── errors/              # 404, 403, 401, error boundary
├── routes/
│   ├── index.tsx            # Route configuration
│   ├── ProtectedRoute.tsx   # Auth guard
│   └── RoleGuard.tsx        # Role-based access
├── services/
│   ├── academicService.ts   # Read-only academic references
│   ├── libraryService.ts    # Books, borrowing, stats
│   ├── materialService.ts   # Materials CRUD, upload
│   ├── researchService.ts   # Research CRUD, approval
│   ├── searchService.ts     # Cross-platform search
│   └── notificationService.ts # Notifications, realtime
├── types/
│   ├── auth.types.ts
│   ├── roles.types.ts
│   ├── academic.types.ts
│   ├── library.types.ts
│   ├── material.types.ts
│   ├── research.types.ts
│   └── database.types.ts
├── main.tsx
├── App.tsx
└── index.css
```

---

## Deployment Checklist

### 1. Environment Setup

Create `.env.production` with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Database

1. Create a new Supabase project
2. Run the migrations in `supabase/migrations` in numeric order (SQL editor)
3. Verify RLS policies are active
4. Create storage buckets:
   - `course-materials` (PRIVATE)
   - `research-resources` (PRIVATE)

### 3. Storage Policies

Bucket policies are defined in migrations. Verify:

```sql
-- Materials bucket — only authenticated users can list/read their own
select * from storage.objects where bucket_id = 'course-materials';

-- Research bucket — only authenticated can read signed URLs
select * from storage.objects where bucket_id = 'research-resources';
```

### 4. Build & Deploy

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Preview build locally
npm run preview

# Deploy to Vercel / Netlify
vercel deploy
# or
netlify deploy --prod --dir dist
```

### 5. DNS & Custom Domain

Point your domain to your hosting provider's nameservers or CNAME.

---

## Key Service APIs

### Authentication Service (`useAuth`)

```typescript
const { profile, signOut, signIn, signUp } = useAuth();
```

### Material Service

```typescript
materialService.list(filters)
materialService.get(id)
materialService.upload(payload, uploadedBy)
materialService.publish(id)
materialService.unpublish(id)
materialService.delete(id)
materialService.getDownloadUrl(storagePath)
materialService.recordDownload(id)
```

### Research Service

```typescript
researchService.list(filters)
researchService.get(id)
researchService.submit(payload, submittedBy)
researchService.approve(id, approvedBy)
researchService.reject(id, reason)
researchService.updateVisibility(id, visibility)
researchService.delete(id)
```

### Notification Service

```typescript
notificationService.list(userId, unreadOnly?)
notificationService.getUnreadCount(userId)
notificationService.markRead(id)
notificationService.markAllRead(userId)
notificationService.delete(id)
notificationService.subscribe(userId, callback) // realtime
```

### Search Service

```typescript
searchService.search(query, category?, limit?)
// Categories: "ALL", "BOOKS", "MATERIALS", "RESEARCH"
```

---

## Common Workflows

### As a Student

1. **Login** → `/login`
2. **Borrow Books** → `/library` → click book → "Request" or "Borrow"
3. **View Enrolled Courses** → `/courses` (read-only SIS reference)
4. **Access Course Materials** → select a course and open its materials
5. **Browse Research** → `/research` (filtered to APPROVED, student-visible)
6. **Search Everything** → `/search` (unified search)
7. **Check Notifications** → Bell icon in Topbar

### As a Lecturer

1. **Login** → `/login` (LECTURER role)
2. **View Assigned Courses** → `/lecturer/courses` (read-only SIS reference)
3. **Upload Materials** → choose an assigned course at `/lecturer/materials/upload`
4. **Publish/Unpublish** → `/lecturer/materials` (per-material toggles)
5. **View Analytics** → `/lecturer/analytics` (views, downloads by material)
6. **Submit Research** → `/research/submit`
7. **Manage Submissions** → `/research` (list + submit button)

### As a Librarian

1. **Login** → `/login` (LIBRARIAN role)
2. **Manage Books** → `/librarian/books` (CRUD)
3. **Scan QR Codes** → `/librarian/qr` (borrowing/returns)
4. **Manage Borrowings** → `/librarian/borrowings`
5. **Process Returns** → `/librarian/returns`
6. **Handle Overdues** → `/librarian/overdue` (reminders, fines)
7. **Generate Reports** → `/librarian/reports`

### As an Admin

1. **Login** → `/login` (ACADEMIC_LIBRARY_ADMIN role)
2. **Manage Users** → `/admin/users`
3. **Approve Research** → `/admin/research` (approve/reject/visibility)
4. **Approve Materials** → `/admin/materials`
5. **View Analytics** → `/admin/analytics` (platform metrics)

---

## Realtime Features

### Notifications

Real-time push of new notifications to a user's notification bell:

```typescript
// In Topbar.tsx
useEffect(() => {
  const unsubscribe = notificationService.subscribe(userId, (newNotif) => {
    queryClient.invalidateQueries(['notification-count']);
  });
  return unsubscribe;
}, [userId]);
```

### Subscription Model

All realtime subscriptions use Supabase `postgres_changes` channel:

```typescript
channel = supabase
  .channel(`notifications:${userId}`)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, callback)
  .subscribe();
```

---

## Testing Checklist

### Before Going Live

- [ ] All migrations run without error
- [ ] Auth: signup → verification email → login works
- [ ] Student: can access materials only for courses with an active enrollment
- [ ] Lecturer: can upload and publish materials
- [ ] Librarian: can scan QR codes and process borrowings
- [ ] Admin: can approve research submissions
- [ ] Notifications: bell badge updates in real-time
- [ ] Search: cross-platform search returns correct results
- [ ] Analytics: dashboards load and display accurate counts
- [ ] Download/Upload: file operations complete successfully
- [ ] RLS: users cannot access data outside their scope

### Load Testing

- Test with realistic data volume (10k+ books, 1k+ users)
- Verify query performance (add indexes for frequently filtered columns)
- Monitor realtime subscription count (max ~100 concurrent per user)

---

## Troubleshooting

### Issue: "User not found" after signup

**Solution**: Check email verification is completed. Supabase sends an email link that must be clicked. For local dev, check the Supabase email logs.

### Issue: Materials not showing for students

**Solution**: Verify:
1. Material is PUBLISHED (not DRAFT)
2. Student is enrolled in the course
3. Material visibility is not PRIVATE

### Issue: Notifications not appearing

**Solution**:
1. Confirm `notifications` table has a row for the user
2. Check realtime subscriptions are active in Supabase dashboard
3. Verify user is authenticated

### Issue: File uploads fail

**Solution**:
1. Check storage bucket exists and is PRIVATE
2. Verify RLS policies allow authenticated users
3. Confirm file size is under 100 MB
4. Check browser console for CORS errors

---

## Performance Optimization

### Already Implemented

- **TanStack Query**: server-state caching, stale-time, gc-time
- **Code splitting**: lazy-loaded pages via React Router
- **Image optimization**: Avatar components use Supabase storage
- **Search debounce**: 350ms debounce prevents excessive queries
- **Pagination**: all list endpoints support limit/offset
- **Indexes**: migration files define indexes for common filters

### Recommendations

1. **Add pagination UI** to all lists (currently load all)
2. **Cache search results** locally (localStorage or IndexedDB)
3. **Lazy load analytics** charts (defer until tab is visible)
4. **Compress PDFs** on upload (server-side via edge function)
5. **CDN for storage**: route `research-resources` and `course-materials` through Cloudflare

---

## Support & Contribution

- **Bugs**: Report in issue tracker with steps to reproduce
- **Features**: Discuss in discussions before opening PR
- **Style Guide**: Follow existing component patterns (shadcn/ui + TailwindCSS)
- **Testing**: Ensure all new pages pass the "Testing Checklist" above

---

## License

DMU Academic Hub © 2024. All rights reserved.
