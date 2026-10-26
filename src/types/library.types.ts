export interface BookCategory {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface LibraryLocation {
  id: string;
  name: string;
  code: string;
  description: string | null;
  created_at: string;
}

export type CopyCondition = "NEW" | "GOOD" | "FAIR" | "POOR";
export type CopyStatus =
  | "AVAILABLE"
  | "BORROWED"
  | "RESERVED"
  | "LOST"
  | "DAMAGED"
  | "MAINTENANCE";

export type BorrowingStatus = "ACTIVE" | "RETURNED" | "OVERDUE" | "LOST" | "DAMAGED";
export type ReservationStatus =
  | "PENDING"
  | "READY"
  | "FULFILLED"
  | "CANCELLED"
  | "EXPIRED";

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  publisher: string | null;
  publication_year: number | null;
  edition: string | null;
  category_id: string | null;
  department_id: string | null;
  location_id: string | null;
  description: string | null;
  cover_url: string | null;
  total_copies: number;
  available_copies: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // joined
  category?: BookCategory;
  location?: LibraryLocation;
  department?: { id: string; name: string; code: string };
}

export interface BookCopy {
  id: string;
  book_id: string;
  accession_number: string;
  qr_code: string | null;
  condition: CopyCondition;
  status: CopyStatus;
  location_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  book?: Book;
  location?: LibraryLocation;
}

export interface Borrowing {
  id: string;
  book_copy_id: string;
  book_id: string;
  student_id: string;
  librarian_id: string | null;
  borrow_date: string;
  due_date: string;
  return_date: string | null;
  status: BorrowingStatus;
  renewal_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  book?: Book;
  book_copy?: BookCopy;
  student?: {
    id: string;
    full_name: string | null;
    email: string;
    student_id: string | null;
    avatar_url: string | null;
  };
  librarian?: { id: string; full_name: string | null };
}

export interface Reservation {
  id: string;
  book_id: string;
  student_id: string;
  reservation_date: string;
  expiry_date: string | null;
  status: ReservationStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  book?: Book;
  student?: {
    id: string;
    full_name: string | null;
    email: string;
    student_id: string | null;
    avatar_url: string | null;
  };
}

// ── Payload types ─────────────────────────────────────────────────────────────

export interface BookPayload {
  title: string;
  author: string;
  isbn?: string;
  publisher?: string;
  publication_year?: number;
  edition?: string;
  category_id?: string;
  department_id?: string;
  location_id?: string;
  description?: string;
  cover_url?: string;
  is_active?: boolean;
}

export interface BookCopyPayload {
  book_id: string;
  accession_number: string;
  qr_code?: string;
  condition?: CopyCondition;
  status?: CopyStatus;
  location_id?: string;
  notes?: string;
}

export interface IssueBorrowingPayload {
  book_copy_id: string;
  book_id: string;
  student_id: string;
  librarian_id: string;
  due_date: string;
  notes?: string;
}
