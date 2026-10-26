import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { NAVIGATION_CONFIG } from "@/lib/navigation/navigation.config";
import type { AppRole } from "@/types/roles.types";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const ROLE_DISPLAY_NAMES_MAP: Record<AppRole, string> = {
  STUDENT: "Student",
  LECTURER: "Lecturer",
  LIBRARIAN: "Librarian",
  ACADEMIC_LIBRARY_ADMIN: "Admin",
};

const COLLAPSED_KEY = "dmu-sidebar-collapsed";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  const { profile, signOut } = useAuth();
  const { role } = useRole();
  const location = useLocation();

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed]);

  if (!role) return null;

  const navGroups = NAVIGATION_CONFIG[role] ?? [];

  const isActive = (href: string) => {
    if (href === "/dashboard" || href === "/lecturer/dashboard" ||
        href === "/librarian/dashboard" || href === "/admin/dashboard") {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r bg-card transition-all duration-300",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex h-16 items-center border-b px-3 gap-2",
        collapsed ? "justify-center" : "justify-between"
      )}>
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="truncate text-sm font-bold text-foreground leading-tight">
                DMU Academic Hub
              </p>
              <p className="truncate text-[10px] text-muted-foreground leading-tight">
                Debre Markos University
              </p>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="ml-auto rounded-md p-1 hover:bg-muted text-muted-foreground"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-muted"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        <nav aria-label="Main navigation">
          {navGroups.map((group, gi) => (
            <div key={gi} className="mb-1">
              {!collapsed && group.label && (
                <p className="mb-1 mt-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
              )}
              {collapsed && gi > 0 && (
                <Separator className="my-2 mx-3" />
              )}
              <ul role="list" className="space-y-0.5 px-2">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <NavLink
                        to={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                          collapsed ? "justify-center" : "",
                          active
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {!collapsed && (
                          <span className="truncate">{item.label}</span>
                        )}
                        {!collapsed && item.badge && (
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* User footer */}
      <div className="border-t p-2">
        {!collapsed ? (
          <div className="flex items-center gap-2 rounded-md p-2">
            <UserAvatar
              name={profile?.full_name}
              avatarUrl={profile?.avatar_url}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                {profile?.full_name ?? profile?.email ?? "User"}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {role ? ROLE_DISPLAY_NAMES_MAP[role] : ""}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={signOut}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <UserAvatar
              name={profile?.full_name}
              avatarUrl={profile?.avatar_url}
              size="sm"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={signOut}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
