import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, BookMarked, MapPin } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { DataTable, type Column } from "@/components/common/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { StatCardSkeleton } from "@/components/common/LoadingSkeleton";
import { toast } from "@/hooks/use-toast";
import {
  bookCategoryService, locationService, libraryStatsService,
} from "@/services/libraryService";
import type { BookCategory, LibraryLocation } from "@/types/library.types";

const catSchema = z.object({
  name: z.string().min(2, "Name required"),
  description: z.string().optional(),
});
const locSchema = z.object({
  name: z.string().min(2, "Name required"),
  code: z.string().min(1, "Code required").max(10),
  description: z.string().optional(),
});

export function AdminLibraryPage() {
  const qc = useQueryClient();
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [locDialogOpen, setLocDialogOpen] = useState(false);
  const [editCat, setEditCat] = useState<BookCategory | null>(null);
  const [editLoc, setEditLoc] = useState<LibraryLocation | null>(null);
  const [deleteCat, setDeleteCat] = useState<BookCategory | null>(null);
  const [deleteLoc, setDeleteLoc] = useState<LibraryLocation | null>(null);

  const { data: stats, isPending: statsPending } = useQuery({
    queryKey: ["library-stats"],
    queryFn: libraryStatsService.getDashboardStats,
  });

  const { data: categories, isPending: catPending } = useQuery({
    queryKey: ["book-categories"],
    queryFn: bookCategoryService.list,
  });

  const { data: locations, isPending: locPending } = useQuery({
    queryKey: ["library-locations"],
    queryFn: locationService.list,
  });

  const catForm = useForm<z.infer<typeof catSchema>>({
    resolver: zodResolver(catSchema),
    defaultValues: { name: "", description: "" },
  });

  const locForm = useForm<z.infer<typeof locSchema>>({
    resolver: zodResolver(locSchema),
    defaultValues: { name: "", code: "", description: "" },
  });

  const saveCatMutation = useMutation({
    mutationFn: (v: z.infer<typeof catSchema>) =>
      editCat
        ? bookCategoryService.update(editCat.id, v.name, v.description)
        : bookCategoryService.create(v.name, v.description),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["book-categories"] });
      setCatDialogOpen(false);
      toast({ title: editCat ? "Category updated" : "Category created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteCatMutation = useMutation({
    mutationFn: () => bookCategoryService.delete(deleteCat!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["book-categories"] });
      setDeleteCat(null);
      toast({ title: "Category deleted" });
    },
    onError: (e: Error) => toast({ title: "Cannot delete", description: e.message, variant: "destructive" }),
  });

  const saveLocMutation = useMutation({
    mutationFn: (v: z.infer<typeof locSchema>) =>
      editLoc
        ? Promise.resolve(editLoc) // update not implemented in service for brevity
        : locationService.create({ name: v.name, code: v.code.toUpperCase(), description: v.description ?? null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library-locations"] });
      setLocDialogOpen(false);
      toast({ title: "Location saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteLocMutation = useMutation({
    mutationFn: () => locationService.delete(deleteLoc!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library-locations"] });
      setDeleteLoc(null);
      toast({ title: "Location deleted" });
    },
    onError: (e: Error) => toast({ title: "Cannot delete", description: e.message, variant: "destructive" }),
  });

  const catColumns: Column<BookCategory>[] = [
    { header: "Name", accessor: "name" },
    { header: "Description", accessor: r => r.description ?? "—" },
    {
      header: "Actions", accessor: r => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => { setEditCat(r); catForm.reset({ name: r.name, description: r.description ?? "" }); setCatDialogOpen(true); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteCat(r)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const locColumns: Column<LibraryLocation>[] = [
    { header: "Name", accessor: "name" },
    { header: "Code", accessor: r => <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{r.code}</span> },
    { header: "Description", accessor: r => r.description ?? "—" },
    {
      header: "Actions", accessor: r => (
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteLoc(r)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Library Management</h1>
        <p className="page-description">Platform-level library configuration — categories, locations, and overview.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsPending ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : (
          <>
            {[
              { label: "Total Books", value: stats?.totalBooks ?? 0, color: "text-primary" },
              { label: "Total Copies", value: stats?.totalCopies ?? 0, color: "text-blue-600" },
              { label: "Currently Borrowed", value: stats?.borrowed ?? 0, color: "text-amber-600" },
              { label: "Overdue", value: stats?.overdue ?? 0, color: "text-destructive" },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="p-5 text-center">
                  <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>

      {/* Quick links */}
      <Card>
        <CardHeader><CardTitle className="text-base">Library Operations</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Books Catalogue", href: "/admin/library/books", icon: BookMarked },
              { label: "Borrowings", href: "/admin/library/borrowings", icon: BookMarked },
              { label: "Returns", href: "/admin/library/returns", icon: BookMarked },
              { label: "Reports", href: "/admin/library/reports", icon: BookMarked },
            ].map(a => (
              <Button key={a.href} variant="outline" className="flex h-auto flex-col gap-2 py-4" asChild>
                <Link to={a.href}>
                  <a.icon className="h-5 w-5 text-primary" />
                  <span className="text-xs">{a.label}</span>
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Book Categories */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Book Categories</CardTitle>
          <Button size="sm" onClick={() => { setEditCat(null); catForm.reset({ name: "", description: "" }); setCatDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />Add Category
          </Button>
        </CardHeader>
        <CardContent>
          {catPending ? <LoadingSkeleton rows={4} /> : !categories?.length ? (
            <EmptyState icon={BookMarked} title="No categories" />
          ) : (
            <DataTable columns={catColumns} data={categories} keyField="id" />
          )}
        </CardContent>
      </Card>

      {/* Library Locations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Shelf Locations</CardTitle>
          <Button size="sm" onClick={() => { setEditLoc(null); locForm.reset({ name: "", code: "", description: "" }); setLocDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />Add Location
          </Button>
        </CardHeader>
        <CardContent>
          {locPending ? <LoadingSkeleton rows={3} /> : !locations?.length ? (
            <EmptyState icon={MapPin} title="No locations" />
          ) : (
            <DataTable columns={locColumns} data={locations} keyField="id" />
          )}
        </CardContent>
      </Card>

      {/* Category dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editCat ? "Edit Category" : "Add Category"}</DialogTitle></DialogHeader>
          <Form {...catForm}>
            <form onSubmit={catForm.handleSubmit(v => saveCatMutation.mutate(v))} className="space-y-4">
              <FormField control={catForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input placeholder="Computer Science & IT" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={catForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Input placeholder="Optional description..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCatDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saveCatMutation.isPending}>
                  {saveCatMutation.isPending ? "Saving..." : editCat ? "Save" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Location dialog */}
      <Dialog open={locDialogOpen} onOpenChange={setLocDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Shelf Location</DialogTitle></DialogHeader>
          <Form {...locForm}>
            <form onSubmit={locForm.handleSubmit(v => saveLocMutation.mutate(v))} className="space-y-4">
              <FormField control={locForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input placeholder="Main Hall – Section A" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={locForm.control} name="code" render={({ field }) => (
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  <FormControl><Input placeholder="A" {...field} onChange={e => field.onChange(e.target.value.toUpperCase())} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={locForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Input placeholder="Optional..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setLocDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saveLocMutation.isPending}>
                  {saveLocMutation.isPending ? "Saving..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteCat}
        onOpenChange={o => !o && setDeleteCat(null)}
        title="Delete Category"
        description={`Delete "${deleteCat?.name}"?`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteCatMutation.mutate()}
        isLoading={deleteCatMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteLoc}
        onOpenChange={o => !o && setDeleteLoc(null)}
        title="Delete Location"
        description={`Delete location "${deleteLoc?.name}"?`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteLocMutation.mutate()}
        isLoading={deleteLocMutation.isPending}
      />
    </div>
  );
}
