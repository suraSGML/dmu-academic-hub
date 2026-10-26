import { useParams, Link, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, BookMarked, Copy, QrCode, MapPin, Hash, AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { toast } from "@/hooks/use-toast";
import { bookService, bookCopyService } from "@/services/libraryService";
import type { BookCopy, CopyStatus } from "@/types/library.types";

const COPY_STATUS_OPTIONS: { value: CopyStatus; label: string }[] = [
  { value: "AVAILABLE",   label: "Available" },
  { value: "MAINTENANCE", label: "In Maintenance" },
  { value: "DAMAGED",     label: "Damaged" },
  { value: "LOST",        label: "Lost" },
];

export function LibrarianBookDetailPage() {
  const location = useLocation();
  const libraryBase = location.pathname.startsWith("/admin/library") ? "/admin/library" : "/librarian";
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [statusTarget, setStatusTarget] = useState<BookCopy | null>(null);
  const [newStatus, setNewStatus] = useState<CopyStatus>("AVAILABLE");
  const [deleteTarget, setDeleteTarget] = useState<BookCopy | null>(null);

  const { data: book, isPending, isError, refetch } = useQuery({
    queryKey: ["book", id],
    queryFn: () => bookService.get(id!),
    enabled: !!id,
  });

  const { data: copies, refetch: refetchCopies } = useQuery({
    queryKey: ["book-copies", id],
    queryFn: () => bookCopyService.listByBook(id!),
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: () => bookCopyService.updateStatus(statusTarget!.id, newStatus),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["book-copies", id] });
      qc.invalidateQueries({ queryKey: ["book", id] });
      setStatusTarget(null);
      toast({ title: "Copy status updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteCopyMutation = useMutation({
    mutationFn: () => bookCopyService.delete(deleteTarget!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["book-copies", id] });
      qc.invalidateQueries({ queryKey: ["book", id] });
      setDeleteTarget(null);
      toast({ title: "Copy removed" });
    },
    onError: (e: Error) => toast({ title: "Cannot delete", description: e.message, variant: "destructive" }),
  });

  if (isPending) return <div className="space-y-4"><LoadingSkeleton rows={4} /></div>;
  if (isError || !book) return <ErrorState onRetry={refetch} title="Book not found" />;

  const availableCount = copies?.filter(c => c.status === "AVAILABLE").length ?? 0;
  const borrowedCount = copies?.filter(c => c.status === "BORROWED").length ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to={`${libraryBase}/books`}><ArrowLeft className="mr-2 h-4 w-4" />Books</Link>
      </Button>

      {/* Book header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-5">
            {book.cover_url ? (
              <img src={book.cover_url} alt={book.title} className="h-32 w-24 rounded-md object-cover shadow-sm shrink-0" />
            ) : (
              <div className="flex h-32 w-24 shrink-0 items-center justify-center rounded-md bg-muted">
                <BookMarked className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground">{book.title}</h1>
              <p className="mt-0.5 text-base text-muted-foreground">{book.author}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(book.category as any)?.name && <Badge variant="secondary">{(book.category as any).name}</Badge>}
                {book.edition && <Badge variant="outline">{book.edition} edition</Badge>}
                <Badge variant={availableCount > 0 ? "success" : "destructive"}>
                  {availableCount} of {book.total_copies} available
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-4">
                {book.isbn && <span><strong>ISBN:</strong> {book.isbn}</span>}
                {book.publisher && <span><strong>Publisher:</strong> {book.publisher}</span>}
                {book.publication_year && <span><strong>Year:</strong> {book.publication_year}</span>}
                {(book.location as any)?.name && <span><strong>Location:</strong> {(book.location as any).name}</span>}
              </div>
              {book.description && <p className="mt-3 text-sm text-muted-foreground">{book.description}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Copies stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Copies", value: book.total_copies, color: "text-foreground" },
          { label: "Available", value: availableCount, color: "text-green-600" },
          { label: "Borrowed", value: borrowedCount, color: "text-amber-600" },
          { label: "Lost/Damaged", value: (copies?.filter(c => ["LOST","DAMAGED"].includes(c.status)).length ?? 0), color: "text-destructive" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Copies list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Copy className="h-4 w-4" /> Book Copies ({copies?.length ?? 0})
          </CardTitle>
          <Button size="sm" asChild>
            <Link to={`${libraryBase}/copies?bookId=${id}`}>Manage Copies</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!copies?.length ? (
            <EmptyState icon={Copy} title="No copies" description="Add physical copies to make this book borrowable." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    {["Accession No.", "QR Code", "Condition", "Status", "Location", "Actions"].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {copies.map(copy => (
                    <tr key={copy.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs">{copy.accession_number}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{copy.qr_code ?? "—"}</td>
                      <td className="px-3 py-2"><Badge variant="outline">{copy.condition}</Badge></td>
                      <td className="px-3 py-2"><StatusBadge status={copy.status} /></td>
                      <td className="px-3 py-2 text-muted-foreground">{(copy.location as any)?.code ?? "—"}</td>
                      <td className="px-3 py-2">
                        {["AVAILABLE", "MAINTENANCE"].includes(copy.status) && (
                          <Button size="sm" variant="ghost" onClick={() => { setStatusTarget(copy); setNewStatus(copy.status); }}>
                            Update
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update status dialog */}
      <Dialog open={!!statusTarget} onOpenChange={o => !o && setStatusTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Copy Status — {statusTarget?.accession_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Current status: <StatusBadge status={statusTarget?.status ?? ""} /></p>
            <div>
              <label className="text-sm font-medium">New status</label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newStatus}
                onChange={e => setNewStatus(e.target.value as CopyStatus)}
              >
                {COPY_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusTarget(null)}>Cancel</Button>
            <Button onClick={() => updateStatusMutation.mutate()} disabled={updateStatusMutation.isPending}>
              {updateStatusMutation.isPending ? "Saving..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={o => !o && setDeleteTarget(null)}
        title="Remove Copy"
        description={`Remove copy ${deleteTarget?.accession_number}? This cannot be undone.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => deleteCopyMutation.mutate()}
        isLoading={deleteCopyMutation.isPending}
      />
    </div>
  );
}
