import { useEffect } from "react";
import { Menu, Bell, Search, ChevronDown, User, Settings, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/common/UserAvatar";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { notificationService } from "@/services/notificationService";
import type { AppRole } from "@/types/roles.types";

const ROLE_LABELS: Record<AppRole, string> = {
  STUDENT:                "Student",
  LECTURER:               "Lecturer",
  LIBRARIAN:              "Librarian",
  ACADEMIC_LIBRARY_ADMIN: "Resource & Library Admin",
};

interface TopbarProps {
  onMenuClick: () => void;
  pageTitle?: string;
}

export function Topbar({ onMenuClick, pageTitle }: TopbarProps) {
  const { profile, signOut } = useAuth();
  const { role }             = useRole();
  const navigate             = useNavigate();
  const qc                   = useQueryClient();

  // Real unread count
  const { data: unreadCount = 0, isError: unreadCountError } = useQuery({
    queryKey: ["notification-count", profile?.id],
    queryFn:  () => notificationService.getUnreadCount(profile!.id),
    enabled:  !!profile?.id,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  // Realtime subscription for the badge
  useEffect(() => {
    if (!profile?.id) return;
    const unsubscribe = notificationService.subscribe(profile.id, () => {
      qc.invalidateQueries({ queryKey: ["notification-count", profile.id] });
    }, () => {
      qc.invalidateQueries({ queryKey: ["notification-count", profile.id] });
    });
    return unsubscribe;
  }, [profile?.id, qc]);

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background px-4 lg:px-6">
      {/* Mobile menu toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Page title */}
      {pageTitle && (
        <h1 className="hidden text-base font-semibold text-foreground sm:block">
          {pageTitle}
        </h1>
      )}

      <div className="flex-1" />

      {/* Search shortcut */}
      <Button
        variant="outline"
        className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex"
        onClick={() => navigate("/search")}
        aria-label="Search resources"
      >
        <Search className="h-4 w-4" />
        <span>Search resources...</span>
        <kbd className="pointer-events-none ml-2 hidden select-none rounded border bg-muted px-1.5 text-[10px] font-mono opacity-100 sm:inline-block">
          /
        </kbd>
      </Button>

      {/* Notification bell with live badge */}
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => navigate("/notifications")}
        aria-label={unreadCountError
          ? "View notifications (unread count unavailable)"
          : `View notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        title={unreadCountError ? "Unread count unavailable. Open notifications to retry." : "Notifications"}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white"
            aria-hidden="true"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 px-2" aria-label="User menu">
            <UserAvatar name={profile?.full_name} avatarUrl={profile?.avatar_url} size="sm" />
            <div className="hidden text-left sm:block">
              <p className="text-xs font-medium leading-none">
                {profile?.full_name ?? profile?.email ?? "User"}
              </p>
              {role && (
                <p className="mt-0.5 text-[10px] leading-none text-muted-foreground">
                  {ROLE_LABELS[role]}
                </p>
              )}
            </div>
            <ChevronDown className="hidden h-3 w-3 text-muted-foreground sm:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{profile?.full_name ?? "User"}</p>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/profile" className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/settings" className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive cursor-pointer"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" />Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
