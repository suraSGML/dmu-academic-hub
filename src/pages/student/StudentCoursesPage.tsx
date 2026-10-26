import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Clock, GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { CardSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { useAuth } from "@/hooks/useAuth";
import { courseService } from "@/services/academicService";
import { auditService } from "@/services/adminService";

export function StudentCoursesPage() {
  const { profile } = useAuth();
  const { data: courses, isPending, isError, error, refetch } = useQuery({
    queryKey: ["student-courses", profile?.id],
    queryFn: () => courseService.getForStudent(profile!.id),
    enabled: !!profile?.id,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!profile?.id) return;
    void auditService.log({
      action: "COURSE_LIST_VIEWED",
      resourceType: "course_list",
      details: { role: "STUDENT" },
    });
  }, [profile?.id]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">My Courses</h1>
        <p className="page-description">Courses you are enrolled in, from the university course records.</p>
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => <CardSkeleton key={index} />)}
        </div>
      ) : isError ? (
        <ErrorState
          description={`Unable to load your enrolled courses: ${error.message}`}
          onRetry={refetch}
        />
      ) : !courses?.length ? (
        <EmptyState
          icon={BookOpen}
          title="No enrolled courses"
          description="Your course list will appear when your enrollment is available from the university system."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link key={course.id} to={`/courses/${course.id}`}>
              <Card className="group h-full transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <Badge variant="secondary" className="shrink-0 font-mono text-xs">{course.code}</Badge>
                  </div>
                  <h2 className="mb-1 font-semibold leading-tight transition-colors group-hover:text-primary">{course.name}</h2>
                  <p className="mb-3 text-xs text-muted-foreground">{course.department?.name ?? "Department not listed"}</p>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>{course.semester?.name} · {course.academic_year?.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                      <span>Year {course.year_level} · {course.credit_hours} credits</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
