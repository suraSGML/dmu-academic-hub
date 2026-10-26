import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DollarSign, CheckCircle2, AlertCircle, RefreshCw, Search, Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { UserAvatar } from "@/components/common/UserAvatar";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { fineService, auditService } from "@/services/adminService";
import type { Fine } from "@/services/adminService";
import { formatDate, formatDateTime } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-red-100 text-red-700 border-red-200",
  PAID:    "bg-green-100 text-green-700 border-green-200",
  WAIVED:  "bg-gray-100 text-gray-600 border-gray-200",
};

export function FineManagementPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [waiveTarget, setWaiveTarget] = useState<Fine | null>(null);
  const [waiveReason, setWaiveReason] = useState("");

  const { data: result, isPending, isError, refetch } = useQuery({
    queryKey: ["fines-all", statusFilter],
    queryFn:  () =>
      fineService.list({
        status: statusFilter as "PENDING" | "PAID" | "WAIVED" | undefined || undefined,
        limit:  200,
      }),
  });

  const fines = (result?.data ?? []).filter(f => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = (f.student as any)?.full_name?.toLowerCase() ?? "";
    const email = (f.student as any)?.email?.toLowerCase() ?? "";
    const title = (f.borrowing as any)?.book?.title?.toLowerCase() ?? "";
    return name.includes(q) || email.includes(q) || title.includes(q);
  });

  const totalPending = (result?.data ?? [])
    .filter(f => f.status === "PENDING")
    .reduce((s, f) => s + f.amount, 0);

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => fineService.markPaid(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["fines-all"] });
      toast({ title: "Fine marked as paid" });
      auditService.log({ action: "FINE_PAID", resourceType: "fine", resourceId: id });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const waiveMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      fineService.waive(id, profile!.id, reason),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["fines-all"] });
      toast({ title: "Fine waived" });
      auditService.log({ action: "FINE_WAIVED", resourceType: "fine", resourceId: id, details: { reason: waiveReason } });
      setWaiveTarget(null);
      setWaiveReason("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="page-header mb-0">
          <h1 className="page-title">Fine Management</h1>
          <p className="page-description">
            View, collect, and waive overdue fines for library borrowings.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />Refresh
        </Button>
      </div>

      {/* Summary */}
      {totalPending > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50/60 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <p className="text-sm text-red-800">
            <strong>ETB {totalPending.toFixed(2)}</strong> in pending fines across{" "}
            {(result?.data ?? []).filter(f => f.status === "PENDING").length} borrowing(s).
          </p>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="WAIVED">Waived</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search student or book..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 w-56"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {isPending ? (
        <LoadingSkeleton rows={6} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : fines.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No fines found"
          description="Fines are created when books are returned overdue. Apply migration 009 to enable this feature."
        />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                {["Student", "Book", "Days Overdue", "Amount (ETB)", "Status", "Date", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fines.map(f => (
                <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserAvatar name={(f.student as any)?.full_name} size="sm" />
                      <div>
                        <p className="font-medium text-sm">{(f.student as any)?.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{(f.student as any)?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm line-clamp-1">
                      {(f.borrowing as any)?.book?.title ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Due: {f.borrowing?.due_date ? formatDate(f.borrowing.due_date) : "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="destructive">{f.days_overdue} day{f.days_overdue !== 1 ? "s" : ""}</Badge>
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {f.amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[f.status] ?? ""}`}>
                      {f.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(f.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {f.status === "PENDING" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => markPaidMutation.mutate(f.id)}
                          disabled={markPaidMutation.isPending}
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Mark Paid
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setWaiveTarget(f)}
                        >
                          Waive
                        </Button>
                      </div>
                    )}
                    {f.status === "WAIVED" && f.waive_reason && (
                      <p className="text-xs text-muted-foreground italic max-w-[140px] truncate" title={f.waive_reason}>
                        "{f.waive_reason}"
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Waive Dialog */}
      <Dialog open={!!waiveTarget} onOpenChange={open => { if (!open) { setWaiveTarget(null); setWaiveReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Waive Fine</DialogTitle>
          </DialogHeader>
          {waiveTarget && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <p><span className="font-medium">Student:</span> {(waiveTarget.student as any)?.full_name}</p>
                <p><span className="font-medium">Book:</span> {(waiveTarget.borrowing as any)?.book?.title}</p>
                <p><span className="font-medium">Amount:</span> ETB {waiveTarget.amount.toFixed(2)}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="waive-reason">Reason for waiver *</Label>
                <Textarea
                  id="waive-reason"
                  placeholder="e.g. Medical emergency, administrative error..."
                  value={waiveReason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setWaiveReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setWaiveTarget(null); setWaiveReason(""); }}>
              Cancel
            </Button>
            <Button
              onClick={() => waiveTarget && waiveMutation.mutate({ id: waiveTarget.id, reason: waiveReason })}
              disabled={!waiveReason.trim() || waiveMutation.isPending}
            >
              Confirm Waiver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
