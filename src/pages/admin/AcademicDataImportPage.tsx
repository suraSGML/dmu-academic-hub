import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileUp, Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  academicImportService,
  type AcademicImportResult,
  type StudentIdsImportResult,
} from "@/services/academicService";

const IMPORTS = {
  courses: {
    label: "Course catalog",
    description: "Enter the college and department names; missing academic references are created during import.",
    headers: [
      "course_code", "course_name", "college_name", "department_name",
      "academic_year", "semester_number",
    ],
    required: [
      "course_code", "course_name", "college_name", "department_name",
      "academic_year", "semester_number",
    ],
  },
  enrollments: {
    label: "Student enrollments",
    description: "Connect existing student accounts to catalog courses by email.",
    headers: ["course_code", "academic_year", "semester_number", "student_email", "status"],
    required: ["course_code", "academic_year", "semester_number", "student_email"],
  },
  assignments: {
    label: "Lecturer assignments",
    description: "Assign lecturers to courses, or explicitly unassign them with action=UNASSIGN.",
    headers: ["course_code", "academic_year", "semester_number", "lecturer_email", "action", "is_primary"],
    required: ["course_code", "academic_year", "semester_number", "lecturer_email"],
  },
  studentIds: {
    label: "Student accounts & IDs",
    description: "Match existing student accounts by email and add their official student IDs. This does not create login accounts.",
    headers: ["student_email", "student_id"],
    required: ["student_email", "student_id"],
  },
} as const;
const MAX_CSV_BYTES = 10 * 1024 * 1024;

type ImportKind = keyof typeof IMPORTS;
type CsvRow = Record<string, string>;
type ImportResult = AcademicImportResult | StudentIdsImportResult;

function getImportErrorMessage(cause: unknown, kind: ImportKind): string {
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === "object") {
    const error = cause as Record<string, unknown>;
    const messages = [error.message, error.details, error.hint, error.code]
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    if (messages.length) return messages.join(" — ");
  }
  const migrations = kind === "studentIds" ? "migration 017" : "migrations 012–015";
  return `Import failed. No records were imported. Check the CSV values and confirm ${migrations} have been applied.`;
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  if (rows.length < 2) throw new Error("CSV must include a header and at least one data row.");

  const headers = rows[0].map((value, index) =>
    (index === 0 ? value.replace(/^\uFEFF/, "") : value).trim().toLowerCase(),
  );
  if (headers.some((header) => !header)) throw new Error("CSV headers cannot be blank.");
  if (new Set(headers).size !== headers.length) throw new Error("CSV contains duplicate headers.");

  return rows.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(`Row ${index + 2} has ${values.length} columns; expected ${headers.length}.`);
    }
    return Object.fromEntries(headers.map((header, column) => [header, values[column].trim()]));
  });
}

function validateRows(kind: ImportKind, rows: CsvRow[]): void {
  const config = IMPORTS[kind];
  const missingHeaders = config.required.filter((header) => !(header in rows[0]));
  if (missingHeaders.length) {
    throw new Error(`Missing required columns: ${missingHeaders.join(", ")}.`);
  }
  rows.forEach((row, index) => {
    const missingValues = config.required.filter((header) => !row[header]);
    if (missingValues.length) {
      throw new Error(`Row ${index + 2} is missing: ${missingValues.join(", ")}.`);
    }
    if (
      (kind === "courses" || kind === "enrollments" || kind === "assignments") &&
      !["1", "2"].includes(row.semester_number)
    ) {
      throw new Error(`Row ${index + 2}: semester_number must be 1 or 2.`);
    }
    if (kind === "enrollments" && row.status && !["ACTIVE", "DROPPED", "COMPLETED"].includes(row.status.toUpperCase())) {
      throw new Error(`Row ${index + 2}: status must be ACTIVE, DROPPED, or COMPLETED.`);
    }
    if (kind === "assignments") {
      if (row.action && !["ASSIGN", "UNASSIGN"].includes(row.action.toUpperCase())) {
        throw new Error(`Row ${index + 2}: action must be ASSIGN or UNASSIGN.`);
      }
      if (row.is_primary && !["true", "false", "1", "0", "yes", "no"].includes(row.is_primary.toLowerCase())) {
        throw new Error(`Row ${index + 2}: is_primary must be true or false.`);
      }
    }
    if (kind === "studentIds") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.student_email)) {
        throw new Error(`Row ${index + 2}: student_email must be a valid email address.`);
      }
      if (row.student_id.length > 50) {
        throw new Error(`Row ${index + 2}: student_id must be 50 characters or fewer.`);
      }
    }
  });
  if (rows.length > 5000) throw new Error("A CSV file may contain at most 5,000 data rows.");
}

function downloadTemplate(kind: ImportKind): void {
  const csv = `${IMPORTS[kind].headers.join(",")}\r\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = kind === "studentIds" ? "student-ids-template.csv" : `${kind}-template.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function AcademicDataImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<ImportKind>("courses");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const selectKind = (value: ImportKind) => {
    setKind(value);
    setFileName("");
    setRows([]);
    setError("");
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const readFile = async (file?: File) => {
    setFileName(file?.name ?? "");
    setRows([]);
    setError("");
    setResult(null);
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) {
      setError("CSV files must be 10 MB or smaller.");
      return;
    }
    try {
      const parsed = parseCsv(await file.text());
      validateRows(kind, parsed);
      setRows(parsed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read this CSV file.");
    }
  };

  const importRows = async () => {
    setIsImporting(true);
    setError("");
    setResult(null);
    try {
      if (kind === "studentIds") {
        const studentIdsResult = await academicImportService.importStudentIds(rows);
        setResult(studentIdsResult);
        await queryClient.invalidateQueries({ queryKey: ["users"] });
      } else {
        setResult(await academicImportService.importRecords(kind, rows));
      }
    } catch (cause) {
      setError(getImportErrorMessage(cause, kind));
    } finally {
      setIsImporting(false);
    }
  };

  const headers = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Import university records</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Import university-provided course data or match an existing student account to an official student ID.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Choose an import</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(IMPORTS) as ImportKind[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => selectKind(option)}
                disabled={isImporting}
                className={`rounded-md border p-4 text-left ${kind === option ? "border-primary bg-primary/5" : "border-border"}`}
                aria-pressed={kind === option}
              >
                <span className="block font-medium">{IMPORTS[option].label}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{IMPORTS[option].description}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => downloadTemplate(kind)}>
              <Download className="mr-2 h-4 w-4" /> Download CSV template
            </Button>
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              <FileUp className="mr-2 h-4 w-4" /> Choose CSV
            </Button>
            <Input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => void readFile(event.target.files?.[0])}
              aria-label="Choose CSV file"
            />
            {fileName && <span className="self-center text-sm text-muted-foreground">{fileName}</span>}
          </div>

          {kind !== "studentIds" && <p className="text-sm text-muted-foreground">
            Imports are additive/upsert operations; omitted rows are not removed. Enrollment status can be set to DROPPED, and a lecturer can be unassigned using action=UNASSIGN.
          </p>}
          {kind === "courses" && (
            <p className="text-sm text-muted-foreground">
              Course CSV example: <code>SE101,Introduction to Software,College of Computing,Software Engineering,2025/2026,1</code>.
              Credit hours and year level default to 3 and 1.
            </p>
          )}
          {kind === "studentIds" && (
            <p className="text-sm text-muted-foreground">
              Every email must belong to an existing account with the STUDENT role. The import updates IDs only; it does not create accounts or change names and roles.
            </p>
          )}

          {error && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
          {result && (
            <div role="status" className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
              {"studentIds" in result
                ? `Import completed. Student IDs updated for ${result.updated} existing accounts.`
                : `Import completed. Processed: ${result.courses} courses, ${result.enrollments} enrollments, ${result.assignments} lecturer assignments, and ${result.unassignments} unassignments.`}
            </div>
          )}

          {rows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Preview ({rows.length} rows)</h2>
                <Button onClick={() => void importRows()} disabled={isImporting}>
                  {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {isImporting ? "Importing..." : "Import records"}
                </Button>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-max text-left text-sm">
                  <thead className="bg-muted">
                    <tr>{headers.map((header) => <th key={header} className="px-3 py-2 font-medium">{header}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((row, index) => (
                      <tr key={index} className="border-t">
                        {headers.map((header) => <td key={header} className="max-w-64 truncate px-3 py-2">{row[header]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 5 && <p className="text-xs text-muted-foreground">Showing the first 5 rows.</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
