import { supabase } from "@/lib/supabase";

export type SearchCategory = "ALL" | "BOOKS" | "MATERIALS" | "RESEARCH";

export interface SearchResult {
  id: string;
  type: SearchCategory;
  title: string;
  subtitle: string;
  description: string | null;
  badge: string;
  href: string;
  meta?: string;
  statusBadge?: string;
}

export const searchService = {
  search: async (
    query: string = "",
    category: SearchCategory = "ALL",
    limit = 50
  ): Promise<{ results: SearchResult[]; total: number }> => {
    const q = query.trim();
    const results: SearchResult[] = [];

    // ── Books ────────────────────────────────────────────────────────────
    if (category === "ALL" || category === "BOOKS") {
      let bQuery = supabase
        .from("books")
        .select("id, title, author, isbn, publisher, available_copies, total_copies, category:book_categories(name)")
        .eq("is_active", true);

      if (q) {
        bQuery = bQuery.or(`title.ilike.%${q}%,author.ilike.%${q}%,isbn.ilike.%${q}%`);
      }

      const { data } = await bQuery
        .order("created_at", { ascending: false })
        .limit(limit);

      (data ?? []).forEach((b: any) => {
        results.push({
          id:          b.id,
          type:        "BOOKS",
          title:       b.title,
          subtitle:    b.author,
          description: b.isbn ? `ISBN: ${b.isbn}` : null,
          badge:       b.category?.name ?? "Book",
          href:        `/library/books/${b.id}`,
          meta:        `${b.available_copies}/${b.total_copies} available`,
        });
      });
    }

    // ── Course Materials ──────────────────────────────────────────────────
    if (category === "ALL" || category === "MATERIALS") {
      let mQuery = supabase
        .from("course_materials")
        .select("id, title, description, material_type, publication_status, course:courses(id,name,code)")
        .eq("is_active", true);

      if (q) {
        mQuery = mQuery.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
      }

      // RLS safely shows published materials to students, plus drafts to lecturers & admins
      const { data } = await mQuery
        .order("created_at", { ascending: false })
        .limit(limit);

      (data ?? []).forEach((m: any) => {
        results.push({
          id:          m.id,
          type:        "MATERIALS",
          title:       m.title,
          subtitle:    m.course?.name ?? "Course Material",
          description: m.description,
          badge:       m.material_type ? m.material_type.replace(/_/g, " ") : "Material",
          href:        m.course?.id ? `/materials/courses/${m.course.id}` : `/search`,
          meta:        m.course?.code ?? (m.publication_status === "DRAFT" ? "Draft" : undefined),
          statusBadge: m.publication_status === "DRAFT" ? "Draft" : undefined,
        });
      });
    }

    // ── Research ───────────────────────────────────────────────────────────
    if (category === "ALL" || category === "RESEARCH") {
      let rQuery = supabase
        .from("research_resources")
        .select("id, title, abstract, resource_type, approval_status, department:departments(name), academic_year:academic_years(name)")
        .eq("is_active", true);

      if (q) {
        rQuery = rQuery.or(`title.ilike.%${q}%,abstract.ilike.%${q}%,supervisor.ilike.%${q}%`);
      }

      // RLS safely returns approved items for all, and user's own/pending items for admins & submitters
      const { data } = await rQuery
        .order("created_at", { ascending: false })
        .limit(limit);

      (data ?? []).forEach((r: any) => {
        results.push({
          id:          r.id,
          type:        "RESEARCH",
          title:       r.title,
          subtitle:    r.department?.name ?? "Research",
          description: r.abstract ? (r.abstract.length > 140 ? r.abstract.slice(0, 140) + "..." : r.abstract) : null,
          badge:       r.resource_type ? r.resource_type.replace(/_/g, " ") : "Research",
          href:        `/research/${r.id}`,
          meta:        r.academic_year?.name,
          statusBadge: r.approval_status !== "APPROVED" ? r.approval_status : undefined,
        });
      });
    }

    return { results, total: results.length };
  },
};
