import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookMarked, MapPin, Calendar, Hash, BookOpen, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CardSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "@/hooks/use-toast";
import { bookService, reservationService, borrowingService } from "@/services/libraryService";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

export function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [reserveConfirmOpen, setReserveConfirmOpen] = useState(false);

  const { data: book, isPending, isError, refetch } = useQuery({
    queryKey: ["book", id],
    queryFn: () => bookService.get(id!),
    enabled: !!id,
  });

  // Check if student already has active borrowing for this book
  const { data: activeBorrowing } = useQuery({
    queryKey: ["student-borrowing-check", id, profile?.id],
    queryFn: async () => {
      if (!profile?.id || !id) return null;
      const result = await borrowingService.list({ studentId: profile.id, status: "ACTIVE" as any });
      return result.data.find(b => b.book_id === id) ?? null;
    },
    enabled: !!id && !!profile?.id,
  });

  // Check existing reservation
  const { data: existingReservation } = useQuery({
    queryKey: ["student-reservation-check", id, profile?.id],
    queryFn: async () => {
      if (!profile?.id || !id) return null;
      const reservations = await reservationService.list({ studentId: profile.id, bookId: id });
      return reservations.find(r => ["PENDING", "READY"].includes(r.status)) ?? null;
    },
    enabled: !!id && !!profile?.id,
  });

  const reserveMutation = useMutation({
    mutationFn: () => reservationService.create(id!, profile!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-reservation-check", id] });
      setReserveConfirmOpen(false);
      toast({ title: "Book reserved", description: "You'll be notified when it becomes available." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isPending) return <div className="space-y-4"><CardSkeleton /><CardSkeleton /></div>;
  if (isError || !book) return <ErrorState onRetry={refetch} title="Book not found" />;

  const isAvailable = book.available_copies > 0;
  const hasBorrowed = !!activeBorrowing;
  const hasReserved = !!existingReservation;

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/library"><ArrowLeft className="mr-2 h-4 w-4" />Library</Link>
      </Button>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row">
            {/* Cover */}
            {book.cover_url ? (
              <img src={book.cover_url} alt={book.title} className="h-48 w-32 object-cover rounded-md shadow-sm shrink-0 self-start" />
            ) : (
              <div className="flex h-48 w-32 items-center justify-center rounded-md bg-muted shrink-0">
                <BookMarked className="h-12 w-12 text-muted-foreground" />
              </div>
            )}

            {/* Info */}
            <div className="flex-1 space-y-3">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{book.title}</h1>
                <p className="text-base text-muted-foreground mt-0.5">{book.author}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {(book.category as any)?.name && <Badge variant="secondary">{(book.category as any).name}</Badge>}
                {book.edition && <Badge variant="outline">{book.edition} edition</Badge>}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                {book.isbn && <InfoRow icon={Hash} label="ISBN" value={book.isbn} />}
                {book.publisher && <InfoRow icon={BookOpen} label="Publisher" value={book.publisher} />}
                {book.publication_year && <InfoRow icon={Calendar} label="Year" value={String(book.publication_year)} />}
                {(book.location as any)?.name && <InfoRow icon={MapPin} label="Location" value={(book.location as any).name} />}
              </div>

              {book.description && <p className="text-sm text-muted-foreground">{book.description}</p>}

              <Separator />

              {/* Availability + actions */}
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Availability</p>
                  <p className="font-semibold text-lg">
                    <span className={isAvailable ? "text-green-600" : "text-destructive"}>{book.available_copies}</span>
                    <span className="text-muted-foreground text-base"> / {book.total_copies} copies</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {hasBorrowed ? (
                    <Badge variant="info">Already borrowed</Badge>
                  ) : hasReserved ? (
                    <Badge variant="warning">Reservation {existingReservation?.status?.toLowerCase()}</Badge>
                  ) : isAvailable ? (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Available to borrow — visit the library desk with your student ID.</p>
                      <Badge variant="success">Available for borrowing</Badge>
                    </div>
                  ) : (
                    <Button onClick={() => setReserveConfirmOpen(true)}>
                      <CalendarClock className="mr-2 h-4 w-4" />Reserve Book
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={reserveConfirmOpen}
        onOpenChange={setReserveConfirmOpen}
        title="Reserve Book"
        description={`Reserve "${book.title}"? You'll be notified when a copy becomes available. Reservation expires after 7 days.`}
        confirmLabel="Reserve"
        onConfirm={() => reserveMutation.mutate()}
        isLoading={reserveMutation.isPending}
      />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium text-xs">{value}</p>
      </div>
    </div>
  );
}
