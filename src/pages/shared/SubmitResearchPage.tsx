import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { Upload, FileText, X, Plus, ArrowLeft, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { researchService } from "@/services/researchService";
import { departmentService, programService, academicYearService } from "@/services/academicService";
import {
  RESEARCH_TYPE_LABELS, RESEARCH_VISIBILITY_LABELS,
  type ResearchType, type ResearchVisibility,
} from "@/types/research.types";
import { formatFileSize } from "@/lib/utils";

const schema = z.object({
  title:            z.string().min(5, "Title must be at least 5 characters").max(300),
  abstract:         z.string().max(3000).optional(),
  resource_type:    z.string().min(1, "Select a type"),
  department_id:    z.string().optional(),
  program_id:       z.string().optional(),
  academic_year_id: z.string().optional(),
  supervisor:       z.string().max(200).optional(),
  publication_date: z.string().optional(),
  visibility:       z.string().min(1, "Select visibility"),
});
type FormValues = z.infer<typeof schema>;

export function SubmitResearchPage() {
  const { profile } = useAuth();
  const { isLecturer, isAdmin } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLecturer && !isAdmin) {
      toast({
        title: "Access Restricted",
        description: "Only lecturers and administrators are authorized to submit research.",
        variant: "destructive",
      });
      navigate("/research", { replace: true });
    }
  }, [isLecturer, isAdmin, navigate]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [authors, setAuthors] = useState<string[]>(
    profile?.full_name ? [profile.full_name] : [""]
  );
  const [keywords, setKeywords] = useState<string[]>([""]);

  const { data: departments } = useQuery({ queryKey: ["departments"], queryFn: () => departmentService.list() });
  const { data: programs }    = useQuery({ queryKey: ["programs"],    queryFn: () => programService.list() });
  const { data: years }       = useQuery({ queryKey: ["academic-years"], queryFn: academicYearService.list });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "", abstract: "", resource_type: "THESIS",
      department_id: profile?.department_id ?? "",
      visibility: "DMU_ONLY",
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip"];
    if (!allowed.includes(file.type)) {
      setFileError("Only PDF, DOC, DOCX, and ZIP files are allowed.");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setFileError("File is too large. Maximum 100 MB.");
      return;
    }
    setFileError(null);
    setSelectedFile(file);
  };

  const submitMutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!selectedFile) throw new Error("Please select a file.");
      if (!profile?.id)  throw new Error("Not authenticated.");
      return researchService.submit({
        title:            values.title,
        abstract:         values.abstract,
        resource_type:    values.resource_type as ResearchType,
        department_id:    values.department_id || undefined,
        program_id:       values.program_id || undefined,
        academic_year_id: values.academic_year_id || undefined,
        supervisor:       values.supervisor,
        publication_date: values.publication_date,
        visibility:       values.visibility as ResearchVisibility,
        authors:          authors.filter(a => a.trim()),
        keywords:         keywords.filter(k => k.trim()),
        file:             selectedFile,
      }, profile.id);
    },
    onSuccess: () => {
      toast({
        title: "Research submitted",
        description: "Your submission is pending review by an administrator.",
      });
      navigate("/research");
    },
    onError: (e: Error) => toast({ title: "Submission failed", description: e.message, variant: "destructive" }),
  });

  const addAuthor   = () => setAuthors(prev => [...prev, ""]);
  const removeAuthor = (i: number) => setAuthors(prev => prev.filter((_, idx) => idx !== i));
  const updateAuthor = (i: number, v: string) => setAuthors(prev => prev.map((a, idx) => idx === i ? v : a));

  const addKeyword    = () => setKeywords(prev => [...prev, ""]);
  const removeKeyword = (i: number) => setKeywords(prev => prev.filter((_, idx) => idx !== i));
  const updateKeyword = (i: number, v: string) => setKeywords(prev => prev.map((k, idx) => idx === i ? v : k));

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/research"><ArrowLeft className="mr-2 h-4 w-4" />Research Repository</Link>
      </Button>

      <div className="page-header">
        <h1 className="page-title">Submit Research</h1>
        <p className="page-description">Submit your thesis, graduation project, or research paper for review.</p>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50/60 p-4 flex gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          Submissions are reviewed by an administrator before becoming visible to others.
          Public visibility requires explicit approval.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(v => submitMutation.mutate(v))} className="space-y-5">
          {/* Type + Title */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField control={form.control} name="resource_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" {...field}>
                      {Object.entries(RESEARCH_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="Full title of your research..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="abstract" render={({ field }) => (
                <FormItem>
                  <FormLabel>Abstract</FormLabel>
                  <FormControl>
                    <textarea
                      className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                      placeholder="Brief summary of your research..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="supervisor" render={({ field }) => (
                <FormItem>
                  <FormLabel>Supervisor <span className="text-muted-foreground">(optional)</span></FormLabel>
                  <FormControl><Input placeholder="Dr. Name Surname" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Authors */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Authors</CardTitle>
              <CardDescription>List all authors in order. You are automatically added as first author.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {authors.map((author, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder={i === 0 ? "Your name (primary author)" : `Author ${i + 1}`}
                    value={author}
                    onChange={e => updateAuthor(i, e.target.value)}
                  />
                  {authors.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeAuthor(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addAuthor}>
                <Plus className="mr-2 h-4 w-4" />Add Author
              </Button>
            </CardContent>
          </Card>

          {/* Academic details */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Academic Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="department_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...field}>
                        <option value="">Select...</option>
                        {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="program_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Program</FormLabel>
                    <FormControl>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...field}>
                        <option value="">Select...</option>
                        {programs?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="academic_year_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Academic Year</FormLabel>
                    <FormControl>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...field}>
                        <option value="">Select...</option>
                        {years?.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="publication_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Publication Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          {/* Keywords */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Keywords</CardTitle>
              <CardDescription>Add keywords to improve discoverability.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2 mb-2">
                {keywords.filter(k => k.trim()).map((k, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {k}
                    <button type="button" onClick={() => removeKeyword(i)} className="ml-1.5 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              {keywords.map((keyword, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="e.g. machine learning"
                    value={keyword}
                    onChange={e => updateKeyword(i, e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                  />
                  {keywords.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeKeyword(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addKeyword}>
                <Plus className="mr-2 h-4 w-4" />Add Keyword
              </Button>
            </CardContent>
          </Card>

          {/* File upload */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">File Upload</CardTitle>
              <CardDescription>Upload your research document. Max 100 MB. PDF, DOC, DOCX, or ZIP.</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedFile ? (
                <div
                  className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors ${fileError ? "border-destructive" : "border-border"}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { const input = fileInputRef.current; if (input) { const dt = new DataTransfer(); dt.items.add(f); input.files = dt.files; handleFileSelect({ target: input } as any); } } }}
                  onDragOver={e => e.preventDefault()}
                >
                  <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX, ZIP — up to 100 MB</p>
                  <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.zip" onChange={handleFileSelect} />
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                  <FileText className="h-8 w-8 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {fileError && <p className="mt-2 text-sm text-destructive">{fileError}</p>}
            </CardContent>
          </Card>

          {/* Visibility */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Visibility</CardTitle>
              <CardDescription>Who can access this resource once approved.</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField control={form.control} name="visibility" render={({ field }) => (
                <FormItem>
                  <div className="space-y-2">
                    {(Object.entries(RESEARCH_VISIBILITY_LABELS) as [ResearchVisibility, string][]).map(([value, label]) => (
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

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/research")} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={submitMutation.isPending || !selectedFile} className="flex-1">
              {submitMutation.isPending ? "Submitting..." : <><Upload className="mr-2 h-4 w-4" />Submit Research</>}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
