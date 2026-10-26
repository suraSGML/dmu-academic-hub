import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useAuth } from "@/hooks/useAuth";
import { reservationService } from "@/services/libraryService";
import { formatDate } from "@/lib/utils";
import { useState } from "react";
import type { Reservation } from "@/types/library.types";

export function ReservationsPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);

  const { data: reservations, isPending, isError, refetch } = useQuery({
    queryKey: ["student-reservations", profile?.id],
    queryFn: () => reservationService.list({ studentId: profile!.id }),
    enabled: !!profile?.id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => reservationService.cancel(cancelTarget!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-reservations"] });
      setCancelTarget(null);
    },
  });

  const active = (reservations ?? []).filter(r => ["PENDING", "READY"].includes(r.status));
  const past = (reservations ?? []).filter(r => ["FULFILLED", "CANCELLED", "EXPIRED"].includes(r.status));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Reservations</h1>
        <p className="page-description">Books you have reserved from the library.</p>
      </div>

      {isPending ? <LoadingSkeleton rows={4} /> : isError ? <ErrorState onRetry={refetch} /> : (
        <div className="space-y-6">
          {/* Active reservations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Active Reservations ({active.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {active.length === 0 ? (
                <EmptyState
                  icon={CalendarClock}
                  title="No active reservations"
                  description="When all copies of a book are borrowed, you can reserve it and be notified when it's available."
                  actionLabel="Browse Library"
                  onAction={() => {}}
                />
              ) : (
                <div className="space-y-3">
                  {active.map(r => (
                    <div key={r.id} className={`flex items-start gap-4 rounded-lg border p-4 ${r.status === "READY" ? "border-green-200 bg-green-50/50" : ""}`}>
                      <div className="flex h-12 w-10 shrink-0 items-center justify-center rounded bg-muted">
                        <CalendarClock className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link to={`/library/books/${r.book_id}`} className="font-semibold text-sm hover:text-primary transition-colors line-clamp-1">
                          {(r.book as any)?.title ?? "—"}
                        </Link>
                        <p className="text-xs text-muted-foreground">{(r.book as any)?.author}</p>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>Reserved: {formatDate(r.reservation_date)}</span>
                          {r.expiry_date && <span>Expires: {formatDate(r.expiry_date)}</span>}
                        </div>
                        {r.status === "READY" && (
                          <p className="mt-1 text-xs font-medium text-green-700">
                            A copy is ready for pickup — visit the library desk.
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <StatusBadge status={r.status} />
                        {r.status === "PENDING" && (
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-7 text-xs"
                            onClick={() => setCancelTarget(r)}>
                            <X className="mr-1 h-3 w-3" />Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Past reservations */}
          {past.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Past Reservations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        {["Book", "Reserved", "Status"].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {past.map(r => (
                        <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-3 py-2">
                            <Link to={`/library/books/${r.book_id}`} className="font-medium hover:text-primary">
                              {(r.book as any)?.title ?? "—"}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{formatDate(r.reservation_date)}</td>
                          <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={o => !o && setCancelTarget(null)}
        title="Cancel Reservation"
        description={`Cancel your reservation for "${(cancelTarget?.book as any)?.title}"?`}
        confirmLabel="Cancel Reservation"
        variant="destructive"
        onConfirm={() => cancelMutation.mutate()}
        isLoading={cancelMutation.isPending}
      />
    </div>
  );
}
