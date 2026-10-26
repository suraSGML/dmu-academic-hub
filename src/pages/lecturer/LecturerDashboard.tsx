import { FileText, Users, BarChart3, Eye, Edit3, Download, TrendingUp, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { StatCardSkeleton } from "@/components/common/LoadingSkeleton";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { materialService } from "@/services/materialService";
import { MATERIAL_TYPE_LABELS } from "@/types/material.types";
import { formatDate, formatFileSize } from "@/lib/utils";

export function LecturerDashboard() {
  const { profile } = useAuth();
  const userId = profile?.id ?? "";

  const { data: materialStats, isPending: statsPending } = useQuery({
    queryKey: ["lecturer-material-stats", userId],
    queryFn:  () => materialService.getStatsForLecturer(userId),
    enabled:  !!userId,
  });

  const { data: recentMaterials } = useQuery({
    queryKey: ["lecturer-recent-materials", userId],
    queryFn:  () => materialService.list({ uploadedBy: userId, limit: 8 }),
    enabled:  !!userId,
  });

  const firstName = profile?.full_name?.split(" ")[0] ?? "Lecturer";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Welcome, {firstName}</h1>
        <p className="page-description">
          Manage your courses and course materials for Debre Markos University.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsPending ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <LecStatCard title="Total Materials"  value={materialStats?.total ?? 0}           icon={FileText}  href="/lecturer/materials" colorClass="text-primary bg-primary/10" />
            <LecStatCard title="Published"        value={materialStats?.published ?? 0}       icon={Eye}       href="/lecturer/materials" colorClass="text-green-600 bg-green-100" />
            <LecStatCard title="Drafts"           value={materialStats?.drafts ?? 0}          icon={Edit3}     href="/lecturer/materials" colorClass="text-amber-600 bg-amber-100" />
            <LecStatCard title="Total Downloads"  value={materialStats?.totalDownloads ?? 0}  icon={Download}  href="/lecturer/materials" colorClass="text-blue-600 bg-blue-100" />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent materials */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Materials</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/lecturer/materials">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!recentMaterials?.data.length ? (
              <EmptyState
                icon={FileText}
                title="No materials uploaded"
                description="Upload course materials for your assigned courses."
                actionLabel="Upload Material"
                onAction={() => {}}
              />
            ) : (
              <ul className="space-y-2">
                {recentMaterials.data.map(m => (
                  <li key={m.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {(m.course as any)?.code} · {MATERIAL_TYPE_LABELS[m.material_type]} · {formatDate(m.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={m.publication_status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Drafts reminder */}
        {(materialStats?.drafts ?? 0) > 0 && (
          <Card className="border-amber-200 bg-amber-50/50 lg:col-span-2">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
                  <Edit3 className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    {materialStats?.drafts} draft material{materialStats?.drafts !== 1 ? "s" : ""} waiting to be published
                  </p>
                  <p className="text-xs text-amber-700">Publish them so your students can access them.</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="border-amber-300 text-amber-700 hover:bg-amber-100" asChild>
                <Link to="/lecturer/materials?status=DRAFT">Review drafts</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Material Engagement */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Material Engagement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {!recentMaterials?.data.length ? (
              <EmptyState
                icon={BarChart3}
                title="No materials yet"
                description="Upload course materials to start tracking views and downloads."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium pr-4">Material</th>
                      <th className="pb-2 font-medium text-right pr-4">Status</th>
                      <th className="pb-2 font-medium text-right pr-4">
                        <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> Views</span>
                      </th>
                      <th className="pb-2 font-medium text-right">
                        <span className="inline-flex items-center gap-1"><Download className="h-3 w-3" /> Downloads</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recentMaterials.data.map(m => (
                      <tr key={m.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-2.5 pr-4">
                          <p className="font-medium truncate max-w-[220px]">{m.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {(m.course as any)?.code} · {MATERIAL_TYPE_LABELS[m.material_type]}
                          </p>
                        </td>
                        <td className="py-2.5 pr-4 text-right">
                          <StatusBadge status={m.publication_status} />
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums font-medium">
                          {(m as any).view_count ?? 0}
                        </td>
                        <td className="py-2.5 text-right tabular-nums font-medium">
                          {(m as any).download_count ?? 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t">
                      <td colSpan={2} className="pt-2.5 text-xs text-muted-foreground">Total across {recentMaterials.data.length} materials</td>
                      <td className="pt-2.5 text-right tabular-nums text-xs font-semibold">
                        {recentMaterials.data.reduce((s, m) => s + ((m as any).view_count ?? 0), 0)}
                      </td>
                      <td className="pt-2.5 text-right tabular-nums text-xs font-semibold">
                        {materialStats?.totalDownloads ?? 0}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LecStatCard({ title, value, icon: Icon, href, colorClass }: {
  title: string; value: number; icon: React.ElementType; href: string; colorClass: string;
}) {
  const [textColor, bgColor] = colorClass.split(" ");
  return (
    <Link to={href} className="block group">
      <Card className="transition-shadow group-hover:shadow-md">
        <CardContent className="flex items-center gap-4 p-6">
          <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${bgColor}`}>
            <Icon className={`h-6 w-6 ${textColor}`} aria-hidden="true" />
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
