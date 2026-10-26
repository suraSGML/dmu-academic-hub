import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, FileText, Download, Eye, AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { CardSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SaveButton } from "@/components/common/SaveButton";
import { useAuth } from "@/hooks/useAuth";
import { courseService } from "@/services/academicService";
import { materialService } from "@/services/materialService";
import { supabase } from "@/lib/supabase";
import {
  MATERIAL_TYPE_LABELS,
  type MaterialType,
} from "@/types/material.types";
import { formatDate, formatFileSize } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export function StudentCourseMaterialsPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [typeFilter, setTypeFilter] = useState<string>("");

  // Verify enrollment — this is the authorization check on the frontend
  const { data: enrollment, isPending: enrollPending } = useQuery({
    queryKey: ["enrollment-check", courseId, profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_enrollments" as never)
        .select("id, status")
        .eq("course_id", courseId!)
        .eq("student_id", profile!.id)
        .eq("status", "ACTIVE")
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; status: string } | null;
    },
    enabled: !!courseId && !!profile?.id,
  });

  const { data: course } = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => courseService.get(courseId!),
    enabled: !!courseId,
  });

  // Fetch materials — RLS will also enforce access server-side
  const { data: result, isPending: materialsPending, isError, refetch } = useQuery({
    queryKey: ["course-materials", courseId, typeFilter],
    queryFn: () => materialService.list({
      courseId,
      status: "PUBLISHED",
      materialType: typeFilter as MaterialType || undefined,
    }),
    enabled: !!courseId && !!enrollment,
  });

  const handleDownload = async (storagePath: string, materialId: string, title: string) => {
    try {
      const url = await materialService.getDownloadUrl(storagePath);
      await materialService.recordDownload(materialId);
      // Create a temporary link to trigger download
      const a = document.createElement("a");
      a.href = url;
      a.download = title;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      toast({ title: "Download failed", description: "Could not generate download link.", variant: "destructive" });
    }
  };

  const isPending = enrollPending;

  if (isPending) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  // Enrollment guard — frontend layer (RLS is the real guard)
  if (!enrollment && !enrollPending) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/search"><ArrowLeft className="mr-2 h-4 w-4" />Search</Link>
        </Button>
        <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 py-16 text-center px-4">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Access Denied</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            You are not enrolled in this course. Contact your department administrator to enroll.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link to="/search">Back to Search</Link>
          </Button>
        </div>
      </div>
    );
  }

  const materials = result?.data ?? [];
  const usedTypes = [...new Set(materials.map(m => m.material_type))];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/search">
          <ArrowLeft className="mr-2 h-4 w-4" />{course?.name ?? "Course"}
        </Link>
      </Button>

      <div className="page-header">
        <h1 className="page-title">Course Materials</h1>
        <p className="page-description">
          {course?.name} · {(course?.semester as any)?.name} · {(course?.academic_year as any)?.name}
        </p>
      </div>

      {/* Type filter chips */}
      {usedTypes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={typeFilter === "" ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("")}
          >
            All ({materials.length})
          </Button>
          {usedTypes.map(type => {
            const count = materials.filter(m => m.material_type === type).length;
            return (
              <Button
                key={type}
                variant={typeFilter === type ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter(type)}
              >
                {MATERIAL_TYPE_LABELS[type]} ({count})
              </Button>
            );
          })}
        </div>
      )}

      {/* Materials list */}
      {materialsPending ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : !materials.length ? (
        <EmptyState
          icon={FileText}
          title="No materials available"
          description={
            typeFilter
              ? `No ${MATERIAL_TYPE_LABELS[typeFilter as MaterialType]} materials uploaded yet.`
              : "Your lecturer hasn't published any materials for this course yet."
          }
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {materials.length} material{materials.length !== 1 ? "s" : ""}
          </p>
          {materials.map(m => (
            <Card key={m.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="flex items-start gap-4 p-4">
                {/* Icon */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{m.title}</h3>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {MATERIAL_TYPE_LABELS[m.material_type]}
                    </Badge>
                  </div>

                  {m.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{m.description}</p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {m.module_chapter && (
                      <span className="font-medium text-foreground">{m.module_chapter}</span>
                    )}
                    <span>By {(m.uploader as any)?.full_name ?? "Lecturer"}</span>
                    <span>·</span>
                    <span>{formatDate(m.created_at)}</span>
                    {m.file_size && (
                      <>
                        <span>·</span>
                        <span>{formatFileSize(m.file_size)}</span>
                      </>
                    )}
                    {m.version > 1 && (
                      <Badge variant="outline" className="font-mono text-xs">v{m.version}</Badge>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <SaveButton
                    resourceType="material"
                    resourceId={m.id}
                    userId={profile?.id}
                  />
                  {m.storage_path && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => handleDownload(m.storage_path!, m.id, m.file_name ?? m.title)}
                    >
                      <Download className="mr-2 h-3.5 w-3.5" />
                      Download
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
