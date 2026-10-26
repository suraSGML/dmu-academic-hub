import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Trash2, BookMarked, FileText, FlaskConical, Megaphone, Info } from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { toast } from "@/hooks/use-toast";
import { notificationService, type Notification, type NotificationType } from "@/services/notificationService";
import { formatRelativeTime } from "@/lib/utils";

const TYPE_CONFIG: Record<NotificationType, { icon: React.ElementType; color: string; bg: string }> = {
  NEW_MATERIAL:       { icon: FileText,     color: "text-blue-600",   bg: "bg-blue-100" },
  MATERIAL_UPDATED:   { icon: FileText,     color: "text-blue-500",   bg: "bg-blue-50" },
  BOOK_DUE_SOON:      { icon: BookMarked,   color: "text-amber-600",  bg: "bg-amber-100" },
  BOOK_ISSUED:        { icon: BookMarked,   color: "text-blue-600",   bg: "bg-blue-100" },
  BOOK_OVERDUE:       { icon: BookMarked,   color: "text-destructive", bg: "bg-destructive/10" },
  BOOK_RETURNED:      { icon: BookMarked,   color: "text-green-600",  bg: "bg-green-100" },
  RESERVATION_READY:  { icon: BookMarked,   color: "text-green-600",  bg: "bg-green-100" },
  RESEARCH_SUBMITTED: { icon: FlaskConical, color: "text-purple-600", bg: "bg-purple-100" },
  RESEARCH_APPROVED:  { icon: FlaskConical, color: "text-green-600",  bg: "bg-green-100" },
  RESEARCH_REJECTED:  { icon: FlaskConical, color: "text-destructive", bg: "bg-destructive/10" },
  ANNOUNCEMENT:       { icon: Megaphone,    color: "text-primary",    bg: "bg-primary/10" },
  SYSTEM:             { icon: Info,         color: "text-muted-foreground", bg: "bg-muted" },
};

function getHref(n: Notification, role?: string): string | null {
  if (!n.resource_id) return null;
  switch (n.resource_type) {
    case "courses": return `/materials/courses/${n.resource_id}`;
    case "books":            return `/library/books/${n.resource_id}`;
    case "borrowings":       return `/library/borrowed`;
    case "research":
      return role === "ACADEMIC_LIBRARY_ADMIN" && n.type === "RESEARCH_SUBMITTED"
        ? `/admin/research`
        : `/research/${n.resource_id}`;
    default: return null;
  }
}

export function NotificationsPage() {
  const { profile } = useAuth();
  const { role } = useRole();
  const qc = useQueryClient();

  const { data: notifications, isPending, isError, refetch } = useQuery({
    queryKey: ["notifications", profile?.id],
    queryFn:  () => notificationService.list(profile!.id),
    enabled:  !!profile?.id,
    refetchInterval: 30_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // Subscribe to realtime new notifications
  useEffect(() => {
    if (!profile?.id) return;
    const refreshNotifications = () => {
      qc.invalidateQueries({ queryKey: ["notifications", profile.id] });
      qc.invalidateQueries({ queryKey: ["notification-count", profile.id] });
    };
    const unsubscribe = notificationService.subscribe(profile.id, () => {
      refreshNotifications();
    }, () => {
      refreshNotifications();
    });
    return unsubscribe;
  }, [profile?.id, qc]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", profile?.id] });
      qc.invalidateQueries({ queryKey: ["notification-count", profile?.id] });
    },
    onError: (error: Error) => toast({ title: "Could not mark notification as read", description: error.message, variant: "destructive" }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationService.markAllRead(profile!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", profile?.id] });
      qc.invalidateQueries({ queryKey: ["notification-count", profile?.id] });
    },
    onError: (error: Error) => toast({ title: "Could not mark notifications as read", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", profile?.id] });
      qc.invalidateQueries({ queryKey: ["notification-count", profile?.id] });
    },
    onError: (error: Error) => toast({ title: "Could not delete notification", description: error.message, variant: "destructive" }),
  });

  const unreadCount = (notifications ?? []).filter(n => !n.is_read).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title flex items-center gap-2">
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>
            )}
          </h1>
          <p className="page-description">Your platform activity and alerts.</p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
          >
            <Check className="mr-2 h-4 w-4" />Mark all read
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Notifications</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isPending ? (
            <div className="p-4"><LoadingSkeleton rows={5} /></div>
          ) : isError ? (
            <div className="p-4"><ErrorState onRetry={refetch} /></div>
          ) : !notifications?.length ? (
            <div className="p-6">
              <EmptyState
                icon={Bell}
                title="No notifications"
                description="You'll see alerts here when course materials are published, books are issued or overdue, reservations are ready, or research is reviewed."
              />
            </div>
          ) : (
            <ul role="list">
              {notifications.map((n, idx) => {
                const config = TYPE_CONFIG[n.type as NotificationType] ?? TYPE_CONFIG.SYSTEM;
                const Icon   = config.icon;
                const href   = getHref(n, role);
                const isLast = idx === notifications.length - 1;

                const body = (
                  <>
                    {/* Icon */}
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${config.bg}`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-snug ${!n.is_read ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
                          {n.title}
                        </p>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground/70">{formatRelativeTime(n.created_at)}</p>
                    </div>
                  </>
                );

                return (
                  <li key={n.id} className="group">
                    <div className={`flex items-start gap-3 px-4 py-4 transition-colors ${!n.is_read ? "bg-primary/5" : "hover:bg-muted/40"} ${!isLast ? "border-b" : ""}`}>
                      {href ? (
                        <Link
                          to={href}
                          className="flex min-w-0 flex-1 items-start gap-4"
                          onClick={() => { if (!n.is_read) markReadMutation.mutate(n.id); }}
                        >
                          {body}
                        </Link>
                      ) : (
                        <div className="flex min-w-0 flex-1 items-start gap-4">
                          {body}
                        </div>
                      )}

                      <div className="flex shrink-0 items-center gap-1">
                        {!n.is_read && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => markReadMutation.mutate(n.id)}
                            disabled={markReadMutation.isPending}
                            aria-label="Mark notification as read"
                            title="Mark as read"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(n.id)}
                          disabled={deleteMutation.isPending}
                          aria-label="Delete notification"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
