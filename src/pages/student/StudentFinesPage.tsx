import { useQuery } from "@tanstack/react-query";
import { DollarSign, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { useAuth } from "@/hooks/useAuth";
import { fineService } from "@/services/adminService";
import { formatDate } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-red-100 text-red-700 border-red-200",
  PAID:    "bg-green-100 text-green-700 border-green-200",
  WAIVED:  "bg-gray-100 text-gray-600 border-gray-200",
};

export function StudentFinesPage() {
  const { profile } = useAuth();

  const { data: fines = [], isPending } = useQuery({
    queryKey: ["student-fines", profile?.id],
    queryFn:  () => fineService.getForStudent(profile!.id),
    enabled:  !!profile?.id,
  });

  const pendingFines  = fines.filter(f => f.status === "PENDING");
  const pendingTotal  = pendingFines.reduce((s, f) => s + f.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">My Fines</h1>
        <p className="page-description">Overdue fines for library borrowings.</p>
      </div>

      {pendingFines.length > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50/60 px-4 py-4">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <div>
            <p className="font-medium text-red-800 text-sm">
              You have {pendingFines.length} unpaid fine{pendingFines.length !== 1 ? "s" : ""} totalling{" "}
              <strong>ETB {pendingTotal.toFixed(2)}</strong>.
            </p>
            <p className="text-xs text-red-700 mt-0.5">
              Please visit the library to pay your outstanding fines.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Fine History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <LoadingSkeleton rows={4} />
          ) : fines.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="No fines"
              description="You have no overdue fines. Return books on time to avoid penalties."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    {["Book", "Due Date", "Days Overdue", "Amount (ETB)", "Status", "Notes"].map(h => (
                      <th key={h} className="px-3 py-3 text-left font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fines.map(f => (
                    <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-3">
                        <p className="font-medium line-clamp-1">
                          {(f.borrowing as any)?.book?.title ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(f.borrowing as any)?.book?.author}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {f.borrowing?.due_date ? formatDate(f.borrowing.due_date) : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="destructive">{f.days_overdue}d</Badge>
                      </td>
                      <td className="px-3 py-3 font-semibold">
                        {f.amount.toFixed(2)}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[f.status] ?? ""}`}>
                          {f.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {f.status === "WAIVED" && f.waive_reason ? `Waived: ${f.waive_reason}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
