# DMU Academic Hub

**Formal Title:** Design and Development of a Smart Academic Resource and Digital Library Management System for Debre Markos University

A production-quality, university-wide academic resource and digital library management platform for Debre Markos University (DMU), Ethiopia.

---

## Project Purpose

DMU Academic Hub centralises all academic resources at Debre Markos University into a single, secure, role-aware platform covering:

- Physical library management (books, copies, borrowing, returns, reservations, QR)
- Digital course materials (lecture notes, presentations, handouts, assignments)
- Research repository (theses, graduation projects, research papers)
- Read-only academic references used to organize course materials and research
- Admin-only CSV import for university course catalogs, enrollments, and lecturer assignments when SIS integration is unavailable
- Unified academic search
- In-app notifications
- Role-based access control at every layer

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS v3, shadcn/ui |
| State / Data | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Routing | React Router v6 |
| Icons | Lucide React |
| Backend | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Authorization | Supabase Auth + PostgreSQL RLS + application permission checks |
| Deployment | Vercel (frontend) + Supabase (backend) |

---

## RBAC Authorization Model

```
AUTHENTICATION
      ↓
USER ROLE
      ↓
PERMISSION
      ↓
ACADEMIC RELATIONSHIP (enrollment / assignment)
      ↓
RESOURCE VISIBILITY
      ↓
DATABASE RLS POLICY
      ↓
ALLOW OR DENY
```

### Roles

| Role | Display Name |
|---|---|
| `STUDENT` | Student |
| `LECTURER` | Lecturer |
| `LIBRARIAN` | Librarian |
| `ACADEMIC_LIBRARY_ADMIN` | Academic Resource & Library Administrator |

Frontend guards (`PermissionGuard`, `RoleGuard`, `ProtectedRoute`) are **UX layer only**. Real security is enforced by PostgreSQL RLS policies and Supabase Storage policies.

---

## Project Structure

```
src/
├── components/
│   ├── ui/           # shadcn/ui components
│   ├── layout/       # AppShell, Sidebar, Topbar, MobileNav
│   └── common/       # EmptyState, ErrorState, LoadingSkeleton,
│                     # StatusBadge, ConfirmDialog, PermissionGuard,
│                     # RoleGuard, UserAvatar
├── features/
│   └── auth/         # AuthContext, AuthProvider
├── hooks/
│   ├── useAuth.ts
│   ├── useRole.ts
│   ├── usePermissions.ts
│   └── use-toast.ts
├── lib/
│   ├── supabase/     # Typed Supabase client
│   ├── navigation/   # Role-aware navigation config
│   └── utils.ts
├── pages/
│   ├── auth/         # Login, Register, ForgotPassword, ResetPassword
│   ├── student/      # Student-facing pages
│   ├── lecturer/     # Lecturer-facing pages
│   ├── librarian/    # Librarian-facing pages
│   ├── admin/        # Admin-facing pages
│   ├── shared/       # Profile, Settings, Notifications
│   └── errors/       # 401, 403, 404, 500
├── routes/
│   ├── index.tsx       # createBrowserRouter config
│   ├── ProtectedRoute.tsx
│   └── RoleGuard.tsx
├── schemas/
│   └── auth.schemas.ts  # Zod validation schemas
├── types/
│   ├── auth.types.ts
│   ├── roles.types.ts   # AppRole, Permission, ROLE_PERMISSIONS
│   ├── profile.types.ts
│   ├── database.types.ts
│   └── index.ts
supabase/
└── migrations/   # Ordered database migrations
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase project values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

**Never commit `.env` to version control.** The `.gitignore` already excludes it.

---

## Supabase Setup

### 1. Create Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Name: `dmu-academic-hub`, Region: EU West (closest to Ethiopia)
3. Copy **Project URL** and **anon public key** from Settings → API

### 2. Run Database Migration

1. Open the Supabase **SQL Editor**
2. Run all SQL files in `supabase/migrations` in numeric order
3. Migration 010 restricts academic records to read-only reference access
4. Apply migration 018 to enable notification delivery, realtime updates, and user notification actions

### Disable email confirmation

The local Supabase configuration in `supabase/config.toml` disables email
confirmation for local development. To disable it for the hosted project, open
Supabase Dashboard → **Authentication** → **Providers** → **Email** and turn
off **Confirm email**. This is a Supabase Auth setting and cannot be changed by
the frontend or a database migration. New accounts can then sign in without
clicking an email link.

### 3. Configure Storage Buckets

Create four **private** buckets in Storage:

| Bucket | Purpose |
|---|---|
| `avatars` | User profile photos |
| `course-materials` | Restricted course material files |
| `research-resources` | Research paper files |
| `book-covers` | Library book cover images |

All buckets must be **private** (not public). Course materials and research files are served via signed URLs only.

### 4. Configure Auth

- Go to Authentication → Providers → Email
- For development: disable "Confirm email" to simplify manual user creation
- For production: enable email confirmation

### 5. Create Test Users

Create one user per role via Authentication → Users → Add User:

| Role | Suggested email |
|---|---|
| Student | student@dmu.edu.et |
| Lecturer | lecturer@dmu.edu.et |
| Librarian | librarian@dmu.edu.et |
| Admin | admin@dmu.edu.et |

After creating each user, update their role in the `user_roles` table:

```sql
-- Example: set a user as LECTURER
UPDATE public.user_roles
SET role_id = (SELECT id FROM public.roles WHERE name = 'LECTURER')
WHERE user_id = '<paste-user-uuid-here>';
```

---

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Type check
npx tsc --noEmit

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Implementation Phases

| Phase | Status | Description |
|---|---|---|
| Phase 1 | ✅ Complete | Foundation, RBAC, Auth, App Shell |
| Phase 2 | 🔲 Pending | University academic structure |
| Phase 3 | 🔲 Pending | Physical library system |
| Phase 4 | 🔲 Pending | Digital course materials |
| Phase 5 | 🔲 Pending | Research repository |
| Phase 6 | 🔲 Pending | Unified search |
| Phase 7 | 🔲 Pending | Notifications |
| Phase 8 | 🔲 Pending | Analytics |
| Phase 9 | 🔲 Pending | Advanced features |
| Phase 10 | 🔲 Pending | QA, security audit, deployment |

---

## Security Notes

- RLS is enabled on all tables — no broad `authenticated can read everything` policies
- Course materials use private Storage buckets with signed URLs
- Frontend guards are UX convenience only; database policies are the real boundary
- The Supabase service role key is never exposed to the frontend
- All file uploads are validated for type, MIME, and size before storage
- Audit logs track all significant platform actions
- IDOR is prevented: all resource access is verified through DB relationships, not just IDs

---

## License

Built as a university graduation project for Debre Markos University.
