import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { QrCode, Search, BookMarked } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/common/StatusBadge";
import { UserAvatar } from "@/components/common/UserAvatar";
import { toast } from "@/hooks/use-toast";
import { bookCopyService, borrowingService } from "@/services/libraryService";
import { formatDate } from "@/lib/utils";

type ScanResult = {
  copy: any;
  borrowing: any | null;
};

export function QRScannerPage() {
  const location = useLocation();
  const libraryBase = location.pathname.startsWith("/admin/library") ? "/admin/library" : "/librarian";
  const [qrInput, setQrInput] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const qc = useQueryClient();

  const handleScan = async () => {
    const code = qrInput.trim();
    if (!code) return;
    setScanning(true);
    try {
      const copy = await bookCopyService.getByQR(code);
      let borrowing: any = null;
      if (copy.status === "BORROWED") {
        borrowing = await borrowingService.getActiveBorrowingForCopy(copy.id);
      }
      setResult({ copy, borrowing });
    } catch {
      toast({ title: "Not found", description: `No book copy found with QR code: ${code}`, variant: "destructive" });
      setResult(null);
    } finally {
      setScanning(false);
    }
  };

  const reset = () => { setResult(null); setQrInput(""); };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="page-header">
        <h1 className="page-title">QR Scanner</h1>
        <p className="page-description">
          Scan or enter a DMU library QR code to identify a book copy and manage transactions.
        </p>
      </div>

      {/* Scan input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <QrCode className="h-4 w-4" /> Enter QR Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Scan a book's QR code with a barcode scanner or type it manually.
            Format: <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">DMU-LIB-BOOK-XXXXXX</span>
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="DMU-LIB-BOOK-001234"
              value={qrInput}
              onChange={e => setQrInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleScan()}
              className="font-mono"
              autoFocus
            />
            <Button onClick={handleScan} disabled={scanning || !qrInput.trim()}>
              {scanning ? "Scanning..." : <><Search className="mr-2 h-4 w-4" />Lookup</>}
            </Button>
            {result && <Button variant="outline" onClick={reset}>Clear</Button>}
          </div>
        </CardContent>
      </Card>

      {/* Scan result */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scan Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Book info */}
            <div className="flex gap-4">
              {result.copy.book?.cover_url ? (
                <img src={result.copy.book.cover_url} alt={result.copy.book.title} className="h-20 w-14 object-cover rounded shrink-0" />
              ) : (
                <div className="flex h-20 w-14 items-center justify-center rounded bg-muted shrink-0">
                  <BookMarked className="h-7 w-7 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 space-y-1">
                <h3 className="font-semibold text-foreground">{result.copy.book?.title}</h3>
                <p className="text-sm text-muted-foreground">{result.copy.book?.author}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{result.copy.accession_number}</span>
                  <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{result.copy.qr_code}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Copy status */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Status</p>
                <div className="mt-1"><StatusBadge status={result.copy.status} /></div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Condition</p>
                <p className="font-medium mt-1">{result.copy.condition}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Location</p>
                <p className="font-medium mt-1">{result.copy.location?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Book Availability</p>
                <p className="font-medium mt-1">
                  {result.copy.book?.available_copies ?? 0} / {result.copy.book?.total_copies ?? 0} copies available
                </p>
              </div>
            </div>

            {/* Active borrowing info */}
            {result.borrowing && (
              <>
                <Separator />
                <div className="rounded-md bg-amber-50 border border-amber-200 p-3 space-y-2">
                  <p className="text-sm font-semibold text-amber-800">Currently Borrowed</p>
                  <div className="flex items-center gap-2">
                    <UserAvatar name={(result.borrowing.student as any)?.full_name} size="sm" />
                    <div>
                      <p className="text-sm font-medium">{(result.borrowing.student as any)?.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{(result.borrowing.student as any)?.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Borrowed: {formatDate(result.borrowing.borrow_date)}</span>
                    <span className={new Date(result.borrowing.due_date) < new Date() ? "text-destructive font-medium" : ""}>
                      Due: {formatDate(result.borrowing.due_date)}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Actions */}
            <Separator />
            <div className="flex flex-wrap gap-2">
              {result.copy.status === "AVAILABLE" && (
                <Button asChild>
                  <Link to={`${libraryBase}/borrowings`}>Issue This Book</Link>
                </Button>
              )}
              {result.copy.status === "BORROWED" && (
                <Button asChild>
                  <Link to={`${libraryBase}/returns`}>Process Return</Link>
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link to={`${libraryBase}/books/${result.copy.book_id}`}>View Book Details</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      {!result && (
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-3">QR Code Format</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>All DMU library book copies have a unique QR code in the format:</p>
              <p className="font-mono bg-muted px-3 py-2 rounded text-center text-base">DMU-LIB-BOOK-XXXXXX</p>
              <p className="mt-2">You can use the QR code to:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Identify any book copy instantly</li>
                <li>Check current availability and borrowing status</li>
                <li>Quickly navigate to issue or return transactions</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
