import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, ArrowLeftRight, RefreshCw } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "react-router-dom";

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
import { UserAvatar } from "@/components/common/UserAvatar";
import { toast } from "@/hooks/use-toast";
import { borrowingService, bookCopyService, bookService } from "@/services/libraryService";
import { userService } from "@/services/academicService";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/utils";
import type { BorrowingStatus } from "@/types/library.types";

const issueSchema = z.object({
  book_id: z.string().min(1, "Book required"),
  book_copy_id: z.string().min(1, "Copy required"),
  student_id: z.string().min(1, "Student required"),
  due_date: z.string().min(1, "Due date required"),
  notes: z.string().optional(),
});
type IssueFormValues = z.infer<typeof issueSchema>;

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "RETURNED", label: "Returned" },
];

export function BorrowingManagementPage() {
  const location = useLocation();
  const libraryBase = location.pathname.startsWith("/admin/library") ? "/admin/library" : "/librarian";
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [search, setSearch] = useState("");
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState("");

  // Default due date 14 days from today
  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 14);
  const defaultDueDateStr = defaultDueDate.toISOString().split("T")[0];

  const { data: result, isPending, isError, refetch } = useQuery({
    queryKey: ["borrowings", statusFilter],
    queryFn: () => borrowingService.list({
      status: statusFilter ? (statusFilter as BorrowingStatus) : undefined,
      limit: 100,
    }),
  });

  const { data: booksResult, isPending: booksPending, isError: booksError, error: booksLoadError } = useQuery({
    queryKey: ["books"],
    queryFn: () => bookService.list({ available: true, limit: 200 }),
  });

  const { data: copies, isPending: copiesPending, isError: copiesError, error: copiesLoadError } = useQuery({
    queryKey: ["book-copies", selectedBookId],
    queryFn: () => bookCopyService.listByBook(selectedBookId),
    enabled: !!selectedBookId,
  });

  const { data: allUsers, isPending: usersPending, isError: usersError, error: usersLoadError } = useQuery({
    queryKey: ["users"],
    queryFn: userService.listWithRoles,
  });
  const students = (allUsers ?? []).filter(
    (user) => user.is_active && user.user_roles?.some((ur: any) => ur.role?.name === "STUDENT"),
  );

  const form = useForm<IssueFormValues>({
    resolver: zodResolver(issueSchema),
    defaultValues: { book_id: "", book_copy_id: "", student_id: "", due_date: defaultDueDateStr },
  });

  const issueMutation = useMutation({
    mutationFn: (v: IssueFormValues) => borrowingService.issue({
      book_copy_id: v.book_copy_id,
      book_id: v.book_id,
      student_id: v.student_id,
      librarian_id: profile!.id,
      due_date: v.due_date,
      notes: v.notes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["borrowings"] });
      qc.invalidateQueries({ queryKey: ["books"] });
      setIssueDialogOpen(false);
      form.reset();
      toast({ title: "Book issued successfully" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const markOverdueMutation = useMutation({
    mutationFn: borrowingService.markOverdue,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["borrowings"] });
      toast({ title: "Overdue status updated" });
    },
  });

  const borrowings = (result?.data ?? []).filter(b => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (b.book as any)?.title?.toLowerCase().includes(s) ||
      (b.student as any)?.full_name?.toLowerCase().includes(s) ||
      (b.student as any)?.email?.toLowerCase().includes(s) ||
      (b.book_copy as any)?.accession_number?.toLowerCase().includes(s)
    );
  });

  const availableCopies = copies?.filter(c => c.status === "AVAILABLE") ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Borrowing Management</h1>
          <p className="page-description">Issue books and track active loans.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => markOverdueMutation.mutate()} disabled={markOverdueMutation.isPending}>
            <RefreshCw className="mr-2 h-4 w-4" />Sync Overdue
          </Button>
          <Button onClick={() => setIssueDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />Issue Book
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1">
          {STATUS_FILTERS.map(f => (
            <Button key={f.value} variant={statusFilter === f.value ? "default" : "outline"} size="sm"
              onClick={() => setStatusFilter(f.value)}>
              {f.label}
            </Button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by title, student, accession..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {isPending ? <LoadingSkeleton rows={6} /> : isError ? <ErrorState onRetry={refetch} /> : !borrowings.length ? (
        <EmptyState icon={ArrowLeftRight} title="No borrowings found" description="Issue a book to a student to see it here." actionLabel="Issue Book" onAction={() => setIssueDialogOpen(true)} />
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{borrowings.length} record(s)</p>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  {["Student", "Book", "Accession", "Borrowed", "Due Date", "Status", "Returns"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {borrowings.map(b => {
                  const isOverdue = b.status === "ACTIVE" && new Date(b.due_date) < new Date();
                  return (
                    <tr key={b.id} className={`border-b last:border-0 hover:bg-muted/30 ${isOverdue ? "bg-red-50/50" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <UserAvatar name={(b.student as any)?.full_name} size="sm" />
                          <div>
                            <p className="font-medium text-sm">{(b.student as any)?.full_name ?? "—"}</p>
                            <p className="text-xs text-muted-foreground">{(b.student as any)?.student_id ?? (b.student as any)?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm line-clamp-1">{(b.book as any)?.title ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{(b.book as any)?.author}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{(b.book_copy as any)?.accession_number ?? "—"}</td>
                      <td className="px-4 py-3 text-sm">{formatDate(b.borrow_date)}</td>
                      <td className={`px-4 py-3 text-sm font-medium ${isOverdue ? "text-destructive" : ""}`}>
                        {formatDate(b.due_date)}
                        {isOverdue && <span className="ml-1 text-xs">(overdue)</span>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      <td className="px-4 py-3">
                        {["ACTIVE","OVERDUE"].includes(b.status) && (
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`${libraryBase}/returns`}>Return</Link>
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Issue Book Dialog */}
      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Issue Book to Student</DialogTitle></DialogHeader>
          {(booksError || usersError || (selectedBookId && copiesError)) && (
            <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {booksError && <p>Could not load books: {booksLoadError.message}</p>}
              {usersError && <p>Could not load students: {usersLoadError.message}</p>}
              {selectedBookId && copiesError && <p>Could not load book copies: {copiesLoadError.message}</p>}
            </div>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(v => issueMutation.mutate(v))} className="space-y-4">
              <FormField control={form.control} name="book_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Book</FormLabel>
                  <FormControl>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      {...field} disabled={booksPending || booksError}
                      onChange={e => { field.onChange(e); setSelectedBookId(e.target.value); form.setValue("book_copy_id", ""); }}>
                      <option value="">{booksPending ? "Loading books..." : booksError ? "Books unavailable" : "Select book..."}</option>
                      {booksResult?.data.map(b => (
                        <option key={b.id} value={b.id}>{b.title} ({b.available_copies} available)</option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="book_copy_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Copy (Accession Number)</FormLabel>
                  <FormControl>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      {...field} disabled={!selectedBookId || copiesPending || copiesError}>
                      <option value="">
                        {!selectedBookId ? "Select a book first" : copiesPending ? "Loading copies..." : copiesError ? "Copies unavailable" : availableCopies.length ? "Select copy..." : "No available copies"}
                      </option>
                      {availableCopies.map(c => <option key={c.id} value={c.id}>{c.accession_number} — {c.condition}</option>)}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="student_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Student</FormLabel>
                  <FormControl>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      {...field} disabled={usersPending || usersError || students.length === 0}>
                      <option value="">
                        {usersPending ? "Loading students..." : usersError ? "Students unavailable" : students.length ? "Select student..." : "No active student accounts found"}
                      </option>
                      {students.map((student) => {
                        const displayName = student.full_name?.trim() || "Unnamed student";
                        const studentNumber = student.student_id
                          ? `Student ID: ${student.student_id}`
                          : "Student ID not set";
                        return (
                          <option key={student.id} value={student.id}>
                            {displayName} — {student.email} — {studentNumber}
                          </option>
                        );
                      })}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="due_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes <span className="text-muted-foreground">(optional)</span></FormLabel>
                  <FormControl><Input placeholder="Any notes..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIssueDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={issueMutation.isPending}>
                  {issueMutation.isPending ? "Issuing..." : "Issue Book"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
