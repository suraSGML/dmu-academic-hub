import { NavLink, useLocation } from "react-router-dom";
import { GraduationCap, LogOut } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/common/UserAvatar";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { NAVIGATION_CONFIG } from "@/lib/navigation/navigation.config";
import type { AppRole } from "@/types/roles.types";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<AppRole, string> = {
  STUDENT: "Student",
  LECTURER: "Lecturer",
  LIBRARIAN: "Librarian",
  ACADEMIC_LIBRARY_ADMIN: "Admin",
};

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  const { profile, signOut } = useAuth();
  const { role } = useRole();
  const location = useLocation();

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
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="flex h-16 items-center border-b px-4">
          <SheetTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold leading-tight">DMU Academic Hub</p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Debre Markos University
              </p>
            </div>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-8rem)] py-2">
          <nav aria-label="Mobile navigation">
            {navGroups.map((group, gi) => (
              <div key={gi} className="mb-1">
                {group.label && (
                  <p className="mb-1 mt-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                )}
                {gi > 0 && !group.label && <Separator className="my-1 mx-3" />}
                <ul role="list" className="space-y-0.5 px-2">
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <NavLink
                          to={item.href}
                          onClick={onClose}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                            active
                              ? "bg-primary text-primary-foreground font-medium"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>{item.label}</span>
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
        <div className="absolute bottom-0 left-0 right-0 border-t bg-background p-3">
          <div className="flex items-center gap-3">
            <UserAvatar
              name={profile?.full_name}
              avatarUrl={profile?.avatar_url}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">
                {profile?.full_name ?? profile?.email}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {role ? ROLE_LABELS[role] : ""}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={signOut}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
