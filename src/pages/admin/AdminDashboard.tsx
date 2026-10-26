import {
  Users, BookMarked, FileText, FlaskConical,
  BarChart3, ScrollText, Upload,
  CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { StatCardSkeleton } from "@/components/common/LoadingSkeleton";
import { StatusBadge } from "@/components/common/StatusBadge";
import { supabase } from "@/lib/supabase";
import { auditService } from "@/services/adminService";
import { researchService } from "@/services/researchService";
import { formatDate, formatDateTime } from "@/lib/utils";

function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [users, books, materials, research] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("books" as never).select("id", { count: "exact", head: true }),
        supabase.from("course_materials" as never).select("id", { count: "exact", head: true }),
        supabase.from("research_resources" as never).select("id", { count: "exact", head: true }),
      ]);
      return {
        users:     (users as any).count ?? 0,
        books:     (books as any).count ?? 0,
        materials: (materials as any).count ?? 0,
        research:  (research as any).count ?? 0,
      };
    },
  });
}

export function AdminDashboard() {
  const { data: stats, isPending } = useAdminStats();

  const { data: pendingResearch } = useQuery({
    queryKey: ["admin-pending-research"],
    queryFn: () => researchService.list({ approvalStatus: "PENDING", limit: 5 }),
  });

  const { data: auditResult } = useQuery({
    queryKey: ["audit-logs-recent"],
    queryFn: () => auditService.list({ limit: 8 }),
  });

  const recentLogs   = auditResult?.data ?? [];
  const pendingItems = pendingResearch?.data ?? [];

  const ACTION_COLORS: Record<string, string> = {
    BOOK_BORROWED:     "text-amber-600",
    BOOK_RETURNED:     "text-green-600",
    RESEARCH_APPROVED: "text-green-600",
    RESEARCH_REJECTED: "text-red-600",
    BOOK_CREATED:      "text-teal-600",
    MATERIAL_UPLOADED: "text-blue-600",
    USER_REGISTER:     "text-indigo-600",
    FINE_WAIVED:       "text-yellow-600",
    SETTING_UPDATED:   "text-gray-600",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Academic Resource & Library Administration</h1>
        <p className="page-description">
          Manage the university's digital resources, research repository, and library services.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isPending ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <AdminStat title="Platform Users"   value={stats?.users ?? 0}       icon={Users}         href="/admin/users"       color="text-primary"    bg="bg-primary/10" />
            <AdminStat title="Library Books"     value={stats?.books ?? 0}       icon={BookMarked}    href="/admin/library"     color="text-amber-600"  bg="bg-amber-100" />
            <AdminStat title="Course Materials"  value={stats?.materials ?? 0}   icon={FileText}      href="/admin/materials"   color="text-rose-600"   bg="bg-rose-100" />
            <AdminStat title="Research Resources" value={stats?.research ?? 0}   icon={FlaskConical}  href="/admin/research"    color="text-violet-600" bg="bg-violet-100" />
          </>
        )}
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Manage Users",    href: "/admin/users",          icon: Users },
              { label: "Import Course Data", href: "/admin/academic-import", icon: Upload },
              { label: "Review Materials", href: "/admin/materials",     icon: FileText },
              { label: "Review Research",  href: "/admin/research",      icon: FlaskConical },
              { label: "Library",          href: "/admin/library",       icon: BookMarked },
              { label: "Analytics",        href: "/admin/analytics",     icon: BarChart3 },
              { label: "Audit Logs",      href: "/admin/audit-logs",     icon: ScrollText },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Button key={action.href} variant="outline" className="flex h-auto flex-col gap-2 py-4" asChild>
                  <Link to={action.href}>
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="text-xs">{action.label}</span>
                  </Link>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity — from audit_logs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Platform Activity</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/audit-logs">View logs</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No activity logged yet"
                description="Successful logins, material uploads, and administrative changes will appear here as they occur."
              />
            ) : (
              <ul className="space-y-2">
                {recentLogs.map(log => {
                  const colorClass = ACTION_COLORS[log.action] ?? "text-muted-foreground";
                  const label = log.action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
                  return (
                    <li key={log.id} className="flex items-start gap-3 rounded-md p-2 hover:bg-muted/50 transition-colors">
                      <div className={`mt-0.5 h-2 w-2 rounded-full bg-current shrink-0 ${colorClass}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${colorClass}`}>{label}</p>
                        {log.resource_type && (
                          <p className="text-xs text-muted-foreground capitalize">{log.resource_type.replace(/_/g, " ")}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {formatDateTime(log.created_at)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Pending Research Approvals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Pending Approvals
              {pendingItems.length > 0 && (
                <Badge variant="destructive" className="text-xs">{pendingItems.length}</Badge>
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/research">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {pendingItems.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No pending approvals"
                description="Research submissions awaiting review will appear here."
              />
            ) : (
              <ul className="space-y-2">
                {pendingItems.map(r => (
                  <li key={r.id}>
                    <Link
                      to={`/research/${r.id}`}
                      className="flex items-start gap-3 rounded-md p-2 hover:bg-muted/50 transition-colors"
                    >
                      <FlaskConical className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-1">{r.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {(r as any).authors?.map((a: any) => a.author_name).join(", ") || "—"} · {formatDate(r.created_at)}
                        </p>
                      </div>
                      <StatusBadge status="PENDING" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdminStat({ title, value, icon: Icon, href, color, bg }: {
  title: string; value: number; icon: React.ElementType; href: string; color: string; bg: string;
}) {
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
