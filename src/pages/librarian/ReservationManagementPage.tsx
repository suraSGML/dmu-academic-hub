import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { UserAvatar } from "@/components/common/UserAvatar";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "@/hooks/use-toast";
import { reservationService } from "@/services/libraryService";
import { formatDate } from "@/lib/utils";
import type { Reservation } from "@/types/library.types";

const STATUS_TABS = [
  { value: "PENDING", label: "Pending" },
  { value: "READY",   label: "Ready" },
  { value: "FULFILLED", label: "Fulfilled" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function ReservationManagementPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);

  const { data: reservations, isPending, isError, refetch } = useQuery({
    queryKey: ["reservations", statusFilter],
    queryFn: () => reservationService.list({ status: statusFilter }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "READY" | "FULFILLED" | "CANCELLED" | "EXPIRED" }) =>
      reservationService.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      toast({ title: "Reservation updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => reservationService.cancel(cancelTarget!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      setCancelTarget(null);
      toast({ title: "Reservation cancelled" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Reservation Management</h1>
        <p className="page-description">Manage student book reservations and notify when available.</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b">
        {STATUS_TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setStatusFilter(t.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === t.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isPending ? <LoadingSkeleton rows={5} /> : isError ? <ErrorState onRetry={refetch} /> : !reservations?.length ? (
        <EmptyState icon={CalendarClock} title={`No ${statusFilter.toLowerCase()} reservations`} description="Student reservations will appear here." />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                {["Student", "Book", "Reserved On", "Expires", "Status", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reservations.map(r => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserAvatar name={(r.student as any)?.full_name} size="sm" />
                      <div>
                        <p className="font-medium text-sm">{(r.student as any)?.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{(r.student as any)?.student_id ?? (r.student as any)?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm line-clamp-1">{(r.book as any)?.title ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{(r.book as any)?.author}</p>
                  </td>
                  <td className="px-4 py-3 text-sm">{formatDate(r.reservation_date)}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {r.expiry_date ? formatDate(r.expiry_date) : "—"}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {r.status === "PENDING" && (
                        <>
                          <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => updateMutation.mutate({ id: r.id, status: "READY" })}>
                            <Check className="mr-1 h-3.5 w-3.5" />Ready
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                            onClick={() => setCancelTarget(r)}>
                            <X className="mr-1 h-3.5 w-3.5" />Cancel
                          </Button>
                        </>
                      )}
                      {r.status === "READY" && (
                        <Button size="sm" variant="outline"
                          onClick={() => updateMutation.mutate({ id: r.id, status: "FULFILLED" })}>
                          <Check className="mr-1 h-3.5 w-3.5" />Fulfilled
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={o => !o && setCancelTarget(null)}
        title="Cancel Reservation"
        description={`Cancel ${(cancelTarget?.student as any)?.full_name}'s reservation for "${(cancelTarget?.book as any)?.title}"?`}
        confirmLabel="Cancel Reservation"
        variant="destructive"
        onConfirm={() => cancelMutation.mutate()}
        isLoading={cancelMutation.isPending}
      />
    </div>
  );
}
