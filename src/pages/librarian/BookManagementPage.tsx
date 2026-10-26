import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, BookMarked, Eye } from "lucide-react";
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
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { toast } from "@/hooks/use-toast";
import { bookService, bookCategoryService, locationService } from "@/services/libraryService";
import { departmentService } from "@/services/academicService";
import type { Book, BookPayload } from "@/types/library.types";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  author: z.string().min(1, "Author is required"),
  isbn: z.string().optional(),
  publisher: z.string().optional(),
  publication_year: z.coerce.number().int().min(1900).max(2100).optional(),
  edition: z.string().optional(),
  category_id: z.string().optional(),
  department_id: z.string().optional(),
  location_id: z.string().optional(),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function BookManagementPage() {
  const location = useLocation();
  const libraryBase = location.pathname.startsWith("/admin/library") ? "/admin/library" : "/librarian";
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Book | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);

  const { data: result, isPending, isError, refetch } = useQuery({
    queryKey: ["books", search, categoryFilter],
    queryFn: () => bookService.list({ search: search || undefined, categoryId: categoryFilter || undefined }),
  });

  const { data: categories } = useQuery({ queryKey: ["book-categories"], queryFn: bookCategoryService.list });
  const { data: locations } = useQuery({ queryKey: ["library-locations"], queryFn: locationService.list });
  const { data: departments } = useQuery({ queryKey: ["departments"], queryFn: () => departmentService.list() });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", author: "" },
  });

  const openAdd = () => {
    setEditTarget(null);
    form.reset({ title: "", author: "" });
    setDialogOpen(true);
  };

  const openEdit = (book: Book) => {
    setEditTarget(book);
    form.reset({
      title: book.title,
      author: book.author,
      isbn: book.isbn ?? "",
      publisher: book.publisher ?? "",
      publication_year: book.publication_year ?? undefined,
      edition: book.edition ?? "",
      category_id: book.category_id ?? "",
      department_id: book.department_id ?? "",
      location_id: book.location_id ?? "",
      description: book.description ?? "",
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: (v: FormValues) => {
      const payload: BookPayload = {
        ...v,
        category_id: v.category_id || undefined,
        department_id: v.department_id || undefined,
        location_id: v.location_id || undefined,
      };
      return editTarget ? bookService.update(editTarget.id, payload) : bookService.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["books"] });
      setDialogOpen(false);
      toast({ title: editTarget ? "Book updated" : "Book added to catalogue" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => bookService.delete(deleteTarget!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["books"] });
      setDeleteTarget(null);
      toast({ title: "Book deleted" });
    },
    onError: (e: Error) => toast({ title: "Cannot delete", description: e.message, variant: "destructive" }),
  });

  const books = result?.data ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Book Management</h1>
          <p className="page-description">Manage the library book catalogue.</p>
        </div>
        <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Add Book</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by title, author, ISBN..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All categories</option>
          {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {isPending ? <LoadingSkeleton rows={6} /> : isError ? <ErrorState onRetry={refetch} /> : !books.length ? (
        <EmptyState icon={BookMarked} title="No books found" actionLabel="Add Book" onAction={openAdd} />
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{result?.count ?? 0} book(s) in catalogue</p>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  {["Title / Author", "Category", "ISBN", "Location", "Copies", "Status", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {books.map(book => (
                  <tr key={book.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">{book.title}</p>
                      <p className="text-xs text-muted-foreground">{book.author}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{(book.category as any)?.name ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{book.isbn ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{(book.location as any)?.code ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${book.available_copies === 0 ? "text-destructive" : "text-green-600"}`}>
                        {book.available_copies}
                      </span>
                      <span className="text-muted-foreground">/{book.total_copies}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={book.available_copies > 0 ? "success" : "destructive"}>
                        {book.available_copies > 0 ? "Available" : "All Borrowed"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" asChild>
                          <Link to={`${libraryBase}/books/${book.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(book)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(book)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Book" : "Add Book to Catalogue"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(v => saveMutation.mutate(v))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Title</FormLabel>
                    <FormControl><Input placeholder="Introduction to Algorithms" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="author" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Author(s)</FormLabel>
                    <FormControl><Input placeholder="Cormen, Leiserson, Rivest" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="isbn" render={({ field }) => (
                  <FormItem>
                    <FormLabel>ISBN <span className="text-muted-foreground">(optional)</span></FormLabel>
                    <FormControl><Input placeholder="978-0-000-00000-0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="publisher" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Publisher</FormLabel>
                    <FormControl><Input placeholder="MIT Press" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="publication_year" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year</FormLabel>
                    <FormControl><Input type="number" placeholder="2024" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="edition" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Edition</FormLabel>
                    <FormControl><Input placeholder="3rd" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="category_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...field}>
                        <option value="">Select category...</option>
                        {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="location_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shelf Location</FormLabel>
                    <FormControl>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...field}>
                        <option value="">Select location...</option>
                        {locations?.map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Description <span className="text-muted-foreground">(optional)</span></FormLabel>
                    <FormControl><Input placeholder="Brief description of the book..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving..." : editTarget ? "Save changes" : "Add book"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={o => !o && setDeleteTarget(null)}
        title="Delete Book"
        description={`Delete "${deleteTarget?.title}"? All copies and borrowing records will also be removed.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate()}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
