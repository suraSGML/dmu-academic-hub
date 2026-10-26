import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, Users, BookMarked, FileText, FlaskConical, BookOpen,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCardSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { libraryStatsService } from "@/services/libraryService";
import { supabase } from "@/lib/supabase";

function usePlatformStats() {
  return useQuery({
    queryKey: ["platform-analytics"],
    queryFn: async () => {
      const [users, courses, enrollments, materials, research, libStats] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("courses").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("course_enrollments").select("id", { count: "exact", head: true }).eq("status", "ACTIVE"),
        supabase.from("course_materials").select("id, download_count, view_count").eq("is_active", true).eq("publication_status", "PUBLISHED"),
        supabase.from("research_resources").select("id", { count: "exact", head: true }).eq("approval_status", "APPROVED").eq("is_active", true),
        libraryStatsService.getDashboardStats(),
      ]);

      const totalDownloads = (materials.data ?? []).reduce((s: number, m: any) => s + (m.download_count ?? 0), 0);
      const totalViews     = (materials.data ?? []).reduce((s: number, m: any) => s + (m.view_count    ?? 0), 0);

      return {
        users:          (users as any).count        ?? 0,
        courses:        (courses as any).count      ?? 0,
        enrollments:    (enrollments as any).count  ?? 0,
        materials:      (materials.data ?? []).length,
        research:       (research as any).count     ?? 0,
        totalDownloads,
        totalViews,
        library:        libStats,
      };
    },
  });
}

export function AdminAnalyticsPage() {
  const { data: stats, isPending } = usePlatformStats();

  // Data for bar chart: platform overview
  const overviewBarData = stats ? [
    { name: "Users",       value: stats.users },
    { name: "Courses",     value: stats.courses },
    { name: "Enrollments", value: stats.enrollments },
    { name: "Materials",   value: stats.materials },
    { name: "Research",    value: stats.research },
  ] : [];

  // Data for library radar chart
  const libraryRadarData = stats?.library ? [
    { subject: "Books",        A: stats.library.totalBooks   },
    { subject: "Copies",       A: stats.library.totalCopies  },
    { subject: "Borrowed",     A: stats.library.borrowed     },
    { subject: "Overdue",      A: stats.library.overdue      },
    { subject: "Reservations", A: stats.library.reservations },
  ] : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Platform Analytics</h1>
        <p className="page-description">
          Usage overview across the entire DMU Academic Hub platform.
        </p>
      </div>

      {/* Platform stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isPending ? (
          Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard title="Platform Users"     value={stats?.users         ?? 0} icon={Users}       color="text-primary"    bg="bg-primary/10" />
            <StatCard title="Active Courses"      value={stats?.courses       ?? 0} icon={BookOpen}    color="text-blue-600"   bg="bg-blue-100" />
            <StatCard title="Active Enrollments"  value={stats?.enrollments   ?? 0} icon={Users}       color="text-indigo-600" bg="bg-indigo-100" />
            <StatCard title="Published Materials" value={stats?.materials     ?? 0} icon={FileText}    color="text-green-600"  bg="bg-green-100" />
            <StatCard title="Material Downloads"  value={stats?.totalDownloads ?? 0} icon={BarChart3}  color="text-amber-600"  bg="bg-amber-100" />
            <StatCard title="Total Views"         value={stats?.totalViews   ?? 0} icon={BarChart3}    color="text-cyan-600"   bg="bg-cyan-100" />
            <StatCard title="Research Resources"  value={stats?.research      ?? 0} icon={FlaskConical} color="text-purple-600" bg="bg-purple-100" />
            <StatCard title="Library Books"       value={stats?.library?.totalBooks ?? 0} icon={BookMarked} color="text-primary" bg="bg-primary/10" />
          </>
        )}
      </div>

      {!isPending && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Platform Overview Bar Chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />Platform Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overviewBarData.length === 0 ? (
                <EmptyState icon={BarChart3} title="No data yet" />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={overviewBarData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(val) => [val != null ? Number(val).toLocaleString() : "0", "Count"]}
                    />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Library Radar Chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookMarked className="h-4 w-4" />Library Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!stats?.library ? (
                <EmptyState icon={BookMarked} title="No library data" />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={libraryRadarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                    <Radar
                      name="Library"
                      dataKey="A"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.25}
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                    />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Library detail tiles */}
          {stats?.library && (
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Library Snapshot</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { label: "Total Copies",        value: stats.library.totalCopies,     color: "text-foreground" },
                    { label: "Active Borrowings",   value: stats.library.borrowed,         color: "text-blue-600" },
                    { label: "Overdue Books",        value: stats.library.overdue,          color: "text-destructive" },
                    { label: "Pending Reservations",value: stats.library.reservations,     color: "text-amber-600" },
                  ].map(s => (
                    <div key={s.label} className="rounded-lg bg-muted/50 p-4 text-center">
                      <p className={`text-3xl font-bold ${s.color}`}>{s.value.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Content engagement card */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Content Engagement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "Total Material Views",  value: stats?.totalViews     ?? 0 },
                  { label: "Total Downloads",        value: stats?.totalDownloads ?? 0 },
                  { label: "Active Enrollments",     value: stats?.enrollments    ?? 0 },
                  { label: "Approved Research",      value: stats?.research       ?? 0 },
                ].map(s => (
                  <div key={s.label} className="rounded-lg bg-muted/50 p-4 text-center">
                    <p className="text-3xl font-bold text-foreground">{s.value.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, bg }: {
  title: string; value: number; icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${bg}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}
