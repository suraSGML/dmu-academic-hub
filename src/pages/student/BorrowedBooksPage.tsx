import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Library, AlertCircle, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { borrowingService } from "@/services/libraryService";
import { formatDate } from "@/lib/utils";

export function BorrowedBooksPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const { data: result, isPending, isError, refetch } = useQuery({
    queryKey: ["student-borrowings", profile?.id],
    queryFn: () => borrowingService.list({ studentId: profile!.id, limit: 50 }),
    enabled: !!profile?.id,
  });

  const syncMutation = useMutation({
    mutationFn: borrowingService.markOverdue,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-borrowings"] }); refetch(); },
  });

  const borrowings = result?.data ?? [];
  const active = borrowings.filter(b => b.status === "ACTIVE");
  const overdue = borrowings.filter(b => b.status === "OVERDUE");
  const history = borrowings.filter(b => b.status === "RETURNED");

  const daysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Borrowed Books</h1>
          <p className="page-description">Your current loans and borrowing history.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
          <RefreshCw className="mr-2 h-4 w-4" />Sync Status
        </Button>
      </div>

      {isPending ? <LoadingSkeleton rows={4} /> : isError ? <ErrorState onRetry={refetch} /> : (
        <div className="space-y-6">

          {/* Overdue alert */}
          {overdue.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive text-sm">
                  You have {overdue.length} overdue book{overdue.length !== 1 ? "s" : ""}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Please return them to the library as soon as possible.
                </p>
              </div>
            </div>
          )}

          {/* Active loans */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Active Loans ({active.length + overdue.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {active.length === 0 && overdue.length === 0 ? (
                <EmptyState icon={Library} title="No active loans" description="Books you borrow will appear here." />
              ) : (
                <div className="space-y-3">
                  {[...overdue, ...active].map(b => {
                    const days = daysUntilDue(b.due_date);
                    const isOverdueItem = b.status === "OVERDUE" || days < 0;
                    const isDueSoon = !isOverdueItem && days <= 3;

                    return (
                      <div key={b.id} className={`flex items-start gap-4 rounded-lg border p-4 transition-colors
                        ${isOverdueItem ? "border-destructive/30 bg-destructive/5" : isDueSoon ? "border-amber-200 bg-amber-50/50" : ""}`}>
                        <div className="flex h-12 w-10 shrink-0 items-center justify-center rounded bg-muted">
                          <Library className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link to={`/library/books/${b.book_id}`} className="font-semibold text-sm hover:text-primary transition-colors line-clamp-1">
                            {(b.book as any)?.title ?? "—"}
                          </Link>
                          <p className="text-xs text-muted-foreground">{(b.book as any)?.author}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>Borrowed: {formatDate(b.borrow_date)}</span>
                            <span className={isOverdueItem ? "text-destructive font-semibold" : isDueSoon ? "text-amber-600 font-semibold" : ""}>
                              Due: {formatDate(b.due_date)}
                              {isOverdueItem ? ` (${Math.abs(days)} days overdue)` : isDueSoon && days >= 0 ? ` (${days} day${days !== 1 ? "s" : ""} left)` : ""}
                            </span>
                            {b.renewal_count > 0 && <span>Renewed: {b.renewal_count}×</span>}
                          </div>
                        </div>
                        <div className="shrink-0">
                          <StatusBadge status={b.status} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Borrowing history */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Borrowing History ({history.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <EmptyState icon={Library} title="No borrowing history" description="Your past borrowings will appear here." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        {["Book", "Borrowed", "Returned", "Status"].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(b => (
                        <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-3 py-2">
                            <Link to={`/library/books/${b.book_id}`} className="font-medium hover:text-primary transition-colors">
                              {(b.book as any)?.title ?? "—"}
                            </Link>
                            <p className="text-xs text-muted-foreground">{(b.book as any)?.author}</p>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{formatDate(b.borrow_date)}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {b.return_date ? formatDate(b.return_date) : "—"}
                          </td>
                          <td className="px-3 py-2"><StatusBadge status={b.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
