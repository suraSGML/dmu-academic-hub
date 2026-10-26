import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, BookMarked, Filter } from "lucide-react";
import { Link } from "react-router-dom";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import { CardSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { SaveButton } from "@/components/common/SaveButton";
import { bookService, bookCategoryService } from "@/services/libraryService";
import { useAuth } from "@/hooks/useAuth";

export function LibraryPage() {
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  let timeout: ReturnType<typeof setTimeout>;
  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout(timeout);
    timeout = setTimeout(() => setDebouncedSearch(val), 400);
  };

  const { data: result, isPending, isError, refetch } = useQuery({
    queryKey: ["books-student", debouncedSearch, categoryFilter, availableOnly],
    queryFn: () => bookService.list({
      search: debouncedSearch || undefined,
      categoryId: categoryFilter || undefined,
      available: availableOnly || undefined,
      limit: 50,
    }),
  });

  const { data: categories } = useQuery({ queryKey: ["book-categories"], queryFn: bookCategoryService.list });

  const books = result?.data ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Library</h1>
        <p className="page-description">Search and browse DMU's book collection.</p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by title, author, ISBN..." value={search} onChange={e => handleSearch(e.target.value)} />
        </div>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All categories</option>
          {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button variant={availableOnly ? "default" : "outline"} onClick={() => setAvailableOnly(v => !v)}>
          <Filter className="mr-2 h-4 w-4" />Available Only
        </Button>
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : !books.length ? (
        <EmptyState icon={BookMarked} title="No books found" description={debouncedSearch ? `No results for "${debouncedSearch}".` : "The library catalogue is empty."} />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{result?.count ?? 0} book(s) in catalogue</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {books.map(book => (
              <Link key={book.id} to={`/library/books/${book.id}`}>
                <Card className="group h-full hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      {book.cover_url ? (
                        <img src={book.cover_url} alt={book.title} className="h-20 w-14 object-cover rounded shrink-0" />
                      ) : (
                        <div className="flex h-20 w-14 items-center justify-center rounded bg-muted shrink-0">
                          <BookMarked className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <h3 className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2">
                            {book.title}
                          </h3>
                          <SaveButton
                            resourceType="book"
                            resourceId={book.id}
                            userId={profile?.id}
                            className="-mt-1 -mr-1"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{book.author}</p>
                        {book.publication_year && (
                          <p className="text-xs text-muted-foreground">{book.publication_year} · {book.edition}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(book.category as any)?.name && (
                            <Badge variant="secondary" className="text-xs">{(book.category as any).name}</Badge>
                          )}
                          <Badge variant={book.available_copies > 0 ? "success" : "destructive"} className="text-xs">
                            {book.available_copies > 0 ? `${book.available_copies} available` : "All borrowed"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
