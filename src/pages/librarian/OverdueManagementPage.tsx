import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { UserAvatar } from "@/components/common/UserAvatar";
import { toast } from "@/hooks/use-toast";
import { borrowingService } from "@/services/libraryService";
import { formatDate } from "@/lib/utils";

export function OverdueManagementPage() {
  const location = useLocation();
  const libraryBase = location.pathname.startsWith("/admin/library") ? "/admin/library" : "/librarian";
  const qc = useQueryClient();

  const { data: result, isPending, isError, refetch } = useQuery({
    queryKey: ["borrowings-overdue"],
    queryFn: () => borrowingService.list({ status: "OVERDUE", limit: 200 }),
  });

  // Also get ACTIVE loans that are past due date
  const { data: activePastDue } = useQuery({
    queryKey: ["borrowings-past-due"],
    queryFn: () => borrowingService.list({ status: "ACTIVE", limit: 500 }),
  });

  const syncMutation = useMutation({
    mutationFn: borrowingService.markOverdue,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["borrowings-overdue"] });
      qc.invalidateQueries({ queryKey: ["borrowings-past-due"] });
      refetch();
      toast({ title: "Overdue status synced" });
    },
  });

  // Combine: confirmed OVERDUE + ACTIVE past due date
  const todayStr = new Date().toISOString().split("T")[0];
  const pastDue = (activePastDue?.data ?? []).filter(b => b.due_date < todayStr);
  const allOverdue = [...(result?.data ?? []), ...pastDue];
  // Deduplicate by id
  const seen = new Set<string>();
  const overdueList = allOverdue.filter(b => { if (seen.has(b.id)) return false; seen.add(b.id); return true; });

  const daysOverdue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Overdue Management</h1>
          <p className="page-description">Books past their due date that haven't been returned.</p>
        </div>
        <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
          <RefreshCw className="mr-2 h-4 w-4" />Sync Overdue Status
        </Button>
      </div>

      {overdueList.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">
            {overdueList.length} overdue borrowing{overdueList.length !== 1 ? "s" : ""} — contact students for return.
          </p>
        </div>
      )}

      {isPending ? <LoadingSkeleton rows={5} /> : isError ? <ErrorState onRetry={refetch} /> : !overdueList.length ? (
        <EmptyState icon={AlertCircle} title="No overdue books" description="All borrowed books are within their due dates." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                {["Student", "Book", "Accession", "Due Date", "Days Overdue", "Renewals", "Action"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {overdueList.map(b => {
                const days = daysOverdue(b.due_date);
                return (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UserAvatar name={(b.student as any)?.full_name} size="sm" />
                        <div>
                          <p className="font-medium text-sm">{(b.student as any)?.full_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{(b.student as any)?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm line-clamp-1">{(b.book as any)?.title ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{(b.book_copy as any)?.accession_number ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-destructive font-medium">{formatDate(b.due_date)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="destructive">{days} day{days !== 1 ? "s" : ""}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">{b.renewal_count}</td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`${libraryBase}/returns`}>Process Return</Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
