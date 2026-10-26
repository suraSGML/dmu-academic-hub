-- =============================================================================
-- DMU Academic Hub — Migration 003: Physical Library System
-- =============================================================================
-- Run this AFTER 002_academic_structure.sql
-- =============================================================================

-- =============================================================================
-- SECTION 1: LIBRARY TABLES
-- =============================================================================

-- 1.1 Book Categories
create table if not exists public.book_categories (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);

-- 1.2 Library Locations (shelves/sections)
create table if not exists public.library_locations (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,       -- e.g. "Section A, Shelf 3"
  code        text not null unique,-- e.g. "A-03"
  description text,
  created_at  timestamptz not null default now()
);

-- 1.3 Books (catalogue entry — not a physical copy)
create table if not exists public.books (
  id               uuid primary key default uuid_generate_v4(),
  title            text not null,
  author           text not null,
  isbn             text unique,
  publisher        text,
  publication_year int,
  edition          text,
  category_id      uuid references public.book_categories(id) on delete set null,
  department_id    uuid references public.departments(id) on delete set null,
  location_id      uuid references public.library_locations(id) on delete set null,
  description      text,
  cover_url        text,
  total_copies     int  not null default 0,
  available_copies int  not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- 1.4 Book Copies (individual physical items)
create table if not exists public.book_copies (
  id               uuid primary key default uuid_generate_v4(),
  book_id          uuid not null references public.books(id) on delete cascade,
  accession_number text not null unique,   -- e.g. "DMU-2024-001234"
  qr_code          text unique,            -- e.g. "DMU-LIB-BOOK-001234"
  condition        text not null default 'GOOD'
                     check (condition in ('NEW','GOOD','FAIR','POOR')),
  status           text not null default 'AVAILABLE'
                     check (status in ('AVAILABLE','BORROWED','RESERVED','LOST','DAMAGED','MAINTENANCE')),
  location_id      uuid references public.library_locations(id) on delete set null,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- 1.5 Borrowings
create table if not exists public.borrowings (
  id             uuid primary key default uuid_generate_v4(),
  book_copy_id   uuid not null references public.book_copies(id) on delete restrict,
  book_id        uuid not null references public.books(id) on delete restrict,
  student_id     uuid not null references public.profiles(id) on delete restrict,
  librarian_id   uuid references public.profiles(id) on delete set null,
  borrow_date    date not null default current_date,
  due_date       date not null,
  return_date    date,
  status         text not null default 'ACTIVE'
                   check (status in ('ACTIVE','RETURNED','OVERDUE','LOST','DAMAGED')),
  renewal_count  int  not null default 0,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 1.6 Reservations
create table if not exists public.reservations (
  id               uuid primary key default uuid_generate_v4(),
  book_id          uuid not null references public.books(id) on delete cascade,
  student_id       uuid not null references public.profiles(id) on delete cascade,
  reservation_date timestamptz not null default now(),
  expiry_date      timestamptz,
  status           text not null default 'PENDING'
                     check (status in ('PENDING','READY','FULFILLED','CANCELLED','EXPIRED')),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique(book_id, student_id, status)
);

-- =============================================================================
-- SECTION 2: INDEXES
-- =============================================================================

create index if not exists idx_books_category_id     on public.books(category_id);
create index if not exists idx_books_department_id   on public.books(department_id);
create index if not exists idx_books_title           on public.books using gin(to_tsvector('english', title));
create index if not exists idx_books_author          on public.books using gin(to_tsvector('english', author));
create index if not exists idx_book_copies_book_id   on public.book_copies(book_id);
create index if not exists idx_book_copies_status    on public.book_copies(status);
create index if not exists idx_book_copies_qr_code   on public.book_copies(qr_code);
create index if not exists idx_borrowings_student_id on public.borrowings(student_id);
create index if not exists idx_borrowings_status     on public.borrowings(status);
create index if not exists idx_borrowings_due_date   on public.borrowings(due_date);
create index if not exists idx_reservations_student  on public.reservations(student_id);
create index if not exists idx_reservations_book     on public.reservations(book_id);

-- =============================================================================
-- SECTION 3: UPDATED_AT TRIGGERS
-- =============================================================================

do $$ declare t text; begin
  foreach t in array array['books','book_copies','borrowings','reservations'] loop
    execute format('
      drop trigger if exists %I_updated_at on public.%I;
      create trigger %I_updated_at before update on public.%I
      for each row execute function public.handle_updated_at();
    ', t, t, t, t);
  end loop;
end $$;

-- =============================================================================
-- SECTION 4: FUNCTIONS
-- =============================================================================

-- Automatically update book available_copies when a copy status changes
create or replace function public.sync_book_availability()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.books
  set
    available_copies = (
      select count(*) from public.book_copies
      where book_id = coalesce(new.book_id, old.book_id)
        and status = 'AVAILABLE'
    ),
    total_copies = (
      select count(*) from public.book_copies
      where book_id = coalesce(new.book_id, old.book_id)
        and status not in ('LOST','DAMAGED')
    ),
    updated_at = now()
  where id = coalesce(new.book_id, old.book_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists book_copies_sync_availability on public.book_copies;
create trigger book_copies_sync_availability
  after insert or update of status or delete on public.book_copies
  for each row execute function public.sync_book_availability();

-- Auto-mark borrowings as OVERDUE when due_date has passed
create or replace function public.mark_overdue_borrowings()
returns void language sql security definer set search_path = public as $$
  update public.borrowings
  set status = 'OVERDUE', updated_at = now()
  where status = 'ACTIVE'
    and due_date < current_date;
$$;

-- Check if a student has an active borrowing for a given book
create or replace function public.student_has_active_borrowing(p_student_id uuid, p_book_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.borrowings
    where student_id = p_student_id
      and book_id    = p_book_id
      and status in ('ACTIVE','OVERDUE')
  );
$$;

grant execute on function public.mark_overdue_borrowings()                       to authenticated;
grant execute on function public.student_has_active_borrowing(uuid, uuid)        to authenticated;

-- =============================================================================
-- SECTION 5: ROW LEVEL SECURITY
-- =============================================================================

alter table public.book_categories    enable row level security;
alter table public.library_locations  enable row level security;
alter table public.books              enable row level security;
alter table public.book_copies        enable row level security;
alter table public.borrowings         enable row level security;
alter table public.reservations       enable row level security;

-- ── book_categories ───────────────────────────────────────────────────────────
create policy "book_categories: all authenticated read"
  on public.book_categories for select to authenticated using (true);
create policy "book_categories: librarian write"
  on public.book_categories for all
  using (public.get_user_role(auth.uid()) in ('LIBRARIAN','ACADEMIC_LIBRARY_ADMIN'))
  with check (public.get_user_role(auth.uid()) in ('LIBRARIAN','ACADEMIC_LIBRARY_ADMIN'));

-- ── library_locations ─────────────────────────────────────────────────────────
create policy "library_locations: all authenticated read"
  on public.library_locations for select to authenticated using (true);
create policy "library_locations: librarian write"
  on public.library_locations for all
  using (public.get_user_role(auth.uid()) in ('LIBRARIAN','ACADEMIC_LIBRARY_ADMIN'))
  with check (public.get_user_role(auth.uid()) in ('LIBRARIAN','ACADEMIC_LIBRARY_ADMIN'));

-- ── books ─────────────────────────────────────────────────────────────────────
create policy "books: all authenticated read"
  on public.books for select to authenticated using (true);
create policy "books: librarian write"
  on public.books for all
  using (public.get_user_role(auth.uid()) in ('LIBRARIAN','ACADEMIC_LIBRARY_ADMIN'))
  with check (public.get_user_role(auth.uid()) in ('LIBRARIAN','ACADEMIC_LIBRARY_ADMIN'));

-- ── book_copies ───────────────────────────────────────────────────────────────
create policy "book_copies: all authenticated read"
  on public.book_copies for select to authenticated using (true);
create policy "book_copies: librarian write"
  on public.book_copies for all
  using (public.get_user_role(auth.uid()) in ('LIBRARIAN','ACADEMIC_LIBRARY_ADMIN'))
  with check (public.get_user_role(auth.uid()) in ('LIBRARIAN','ACADEMIC_LIBRARY_ADMIN'));

-- ── borrowings ────────────────────────────────────────────────────────────────
-- Students see their own; librarians/admins see all
create policy "borrowings: student own read"
  on public.borrowings for select
  using (student_id = auth.uid());
create policy "borrowings: librarian all"
  on public.borrowings for all
  using (public.get_user_role(auth.uid()) in ('LIBRARIAN','ACADEMIC_LIBRARY_ADMIN'))
  with check (public.get_user_role(auth.uid()) in ('LIBRARIAN','ACADEMIC_LIBRARY_ADMIN'));

-- ── reservations ──────────────────────────────────────────────────────────────
create policy "reservations: student own"
  on public.reservations for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());
create policy "reservations: librarian all"
  on public.reservations for all
  using (public.get_user_role(auth.uid()) in ('LIBRARIAN','ACADEMIC_LIBRARY_ADMIN'))
  with check (public.get_user_role(auth.uid()) in ('LIBRARIAN','ACADEMIC_LIBRARY_ADMIN'));

-- =============================================================================
-- SECTION 6: SEED DATA
-- =============================================================================

-- Categories
insert into public.book_categories (name, description) values
  ('Computer Science & IT',       'Programming, algorithms, databases, networks'),
  ('Engineering',                  'Civil, electrical, mechanical, chemical'),
  ('Business & Economics',         'Accounting, management, economics, finance'),
  ('Natural Sciences',             'Physics, chemistry, biology, mathematics'),
  ('Social Sciences & Humanities', 'History, geography, sociology, philosophy'),
  ('Medicine & Health',            'Medical sciences, nursing, public health'),
  ('Agriculture',                  'Agronomy, animal science, soil science'),
  ('Education',                    'Pedagogy, curriculum, educational psychology'),
  ('Reference',                    'Dictionaries, encyclopedias, atlases'),
  ('General',                      'General interest and interdisciplinary works')
on conflict (name) do nothing;

-- Locations
insert into public.library_locations (name, code, description) values
  ('Main Hall – Section A',  'A', 'Computer Science & Engineering'),
  ('Main Hall – Section B',  'B', 'Business & Social Sciences'),
  ('Main Hall – Section C',  'C', 'Natural Sciences & Medicine'),
  ('Main Hall – Section D',  'D', 'Agriculture & Education'),
  ('Reference Room',         'REF', 'Reference and reserved materials'),
  ('Periodicals Room',       'PER', 'Journals and periodicals')
on conflict (code) do nothing;

-- Sample books (Computer Science section)
insert into public.books (title, author, isbn, publisher, publication_year, edition, category_id, location_id, description) values
  (
    'Introduction to Algorithms',
    'Cormen, Leiserson, Rivest, Stein',
    '978-0-262-03384-8',
    'MIT Press',
    2022, '4th',
    (select id from public.book_categories where name = 'Computer Science & IT'),
    (select id from public.library_locations where code = 'A'),
    'The definitive textbook on algorithms and data structures.'
  ),
  (
    'Database System Concepts',
    'Silberschatz, Korth, Sudarshan',
    '978-0-07-802215-9',
    'McGraw-Hill',
    2020, '7th',
    (select id from public.book_categories where name = 'Computer Science & IT'),
    (select id from public.library_locations where code = 'A'),
    'Comprehensive introduction to database systems.'
  ),
  (
    'Computer Networks',
    'Andrew S. Tanenbaum',
    '978-0-13-212695-3',
    'Pearson',
    2021, '6th',
    (select id from public.book_categories where name = 'Computer Science & IT'),
    (select id from public.library_locations where code = 'A'),
    'Foundational text on computer networking.'
  ),
  (
    'Clean Code',
    'Robert C. Martin',
    '978-0-13-235088-4',
    'Prentice Hall',
    2008, '1st',
    (select id from public.book_categories where name = 'Computer Science & IT'),
    (select id from public.library_locations where code = 'A'),
    'A handbook of agile software craftsmanship.'
  ),
  (
    'Principles of Economics',
    'N. Gregory Mankiw',
    '978-1-305-58512-6',
    'Cengage Learning',
    2020, '8th',
    (select id from public.book_categories where name = 'Business & Economics'),
    (select id from public.library_locations where code = 'B'),
    'The most widely used economics textbook.'
  ),
  (
    'Financial Accounting',
    'Kieso, Weygandt, Warfield',
    '978-1-118-87420-9',
    'Wiley',
    2022, '16th',
    (select id from public.book_categories where name = 'Business & Economics'),
    (select id from public.library_locations where code = 'B'),
    'Comprehensive financial accounting textbook.'
  ),
  (
    'Engineering Mathematics',
    'K.A. Stroud',
    '978-1-352-01039-2',
    'Macmillan',
    2020, '8th',
    (select id from public.book_categories where name = 'Engineering'),
    (select id from public.library_locations where code = 'A'),
    'The leading mathematics textbook for engineers.'
  ),
  (
    'Calculus: Early Transcendentals',
    'James Stewart',
    '978-1-285-74155-0',
    'Cengage Learning',
    2015, '8th',
    (select id from public.book_categories where name = 'Natural Sciences'),
    (select id from public.library_locations where code = 'C'),
    'Widely adopted calculus textbook.'
  )
on conflict (isbn) do nothing;

-- Add 3 copies for each book
do $$
declare
  b record;
  i int;
  acc_num text;
  qr_code text;
  seq int := 1000;
begin
  for b in select id from public.books loop
    for i in 1..3 loop
      acc_num := 'DMU-' || to_char(now(), 'YYYY') || '-' || lpad(seq::text, 6, '0');
      qr_code := 'DMU-LIB-BOOK-' || lpad(seq::text, 6, '0');
      insert into public.book_copies (book_id, accession_number, qr_code, condition, status)
      values (b.id, acc_num, qr_code, 'GOOD', 'AVAILABLE')
      on conflict (accession_number) do nothing;
      seq := seq + 1;
    end loop;
  end loop;
end $$;

-- =============================================================================
-- DONE
-- Run this in Supabase SQL Editor.
-- =============================================================================
