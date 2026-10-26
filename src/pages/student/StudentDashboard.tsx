import { Library, Bookmark, Bell, Clock, AlertCircle, FileText, FlaskConical } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { StatCardSkeleton } from "@/components/common/LoadingSkeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { borrowingService } from "@/services/libraryService";
import { materialService } from "@/services/materialService";
import { researchService } from "@/services/researchService";
import { MATERIAL_TYPE_LABELS } from "@/types/material.types";
import { formatDate } from "@/lib/utils";

function useStudentStats(userId: string) {
  return useQuery({
    queryKey: ["student-stats", userId],
    queryFn: async () => {
      const [saved, notifications, research] = await Promise.all([
        supabase
          .from("saved_resources" as never)
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_read", false),
        // Count approved research visible to this student
        supabase
          .from("research_resources")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("approval_status", "APPROVED"),
      ]);
      return {
        saved:         (saved as any).count ?? 0,
        notifications: (notifications as any).count ?? 0,
        research:      (research as any).count ?? 0,
      };
    },
    enabled: !!userId,
  });
}

export function StudentDashboard() {
  const { profile } = useAuth();
  const userId = profile?.id ?? "";

  const { data: stats,    isPending: statsPending }   = useStudentStats(userId);
  const { data: borrowResult, isPending: borrowPending } = useQuery({
    queryKey: ["student-borrowings-summary", userId],
    queryFn:  () => borrowingService.list({ studentId: userId, status: ["ACTIVE", "OVERDUE"] as any }),
    enabled:  !!userId,
  });

  // Fetch recent published materials
  const { data: recentMaterialsResult, isPending: materialsPending } = useQuery({
    queryKey: ["student-recent-materials"],
    queryFn:  () => materialService.list({ status: "PUBLISHED", limit: 4 }),
  });
  const recentMaterials = recentMaterialsResult?.data ?? [];

  const activeBorrowings = borrowResult?.data ?? [];
  const overdueItems     = activeBorrowings.filter(b => b.status === "OVERDUE" ||
    new Date(b.due_date) < new Date());
  const dueSoon          = activeBorrowings.filter(b => {
    const days = Math.ceil((new Date(b.due_date).getTime() - new Date().getTime()) / 86400000);
    return days >= 0 && days <= 3 && b.status !== "OVERDUE";
  });

  const firstName = profile?.full_name?.split(" ")[0] ?? "Student";
  const isLoading = statsPending || borrowPending;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Welcome back, {firstName}</h1>
        <p className="page-description">
          Here's an overview of your academic activity at Debre Markos University.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard title="Borrowed Books"  value={activeBorrowings.length}     icon={Library}   href="/library/borrowed" color="text-amber-600"  bg="bg-amber-100" />
            <StatCard title="Saved Resources" value={stats?.saved ?? 0}           icon={Bookmark}  href="/saved"            color="text-blue-600"  bg="bg-blue-100" />
            <StatCard title="Notifications"   value={stats?.notifications ?? 0}   icon={Bell}      href="/notifications"    color="text-purple-600" bg="bg-purple-100" />
            <StatCard title="Research Items"  value={stats?.research ?? 0}         icon={FlaskConical} href="/research"      color="text-green-600" bg="bg-green-100" />
          </>
        )}
      </div>

      {/* Overdue alert */}
      {overdueItems.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-destructive text-sm">
              You have {overdueItems.length} overdue book{overdueItems.length !== 1 ? "s" : ""}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">Please return them to the library.</p>
          </div>
          <Button size="sm" asChild>
            <Link to="/library/borrowed">View</Link>
          </Button>
        </div>
      )}

      {/* Due-soon alert */}
      {dueSoon.length > 0 && overdueItems.length === 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50/60 p-4 flex items-start gap-3">
          <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-amber-800 text-sm">
              {dueSoon.length} book{dueSoon.length !== 1 ? "s" : ""} due within 3 days
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {dueSoon.map(b => (b.book as any)?.title).join(", ")}
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link to="/library/borrowed">View</Link>
          </Button>
        </div>
      )}

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Recent Materials */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Materials</CardTitle>
          </CardHeader>
          <CardContent>
            {materialsPending ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : !recentMaterials.length ? (
              <EmptyState
                icon={FileText}
                title="No materials yet"
                description="Published materials from lecturers will appear here."
              />
            ) : (
              <ul className="space-y-1">
                {recentMaterials.map(m => (
                  <li key={m.id}>
                    <div className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted transition-colors">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {MATERIAL_TYPE_LABELS[m.material_type]} · {formatDate(m.created_at)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Borrowed Books */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Borrowed Books</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link to="/library/borrowed">View all</Link></Button>
          </CardHeader>
          <CardContent>
            {borrowPending ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : !activeBorrowings.length ? (
              <EmptyState
                icon={Library}
                title="No borrowed books"
                description="Books you borrow from the library will appear here."
                actionLabel="Browse library"
                onAction={() => {}}
              />
            ) : (
              <ul className="space-y-2">
                {activeBorrowings.slice(0, 4).map(b => {
                  const isOD = b.status === "OVERDUE" || new Date(b.due_date) < new Date();
                  return (
                    <li key={b.id} className={`flex items-center justify-between rounded-md px-2 py-2 ${isOD ? "bg-destructive/5" : "hover:bg-muted"} transition-colors`}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{(b.book as any)?.title ?? "—"}</p>
                        <p className={`text-xs ${isOD ? "text-destructive" : "text-muted-foreground"}`}>
                          Due: {formatDate(b.due_date)}
                        </p>
                      </div>
                      <Badge variant={isOD ? "destructive" : "secondary"} className="shrink-0 ml-2 text-xs">
                        {isOD ? "Overdue" : "Active"}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Library & Research quick access */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/library"><Library className="mr-2 h-4 w-4" />Browse Library Catalogue</Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/library/reservations"><Clock className="mr-2 h-4 w-4" />My Reservations</Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/research"><FlaskConical className="mr-2 h-4 w-4" />Research Repository</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string; value: number; icon: React.ElementType;
  href: string; color: string; bg: string;
}
function StatCard({ title, value, icon: Icon, href, color, bg }: StatCardProps) {
  return (
    <Link to={href} className="block group">
      <Card className="transition-shadow group-hover:shadow-md">
        <CardContent className="flex items-center gap-4 p-6">
          <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${bg}`}>
            <Icon className={`h-6 w-6 ${color}`} aria-hidden="true" />
          </div>
          <div>
            <p className="stat-value">{value}</p>
            <p className="stat-label">{title}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
