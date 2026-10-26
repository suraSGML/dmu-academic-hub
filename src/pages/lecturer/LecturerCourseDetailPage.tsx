import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, BookOpen, FileText, Hash, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { useAuth } from "@/hooks/useAuth";
import { courseService, enrollmentService } from "@/services/academicService";
import { auditService } from "@/services/adminService";

export function LecturerCourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const loggedCourseId = useRef<string | null>(null);
  const { data: assignedCourses, isPending: assignmentsPending, isError: assignmentsError, error: assignmentsLoadError, refetch } = useQuery({
    queryKey: ["lecturer-courses", profile?.id],
    queryFn: () => courseService.getForLecturer(profile!.id),
    enabled: !!profile?.id,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const isAssigned = assignedCourses?.some((course) => course.id === id) ?? false;
  const { data: course, isPending: coursePending, isError: courseError, error: courseLoadError, refetch: refetchCourse } = useQuery({
    queryKey: ["course", id],
    queryFn: () => courseService.get(id!),
    enabled: !!id && isAssigned,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const { data: enrollmentCount, isPending: countPending, isError: countError } = useQuery({
    queryKey: ["course-enrollment-count", id],
    queryFn: () => enrollmentService.countActiveByCourse(id!),
    enabled: !!id && isAssigned,
  });

  useEffect(() => {
    if (!profile?.id || !isAssigned || !course || loggedCourseId.current === course.id) return;
    loggedCourseId.current = course.id;
    void auditService.log({
      action: "COURSE_DETAIL_VIEWED",
      resourceType: "course",
      resourceId: course.id,
      details: { role: "LECTURER", course_code: course.code, course_name: course.name },
    });
  }, [course, isAssigned, profile?.id]);

  if (assignmentsPending || (isAssigned && coursePending)) {
    return <div className="space-y-4"><CardSkeleton /><CardSkeleton /></div>;
  }
  if (assignmentsError) {
    return (
      <ErrorState
        description={`Unable to load your lecturer assignments: ${assignmentsLoadError.message}`}
        onRetry={refetch}
      />
    );
  }
  if (isAssigned && courseError) {
    return (
      <ErrorState
        description={`Unable to load course details: ${courseLoadError.message}`}
        onRetry={refetchCourse}
      />
    );
  }

  if (!isAssigned || !course) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/lecturer/courses"><ArrowLeft className="mr-2 h-4 w-4" />Assigned Courses</Link>
        </Button>
        <ErrorState title="Course unavailable" description="This course is not in your current lecturer assignments." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/lecturer/courses"><ArrowLeft className="mr-2 h-4 w-4" />Assigned Courses</Link>
      </Button>

      <div className="page-header">
        <h1 className="page-title">{course.name}</h1>
        <p className="page-description">{course.code} · {course.department?.name}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Course information</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Academic period: </span>{course.semester?.name} · {course.academic_year?.name}</p>
            <p className="flex items-center gap-2"><Hash className="h-4 w-4 text-muted-foreground" />Year {course.year_level} · {course.credit_hours} credits</p>
            {course.description && <p className="pt-2 text-muted-foreground">{course.description}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Enrollment</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {countPending ? "Loading enrollment count..." : countError ? "Enrollment count is unavailable." : `${enrollmentCount} active student${enrollmentCount === 1 ? "" : "s"}`}
          </CardContent>
        </Card>
      </div>

      <Button asChild>
        <Link to={`/lecturer/materials/upload?course=${course.id}`}><FileText className="mr-2 h-4 w-4" />Upload course material</Link>
      </Button>
      <Button variant="outline" className="ml-2" asChild>
        <Link to="/lecturer/materials"><BookOpen className="mr-2 h-4 w-4" />Manage materials</Link>
      </Button>
    </div>
  );
}
