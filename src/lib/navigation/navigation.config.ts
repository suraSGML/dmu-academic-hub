import {
  LayoutDashboard,
  Library,
  BookOpen,
  FlaskConical,
  Search,
  Bookmark,
  Bell,
  User,
  FileText,
  BarChart3,
  BookMarked,
  Copy,
  ArrowLeftRight,
  ArrowDownToLine,
  CalendarClock,
  QrCode,
  FileBarChart,
  Users,
  FolderOpen,
  ScrollText,
  Settings,
  ShieldCheck,
  DollarSign,
  Upload,
} from "lucide-react";
import type { AppRole } from "@/types/roles.types";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAVIGATION_CONFIG: Record<AppRole, NavGroup[]> = {
  STUDENT: [
    {
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "My Courses", href: "/courses", icon: BookOpen },
        { label: "Library", href: "/library", icon: Library },
        { label: "Research", href: "/research", icon: FlaskConical },
        { label: "Search", href: "/search", icon: Search },
      ],
    },
    {
      label: "My Space",
      items: [
        { label: "Saved Resources", href: "/saved", icon: Bookmark },
        { label: "My Fines", href: "/library/fines", icon: DollarSign },
        { label: "Notifications", href: "/notifications", icon: Bell },
        { label: "Profile", href: "/profile", icon: User },
      ],
    },
  ],

  LECTURER: [
    {
      items: [
        { label: "Dashboard", href: "/lecturer/dashboard", icon: LayoutDashboard },
        { label: "My Courses", href: "/lecturer/courses", icon: BookOpen },
        { label: "Materials", href: "/lecturer/materials", icon: FileText },
        { label: "Analytics", href: "/lecturer/analytics", icon: BarChart3 },
      ],
    },
    {
      label: "Discover",
      items: [
        { label: "Research", href: "/research", icon: FlaskConical },
        { label: "Search", href: "/search", icon: Search },
        { label: "Profile", href: "/profile", icon: User },
      ],
    },
  ],

  LIBRARIAN: [
    {
      items: [
        { label: "Dashboard", href: "/librarian/dashboard", icon: LayoutDashboard },
      ],
    },
    {
      label: "Collection",
      items: [
        { label: "Books", href: "/librarian/books", icon: BookMarked },
        { label: "Book Copies", href: "/librarian/copies", icon: Copy },
      ],
    },
    {
      label: "Circulation",
      items: [
        { label: "Borrowings", href: "/librarian/borrowings", icon: ArrowLeftRight },
        { label: "Returns", href: "/librarian/returns", icon: ArrowDownToLine },
        { label: "Reservations", href: "/librarian/reservations", icon: BookOpen },
        { label: "Overdue", href: "/librarian/overdue", icon: CalendarClock },
        { label: "Fines", href: "/librarian/fines", icon: DollarSign },
      ],
    },
    {
      label: "Tools",
      items: [
        { label: "QR Scanner", href: "/librarian/qr", icon: QrCode },
        { label: "Reports", href: "/librarian/reports", icon: FileBarChart },
        { label: "Profile", href: "/profile", icon: User },
      ],
    },
  ],

  ACADEMIC_LIBRARY_ADMIN: [
    {
      items: [
        { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
      ],
    },
    {
      label: "Content",
      items: [
        { label: "Materials", href: "/admin/materials", icon: FileText },
        { label: "Research", href: "/admin/research", icon: FlaskConical },
      ],
    },
    {
      label: "Library",
      items: [
        { label: "Library Mgmt", href: "/admin/library", icon: Library },
      ],
    },
    {
      label: "Administration",
      items: [
        { label: "Users", href: "/admin/users", icon: Users },
        { label: "Import Course Data", href: "/admin/academic-import", icon: Upload },
        { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
        { label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
        { label: "Settings", href: "/admin/settings", icon: Settings },
      ],
    },
    {
      label: "Account",
      items: [
        { label: "Profile", href: "/profile", icon: User },
      ],
    },
  ],
};

// Default redirect per role after login
export const ROLE_DEFAULT_ROUTES: Record<AppRole, string> = {
  STUDENT: "/dashboard",
  LECTURER: "/lecturer/dashboard",
  LIBRARIAN: "/librarian/dashboard",
  ACADEMIC_LIBRARY_ADMIN: "/admin/dashboard",
};

// Which roles can access a given route prefix
export const ROUTE_ROLE_MAP: Record<string, AppRole[]> = {
  "/dashboard": ["STUDENT"],
  "/lecturer": ["LECTURER"],
  "/courses": ["STUDENT"],
  "/library": ["STUDENT", "LECTURER", "LIBRARIAN", "ACADEMIC_LIBRARY_ADMIN"],
  "/research": ["STUDENT", "LECTURER", "LIBRARIAN", "ACADEMIC_LIBRARY_ADMIN"],
  "/search": ["STUDENT", "LECTURER", "LIBRARIAN", "ACADEMIC_LIBRARY_ADMIN"],
  "/saved": ["STUDENT"],
  "/notifications": ["STUDENT", "LECTURER", "LIBRARIAN", "ACADEMIC_LIBRARY_ADMIN"],
  "/profile": ["STUDENT", "LECTURER", "LIBRARIAN", "ACADEMIC_LIBRARY_ADMIN"],
  "/settings": ["STUDENT", "LECTURER", "LIBRARIAN", "ACADEMIC_LIBRARY_ADMIN"],
  "/librarian": ["LIBRARIAN"],
  "/admin": ["ACADEMIC_LIBRARY_ADMIN"],
};

// Re-export role display names for use in layout components
export { ROLE_DISPLAY_NAMES } from "@/types/roles.types";
