import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, BookOpen, FileText, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { useAuth } from "@/hooks/useAuth";
import { courseService } from "@/services/academicService";
import { auditService } from "@/services/adminService";

export function StudentCourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const loggedCourseId = useRef<string | null>(null);
  const { data: enrolledCourses, isPending: enrollmentPending, isError: enrollmentError, error: enrollmentLoadError, refetch } = useQuery({
    queryKey: ["student-courses", profile?.id],
    queryFn: () => courseService.getForStudent(profile!.id),
    enabled: !!profile?.id,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const courseIsEnrolled = enrolledCourses?.some((course) => course.id === id) ?? false;
  const { data: course, isPending: coursePending, isError: courseError, error: courseLoadError, refetch: refetchCourse } = useQuery({
    queryKey: ["course", id],
    queryFn: () => courseService.get(id!),
    enabled: !!id && courseIsEnrolled,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!profile?.id || !courseIsEnrolled || !course || loggedCourseId.current === course.id) return;
    loggedCourseId.current = course.id;
    void auditService.log({
      action: "COURSE_DETAIL_VIEWED",
      resourceType: "course",
      resourceId: course.id,
      details: { role: "STUDENT", course_code: course.code, course_name: course.name },
    });
  }, [course, courseIsEnrolled, profile?.id]);

  if (enrollmentPending || (courseIsEnrolled && coursePending)) {
    return <div className="space-y-4"><CardSkeleton /><CardSkeleton /></div>;
  }

  if (enrollmentError) {
    return (
      <ErrorState
        description={`Unable to load your enrollment records: ${enrollmentLoadError.message}`}
        onRetry={refetch}
      />
    );
  }
  if (courseIsEnrolled && courseError) {
    return (
      <ErrorState
        description={`Unable to load course details: ${courseLoadError.message}`}
        onRetry={refetchCourse}
      />
    );
  }

  if (!courseIsEnrolled || !course) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/courses"><ArrowLeft className="mr-2 h-4 w-4" />My Courses</Link>
        </Button>
        <ErrorState title="Course unavailable" description="This course is not in your active enrollment records." />
      </div>
    );
  }

  const lecturers = course.lecturers?.map((assignment) => assignment.lecturer).filter(Boolean) ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/courses"><ArrowLeft className="mr-2 h-4 w-4" />My Courses</Link>
      </Button>

      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="page-title">{course.name}</h1>
            <p className="page-description">{course.code} · {course.department?.name}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Course information</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Academic period: </span>{course.semester?.name} · {course.academic_year?.name}</p>
            <p><span className="text-muted-foreground">Year level: </span>{course.year_level}</p>
            <p><span className="text-muted-foreground">Credit hours: </span>{course.credit_hours}</p>
            {course.description && <p className="pt-2 text-muted-foreground">{course.description}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><GraduationCap className="h-4 w-4" />Lecturers</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {lecturers.length ? lecturers.map((lecturer) => (
              <p key={lecturer!.id}>{lecturer!.full_name ?? lecturer!.email}</p>
            )) : <p className="text-muted-foreground">No lecturer listed.</p>}
          </CardContent>
        </Card>
      </div>

      <Button asChild>
        <Link to={`/materials/courses/${course.id}`}><FileText className="mr-2 h-4 w-4" />View course materials</Link>
      </Button>
    </div>
  );
}
