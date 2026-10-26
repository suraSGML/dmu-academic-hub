import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Plus, Eye, EyeOff, Pencil, Trash2, FileText, Search, Download,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { materialService } from "@/services/materialService";
import { MATERIAL_TYPE_LABELS } from "@/types/material.types";
import type { CourseMaterial, PublicationStatus } from "@/types/material.types";
import { formatDate, formatFileSize } from "@/lib/utils";

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "",          label: "All" },
  { value: "DRAFT",     label: "Drafts" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED",  label: "Archived" },
];

export function LecturerMaterialsPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CourseMaterial | null>(null);

  const { data: result, isPending, isError, refetch } = useQuery({
    queryKey: ["lecturer-materials", profile?.id, statusFilter, search],
    queryFn: () => materialService.list({
      uploadedBy: profile!.id,
      status:     statusFilter as PublicationStatus || undefined,
      search:     search || undefined,
      limit:      100,
    }),
    enabled: !!profile?.id,
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => materialService.publish(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lecturer-materials"] }); toast({ title: "Material published" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => materialService.unpublish(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lecturer-materials"] }); toast({ title: "Material unpublished (set to draft)" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => materialService.delete(deleteTarget!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lecturer-materials"] });
      setDeleteTarget(null);
      toast({ title: "Material deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleDownload = async (material: CourseMaterial) => {
    if (!material.storage_path) return;
    try {
      const url = await materialService.getDownloadUrl(material.storage_path);
      await materialService.recordDownload(material.id);
      window.open(url, "_blank");
    } catch { toast({ title: "Download failed", variant: "destructive" }); }
  };

  const materials = result?.data ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">My Materials</h1>
          <p className="page-description">Manage course materials you have uploaded.</p>
        </div>
        <Button asChild>
          <Link to="/lecturer/materials/upload">
            <Plus className="mr-2 h-4 w-4" />Upload Material
          </Link>
        </Button>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1">
          {STATUS_TABS.map(t => (
            <button key={t.value} onClick={() => setStatusFilter(t.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${statusFilter === t.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search materials..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {isPending ? <LoadingSkeleton rows={5} /> : isError ? <ErrorState onRetry={refetch} /> : !materials.length ? (
        <EmptyState
          icon={FileText}
          title={statusFilter ? `No ${statusFilter.toLowerCase()} materials` : "No materials uploaded yet"}
          description="Upload course materials for your assigned courses."
          actionLabel="Upload Material"
          onAction={() => {}}
        />
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{materials.length} material(s)</p>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  {["Material", "Course", "Type", "Size", "Downloads", "Status", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {materials.map(m => (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium truncate">{m.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(m.created_at)}{m.module_chapter ? ` · ${m.module_chapter}` : ""}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-mono text-muted-foreground">{(m.course as any)?.code ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs whitespace-nowrap">
                        {MATERIAL_TYPE_LABELS[m.material_type]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {m.file_size ? formatFileSize(m.file_size) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">{m.download_count}</td>
                    <td className="px-4 py-3"><StatusBadge status={m.publication_status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {m.storage_path && (
                          <Button size="sm" variant="ghost" onClick={() => handleDownload(m)} title="Download">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {m.publication_status === "DRAFT" ? (
                          <Button size="sm" variant="ghost" className="text-green-600 hover:text-green-700"
                            onClick={() => publishMutation.mutate(m.id)} title="Publish">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        ) : m.publication_status === "PUBLISHED" ? (
                          <Button size="sm" variant="ghost" className="text-amber-600 hover:text-amber-700"
                            onClick={() => unpublishMutation.mutate(m.id)} title="Unpublish">
                            <EyeOff className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" asChild title="Edit">
                          <Link to={`/lecturer/materials/${m.id}/edit`}><Pencil className="h-3.5 w-3.5" /></Link>
                        </Button>
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
        description={`Delete "${deleteTarget?.title}"? The file will be removed from storage and students will lose access.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate()}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
