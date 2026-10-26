import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, Search, Upload, Clock, CheckCircle2, User, Layers, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import { CardSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { SaveButton } from "@/components/common/SaveButton";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { researchService } from "@/services/researchService";
import { departmentService, academicYearService } from "@/services/academicService";
import {
  RESEARCH_TYPE_LABELS,
  type ResearchType,
} from "@/types/research.types";
import { formatDate } from "@/lib/utils";

const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All Types" },
  ...Object.entries(RESEARCH_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

type RepositoryTab = "ALL" | "MY_SUBMISSIONS" | "PENDING";

const PAGE_SIZE = 12;

export function ResearchRepositoryPage() {
  const { profile } = useAuth();
  const { isLecturer, isAdmin } = useRole();
  const [activeTab, setActiveTab] = useState<RepositoryTab>("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [page, setPage] = useState(1);

  // Reliable debounce effect that cancels properly on every change
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filter changes
  const handleTabChange = (tab: RepositoryTab) => {
    setActiveTab(tab);
    setPage(1);
  };
  const handleTypeChange = (val: string) => {
    setTypeFilter(val);
    setPage(1);
  };
  const handleDeptChange = (val: string) => {
    setDeptFilter(val);
    setPage(1);
  };
  const handleYearChange = (val: string) => {
    setYearFilter(val);
    setPage(1);
  };

  const { data: result, isPending, isError, refetch } = useQuery({
    queryKey: ["research", debouncedSearch, typeFilter, deptFilter, yearFilter, activeTab, page, profile?.id],
    queryFn: () => {
      const params: Parameters<typeof researchService.list>[0] = {
        search:         debouncedSearch || undefined,
        type:           (typeFilter as ResearchType) || undefined,
        departmentId:   deptFilter || undefined,
        academicYearId: yearFilter || undefined,
        limit:          PAGE_SIZE,
        offset:         (page - 1) * PAGE_SIZE,
      };

      if (activeTab === "MY_SUBMISSIONS" && profile?.id) {
        params.submittedBy = profile.id;
      } else if (activeTab === "PENDING") {
        params.approvalStatus = "PENDING";
      }

      return researchService.list(params);
    },
    staleTime: 15_000,
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => departmentService.list(),
  });

  const { data: years } = useQuery({
    queryKey: ["academic-years"],
    queryFn: academicYearService.list,
  });

  const resources = result?.data ?? [];
  const canPublish = isLecturer || isAdmin;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="page-header mb-0">
          <h1 className="page-title">Research Repository</h1>
          <p className="page-description">
            Browse and search theses, graduation projects, research papers, and dissertations from Debre Markos University.
          </p>
        </div>
        {canPublish && (
          <Button asChild className="shrink-0">
            <Link to="/research/submit">
              <Upload className="mr-2 h-4 w-4" />Submit Research
            </Link>
          </Button>
        )}
      </div>

      {/* Tabs for Lecturers & Admins */}
      {canPublish && (
        <div className="flex flex-wrap items-center gap-2 border-b pb-2">
          <Button
            variant={activeTab === "ALL" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleTabChange("ALL")}
          >
            <Layers className="mr-1.5 h-4 w-4" />
            All Research
          </Button>

          {profile?.id && (
            <Button
              variant={activeTab === "MY_SUBMISSIONS" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleTabChange("MY_SUBMISSIONS")}
            >
              <User className="mr-1.5 h-4 w-4" />
              My Submissions
            </Button>
          )}

          {isAdmin && (
            <Button
              variant={activeTab === "PENDING" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleTabChange("PENDING")}
            >
              <Clock className="mr-1.5 h-4 w-4" />
              Pending Review
            </Button>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by title, abstract, supervisor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={typeFilter}
          onChange={e => handleTypeChange(e.target.value)}
        >
          {TYPE_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={deptFilter}
          onChange={e => handleDeptChange(e.target.value)}
        >
          <option value="">All Departments</option>
          {departments?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={yearFilter}
          onChange={e => handleYearChange(e.target.value)}
        >
          <option value="">All Years</option>
          {years?.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
        </select>
      </div>

      {/* Results */}
      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : !resources.length ? (
        <EmptyState
          icon={FlaskConical}
          title={
            activeTab === "MY_SUBMISSIONS"
              ? "You haven't submitted any research papers yet"
              : activeTab === "PENDING"
              ? "No pending research submissions"
              : "No research resources found"
          }
          description={
            debouncedSearch
              ? `No results for "${debouncedSearch}".`
              : activeTab === "MY_SUBMISSIONS"
              ? "Submit your research papers using the Submit Research button above."
              : activeTab === "PENDING"
              ? "All submitted papers have been reviewed."
              : "No research resources currently match your filters."
          }
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {result?.count ?? 0} resource(s) {activeTab === "MY_SUBMISSIONS" ? "in your submissions" : activeTab === "PENDING" ? "pending review" : "available"}
          </p>
          {resources.map(r => (
            <Link key={r.id} to={`/research/${r.id}`}>
              <Card className="group hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Type + badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs">
                          {RESEARCH_TYPE_LABELS[r.resource_type]}
                        </Badge>
                        {r.approval_status === "PENDING" && (
                          <Badge variant="warning" className="text-xs">
                            Pending Review
                          </Badge>
                        )}
                        {r.approval_status === "APPROVED" && (
                          <Badge variant="success" className="text-xs">
                            Approved
                          </Badge>
                        )}
                        {r.approval_status === "REJECTED" && (
                          <Badge variant="destructive" className="text-xs">
                            Rejected
                          </Badge>
                        )}
                        {r.visibility === "PUBLIC" && (
                          <Badge variant="outline" className="text-xs">Public</Badge>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
                        {r.title}
                      </h3>

                      {/* Authors */}
                      {r.authors && r.authors.length > 0 && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {r.authors
                            .sort((a, b) => a.author_order - b.author_order)
                            .map(a => a.author_name)
                            .join(", ")}
                        </p>
                      )}

                      {/* Abstract excerpt */}
                      {r.abstract && (
                        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{r.abstract}</p>
                      )}

                      {/* Meta */}
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {r.department && <span>{r.department.name}</span>}
                        {r.academic_year && <span>· {r.academic_year.name}</span>}
                        {r.supervisor && <span>· Supervisor: {r.supervisor}</span>}
                        <span>· {formatDate(r.created_at)}</span>
                        <span>· {r.view_count} views · {r.download_count} downloads</span>
                      </div>

                      {/* Keywords */}
                      {r.keywords && r.keywords.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {r.keywords.slice(0, 5).map(k => (
                            <span key={k.id} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {k.keyword}
                            </span>
                          ))}
                          {r.keywords.length > 5 && (
                            <span className="text-xs text-muted-foreground">+{r.keywords.length - 5} more</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Save button */}
                    <SaveButton
                      resourceType="research"
                      resourceId={r.id}
                      userId={profile?.id}
                      variant="ghost"
                    />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}

          {/* Pagination Controls */}
          {(() => {
            const totalCount = result?.count ?? 0;
            const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
            if (totalPages <= 1) return null;
            return (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} resources
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-xs font-medium px-2">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
