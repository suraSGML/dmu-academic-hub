import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { RoleGuard } from "./RoleGuard";

// Auth pages
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";

// Error pages
import { NotFoundPage } from "@/pages/errors/NotFoundPage";
import { ForbiddenPage } from "@/pages/errors/ForbiddenPage";
import { UnauthorizedPage } from "@/pages/errors/UnauthorizedPage";
import { ErrorPage } from "@/pages/errors/ErrorPage";

// Layout
import { AppShell } from "@/components/layout/AppShell";

// Student pages
import { StudentDashboard } from "@/pages/student/StudentDashboard";
import { LibraryPage } from "@/pages/student/LibraryPage";
import { BookDetailPage } from "@/pages/student/BookDetailPage";
import { BorrowedBooksPage } from "@/pages/student/BorrowedBooksPage";
import { ReservationsPage } from "@/pages/student/ReservationsPage";
import { SavedResourcesPage } from "@/pages/student/SavedResourcesPage";
import { SearchPage } from "@/pages/student/SearchPage";
import { StudentFinesPage } from "@/pages/student/StudentFinesPage";
import { StudentCourseMaterialsPage } from "@/pages/student/StudentCourseMaterialsPage";
import { StudentCoursesPage } from "@/pages/student/StudentCoursesPage";
import { StudentCourseDetailPage } from "@/pages/student/StudentCourseDetailPage";

// Shared content pages (accessible to all authenticated roles)
import { ResearchRepositoryPage } from "@/pages/shared/ResearchRepositoryPage";
import { ResearchDetailPage } from "@/pages/shared/ResearchDetailPage";
import { SubmitResearchPage } from "@/pages/shared/SubmitResearchPage";
import { ProfilePage } from "@/pages/shared/ProfilePage";
import { SettingsPage } from "@/pages/shared/SettingsPage";
import { NotificationsPage } from "@/pages/shared/NotificationsPage";

// Lecturer pages
import { LecturerDashboard } from "@/pages/lecturer/LecturerDashboard";
import { LecturerMaterialsPage } from "@/pages/lecturer/LecturerMaterialsPage";
import { UploadMaterialPage } from "@/pages/lecturer/UploadMaterialPage";
import { LecturerAnalyticsPage } from "@/pages/lecturer/LecturerAnalyticsPage";
import { MaterialEditPage } from "@/pages/lecturer/MaterialEditPage";
import { LecturerCoursesPage } from "@/pages/lecturer/LecturerCoursesPage";
import { LecturerCourseDetailPage } from "@/pages/lecturer/LecturerCourseDetailPage";

// Librarian pages
import { LibrarianDashboard } from "@/pages/librarian/LibrarianDashboard";
import { BookManagementPage } from "@/pages/librarian/BookManagementPage";
import { AddBookPage } from "@/pages/librarian/AddBookPage";
import { LibrarianBookDetailPage } from "@/pages/librarian/LibrarianBookDetailPage";
import { BookCopyManagementPage } from "@/pages/librarian/BookCopyManagementPage";
import { BorrowingManagementPage } from "@/pages/librarian/BorrowingManagementPage";
import { ReturnManagementPage } from "@/pages/librarian/ReturnManagementPage";
import { ReservationManagementPage } from "@/pages/librarian/ReservationManagementPage";
import { OverdueManagementPage } from "@/pages/librarian/OverdueManagementPage";
import { QRScannerPage } from "@/pages/librarian/QRScannerPage";
import { LibraryReportsPage } from "@/pages/librarian/LibraryReportsPage";
import { FineManagementPage } from "@/pages/librarian/FineManagementPage";

// Admin pages
import { AdminDashboard } from "@/pages/admin/AdminDashboard";
import { UserManagementPage } from "@/pages/admin/UserManagementPage";
import { AdminMaterialsPage } from "@/pages/admin/AdminMaterialsPage";
import { AdminResearchPage } from "@/pages/admin/AdminResearchPage";
import { AdminLibraryPage } from "@/pages/admin/AdminLibraryPage";
import { AdminAnalyticsPage } from "@/pages/admin/AdminAnalyticsPage";
import { AuditLogsPage } from "@/pages/admin/AuditLogsPage";
import { SystemSettingsPage } from "@/pages/admin/SystemSettingsPage";
import { AcademicDataImportPage } from "@/pages/admin/AcademicDataImportPage";

export const router = createBrowserRouter([
  // ─── Public Routes ────────────────────────────────────────────────────
  { path: "/login",           element: <LoginPage /> },
  { path: "/register",        element: <RegisterPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password",  element: <ResetPasswordPage /> },

  // ─── Error Routes ─────────────────────────────────────────────────────
  { path: "/unauthorized", element: <UnauthorizedPage /> },
  { path: "/forbidden",    element: <ForbiddenPage /> },
  { path: "/404",          element: <NotFoundPage /> },
  { path: "*",             element: <NotFoundPage /> },

  // ─── All Authenticated Routes ──────────────────────────────────────────
  {
    element: <ProtectedRoute />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <AppShell />,
        children: [
          // ── Shared (all authenticated roles) ───────────────────────
          { path: "/profile",       element: <ProfilePage /> },
          { path: "/settings",      element: <SettingsPage /> },
          { path: "/notifications", element: <NotificationsPage /> },
          { path: "/search",        element: <SearchPage /> },

          // Research repository & detail — viewable by all authenticated roles
          { path: "/research",         element: <ResearchRepositoryPage /> },
          { path: "/research/:id",     element: <ResearchDetailPage /> },

          // Research submission — only lecturers and admins can publish research
          {
            element: <RoleGuard allowedRoles={["LECTURER", "ACADEMIC_LIBRARY_ADMIN"]} />,
            children: [
              { path: "/research/submit", element: <SubmitResearchPage /> },
            ],
          },

          // ── Student Routes ─────────────────────────────────────────
          {
            element: <RoleGuard allowedRoles={["STUDENT"]} />,
            children: [
              { path: "/dashboard",            element: <StudentDashboard /> },
              { path: "/courses",              element: <StudentCoursesPage /> },
              { path: "/courses/:id",          element: <StudentCourseDetailPage /> },
              { path: "/library",              element: <LibraryPage /> },
              { path: "/library/books/:id",    element: <BookDetailPage /> },
              { path: "/library/borrowed",     element: <BorrowedBooksPage /> },
              { path: "/library/reservations", element: <ReservationsPage /> },
              { path: "/library/fines",        element: <StudentFinesPage /> },
              { path: "/saved",                element: <SavedResourcesPage /> },
              { path: "/materials/courses/:id", element: <StudentCourseMaterialsPage /> },
            ],
          },

          // ── Lecturer Routes ────────────────────────────────────────
          {
            element: <RoleGuard allowedRoles={["LECTURER"]} />,
            children: [
              { path: "/lecturer/dashboard",           element: <LecturerDashboard /> },
              { path: "/lecturer/courses",             element: <LecturerCoursesPage /> },
              { path: "/lecturer/courses/:id",         element: <LecturerCourseDetailPage /> },
              { path: "/lecturer/materials",           element: <LecturerMaterialsPage /> },
              { path: "/lecturer/materials/upload",    element: <UploadMaterialPage /> },
              { path: "/lecturer/materials/:id/edit",  element: <MaterialEditPage /> },
              { path: "/lecturer/analytics",           element: <LecturerAnalyticsPage /> },
            ],
          },

          // ── Librarian Routes ───────────────────────────────────────
          {
            element: <RoleGuard allowedRoles={["LIBRARIAN", "ACADEMIC_LIBRARY_ADMIN"]} />,
            children: [
              { path: "/librarian/dashboard",    element: <LibrarianDashboard /> },
              { path: "/librarian/books",        element: <BookManagementPage /> },
              { path: "/librarian/books/new",    element: <AddBookPage /> },
              { path: "/librarian/books/:id",    element: <LibrarianBookDetailPage /> },
              { path: "/librarian/copies",       element: <BookCopyManagementPage /> },
              { path: "/librarian/borrowings",   element: <BorrowingManagementPage /> },
              { path: "/librarian/returns",      element: <ReturnManagementPage /> },
              { path: "/librarian/reservations", element: <ReservationManagementPage /> },
              { path: "/librarian/overdue",      element: <OverdueManagementPage /> },
              { path: "/librarian/fines",        element: <FineManagementPage /> },
              { path: "/librarian/qr",           element: <QRScannerPage /> },
              { path: "/librarian/reports",      element: <LibraryReportsPage /> },
            ],
          },

          // ── Admin Routes ───────────────────────────────────────────
          {
            element: <RoleGuard allowedRoles={["ACADEMIC_LIBRARY_ADMIN"]} />,
            children: [
              { path: "/admin/dashboard",  element: <AdminDashboard /> },
              { path: "/admin/users",      element: <UserManagementPage /> },
              { path: "/admin/academic-import", element: <AcademicDataImportPage /> },
              { path: "/admin/materials",  element: <AdminMaterialsPage /> },
              { path: "/admin/research",   element: <AdminResearchPage /> },
              { path: "/admin/library",    element: <AdminLibraryPage /> },
              { path: "/admin/library/books/new", element: <AddBookPage /> },
              { path: "/admin/library/books/:id", element: <LibrarianBookDetailPage /> },
              { path: "/admin/library/books", element: <BookManagementPage /> },
              { path: "/admin/library/copies", element: <BookCopyManagementPage /> },
              { path: "/admin/library/borrowings", element: <BorrowingManagementPage /> },
              { path: "/admin/library/returns", element: <ReturnManagementPage /> },
              { path: "/admin/library/reservations", element: <ReservationManagementPage /> },
              { path: "/admin/library/overdue", element: <OverdueManagementPage /> },
              { path: "/admin/library/fines", element: <FineManagementPage /> },
              { path: "/admin/library/qr", element: <QRScannerPage /> },
              { path: "/admin/library/reports", element: <LibraryReportsPage /> },
              { path: "/admin/analytics",  element: <AdminAnalyticsPage /> },
              { path: "/admin/audit-logs", element: <AuditLogsPage /> },
              { path: "/admin/settings",   element: <SystemSettingsPage /> },
            ],
          },
        ],
      },
    ],
  },

  // Root redirect
  { path: "/", element: <Navigate to="/login" replace /> },
]);
