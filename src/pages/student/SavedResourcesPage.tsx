import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookMarked, FileText, FlaskConical, X } from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type SavedItem = {
  id: string;
  user_id: string;
  resource_type: "book" | "material" | "research";
  resource_id: string;
  created_at: string;
  // joined depending on type
  book?: any;
  material?: any;
  research?: any;
};

async function fetchSavedResources(userId: string): Promise<SavedItem[]> {
  const { data, error } = await supabase
    .from("saved_resources" as never)
    .select(`
      id, user_id, resource_type, resource_id, created_at
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const items = (data ?? []) as SavedItem[];

  // Resolve titles in parallel for each type
  const bookIds      = items.filter(i => i.resource_type === "book").map(i => i.resource_id);
  const materialIds  = items.filter(i => i.resource_type === "material").map(i => i.resource_id);
  const researchIds  = items.filter(i => i.resource_type === "research").map(i => i.resource_id);

  const [books, materials, research] = await Promise.all([
    bookIds.length
      ? supabase.from("books" as never).select("id, title, author, call_number").in("id", bookIds)
      : { data: [] },
    materialIds.length
      ? supabase.from("course_materials" as never).select("id, title, material_type, course_id, courses(id, title, code)").in("id", materialIds)
      : { data: [] },
    researchIds.length
      ? supabase.from("research_resources" as never).select("id, title, resource_type, authors:research_authors(author_name)").in("id", researchIds)
      : { data: [] },
  ]);

  const bookMap     = Object.fromEntries(((books.data ?? []) as any[]).map(b => [b.id, b]));
  const matMap      = Object.fromEntries(((materials.data ?? []) as any[]).map(m => [m.id, m]));
  const researchMap = Object.fromEntries(((research.data ?? []) as any[]).map(r => [r.id, r]));

  return items.map(item => ({
    ...item,
    book:     item.resource_type === "book"     ? bookMap[item.resource_id]     : undefined,
    material: item.resource_type === "material" ? matMap[item.resource_id]      : undefined,
    research: item.resource_type === "research" ? researchMap[item.resource_id] : undefined,
  }));
}


const TYPE_CONFIG = {
  book:     { icon: BookMarked,  color: "text-amber-600",  bg: "bg-amber-100 dark:bg-amber-950/40",  label: "Book" },
  material: { icon: FileText,    color: "text-blue-600",   bg: "bg-blue-100 dark:bg-blue-950/40",   label: "Material" },
  research: { icon: FlaskConical, color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-950/40", label: "Research" },
};

export function SavedResourcesPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const { data: saved, isPending, isError, refetch } = useQuery({
    queryKey: ["saved-resources", profile?.id],
    queryFn:  () => fetchSavedResources(profile!.id),
    enabled:  !!profile?.id,
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_resources" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-resources"] });
      toast({ title: "Removed from saved" });
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Saved Resources</h1>
        <p className="page-description">
          Books, course materials, and research you have bookmarked.
        </p>
      </div>

      {isPending ? (
        <LoadingSkeleton rows={5} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : !saved?.length ? (
        <EmptyState
          icon={Bookmark}
          title="No saved resources"
          description="Bookmark books, materials, and research papers to find them here quickly."
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{saved.length} saved item{saved.length !== 1 ? "s" : ""}</p>
          {saved.map(item => {
            const cfg  = TYPE_CONFIG[item.resource_type] ?? TYPE_CONFIG.book;
            const Icon = cfg.icon;

            // Build href based on type
            const href =
              item.resource_type === "book"
                ? `/library/books/${item.resource_id}`
                : item.resource_type === "research"
                ? `/research/${item.resource_id}`
                : item.material?.course_id
                ? `/materials/courses/${item.material.course_id}`
                : "/courses";

            const displayTitle =
              item.book?.title ??
              item.material?.title ??
              item.research?.title ??
              "Resource " + item.resource_id.slice(0, 8);

            const metaText =
              item.book?.author
                ? `by ${item.book.author}`
                : item.material?.courses?.title
                ? `${item.material.courses.code ? `${item.material.courses.code} — ` : ""}${item.material.courses.title}`
                : item.research?.authors?.length
                ? `by ${item.research.authors.map((a: any) => a.author_name).join(", ")}`
                : null;

            return (
              <Card key={item.id} className="group hover:shadow-sm transition-shadow">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
                    <Icon className={`h-5 w-5 ${cfg.color}`} />
                  </div>
                  <Link to={href} className="flex-1 min-w-0 hover:text-primary transition-colors">
                    <p className="text-sm font-semibold truncate text-foreground">
                      {displayTitle}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      {metaText && <span className="truncate max-w-xs">{metaText}</span>}
                      {metaText && <span>·</span>}
                      <span>Saved {formatDate(item.created_at)}</span>
                    </div>
                  </Link>
                  <Badge variant="secondary" className="shrink-0 text-xs hidden sm:inline-flex">{cfg.label}</Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Remove from saved"
                    onClick={() => removeMutation.mutate(item.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
