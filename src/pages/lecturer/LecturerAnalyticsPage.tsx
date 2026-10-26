import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download, Eye, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCardSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { materialService } from "@/services/materialService";
import { MATERIAL_TYPE_LABELS } from "@/types/material.types";
import { formatDate } from "@/lib/utils";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
];

export function LecturerAnalyticsPage() {
  const { profile } = useAuth();

  const { data: stats, isPending: statsPending } = useQuery({
    queryKey: ["lecturer-material-stats", profile?.id],
    queryFn:  () => materialService.getStatsForLecturer(profile!.id),
    enabled:  !!profile?.id,
  });

  const { data: materialsResult, isPending: materialsPending } = useQuery({
    queryKey: ["lecturer-materials-analytics", profile?.id],
    queryFn:  () => materialService.list({ uploadedBy: profile!.id, status: "PUBLISHED", limit: 50 }),
    enabled:  !!profile?.id,
  });

  const materials = materialsResult?.data ?? [];

  const topDownloaded = [...materials]
    .sort((a, b) => b.download_count - a.download_count)
    .slice(0, 6)
    .map(m => ({ name: m.title.length > 20 ? m.title.slice(0, 20) + "…" : m.title, downloads: m.download_count, views: m.view_count }));

  const topViewed = [...materials]
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, 6)
    .map(m => ({ name: m.title.length > 20 ? m.title.slice(0, 20) + "…" : m.title, views: m.view_count }));

  // Group by type for pie chart
  const byType: Record<string, number> = {};
  materials.forEach(m => {
    byType[m.material_type] = (byType[m.material_type] ?? 0) + 1;
  });
  const pieData = Object.entries(byType).map(([type, count]) => ({
    name: MATERIAL_TYPE_LABELS[type as keyof typeof MATERIAL_TYPE_LABELS] ?? type,
    value: count,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
        <p className="page-description">Usage statistics for your course materials.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsPending ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard title="Published Materials" value={stats?.published ?? 0}       icon={FileText}  color="text-primary"    bg="bg-primary/10" />
            <StatCard title="Drafts"              value={stats?.drafts ?? 0}           icon={FileText}  color="text-amber-600"  bg="bg-amber-100" />
            <StatCard title="Total Downloads"     value={stats?.totalDownloads ?? 0}   icon={Download}  color="text-blue-600"   bg="bg-blue-100" />
            <StatCard title="Total Views"         value={materials.reduce((s, m) => s + m.view_count, 0)} icon={Eye} color="text-green-600" bg="bg-green-100" />
          </>
        )}
      </div>

      {/* Charts row */}
      {!materialsPending && materials.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Downloads bar chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-4 w-4" />Most Downloaded
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topDownloaded.length === 0 ? (
                <EmptyState icon={Download} title="No downloads yet" description="Downloads will appear once students access your materials." />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topDownloaded} margin={{ top: 4, right: 8, left: -20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(val) => [val, "Downloads"]}
                    />
                    <Bar dataKey="downloads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Views bar chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" />Most Viewed
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topViewed.length === 0 ? (
                <EmptyState icon={Eye} title="No views yet" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topViewed} margin={{ top: 4, right: 8, left: -20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(val) => [val, "Views"]}
                    />
                    <Bar dataKey="views" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Materials by type — Pie chart */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />Materials by Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length === 0 ? (
                <EmptyState icon={BarChart3} title="No published materials yet" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend
                      formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>}
                    />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* All materials table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">All Published Materials</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/lecturer/materials">Manage</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {!materials.length ? (
                <EmptyState icon={FileText} title="No published materials" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        {["Title", "Views", "Downloads", "Date"].map(h => (
                          <th key={h} className="pb-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {materials.map(m => (
                        <tr key={m.id} className="border-b last:border-0">
                          <td className="py-2 pr-3">
                            <p className="font-medium truncate max-w-[140px]">{m.title}</p>
                            <p className="text-xs text-muted-foreground">{(m.course as any)?.code}</p>
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground">{m.view_count}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{m.download_count}</td>
                          <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(m.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty state when no materials at all */}
      {!materialsPending && materials.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <EmptyState icon={BarChart3} title="No data yet" description="Publish materials to see analytics charts here." />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, bg }: {
  title: string; value: number; icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${bg}`}>
          <Icon className={`h-6 w-6 ${color}`} />
        </div>
        <div>
          <p className="stat-value">{value.toLocaleString()}</p>
          <p className="stat-label">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}
