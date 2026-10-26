import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Search, Eye, EyeOff, Trash2, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { toast } from "@/hooks/use-toast";
import { materialService } from "@/services/materialService";
import { MATERIAL_TYPE_LABELS } from "@/types/material.types";
import type { CourseMaterial, PublicationStatus } from "@/types/material.types";
import { formatDate, formatFileSize } from "@/lib/utils";

const STATUS_TABS = [
  { value: "",          label: "All" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT",     label: "Drafts" },
  { value: "ARCHIVED",  label: "Archived" },
];

export function AdminMaterialsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CourseMaterial | null>(null);

  const { data: result, isPending, isError, refetch } = useQuery({
    queryKey: ["admin-materials", statusFilter, search],
    queryFn: () => materialService.list({
      status: statusFilter as PublicationStatus || undefined,
      search: search || undefined,
      limit: 200,
    }),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => materialService.publish(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-materials"] }); toast({ title: "Published" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => materialService.unpublish(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-materials"] }); toast({ title: "Unpublished" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => materialService.delete(deleteTarget!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-materials"] });
      setDeleteTarget(null);
      toast({ title: "Material deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleDownload = async (m: CourseMaterial) => {
    if (!m.storage_path) return;
    try {
      const url = await materialService.getDownloadUrl(m.storage_path);
      window.open(url, "_blank");
    } catch { toast({ title: "Download failed", variant: "destructive" }); }
  };

  const materials = result?.data ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Academic Materials</h1>
        <p className="page-description">
          Review, approve, and manage all course materials across the platform.
        </p>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1">
          {STATUS_TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === t.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by title, description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isPending ? (
        <LoadingSkeleton rows={6} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : !materials.length ? (
        <EmptyState icon={FileText} title="No materials found" description="No course materials match your current filters." />
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{result?.count ?? 0} material(s)</p>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  {["Material", "Course", "Uploader", "Type", "Size", "Visibility", "Status", "Actions"].map(h => (
                    <th key={h} className="px-3 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {materials.map(m => (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-3 max-w-xs">
                      <p className="font-medium truncate">{m.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(m.created_at)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-sm font-mono text-muted-foreground">{(m.course as any)?.code ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[120px]">{(m.course as any)?.name}</p>
                    </td>
                    <td className="px-3 py-3 text-sm text-muted-foreground max-w-[120px]">
                      <p className="truncate">{(m.uploader as any)?.full_name ?? "—"}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="secondary" className="text-xs whitespace-nowrap">
                        {MATERIAL_TYPE_LABELS[m.material_type]}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                      {m.file_size ? formatFileSize(m.file_size) : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline" className="text-xs">{m.visibility}</Badge>
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={m.publication_status} /></td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        {m.storage_path && (
                          <Button size="sm" variant="ghost" onClick={() => handleDownload(m)} title="Download">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {m.publication_status === "DRAFT" ? (
                          <Button size="sm" variant="ghost" className="text-green-600"
                            onClick={() => publishMutation.mutate(m.id)} title="Publish">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        ) : m.publication_status === "PUBLISHED" ? (
                          <Button size="sm" variant="ghost" className="text-amber-600"
                            onClick={() => unpublishMutation.mutate(m.id)} title="Unpublish">
                            <EyeOff className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(m)} title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={o => !o && setDeleteTarget(null)}
        title="Delete Material"
        description={`Delete "${deleteTarget?.title}"? The file will be removed and students will lose access.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate()}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
