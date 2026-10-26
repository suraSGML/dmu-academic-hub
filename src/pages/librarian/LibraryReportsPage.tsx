import { useQuery } from "@tanstack/react-query";
import { FileBarChart, BookMarked, TrendingUp, AlertCircle, ArrowLeftRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCardSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { libraryStatsService } from "@/services/libraryService";

export function LibraryReportsPage() {
  const { data: stats, isPending: statsPending } = useQuery({
    queryKey: ["library-stats"],
    queryFn: libraryStatsService.getDashboardStats,
  });

  const { data: mostBorrowed, isPending: mbPending } = useQuery({
    queryKey: ["most-borrowed"],
    queryFn: () => libraryStatsService.getMostBorrowed(10),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Library Reports</h1>
        <p className="page-description">Borrowing statistics, collection overview, and usage analytics.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsPending ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard title="Total Books" value={stats?.totalBooks ?? 0} icon={BookMarked} color="text-primary" bg="bg-primary/10" />
            <StatCard title="Currently Borrowed" value={stats?.borrowed ?? 0} icon={ArrowLeftRight} color="text-blue-600" bg="bg-blue-100" />
            <StatCard title="Overdue" value={stats?.overdue ?? 0} icon={AlertCircle} color="text-destructive" bg="bg-destructive/10" />
            <StatCard title="Pending Reservations" value={stats?.reservations ?? 0} icon={TrendingUp} color="text-amber-600" bg="bg-amber-100" />
          </>
        )}
      </div>

      {/* Today's activity */}
      {!statsPending && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Today's Borrowings</p>
              <p className="text-4xl font-bold text-foreground mt-1">{stats?.todayBorrowings ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Today's Returns</p>
              <p className="text-4xl font-bold text-foreground mt-1">{stats?.todayReturns ?? 0}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Most borrowed books */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Most Borrowed Books
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mbPending ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : !mostBorrowed?.length ? (
            <EmptyState icon={BookMarked} title="No borrowing data yet" description="Borrowing statistics will appear once books are issued." />
          ) : (
            <div className="space-y-2">
              {mostBorrowed.map((item, idx) => (
                <div key={item.book.id} className="flex items-center justify-between rounded-md p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground w-6 text-center">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-medium text-sm">{item.book.title}</p>
                      <p className="text-xs text-muted-foreground">{item.book.author}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{item.borrow_count} borrowings</Badge>
                    <Badge variant={item.book.available_copies > 0 ? "success" : "destructive"}>
                      {item.book.available_copies} available
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Collection summary */}
      {!statsPending && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Collection Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-center">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-2xl font-bold text-foreground">{stats?.totalBooks}</p>
                <p className="text-xs text-muted-foreground mt-1">Unique Titles</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-2xl font-bold text-foreground">{stats?.totalCopies}</p>
                <p className="text-xs text-muted-foreground mt-1">Physical Copies</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-2xl font-bold text-green-600">{(stats?.totalCopies ?? 0) - (stats?.borrowed ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">Available Copies</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-2xl font-bold text-blue-600">{stats?.borrowed}</p>
                <p className="text-xs text-muted-foreground mt-1">Currently Out</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, bg }: {
  title: string; value: number; icon: React.ElementType; color: string; bg: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${bg}`}>
          <Icon className={`h-6 w-6 ${color}`} />
        </div>
        <div>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}
