import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRef, useState } from "react";
import { ArrowLeft, Upload, FileText, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { CardSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { materialService, validateMaterialFile } from "@/services/materialService";
import {
  MATERIAL_TYPE_LABELS, VISIBILITY_LABELS,
  type MaterialType, type MaterialVisibility,
} from "@/types/material.types";
import { formatDate, formatFileSize } from "@/lib/utils";

const schema = z.object({
  title:          z.string().min(2).max(200),
  description:    z.string().max(1000).optional(),
  material_type:  z.string().min(1),
  module_chapter: z.string().max(100).optional(),
  visibility:     z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

export function MaterialEditPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const { data: material, isPending, isError, refetch } = useQuery({
    queryKey: ["material", id],
    queryFn:  () => materialService.get(id!),
    enabled:  !!id,
  });

  const { data: versions } = useQuery({
    queryKey: ["material-versions", id],
    queryFn:  () => materialService.getVersions(id!),
    enabled:  !!id,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: material ? {
      title:          material.title,
      description:    material.description ?? "",
      material_type:  material.material_type,
      module_chapter: material.module_chapter ?? "",
      visibility:     material.visibility,
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      await materialService.update(id!, {
        title:          values.title,
        description:    values.description || undefined,
        material_type:  values.material_type as MaterialType,
        module_chapter: values.module_chapter || undefined,
        visibility:     values.visibility as MaterialVisibility,
      });
      if (newFile && profile?.id) {
        await materialService.uploadNewVersion(id!, newFile, profile.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material", id] });
      qc.invalidateQueries({ queryKey: ["lecturer-materials"] });
      toast({ title: "Material updated" });
      navigate("/lecturer/materials");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: () => materialService.publish(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material", id] });
      toast({ title: "Material published — students can now access it" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unpublishMutation = useMutation({
    mutationFn: () => materialService.unpublish(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material", id] });
      toast({ title: "Material unpublished" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateMaterialFile(file);
    if (err) { setFileError(err); return; }
    setFileError(null);
    setNewFile(file);
  };

  if (isPending) return <div className="space-y-4"><CardSkeleton /><CardSkeleton /></div>;
  if (isError || !material) return <ErrorState onRetry={refetch} title="Material not found" />;

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/lecturer/materials"><ArrowLeft className="mr-2 h-4 w-4" />Materials</Link>
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div className="page-header mb-0">
          <h1 className="page-title">Edit Material</h1>
          <p className="page-description">{material.title}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {material.publication_status === "DRAFT" ? (
            <Button variant="outline" className="text-green-600 border-green-200 hover:bg-green-50"
              onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
              {publishMutation.isPending ? "Publishing..." : "Publish"}
            </Button>
          ) : material.publication_status === "PUBLISHED" ? (
            <Button variant="outline" className="text-amber-600 border-amber-200"
              onClick={() => unpublishMutation.mutate()} disabled={unpublishMutation.isPending}>
              Unpublish
            </Button>
          ) : null}
        </div>
      </div>

      {/* Status + info */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-4 items-center">
          <StatusBadge status={material.publication_status} />
          <span className="text-sm text-muted-foreground">Version {material.version}</span>
          <span className="text-sm text-muted-foreground">{material.download_count} downloads · {material.view_count} views</span>
          <span className="text-sm text-muted-foreground">Uploaded {formatDate(material.created_at)}</span>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(v => updateMutation.mutate(v))} className="space-y-5">
          {/* Metadata */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Material Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="material_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <FormControl>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...field}>
                        {Object.entries(MATERIAL_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="module_chapter" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Module / Chapter</FormLabel>
                    <FormControl><Input placeholder="Chapter 3" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          {/* Visibility */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Visibility</CardTitle></CardHeader>
            <CardContent>
              <FormField control={form.control} name="visibility" render={({ field }) => (
                <FormItem>
                  <div className="space-y-2">
                    {(Object.entries(VISIBILITY_LABELS) as [MaterialVisibility, string][]).map(([value, label]) => (
                      <label key={value} className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${field.value === value ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                        <input type="radio" className="mt-0.5" value={value} checked={field.value === value} onChange={() => field.onChange(value)} />
                        <div>
                          <p className="text-sm font-medium">{value}</p>
                          <p className="text-xs text-muted-foreground">{label}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Replace file */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Replace File</CardTitle>
              <CardDescription>Upload a new version of this material. The old file will be kept in version history.</CardDescription>
            </CardHeader>
            <CardContent>
              {material.file_name && (
                <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  Current: {material.file_name} ({material.file_size ? formatFileSize(material.file_size) : "unknown size"})
                </div>
              )}
              {newFile ? (
                <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
                  <FileText className="h-6 w-6 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{newFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(newFile.size)}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => { setNewFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />Select new file
                </Button>
              )}
              <input ref={fileInputRef} type="file" className="hidden"
                accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.zip,.jpg,.jpeg,.png"
                onChange={handleFileSelect} />
              {fileError && <p className="mt-2 text-sm text-destructive">{fileError}</p>}
            </CardContent>
          </Card>

          {/* Version history */}
          {versions && versions.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Version History ({versions.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {versions.map(v => (
                    <div key={v.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">v{v.version}</Badge>
                        <span className="text-muted-foreground">{v.file_name ?? "—"}</span>
                        {v.file_size && <span className="text-xs text-muted-foreground">{formatFileSize(v.file_size)}</span>}
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(v.created_at)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/lecturer/materials")} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={updateMutation.isPending} className="flex-1">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
