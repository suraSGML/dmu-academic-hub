import { supabase } from "@/lib/supabase";
import type {
  Book, BookPayload,
  BookCopy, BookCopyPayload,
  BookCategory,
  LibraryLocation,
  Borrowing, IssueBorrowingPayload,
  Reservation,
  CopyStatus,
  BorrowingStatus,
} from "@/types/library.types";

// ── Book Categories ────────────────────────────────────────────────────────────

export const bookCategoryService = {
  list: async (): Promise<BookCategory[]> => {
    const { data, error } = await supabase
      .from("book_categories")
      .select("*")
      .order("name");
    if (error) throw error;
    return data as BookCategory[];
  },

  create: async (name: string, description?: string): Promise<BookCategory> => {
    const { data, error } = await supabase
      .from("book_categories")
      .insert({ name, description })
      .select()
      .single();
    if (error) throw error;
    return data as BookCategory;
  },

  update: async (id: string, name: string, description?: string): Promise<BookCategory> => {
    const { data, error } = await supabase
      .from("book_categories")
      .update({ name, description })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as BookCategory;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from("book_categories").delete().eq("id", id);
    if (error) throw error;
  },
};

// ── Library Locations ─────────────────────────────────────────────────────────

export const locationService = {
  list: async (): Promise<LibraryLocation[]> => {
    const { data, error } = await supabase
      .from("library_locations")
      .select("*")
      .order("code");
    if (error) throw error;
    return data as LibraryLocation[];
  },

  create: async (payload: Omit<LibraryLocation, "id" | "created_at">): Promise<LibraryLocation> => {
    const { data, error } = await supabase
      .from("library_locations")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as LibraryLocation;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from("library_locations").delete().eq("id", id);
    if (error) throw error;
  },
};

// ── Books ──────────────────────────────────────────────────────────────────────

export const bookService = {
  list: async (filters?: {
    search?: string;
    categoryId?: string;
    departmentId?: string;
    available?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ data: Book[]; count: number }> => {
    let query = supabase
      .from("books")
      .select(
        `*, 
         category:book_categories(id,name), 
         location:library_locations(id,name,code),
         department:departments(id,name,code)`,
        { count: "exact" }
      )
      .eq("is_active", true)
      .order("title");

    if (filters?.search) {
      query = query.or(
        `title.ilike.%${filters.search}%,author.ilike.%${filters.search}%,isbn.ilike.%${filters.search}%`
      );
    }
    if (filters?.categoryId) query = query.eq("category_id", filters.categoryId);
    if (filters?.departmentId) query = query.eq("department_id", filters.departmentId);
    if (filters?.available) query = query.gt("available_copies", 0);
    if (filters?.limit) query = query.limit(filters.limit);
    if (filters?.offset) query = query.range(filters.offset, (filters.offset + (filters.limit ?? 20)) - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data as Book[], count: count ?? 0 };
  },

  get: async (id: string): Promise<Book> => {
    const { data, error } = await supabase
      .from("books")
      .select(`
        *,
        category:book_categories(id,name),
        location:library_locations(id,name,code),
        department:departments(id,name,code)
      `)
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as Book;
  },

  create: async (payload: BookPayload): Promise<Book> => {
    const { data, error } = await supabase
      .from("books")
      .insert(payload)
      .select(`*, category:book_categories(id,name), location:library_locations(id,name,code)`)
      .single();
    if (error) throw error;
    return data as Book;
  },

  update: async (id: string, payload: Partial<BookPayload>): Promise<Book> => {
    const { data, error } = await supabase
      .from("books")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(`*, category:book_categories(id,name), location:library_locations(id,name,code)`)
      .single();
    if (error) throw error;
    return data as Book;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) throw error;
  },

  uploadCover: async (bookId: string, file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `covers/${bookId}.${ext}`;
    const { error } = await supabase.storage
      .from("book-covers")
      .upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("book-covers").getPublicUrl(path);
    return data.publicUrl;
  },
};

// ── Book Copies ────────────────────────────────────────────────────────────────

export const bookCopyService = {
  listByBook: async (bookId: string): Promise<BookCopy[]> => {
    const { data, error } = await supabase
      .from("book_copies")
      .select(`*, location:library_locations(id,name,code)`)
      .eq("book_id", bookId)
      .order("accession_number");
    if (error) throw error;
    return data as BookCopy[];
  },

  getByQR: async (qrCode: string): Promise<BookCopy & { book: Book }> => {
    const { data, error } = await supabase
      .from("book_copies")
      .select(`
        *,
        location:library_locations(id,name,code),
        book:books(
          *,
          category:book_categories(id,name)
        )
      `)
      .eq("qr_code", qrCode)
      .single();
    if (error) throw error;
    return data as BookCopy & { book: Book };
  },

  create: async (payload: BookCopyPayload): Promise<BookCopy> => {
    const { data, error } = await supabase
      .from("book_copies")
      .insert(payload)
      .select(`*, location:library_locations(id,name,code)`)
      .single();
    if (error) throw error;
    return data as BookCopy;
  },

  update: async (id: string, payload: Partial<BookCopyPayload>): Promise<BookCopy> => {
    const { data, error } = await supabase
      .from("book_copies")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(`*, location:library_locations(id,name,code)`)
      .single();
    if (error) throw error;
    return data as BookCopy;
  },

  updateStatus: async (id: string, status: CopyStatus, notes?: string): Promise<void> => {
    const { error } = await supabase
      .from("book_copies")
      .update({ status, notes, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from("book_copies").delete().eq("id", id);
    if (error) throw error;
  },

  generateAccessionNumber: async (): Promise<string> => {
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from("book_copies")
      .select("id", { count: "exact", head: true });
    const seq = ((count ?? 0) + 1).toString().padStart(6, "0");
    return `DMU-${year}-${seq}`;
  },

  generateQRCode: (accessionNumber: string): string => {
    const num = accessionNumber.split("-").pop() ?? "000000";
    return `DMU-LIB-BOOK-${num}`;
  },
};

// ── Borrowings ─────────────────────────────────────────────────────────────────

export const borrowingService = {
  list: async (filters?: {
    status?: BorrowingStatus | BorrowingStatus[];
    studentId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: Borrowing[]; count: number }> => {
    let query = supabase
      .from("borrowings")
      .select(
        `*,
         book:books(id,title,author,cover_url),
         book_copy:book_copies(id,accession_number,qr_code),
         student:profiles!student_id(id,full_name,email,student_id,avatar_url),
         librarian:profiles!librarian_id(id,full_name)`,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        query = query.in("status", filters.status);
      } else {
        query = query.eq("status", filters.status);
      }
    }
    if (filters?.studentId) query = query.eq("student_id", filters.studentId);
    if (filters?.limit) query = query.limit(filters.limit);
    if (filters?.offset) query = query.range(filters.offset, (filters.offset + (filters.limit ?? 20)) - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    return { data: data as Borrowing[], count: count ?? 0 };
  },

  getActiveBorrowingForCopy: async (bookCopyId: string): Promise<Borrowing | null> => {
    const { data, error } = await supabase
      .from("borrowings")
      .select(`
        *,
        book:books(id,title,author),
        student:profiles!student_id(id,full_name,email,student_id)
      `)
      .eq("book_copy_id", bookCopyId)
      .in("status", ["ACTIVE", "OVERDUE"])
      .maybeSingle();
    if (error) throw error;
    return data as Borrowing | null;
  },

  issue: async (payload: IssueBorrowingPayload): Promise<Borrowing> => {
    // Mark copy as BORROWED
    const { error: copyErr } = await supabase
      .from("book_copies")
      .update({ status: "BORROWED", updated_at: new Date().toISOString() })
      .eq("id", payload.book_copy_id);
    if (copyErr) throw copyErr;

    // Create borrowing record
    const { data, error } = await supabase
      .from("borrowings")
      .insert({
        book_copy_id: payload.book_copy_id,
        book_id: payload.book_id,
        student_id: payload.student_id,
        librarian_id: payload.librarian_id,
        due_date: payload.due_date,
        notes: payload.notes,
        borrow_date: new Date().toISOString().split("T")[0],
      })
      .select(`
        *,
        book:books(id,title,author),
        book_copy:book_copies(id,accession_number),
        student:profiles!student_id(id,full_name,email)
      `)
      .single();
    if (error) throw error;
    return data as Borrowing;
  },

  processReturn: async (
    borrowingId: string,
    bookCopyId: string,
    returnStatus: "RETURNED" | "LOST" | "DAMAGED" = "RETURNED",
    notes?: string
  ): Promise<void> => {
    const today = new Date().toISOString().split("T")[0];

    // Update borrowing record
    const { error: borrowErr } = await supabase
      .from("borrowings")
      .update({
        status: returnStatus,
        return_date: today,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", borrowingId);
    if (borrowErr) throw borrowErr;

    // Update copy status
    const copyStatus: CopyStatus =
      returnStatus === "LOST" ? "LOST"
      : returnStatus === "DAMAGED" ? "DAMAGED"
      : "AVAILABLE";

    const { error: copyErr } = await supabase
      .from("book_copies")
      .update({ status: copyStatus, updated_at: new Date().toISOString() })
      .eq("id", bookCopyId);
    if (copyErr) throw copyErr;
  },

  renew: async (borrowingId: string, newDueDate: string): Promise<void> => {
    const { data: borrow, error: fetchErr } = await supabase
      .from("borrowings")
      .select("renewal_count")
      .eq("id", borrowingId)
      .single();
    if (fetchErr) throw fetchErr;

    const { error } = await supabase
      .from("borrowings")
      .update({
        due_date: newDueDate,
        status: "ACTIVE",
        renewal_count: ((borrow as any).renewal_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", borrowingId);
    if (error) throw error;
  },

  markOverdue: async (): Promise<void> => {
    await supabase.rpc("mark_overdue_borrowings" as never);
  },
};

// ── Reservations ───────────────────────────────────────────────────────────────

export const reservationService = {
  list: async (filters?: {
    status?: string;
    studentId?: string;
    bookId?: string;
  }): Promise<Reservation[]> => {
    let query = supabase
      .from("reservations")
      .select(`
        *,
        book:books(id,title,author,cover_url,available_copies),
        student:profiles!student_id(id,full_name,email,student_id,avatar_url)
      `)
      .order("reservation_date", { ascending: false });

    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.studentId) query = query.eq("student_id", filters.studentId);
    if (filters?.bookId) query = query.eq("book_id", filters.bookId);

    const { data, error } = await query;
    if (error) throw error;
    return data as Reservation[];
  },

  create: async (bookId: string, studentId: string): Promise<Reservation> => {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7); // 7 day expiry

    const { data, error } = await supabase
      .from("reservations")
      .insert({
        book_id: bookId,
        student_id: studentId,
        expiry_date: expiryDate.toISOString(),
        status: "PENDING",
      })
      .select(`*, book:books(id,title,author)`)
      .single();
    if (error) throw error;
    return data as Reservation;
  },

  updateStatus: async (
    id: string,
    status: "READY" | "FULFILLED" | "CANCELLED" | "EXPIRED"
  ): Promise<void> => {
    const { error } = await supabase
      .from("reservations")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },

  cancel: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from("reservations")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },
};

// ── Library Stats (for dashboards/reports) ────────────────────────────────────

export const libraryStatsService = {
  getDashboardStats: async () => {
    const [books, copies, borrowed, overdue, reservations, todayBorrowings, todayReturns] =
      await Promise.all([
        supabase.from("books").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("book_copies").select("id", { count: "exact", head: true }).not("status", "in", '("LOST","DAMAGED")'),
        supabase.from("borrowings").select("id", { count: "exact", head: true }).in("status", ["ACTIVE", "OVERDUE"]),
        supabase.from("borrowings").select("id", { count: "exact", head: true }).eq("status", "OVERDUE"),
        supabase.from("reservations").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
        supabase.from("borrowings").select("id", { count: "exact", head: true }).eq("borrow_date", new Date().toISOString().split("T")[0]),
        supabase.from("borrowings").select("id", { count: "exact", head: true }).eq("return_date", new Date().toISOString().split("T")[0]),
      ]);

    return {
      totalBooks:       (books as any).count ?? 0,
      totalCopies:      (copies as any).count ?? 0,
      borrowed:         (borrowed as any).count ?? 0,
      overdue:          (overdue as any).count ?? 0,
      reservations:     (reservations as any).count ?? 0,
      todayBorrowings:  (todayBorrowings as any).count ?? 0,
      todayReturns:     (todayReturns as any).count ?? 0,
    };
  },

  getMostBorrowed: async (limit = 5): Promise<Array<{ book: Book; borrow_count: number }>> => {
    const { data, error } = await supabase
      .from("borrowings")
      .select("book_id, book:books(id,title,author,cover_url,available_copies,total_copies)")
      .not("status", "eq", "RETURNED")
      .limit(200);
    if (error) throw error;

    // Count manually
    const counts: Record<string, { book: Book; borrow_count: number }> = {};
    for (const row of (data ?? []) as any[]) {
      if (!row.book_id) continue;
      if (!counts[row.book_id]) {
        counts[row.book_id] = { book: row.book, borrow_count: 0 };
      }
      counts[row.book_id].borrow_count++;
    }
    return Object.values(counts)
      .sort((a, b) => b.borrow_count - a.borrow_count)
      .slice(0, limit);
  },
};

