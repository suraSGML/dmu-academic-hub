import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, QrCode, Trash2, Copy, Printer } from "lucide-react";
import { useSearchParams } from "react-router-dom";
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
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { toast } from "@/hooks/use-toast";
import { bookCopyService, bookService, locationService } from "@/services/libraryService";
import type { BookCopyPayload, CopyCondition } from "@/types/library.types";

const schema = z.object({
  book_id: z.string().min(1, "Book is required"),
  accession_number: z.string().min(1, "Accession number is required"),
  qr_code: z.string().optional(),
  condition: z.enum(["NEW", "GOOD", "FAIR", "POOR"]).default("GOOD"),
  location_id: z.string().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function BookCopyManagementPage() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const preselectedBookId = searchParams.get("bookId") ?? "";
  const [filterBookId, setFilterBookId] = useState(preselectedBookId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: booksResult } = useQuery({
    queryKey: ["books"],
    queryFn: () => bookService.list({ limit: 200 }),
  });
  const { data: locations } = useQuery({ queryKey: ["library-locations"], queryFn: locationService.list });

  const { data: copies, isPending, isError, refetch } = useQuery({
    queryKey: ["book-copies-all", filterBookId],
    queryFn: () => filterBookId ? bookCopyService.listByBook(filterBookId) : Promise.resolve([]),
    enabled: !!filterBookId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { book_id: filterBookId, condition: "GOOD" },
  });

  const openAdd = async () => {
    const acc = await bookCopyService.generateAccessionNumber();
    const qr = bookCopyService.generateQRCode(acc);
    form.reset({ book_id: filterBookId, accession_number: acc, qr_code: qr, condition: "GOOD" });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: (v: FormValues) => {
      const payload: BookCopyPayload = {
        book_id: v.book_id,
        accession_number: v.accession_number,
        qr_code: v.qr_code || bookCopyService.generateQRCode(v.accession_number),
        condition: v.condition as CopyCondition,
        location_id: v.location_id || undefined,
        notes: v.notes || undefined,
      };
      return bookCopyService.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["book-copies-all", filterBookId] });
      qc.invalidateQueries({ queryKey: ["books"] });
      setDialogOpen(false);
      toast({ title: "Copy added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => bookCopyService.delete(deleteTarget!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["book-copies-all", filterBookId] });
      setDeleteTarget(null);
      toast({ title: "Copy removed" });
    },
    onError: (e: Error) => toast({ title: "Cannot remove", description: e.message, variant: "destructive" }),
  });

  const printQR = (copy: any) => {
    const win = window.open("", "_blank");
    win?.document.write(`
      <html><body style="font-family:monospace;padding:20px;">
        <h2>DMU Library QR Code</h2>
        <p><strong>Accession:</strong> ${copy.accession_number}</p>
        <p><strong>QR Code:</strong> ${copy.qr_code}</p>
        <p><strong>Book:</strong> ${copy.book?.title ?? "—"}</p>
        <hr/>
        <p style="font-size:24px;letter-spacing:2px;">${copy.qr_code}</p>
        <script>window.print();window.close();</script>
      </body></html>
    `);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Book Copies</h1>
          <p className="page-description">Manage individual physical copies and generate QR codes.</p>
        </div>
        <Button onClick={openAdd} disabled={!filterBookId}><Plus className="mr-2 h-4 w-4" />Add Copy</Button>
      </div>

      {/* Book selector */}
      <div className="rounded-lg border bg-card p-4">
        <label className="text-sm font-medium">Select book to manage copies</label>
        <select
          className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={filterBookId}
          onChange={e => setFilterBookId(e.target.value)}
        >
          <option value="">Select a book...</option>
          {booksResult?.data.map(b => (
            <option key={b.id} value={b.id}>{b.title} — {b.author} ({b.total_copies} copies)</option>
          ))}
        </select>
      </div>

      {!filterBookId ? (
        <EmptyState icon={Copy} title="Select a book" description="Choose a book above to view and manage its physical copies." />
      ) : isPending ? (
        <LoadingSkeleton rows={5} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : !copies?.length ? (
        <EmptyState icon={Copy} title="No copies yet" description="Add physical copies to make this book borrowable." actionLabel="Add Copy" onAction={openAdd} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                {["Accession No.", "QR Code", "Condition", "Status", "Location", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {copies.map(copy => (
                <tr key={copy.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{copy.accession_number}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <QrCode className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-xs">{copy.qr_code ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge variant="outline">{copy.condition}</Badge></td>
                  <td className="px-4 py-3"><StatusBadge status={copy.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{(copy.location as any)?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => printQR(copy)} title="Print QR">
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                      {copy.status === "AVAILABLE" && (
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(copy)}>
                          <Trash2 className="h-3.5 w-3.5" />
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Book Copy</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(v => saveMutation.mutate(v))} className="space-y-4">
              <FormField control={form.control} name="book_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Book</FormLabel>
                  <FormControl>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...field}>
                      <option value="">Select book...</option>
                      {booksResult?.data.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="accession_number" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accession Number</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="qr_code" render={({ field }) => (
                  <FormItem>
                    <FormLabel>QR Code</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="condition" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condition</FormLabel>
                    <FormControl>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...field}>
                        {["NEW","GOOD","FAIR","POOR"].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="location_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...field}>
                        <option value="">Select...</option>
                        {locations?.map(l => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Adding..." : "Add Copy"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={o => !o && setDeleteTarget(null)}
        title="Remove Copy"
        description={`Remove copy ${deleteTarget?.accession_number}?`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate()}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
