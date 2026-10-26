import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FlaskConical, Check, X, Eye, Trash2, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { researchService } from "@/services/researchService";
import { RESEARCH_TYPE_LABELS, RESEARCH_VISIBILITY_LABELS, type ResearchVisibility } from "@/types/research.types";
import type { ResearchResource, ResearchApprovalStatus } from "@/types/research.types";
import { formatDate, formatFileSize } from "@/lib/utils";

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "PENDING",  label: "Pending Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "",         label: "All" },
];

const rejectSchema = z.object({
  reason: z.string().min(10, "Please provide a reason of at least 10 characters"),
});
const visibilitySchema = z.object({
  visibility: z.enum(["PRIVATE", "DMU_ONLY", "DEPARTMENT", "PUBLIC"]),
});

export function AdminResearchPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [search, setSearch] = useState("");
  const [rejectTarget, setRejectTarget] = useState<ResearchResource | null>(null);
  const [visibilityTarget, setVisibilityTarget] = useState<ResearchResource | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ResearchResource | null>(null);

  const { data: result, isPending, isError, refetch } = useQuery({
    queryKey: ["admin-research", statusFilter, search],
    queryFn: () => researchService.list({
      approvalStatus: statusFilter as ResearchApprovalStatus || undefined,
      search: search || undefined,
      limit: 100,
    }),
  });

  const rejectForm = useForm<z.infer<typeof rejectSchema>>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { reason: "" },
  });

  const visibilityForm = useForm<z.infer<typeof visibilitySchema>>({
    resolver: zodResolver(visibilitySchema),
    defaultValues: { visibility: "DMU_ONLY" },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => researchService.approve(id, profile!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-research"] });
      toast({ title: "Research approved and published" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: (v: z.infer<typeof rejectSchema>) =>
      researchService.reject(rejectTarget!.id, v.reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-research"] });
      setRejectTarget(null);
      toast({ title: "Research rejected" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const visibilityMutation = useMutation({
    mutationFn: (v: z.infer<typeof visibilitySchema>) =>
      researchService.updateVisibility(visibilityTarget!.id, v.visibility),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-research"] });
      setVisibilityTarget(null);
      toast({ title: "Visibility updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => researchService.delete(deleteTarget!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-research"] });
      setDeleteTarget(null);
      toast({ title: "Research deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resources = result?.data ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Research Management</h1>
        <p className="page-description">Review, approve, and manage research submissions from DMU students and lecturers.</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1 border-b sm:border-b-0">
          {STATUS_TABS.map(t => (
            <button key={t.value} onClick={() => setStatusFilter(t.value)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${statusFilter === t.value ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search research..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {isPending ? <LoadingSkeleton rows={5} /> : isError ? <ErrorState onRetry={refetch} /> : !resources.length ? (
        <EmptyState icon={FlaskConical} title={`No ${statusFilter.toLowerCase() || ""} research submissions`} description="Research submissions will appear here." />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{result?.count ?? 0} submission(s)</p>
          {resources.map(r => (
            <div key={r.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">{RESEARCH_TYPE_LABELS[r.resource_type]}</Badge>
                    <StatusBadge status={r.approval_status} />
                    <Badge variant="outline" className="text-xs">{r.visibility}</Badge>
                  </div>
                  <Link to={`/research/${r.id}`} className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-1">
                    {r.title}
                  </Link>
                  {r.authors && r.authors.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {r.authors.sort((a,b) => a.author_order - b.author_order).map(a => a.author_name).join(", ")}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {r.department && <span>{r.department.name}</span>}
                    {r.academic_year && <span>· {r.academic_year.name}</span>}
                    <span>· Submitted by {r.submitter?.full_name ?? r.submitter?.email}</span>
                    <span>· {formatDate(r.created_at)}</span>
                    {r.file_size && <span>· {formatFileSize(r.file_size)}</span>}
                  </div>
                  {r.rejection_reason && (
                    <p className="mt-1 text-xs text-destructive">Rejection: {r.rejection_reason}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" asChild title="View">
                    <Link to={`/research/${r.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                  </Button>
                  <Button size="sm" variant="ghost" title="Change visibility"
                    onClick={() => { setVisibilityTarget(r); visibilityForm.reset({ visibility: r.visibility }); }}>
                    <span className="text-xs">Visibility</span>
                  </Button>
                  {r.approval_status === "PENDING" && (
                    <>
                      <Button size="sm" variant="ghost" className="text-green-600 hover:text-green-700"
                        onClick={() => approveMutation.mutate(r.id)} title="Approve">
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                        onClick={() => { setRejectTarget(r); rejectForm.reset({ reason: "" }); }} title="Reject">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {r.approval_status === "REJECTED" && (
                    <Button size="sm" variant="ghost" className="text-green-600"
                      onClick={() => approveMutation.mutate(r.id)} title="Approve">
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(r)} title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={o => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Research Submission</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground line-clamp-2">{rejectTarget?.title}</p>
          <Form {...rejectForm}>
            <form onSubmit={rejectForm.handleSubmit(v => rejectMutation.mutate(v))} className="space-y-4">
              <FormField control={rejectForm.control} name="reason" render={({ field }) => (
                <FormItem>
                  <FormLabel>Rejection Reason <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" placeholder="Explain why this submission is being rejected..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
                <Button type="submit" variant="destructive" disabled={rejectMutation.isPending}>
                  {rejectMutation.isPending ? "Rejecting..." : "Reject"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Visibility dialog */}
      <Dialog open={!!visibilityTarget} onOpenChange={o => !o && setVisibilityTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Visibility — {visibilityTarget?.title?.slice(0, 50)}</DialogTitle></DialogHeader>
          <Form {...visibilityForm}>
            <form onSubmit={visibilityForm.handleSubmit(v => visibilityMutation.mutate(v))} className="space-y-4">
              <FormField control={visibilityForm.control} name="visibility" render={({ field }) => (
                <FormItem>
                  <FormLabel>Visibility</FormLabel>
                  <div className="space-y-2">
                    {(Object.entries(RESEARCH_VISIBILITY_LABELS) as [ResearchVisibility, string][]).map(([value, label]) => (
                      <label key={value} className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${field.value === value ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                        <input type="radio" className="mt-0.5" value={value} checked={field.value === value} onChange={() => field.onChange(value)} />
                        <div><p className="text-sm font-medium">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
                      </label>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setVisibilityTarget(null)}>Cancel</Button>
                <Button type="submit" disabled={visibilityMutation.isPending}>
                  {visibilityMutation.isPending ? "Saving..." : "Update"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={o => !o && setDeleteTarget(null)}
        title="Delete Research"
        description={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate()}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
