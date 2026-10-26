import {
  BookMarked, BookOpen, AlertCircle, ArrowDownToLine,
  CalendarClock, ArrowLeftRight, TrendingUp, Package,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { StatCardSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { UserAvatar } from "@/components/common/UserAvatar";
import { StatusBadge } from "@/components/common/StatusBadge";
import { libraryStatsService, borrowingService, reservationService } from "@/services/libraryService";
import { formatDate } from "@/lib/utils";

export function LibrarianDashboard() {
  const { data: stats, isPending: statsPending } = useQuery({
    queryKey: ["library-stats"],
    queryFn: libraryStatsService.getDashboardStats,
  });

  const { data: recentBorrowings, isPending: borrowPending } = useQuery({
    queryKey: ["borrowings-recent"],
    queryFn: () => borrowingService.list({ status: "ACTIVE" as any, limit: 5 }),
  });

  const { data: pendingReservations, isPending: resPending } = useQuery({
    queryKey: ["reservations-pending"],
    queryFn: () => reservationService.list({ status: "PENDING" }),
  });

  const { data: overdueResult } = useQuery({
    queryKey: ["borrowings-overdue"],
    queryFn: () => borrowingService.list({ status: "OVERDUE" as any, limit: 5 }),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Library Dashboard</h1>
        <p className="page-description">Overview of library circulation and collection status.</p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsPending ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <LibStatCard title="Total Books"   value={stats?.totalBooks ?? 0}  icon={BookMarked}    href="/librarian/books"       color="text-primary"    bg="bg-primary/10" />
            <LibStatCard title="Borrowed"      value={stats?.borrowed ?? 0}    icon={BookOpen}      href="/librarian/borrowings"  color="text-blue-600"   bg="bg-blue-100" />
            <LibStatCard title="Overdue"       value={stats?.overdue ?? 0}     icon={AlertCircle}   href="/librarian/overdue"     color="text-destructive" bg="bg-destructive/10" />
            <LibStatCard title="Reservations"  value={stats?.reservations ?? 0} icon={CalendarClock} href="/librarian/reservations" color="text-amber-600" bg="bg-amber-100" />
          </>
        )}
      </div>

      {/* Today stats */}
      {!statsPending && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <ArrowLeftRight className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.todayBorrowings ?? 0}</p>
                <p className="text-xs text-muted-foreground">Issued today</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <ArrowDownToLine className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.todayReturns ?? 0}</p>
                <p className="text-xs text-muted-foreground">Returned today</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalCopies ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total copies</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent active borrowings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Active Loans</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/librarian/borrowings">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {borrowPending ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-muted" />)}</div>
            ) : !recentBorrowings?.data.length ? (
              <EmptyState icon={ArrowLeftRight} title="No active loans" />
            ) : (
              <ul className="space-y-2">
                {recentBorrowings.data.slice(0, 5).map(b => (
                  <li key={b.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/50">
                    <UserAvatar name={(b.student as any)?.full_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{(b.book as any)?.title}</p>
                      <p className="text-xs text-muted-foreground">{(b.student as any)?.full_name} · Due {formatDate(b.due_date)}</p>
                    </div>
                    <StatusBadge status={b.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Overdue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Overdue Books
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/librarian/overdue">Manage</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!overdueResult?.data.length ? (
              <EmptyState icon={AlertCircle} title="No overdue books" />
            ) : (
              <ul className="space-y-2">
                {overdueResult.data.slice(0, 5).map(b => (
                  <li key={b.id} className="flex items-center gap-3 rounded-md p-2 bg-destructive/5 border border-destructive/20">
                    <UserAvatar name={(b.student as any)?.full_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{(b.book as any)?.title}</p>
                      <p className="text-xs text-destructive">Due {formatDate(b.due_date)} · {(b.student as any)?.full_name}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Pending reservations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Pending Reservations</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/librarian/reservations">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {resPending ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}</div>
            ) : !pendingReservations?.length ? (
              <EmptyState icon={CalendarClock} title="No pending reservations" />
            ) : (
              <ul className="space-y-2">
                {pendingReservations.slice(0, 5).map(r => (
                  <li key={r.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-muted/50">
                    <UserAvatar name={(r.student as any)?.full_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{(r.book as any)?.title}</p>
                      <p className="text-xs text-muted-foreground">{(r.student as any)?.full_name} · {formatDate(r.reservation_date)}</p>
                    </div>
                    <Badge variant={(r.book as any)?.available_copies > 0 ? "success" : "secondary"}>
                      {(r.book as any)?.available_copies > 0 ? "Available" : "Unavailable"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Issue Book",      href: "/librarian/borrowings", icon: ArrowLeftRight },
                { label: "Process Return",  href: "/librarian/returns",    icon: ArrowDownToLine },
                { label: "QR Scanner",      href: "/librarian/qr",         icon: TrendingUp },
                { label: "Add Book",        href: "/librarian/books/new",  icon: BookMarked },
              ].map(a => {
                const Icon = a.icon;
                return (
                  <Button key={a.href} variant="outline" className="flex h-auto flex-col gap-2 py-4" asChild>
                    <Link to={a.href}>
                      <Icon className="h-5 w-5 text-primary" />
                      <span className="text-xs">{a.label}</span>
                    </Link>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LibStatCard({ title, value, icon: Icon, href, color, bg }: {
  title: string; value: number; icon: React.ElementType; href: string; color: string; bg: string;
}) {
  return (
    <Link to={href} className="block group">
      <Card className="transition-shadow group-hover:shadow-md">
        <CardContent className="flex items-center gap-4 p-6">
          <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${bg}`}>
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
          <div>
            <p className="stat-value">{value}</p>
            <p className="stat-label">{title}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
