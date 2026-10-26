import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, FlaskConical, Download, Calendar,
  User, Building2, GraduationCap, BookOpen, Tag,
  Trash2, Loader2, AlertCircle, FileText, CheckCircle2,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CardSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SaveButton } from "@/components/common/SaveButton";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { researchService } from "@/services/researchService";
import { RESEARCH_TYPE_LABELS } from "@/types/research.types";
import { formatDate, formatFileSize } from "@/lib/utils";

export function ResearchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const qc = useQueryClient();

  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: resource, isPending, isError, refetch } = useQuery({
    queryKey: ["research", id],
    queryFn:  () => researchService.get(id!),
    enabled:  !!id,
  });

  const handleDownload = async () => {
    if (!resource?.storage_path) {
      toast({
        title: "No file available",
        description: "This research resource does not have an attached downloadable document.",
        variant: "destructive",
      });
      return;
    }
    try {
      setIsDownloading(true);
      const url = await researchService.getDownloadUrl(resource.storage_path);
      await researchService.recordDownload(resource.id);
      qc.invalidateQueries({ queryKey: ["research", id] });

      const a = document.createElement("a");
      a.href = url;
      a.download = resource.file_name ?? `${resource.title}.pdf`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast({ title: "Download started", description: `Downloading ${resource.file_name || resource.title}` });
    } catch (err: any) {
      toast({
        title: "Download failed",
        description: err?.message || "Could not retrieve the file. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!resource) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${resource.title}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      await researchService.delete(resource.id, resource.storage_path);
      qc.invalidateQueries({ queryKey: ["research"] });
      toast({ title: "Research item deleted" });
      navigate("/research");
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err?.message || "You may not have permission to delete this research item.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isPending) return <div className="space-y-4"><CardSkeleton /><CardSkeleton /></div>;
  if (isError || !resource) return <ErrorState onRetry={refetch} title="Resource not found" />;

  const sortedAuthors = (resource.authors ?? [])
    .sort((a, b) => a.author_order - b.author_order);

  const canDelete =
    profile?.id === resource.submitted_by ||
    profile?.role === "ACADEMIC_LIBRARY_ADMIN";

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/research"><ArrowLeft className="mr-2 h-4 w-4" />Research Repository</Link>
      </Button>

      {/* Header card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{RESEARCH_TYPE_LABELS[resource.resource_type]}</Badge>
              <StatusBadge status={resource.approval_status} />
              {resource.visibility === "PUBLIC" && <Badge variant="success">Public</Badge>}
            </div>

            <div className="flex items-center gap-2">
              <SaveButton
                resourceType="research"
                resourceId={resource.id}
                userId={profile?.id}
                variant="outline"
              />
              {canDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      Delete
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <h1 className="text-2xl font-bold text-foreground leading-snug">{resource.title}</h1>

          {/* Authors */}
          {sortedAuthors.length > 0 && (
            <p className="mt-2 text-base text-muted-foreground">
              {sortedAuthors.map(a => a.author_name).join(", ")}
            </p>
          )}

          <Separator className="my-4" />

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {resource.department && (
              <MetaItem icon={Building2} label="Department" value={resource.department.name} />
            )}
            {resource.program && (
              <MetaItem icon={GraduationCap} label="Program" value={resource.program.name} />
            )}
            {resource.academic_year && (
              <MetaItem icon={Calendar} label="Academic Year" value={resource.academic_year.name} />
            )}
            {resource.supervisor && (
              <MetaItem icon={User} label="Supervisor" value={resource.supervisor} />
            )}
            {resource.publication_date && (
              <MetaItem icon={Calendar} label="Published" value={formatDate(resource.publication_date)} />
            )}
            {resource.submitter && (
              <MetaItem icon={User} label="Submitted By" value={resource.submitter.full_name ?? resource.submitter.email} />
            )}
          </div>

          <Separator className="my-4" />

          {/* Stats */}
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <span>{resource.view_count} views</span>
            <span>{resource.download_count} downloads</span>
            <span>Submitted {formatDate(resource.created_at)}</span>
            {resource.file_size && <span>{formatFileSize(resource.file_size)}</span>}
          </div>

          {/* Download Box */}
          {resource.storage_path ? (
            <div className="mt-6 rounded-lg border bg-muted/30 p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate max-w-sm">
                      {resource.file_name || `${resource.title}.pdf`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {resource.file_size ? formatFileSize(resource.file_size) : "PDF Document"} · {resource.download_count} download(s)
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="w-full sm:w-auto shrink-0"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Preparing Download...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Download Resource
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-dashed bg-muted/20 p-4 flex items-center gap-3 text-muted-foreground">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
              <div className="text-xs">
                <p className="font-medium text-foreground">No document file attached</p>
                <p>This research resource is indexed as abstract and citation metadata only.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Abstract */}
      {resource.abstract && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />Abstract
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
              {resource.abstract}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Keywords */}
      {resource.keywords && resource.keywords.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4" />Keywords
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {resource.keywords.map(k => (
                <Badge key={k.id} variant="outline" className="text-sm">
                  {k.keyword}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rejection reason if rejected */}
      {resource.approval_status === "REJECTED" && resource.rejection_reason && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-destructive">Rejection Reason</p>
            <p className="mt-1 text-sm text-muted-foreground">{resource.rejection_reason}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetaItem({ icon: Icon, label, value }: {
  icon: React.ElementType; label: string; value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
