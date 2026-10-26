import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Search, RefreshCw, User, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { auditService } from "@/services/adminService";
import { formatDateTime } from "@/lib/utils";

const ACTION_COLORS: Record<string, string> = {
  USER_LOGIN:               "bg-blue-100 text-blue-700 border-blue-200",
  USER_REGISTER:            "bg-green-100 text-green-700 border-green-200",
  USER_ROLE_CHANGED:        "bg-purple-100 text-purple-700 border-purple-200",
  USER_STATUS_CHANGED:      "bg-purple-100 text-purple-700 border-purple-200",
  BOOK_CREATED:             "bg-teal-100 text-teal-700 border-teal-200",
  BOOK_UPDATED:             "bg-teal-100 text-teal-700 border-teal-200",
  BOOK_DELETED:             "bg-red-100 text-red-700 border-red-200",
  BOOK_BORROWED:            "bg-amber-100 text-amber-700 border-amber-200",
  BOOK_RETURNED:            "bg-green-100 text-green-700 border-green-200",
  BOOK_RESERVED:            "bg-orange-100 text-orange-700 border-orange-200",
  RESERVATION_FULFILLED:    "bg-green-100 text-green-700 border-green-200",
  RESERVATION_CANCELLED:    "bg-red-100 text-red-700 border-red-200",
  MATERIAL_UPLOADED:        "bg-blue-100 text-blue-700 border-blue-200",
  MATERIAL_UPDATED:         "bg-blue-100 text-blue-700 border-blue-200",
  MATERIAL_PUBLISHED:       "bg-green-100 text-green-700 border-green-200",
  MATERIAL_UNPUBLISHED:     "bg-amber-100 text-amber-700 border-amber-200",
  MATERIAL_ARCHIVED:        "bg-gray-100 text-gray-700 border-gray-200",
  MATERIAL_DELETED:         "bg-red-100 text-red-700 border-red-200",
  RESEARCH_SUBMITTED:       "bg-violet-100 text-violet-700 border-violet-200",
  RESEARCH_APPROVED:        "bg-green-100 text-green-700 border-green-200",
  RESEARCH_REJECTED:        "bg-red-100 text-red-700 border-red-200",
  FINE_WAIVED:              "bg-yellow-100 text-yellow-700 border-yellow-200",
  FINE_PAID:                "bg-green-100 text-green-700 border-green-200",
  SETTING_UPDATED:          "bg-gray-100 text-gray-700 border-gray-200",
  ENROLLMENT_ADDED:         "bg-indigo-100 text-indigo-700 border-indigo-200",
  ENROLLMENT_DROPPED:       "bg-red-100 text-red-700 border-red-200",
  ACADEMIC_CSV_IMPORT:      "bg-cyan-100 text-cyan-700 border-cyan-200",
  COURSE_LIST_VIEWED:       "bg-indigo-100 text-indigo-700 border-indigo-200",
  COURSE_DETAIL_VIEWED:     "bg-indigo-100 text-indigo-700 border-indigo-200",
  STUDENT_ID_UPDATED:      "bg-purple-100 text-purple-700 border-purple-200",
  STUDENT_IDS_IMPORTED:    "bg-purple-100 text-purple-700 border-purple-200",
};

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "USER_LOGIN", label: "User Login" },
  { value: "USER_REGISTER", label: "User Register" },
  { value: "USER_ROLE_CHANGED", label: "User Role Changed" },
  { value: "USER_STATUS_CHANGED", label: "User Account Status Changed" },
  { value: "BOOK_BORROWED", label: "Book Borrowed" },
  { value: "BOOK_RETURNED", label: "Book Returned" },
  { value: "BOOK_CREATED", label: "Book Created" },
  { value: "MATERIAL_UPLOADED", label: "Material Uploaded" },
  { value: "MATERIAL_PUBLISHED", label: "Material Published" },
  { value: "RESEARCH_SUBMITTED", label: "Research Submitted" },
  { value: "RESEARCH_APPROVED", label: "Research Approved" },
  { value: "RESEARCH_REJECTED", label: "Research Rejected" },
  { value: "FINE_WAIVED", label: "Fine Waived" },
  { value: "FINE_PAID", label: "Fine Paid" },
  { value: "SETTING_UPDATED", label: "Setting Updated" },
  { value: "ENROLLMENT_ADDED", label: "Enrollment Added" },
  { value: "ACADEMIC_CSV_IMPORT", label: "Academic CSV Import" },
  { value: "COURSE_LIST_VIEWED", label: "Course List Viewed" },
  { value: "COURSE_DETAIL_VIEWED", label: "Course Detail Viewed" },
  { value: "STUDENT_ID_UPDATED", label: "Student ID Updated" },
  { value: "STUDENT_IDS_IMPORTED", label: "Student IDs Imported" },
];

const RESOURCE_OPTIONS = [
  { value: "", label: "All Resources" },
  { value: "book", label: "Book" },
  { value: "material", label: "Course Material" },
  { value: "research", label: "Research" },
  { value: "user", label: "User" },
  { value: "borrowing", label: "Borrowing" },
  { value: "fine", label: "Fine" },
  { value: "system_settings", label: "System Settings" },
  { value: "academic_records", label: "Academic Records" },
  { value: "course_list", label: "Course List" },
  { value: "course", label: "Course" },
];

export function AuditLogsPage() {
  const [actionFilter,   setActionFilter]   = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [userFilter,     setUserFilter]     = useState("");

  const { data: result, isPending, isError, refetch } = useQuery({
    queryKey: ["audit-logs", actionFilter, resourceFilter, userFilter],
    queryFn:  () =>
      auditService.list({
        action:       actionFilter   || undefined,
        resourceType: resourceFilter || undefined,
        userId:       userFilter     || undefined,
        limit:        100,
      }),
  });

  const logs = result?.data ?? [];
  const total = result?.count ?? 0;

  const humanizeAction = (action: string) =>
    action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="page-header mb-0">
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-description">
            Platform activity log for administrative oversight.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Action type" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map(o => (
                  <SelectItem key={o.value || "all"} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Resource" />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_OPTIONS.map(o => (
                  <SelectItem key={o.value || "all"} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by User ID..."
                value={userFilter}
                onChange={e => setUserFilter(e.target.value)}
                className="pl-8 w-52 font-mono text-xs"
              />
            </div>

            {(actionFilter || resourceFilter || userFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setActionFilter(""); setResourceFilter(""); setUserFilter(""); }}
              >
                Clear filters
              </Button>
            )}

            {total > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {total.toLocaleString()} event{total !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isPending ? (
            <div className="p-6"><LoadingSkeleton rows={8} /></div>
          ) : isError ? (
            <div className="p-6"><ErrorState onRetry={refetch} /></div>
          ) : logs.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={ScrollText}
                title="No audit events found"
                description="Successful logins, material uploads, and administrative changes will appear here as they occur."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Resource</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Resource ID</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" />User</span>
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Details</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    const colorClass = ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-700 border-gray-200";
                    const detailsStr = log.metadata
                      ? Object.entries(log.metadata)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(", ")
                          .slice(0, 80)
                      : null;
                    return (
                      <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
                            {humanizeAction(log.action)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground capitalize">
                          {log.resource_type?.replace(/_/g, " ") ?? "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground max-w-[120px] truncate">
                          {log.resource_id ? log.resource_id.slice(0, 8) + "..." : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {log.user_id ? log.user_id.slice(0, 8) + "..." : "system"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                          {detailsStr ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                          {formatDateTime(log.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
