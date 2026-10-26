import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import {
  Upload, FileText, X, CheckCircle2, ArrowLeft, AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { materialService, validateMaterialFile } from "@/services/materialService";
import { courseService } from "@/services/academicService";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { CardSkeleton } from "@/components/common/LoadingSkeleton";
import {
  MATERIAL_TYPE_LABELS, VISIBILITY_LABELS,
  MAX_FILE_SIZE_MB, ALLOWED_FILE_TYPES,
  type MaterialType, type MaterialVisibility,
} from "@/types/material.types";
import { formatFileSize } from "@/lib/utils";

const schema = z.object({
  course_id:      z.string().min(1, "Please select an assigned course"),
  title:          z.string().min(2, "Title must be at least 2 characters").max(200),
  description:    z.string().max(1000).optional(),
  material_type:  z.string().min(1, "Please select a material type"),
  module_chapter: z.string().max(100).optional(),
  visibility:     z.string().min(1, "Please select visibility"),
});
type FormValues = z.infer<typeof schema>;

export function UploadMaterialPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const {
    data: courses,
    isPending: coursesPending,
    isError: coursesError,
    refetch: refetchCourses,
  } = useQuery({
    queryKey: ["lecturer-courses", profile?.id],
    queryFn: () => courseService.getForLecturer(profile!.id),
    enabled: !!profile?.id,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      course_id: "", title: "", description: "", material_type: "LECTURE_NOTE",
      module_chapter: "", visibility: "UNIVERSITY",
    },
  });
  const selectedCourseId = form.watch("course_id");

  useEffect(() => {
    const requestedCourseId = searchParams.get("course");
    if (requestedCourseId && courses?.some((course) => course.id === requestedCourseId)) {
      form.setValue("course_id", requestedCourseId, { shouldValidate: true });
    }
  }, [courses, form, searchParams]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateMaterialFile(file);
    if (err) { setFileError(err); setSelectedFile(null); return; }
    setFileError(null);
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const err = validateMaterialFile(file);
    if (err) { setFileError(err); setSelectedFile(null); return; }
    setFileError(null);
    setSelectedFile(file);
  };

  const uploadMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!selectedFile) throw new Error("Please select a file to upload.");
      if (!profile?.id)  throw new Error("Not authenticated.");
      if (!courses?.some((course) => course.id === values.course_id)) {
        throw new Error("Select a course assigned to you.");
      }

      setUploadProgress(10);
      const material = await materialService.upload({
        course_id:      values.course_id,
        title:          values.title,
        description:    values.description,
        material_type:  values.material_type as MaterialType,
        module_chapter: values.module_chapter,
        visibility:     values.visibility as MaterialVisibility,
        file:           selectedFile,
      }, profile.id);
      setUploadProgress(100);
      return material;
    },
    onSuccess: (material) => {
      qc.invalidateQueries({ queryKey: ["lecturer-materials"] });
      toast({ title: "Material uploaded", description: "Your file has been saved as a draft. Publish it when ready." });
      navigate(`/lecturer/materials`);
    },
    onError: (e: Error) => {
      setUploadProgress(0);
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    },
  });

  const isSubmitting = uploadMutation.isPending;

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/lecturer/materials"><ArrowLeft className="mr-2 h-4 w-4" />Materials</Link>
      </Button>

      <div className="page-header">
        <h1 className="page-title">Upload Material</h1>
        <p className="page-description">Upload learning materials for students. Files are saved as drafts until you publish them.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(v => uploadMutation.mutate(v))} className="space-y-5">

          {/* File upload */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Course</CardTitle>
              <CardDescription>Select one of your assigned courses. Course assignments are read-only university records.</CardDescription>
            </CardHeader>
            <CardContent>
              {coursesPending ? (
                <CardSkeleton />
              ) : coursesError ? (
                <ErrorState title="Could not load assigned courses" onRetry={refetchCourses} />
              ) : !courses?.length ? (
                <EmptyState
                  icon={FileText}
                  title="No assigned courses"
                  description="You need an assigned course before you can upload course materials."
                />
              ) : (
                <FormField control={form.control} name="course_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned course <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        {...field}
                      >
                        <option value="">Choose a course</option>
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>{course.code} · {course.name}</option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">File</CardTitle>
              <CardDescription>Max {MAX_FILE_SIZE_MB} MB. Allowed: {Object.values(ALLOWED_FILE_TYPES).join(", ")}.</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedFile ? (
                <div
                  className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer hover:border-primary/50 hover:bg-primary/5 ${fileError ? "border-destructive" : "border-border"}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                >
                  <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium text-foreground">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, PPT, PPTX, DOC, DOCX, XLS, XLSX, ZIP, images</p>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect}
                    accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.zip,.jpg,.jpeg,.png" />
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                  <FileText className="h-8 w-8 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)} · {ALLOWED_FILE_TYPES[selectedFile.type] ?? selectedFile.type}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {fileError && <p className="mt-2 text-sm text-destructive">{fileError}</p>}
              {isSubmitting && uploadProgress > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Uploading...</span><span>{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Material Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="e.g. Chapter 3 — Normalization" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description <span className="text-muted-foreground">(optional)</span></FormLabel>
                  <FormControl>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                      placeholder="Brief description of this material..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="material_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" {...field}>
                        {Object.entries(MATERIAL_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="module_chapter" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Module / Chapter <span className="text-muted-foreground">(optional)</span></FormLabel>
                    <FormControl><Input placeholder="e.g. Chapter 3" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          {/* Visibility */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Access Control</CardTitle>
              <CardDescription>Who can access this material once published.</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="visibility" render={({ field }) => (
                <FormItem>
                  <FormLabel>Visibility <span className="text-destructive">*</span></FormLabel>
                  <div className="space-y-2 mt-2">
                    {(Object.entries(VISIBILITY_LABELS) as [MaterialVisibility, string][]).map(([value, label]) => (
                      <label key={value} className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${field.value === value ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                        <input type="radio" className="mt-0.5" value={value} checked={field.value === value} onChange={() => field.onChange(value)} />
                        <div>
                          <p className="text-sm font-medium text-foreground">{value}</p>
                          <p className="text-xs text-muted-foreground">{label}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <FormDescription className="mt-2">Default is COURSE. Never set to PUBLIC unless explicitly approved by an administrator.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/lecturer/materials")} className="flex-1">
              Cancel
            </Button>
          <Button type="submit" disabled={isSubmitting || !selectedFile || !selectedCourseId || coursesPending || coursesError} className="flex-1">
              {isSubmitting ? "Uploading..." : <><Upload className="mr-2 h-4 w-4" />Upload Material</>}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Material will be saved as a <strong>draft</strong>. Go to Materials to publish it.
          </p>
        </form>
      </Form>
    </div>
  );
}
