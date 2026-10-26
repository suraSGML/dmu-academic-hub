import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search, BookMarked, FileText, FlaskConical, Layers,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { SaveButton } from "@/components/common/SaveButton";
import { useAuth } from "@/hooks/useAuth";
import { searchService, type SearchCategory } from "@/services/searchService";

const CATEGORIES: { value: SearchCategory; label: string; icon: React.ElementType }[] = [
  { value: "ALL",       label: "All",         icon: Layers },
  { value: "BOOKS",     label: "Books",       icon: BookMarked },
  { value: "MATERIALS", label: "Materials",   icon: FileText },
  { value: "RESEARCH",  label: "Research",    icon: FlaskConical },
];

const TYPE_ICONS: Record<SearchCategory, React.ElementType> = {
  ALL:       Layers,
  BOOKS:     BookMarked,
  MATERIALS: FileText,
  RESEARCH:  FlaskConical,
};

const TYPE_COLORS: Record<SearchCategory, string> = {
  ALL:       "text-muted-foreground bg-muted",
  BOOKS:     "text-amber-600 bg-amber-100",
  MATERIALS: "text-blue-600 bg-blue-100",
  RESEARCH:  "text-purple-600 bg-purple-100",
};

export function SearchPage() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery    = searchParams.get("q") ?? "";
  const initialCategory = (searchParams.get("cat") as SearchCategory) ?? "ALL";

  const [query, setQuery]       = useState(initialQuery);
  const [debouncedQ, setDebouncedQ] = useState(initialQuery);
  const [category, setCategory] = useState<SearchCategory>(initialCategory);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(query);
      if (query) setSearchParams({ q: query, cat: category }, { replace: true });
    }, 350);
    return () => clearTimeout(t);
  }, [query, category]);

  const { data, isPending } = useQuery({
    queryKey: ["global-search", debouncedQ, category],
    queryFn:  () => searchService.search(debouncedQ, category, 50),
  });

  const results = data?.results ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Search</h1>
        <p className="page-description">
          Browse and search across books, course materials, and research resources.
        </p>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          ref={inputRef}
          className="pl-10 h-12 text-base"
          placeholder="Search books, materials, research by title, author, course, abstract..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            onClick={() => { setQuery(""); setDebouncedQ(""); }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(c => {
          const Icon = c.icon;
          return (
            <Button
              key={c.value}
              variant={category === c.value ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(c.value)}
            >
              <Icon className="mr-1.5 h-3.5 w-3.5" />
              {c.label}
            </Button>
          );
        })}
      </div>

      {/* Results */}
      {isPending ? (
        <LoadingSkeleton rows={5} />
      ) : !results.length ? (
        <EmptyState
          icon={Search}
          title={debouncedQ ? `No results for "${debouncedQ}"` : "No resources found"}
          description={debouncedQ ? "Try different keywords, or check your spelling." : "No resources currently found in this category."}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {debouncedQ
              ? `${results.length} result${results.length !== 1 ? "s" : ""} for "${debouncedQ}"`
              : `Showing all ${category === "ALL" ? "available resources" : category.toLowerCase()} (${results.length})`}
          </p>
          {results.map(result => {
            const Icon = TYPE_ICONS[result.type] ?? Layers;
            const colorClass = TYPE_COLORS[result.type] ?? TYPE_COLORS.ALL;
            return (
              <Link key={`${result.type}-${result.id}`} to={result.href}>
                <Card className="group hover:shadow-md transition-shadow">
                  <CardContent className="flex items-start gap-4 p-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colorClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {result.title}
                        </h3>
                        <Badge variant="secondary" className="text-xs shrink-0">{result.badge}</Badge>
                        {result.statusBadge && (
                          <Badge variant={result.statusBadge === "APPROVED" ? "success" : "warning"} className="text-xs shrink-0">
                            {result.statusBadge}
                          </Badge>
                        )}
                      </div>
                      {result.subtitle && (
                        <p className="text-xs text-muted-foreground">{result.subtitle}</p>
                      )}
                      {result.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{result.description}</p>
                      )}
                      {result.meta && (
                        <p className="mt-1 text-xs text-muted-foreground opacity-70">{result.meta}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {result.type.charAt(0) + result.type.slice(1).toLowerCase()}
                      </Badge>
                      {(result.type === "BOOKS" || result.type === "MATERIALS" || result.type === "RESEARCH") && (
                        <SaveButton
                          resourceType={
                            result.type === "BOOKS"
                              ? "book"
                              : result.type === "MATERIALS"
                              ? "material"
                              : "research"
                          }
                          resourceId={result.id}
                          userId={profile?.id}
                          variant="ghost"
                          size="sm"
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
