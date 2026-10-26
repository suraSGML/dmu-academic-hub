import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BookMarked, Plus, Minus, Loader2, Search, ArrowLeft, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  bookService,
  bookCategoryService,
  locationService,
  bookCopyService,
} from "@/services/libraryService";
import { departmentService } from "@/services/academicService";
import { auditService } from "@/services/adminService";

const schema = z.object({
  title:            z.string().min(1, "Title is required"),
  author:           z.string().min(1, "Author is required"),
  isbn:             z.string().optional(),
  publisher:        z.string().optional(),
  publication_year: z.coerce.number().int().min(1000).max(2100).optional().or(z.literal("")),
  edition:          z.string().optional(),
  category_id:      z.string().optional(),
  department_id:    z.string().optional(),
  location_id:      z.string().optional(),
  description:      z.string().optional(),
  initial_copies:   z.coerce.number().int().min(1, "At least 1 copy is required").max(100),
});

type FormValues = z.infer<typeof schema>;

// Simple Open Library ISBN fetch
async function lookupISBN(isbn: string): Promise<Partial<FormValues> | null> {
  const clean = isbn.replace(/[-\s]/g, "");
  try {
    const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${clean}&format=json&jscmd=data`);
    const json = await res.json();
    const book = json[`ISBN:${clean}`];
    if (!book) return null;
    return {
      title:            book.title ?? "",
      author:           book.authors?.[0]?.name ?? "",
      publisher:        book.publishers?.[0]?.name ?? "",
      publication_year: book.publish_date ? parseInt(book.publish_date.slice(-4)) || undefined : undefined,
    };
  } catch {
    return null;
  }
}

export function AddBookPage() {
  const location = useLocation();
  const libraryBase = location.pathname.startsWith("/admin/library") ? "/admin/library" : "/librarian";
  const navigate = useNavigate();
  const qc          = useQueryClient();
  const [isbnQuery, setIsbnQuery] = useState("");
  const [isbnLoading, setIsbnLoading] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const { data: categories = [] } = useQuery({ queryKey: ["book-categories"], queryFn: bookCategoryService.list });
  const { data: locations  = [] } = useQuery({ queryKey: ["library-locations"], queryFn: locationService.list });
  const { data: departments } = useQuery({ queryKey: ["departments"], queryFn: () => departmentService.list() });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "", author: "", isbn: "", publisher: "", edition: "",
      category_id: "", department_id: "", location_id: "", description: "",
      initial_copies: 1,
    },
  });

  // ISBN lookup
  const handleISBNLookup = async () => {
    const raw = isbnQuery.trim();
    if (!raw) return;
    setIsbnLoading(true);
    try {
      const result = await lookupISBN(raw);
      if (result) {
        if (result.title)            form.setValue("title",            result.title);
        if (result.author)           form.setValue("author",           result.author);
        if (result.publisher)        form.setValue("publisher",        result.publisher);
        if (result.publication_year) form.setValue("publication_year", result.publication_year as number);
        form.setValue("isbn", raw);
        toast({ title: "Book details fetched", description: `Found: ${result.title}` });
      } else {
        form.setValue("isbn", raw);
        toast({ title: "ISBN not found in Open Library", description: "Fill in details manually.", variant: "destructive" });
      }
    } finally {
      setIsbnLoading(false);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Cover must be under 5 MB.", variant: "destructive" });
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // 1. Create book record
      const book = await bookService.create({
        title:            values.title,
        author:           values.author,
        isbn:             values.isbn || undefined,
        publisher:        values.publisher || undefined,
        publication_year: values.publication_year ? Number(values.publication_year) : undefined,
        edition:          values.edition || undefined,
        category_id:      values.category_id || undefined,
        department_id:    values.department_id || undefined,
        location_id:      values.location_id || undefined,
        description:      values.description || undefined,
      });

      // 2. Upload cover if provided
      if (coverFile) {
        try {
          await bookService.uploadCover(book.id, coverFile);
        } catch {
          // Cover upload failure is non-fatal
        }
      }

      // 3. Create initial copies
      for (let i = 0; i < values.initial_copies; i++) {
        const accession = await bookCopyService.generateAccessionNumber();
        const qrCode    = bookCopyService.generateQRCode(accession);
        await bookCopyService.create({
          book_id:          book.id,
          accession_number: accession,
          qr_code:          qrCode,
          location_id:      values.location_id || undefined,
          condition:        "NEW",
          status:           "AVAILABLE",
        });
      }

      // 4. Audit
      await auditService.log({
        action:       "BOOK_CREATED",
        resourceType: "book",
        resourceId:   book.id,
        details:      { title: book.title, copies: values.initial_copies },
      });

      return book;
    },
    onSuccess: (book) => {
      qc.invalidateQueries({ queryKey: ["books"] });
      qc.invalidateQueries({ queryKey: ["library-stats"] });
      toast({ title: "Book added", description: `"${book.title}" added with ${form.getValues("initial_copies")} cop${form.getValues("initial_copies") === 1 ? "y" : "ies"}.` });
      navigate(`${libraryBase}/books/${book.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add book", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="page-header mb-0">
          <h1 className="page-title">Add New Book</h1>
          <p className="page-description">Add a book to the library catalogue and create physical copies.</p>
        </div>
      </div>

      {/* ISBN Lookup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" />
            ISBN Lookup
          </CardTitle>
          <CardDescription>
            Enter an ISBN to auto-fill book details from Open Library.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. 978-0-06-112008-4"
              value={isbnQuery}
              onChange={e => setIsbnQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleISBNLookup()}
              className="max-w-xs"
            />
            <Button
              variant="outline"
              onClick={handleISBNLookup}
              disabled={isbnLoading || !isbnQuery.trim()}
            >
              {isbnLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Look Up
            </Button>
          </div>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-6">

          {/* Book Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookMarked className="h-4 w-4" />
                Book Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Title *</FormLabel>
                    <FormControl><Input placeholder="Book title" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="author" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Author(s) *</FormLabel>
                    <FormControl><Input placeholder="e.g. John Smith" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="isbn" render={({ field }) => (
                  <FormItem>
                    <FormLabel>ISBN</FormLabel>
                    <FormControl><Input placeholder="978-..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="publisher" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Publisher</FormLabel>
                    <FormControl><Input placeholder="Publisher name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="publication_year" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Publication Year</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g. 2023" min={1000} max={2100} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="edition" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Edition</FormLabel>
                    <FormControl><Input placeholder="e.g. 3rd" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="category_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="department_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(departments ?? []).map((d: { id: string; name: string }) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Description / Abstract</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Brief description or abstract..." rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          {/* Cover Image */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Cover Image
                <Badge variant="secondary" className="ml-1">Optional</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-4">
                {coverPreview ? (
                  <img src={coverPreview} alt="Cover preview" className="h-28 w-20 object-cover rounded border" />
                ) : (
                  <div className="h-28 w-20 rounded border bg-muted flex items-center justify-center">
                    <BookMarked className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" type="button" asChild>
                      <span>
                        <Upload className="mr-2 h-4 w-4" />
                        {coverPreview ? "Change Cover" : "Upload Cover"}
                      </span>
                    </Button>
                    <input type="file" accept="image/*" onChange={handleCoverChange} className="sr-only" />
                  </label>
                  {coverPreview && (
                    <Button variant="ghost" size="sm" type="button" onClick={() => { setCoverFile(null); setCoverPreview(null); }}>
                      Remove
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">JPEG or PNG, max 5 MB</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location & Copies */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Physical Copies & Location</CardTitle>
              <CardDescription>
                Specify where the book is shelved and how many physical copies to create.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="location_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shelf Location</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select shelf" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.map(l => (
                          <SelectItem key={l.id} value={l.id}>{l.code} — {l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="initial_copies" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Copies *</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button" variant="outline" size="icon"
                          onClick={() => field.onChange(Math.max(1, Number(field.value) - 1))}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number" min={1} max={100}
                          className="w-20 text-center"
                          {...field}
                        />
                        <Button
                          type="button" variant="outline" size="icon"
                          onClick={() => field.onChange(Math.min(100, Number(field.value) + 1))}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Each copy will get a unique accession number and QR code automatically.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Separator />

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding Book...</>
              ) : (
                <><BookMarked className="mr-2 h-4 w-4" />Add Book</>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
