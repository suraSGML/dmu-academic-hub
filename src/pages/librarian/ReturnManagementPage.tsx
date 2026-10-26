import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, Search, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { UserAvatar } from "@/components/common/UserAvatar";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "@/hooks/use-toast";
import { borrowingService, bookCopyService } from "@/services/libraryService";
import { formatDate } from "@/lib/utils";
import type { Borrowing } from "@/types/library.types";

type ReturnStatus = "RETURNED" | "LOST" | "DAMAGED";

export function ReturnManagementPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [qrInput, setQrInput] = useState("");
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState<Borrowing | null>(null);
  const [returnStatus, setReturnStatus] = useState<ReturnStatus>("RETURNED");
  const [returnNotes, setReturnNotes] = useState("");
  const [qrCopyInfo, setQrCopyInfo] = useState<any>(null);
  const [qrBorrowing, setQrBorrowing] = useState<any>(null);

  const { data: result, isPending, isError, refetch } = useQuery({
    queryKey: ["borrowings", "ACTIVE,OVERDUE"],
    queryFn: () => borrowingService.list({ status: ["ACTIVE", "OVERDUE"] as any, limit: 200 }),
  });

  const returnMutation = useMutation({
    mutationFn: () => borrowingService.processReturn(
      returnTarget!.id,
      returnTarget!.book_copy_id,
      returnStatus,
      returnNotes || undefined
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["borrowings"] });
      qc.invalidateQueries({ queryKey: ["books"] });
      setReturnTarget(null);
      setReturnNotes("");
      toast({ title: returnStatus === "RETURNED" ? "Book returned successfully" : `Book marked as ${returnStatus.toLowerCase()}` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const scanQR = async () => {
    if (!qrInput.trim()) return;
    try {
      const copy = await bookCopyService.getByQR(qrInput.trim());
      setQrCopyInfo(copy);
      if (copy.status === "BORROWED") {
        const borrowing = await borrowingService.getActiveBorrowingForCopy(copy.id);
        setQrBorrowing(borrowing);
      } else {
        setQrBorrowing(null);
      }
    } catch {
      toast({ title: "QR code not found", description: "No book copy found with this QR code.", variant: "destructive" });
    }
  };

  const filtered = (result?.data ?? []).filter(b => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (b.book as any)?.title?.toLowerCase().includes(s) ||
      (b.student as any)?.full_name?.toLowerCase().includes(s) ||
      (b.student as any)?.student_id?.toLowerCase().includes(s) ||
      (b.book_copy as any)?.accession_number?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Return Management</h1>
          <p className="page-description">Process book returns manually or via QR code.</p>
        </div>
        <Button variant="outline" onClick={() => { setQrCopyInfo(null); setQrBorrowing(null); setQrInput(""); setQrDialogOpen(true); }}>
          <QrCode className="mr-2 h-4 w-4" />QR Return
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by title, student name, student ID, accession..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isPending ? <LoadingSkeleton rows={6} /> : isError ? <ErrorState onRetry={refetch} /> : !filtered.length ? (
        <EmptyState icon={ArrowDownToLine} title="No active borrowings" description="All books have been returned." />
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{filtered.length} active borrowing(s)</p>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  {["Student", "Book", "Accession", "Borrowed", "Due Date", "Status", "Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => {
                  const isOverdue = new Date(b.due_date) < new Date();
                  return (
                    <tr key={b.id} className={`border-b last:border-0 hover:bg-muted/30 ${isOverdue ? "bg-red-50/50" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <UserAvatar name={(b.student as any)?.full_name} size="sm" />
                          <div>
                            <p className="font-medium text-sm">{(b.student as any)?.full_name ?? "—"}</p>
                            <p className="text-xs text-muted-foreground">{(b.student as any)?.student_id ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm line-clamp-1">{(b.book as any)?.title ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{(b.book_copy as any)?.accession_number ?? "—"}</td>
                      <td className="px-4 py-3 text-sm">{formatDate(b.borrow_date)}</td>
                      <td className={`px-4 py-3 text-sm font-medium ${isOverdue ? "text-destructive" : ""}`}>
                        {formatDate(b.due_date)}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      <td className="px-4 py-3">
                        <Button size="sm" onClick={() => { setReturnTarget(b); setReturnStatus("RETURNED"); setReturnNotes(""); }}>
                          Process Return
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Return confirmation dialog */}
      <Dialog open={!!returnTarget} onOpenChange={o => !o && setReturnTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Return</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border p-3 bg-muted/30 space-y-1">
              <p className="font-medium">{(returnTarget?.book as any)?.title}</p>
              <p className="text-sm text-muted-foreground">Accession: {(returnTarget?.book_copy as any)?.accession_number}</p>
              <p className="text-sm text-muted-foreground">Student: {(returnTarget?.student as any)?.full_name}</p>
              <p className="text-sm text-muted-foreground">Due: {returnTarget ? formatDate(returnTarget.due_date) : "—"}</p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Return condition</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={returnStatus}
                onChange={e => setReturnStatus(e.target.value as ReturnStatus)}
              >
                <option value="RETURNED">Returned — Good condition</option>
                <option value="DAMAGED">Returned — Damaged</option>
                <option value="LOST">Lost / Not returned</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Notes <span className="text-muted-foreground">(optional)</span></label>
              <Input value={returnNotes} onChange={e => setReturnNotes(e.target.value)} placeholder="Any notes about this return..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnTarget(null)}>Cancel</Button>
            <Button onClick={() => returnMutation.mutate()} disabled={returnMutation.isPending}>
              {returnMutation.isPending ? "Processing..." : "Confirm Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Return Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>QR Code Return</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Scan or enter QR code (e.g. DMU-LIB-BOOK-001234)"
                value={qrInput}
                onChange={e => setQrInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && scanQR()}
              />
              <Button onClick={scanQR}>Scan</Button>
            </div>

            {qrCopyInfo && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="font-medium">{qrCopyInfo.book?.title}</p>
                <p className="text-sm text-muted-foreground">Accession: {qrCopyInfo.accession_number}</p>
                <p className="text-sm">Status: <StatusBadge status={qrCopyInfo.status} /></p>

                {qrBorrowing && (
                  <div className="mt-2 pt-2 border-t space-y-1">
                    <p className="text-sm font-medium">Active Borrowing Found</p>
                    <p className="text-sm text-muted-foreground">Student: {(qrBorrowing.student as any)?.full_name}</p>
                    <p className="text-sm text-muted-foreground">Due: {formatDate(qrBorrowing.due_date)}</p>
                    <Button
                      className="mt-2 w-full"
                      onClick={() => {
                        setReturnTarget(qrBorrowing);
                        setQrDialogOpen(false);
                        setReturnStatus("RETURNED");
                      }}
                    >
                      Process Return for this Borrowing
                    </Button>
                  </div>
                )}

                {qrCopyInfo.status === "AVAILABLE" && (
                  <p className="text-sm text-green-600 font-medium">This copy is available — not currently borrowed.</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
