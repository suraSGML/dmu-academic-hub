import { useNavigate } from "react-router-dom";
import { ShieldX, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRole } from "@/hooks/useRole";
import { ROLE_DEFAULT_ROUTES } from "@/lib/navigation/navigation.config";

export function ForbiddenPage() {
  const navigate = useNavigate();
  const { role } = useRole();

  const handleGoBack = () => {
    if (role && ROLE_DEFAULT_ROUTES[role]) {
      navigate(ROLE_DEFAULT_ROUTES[role]);
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <ShieldX className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-5xl font-bold text-foreground">403</h1>
        <h2 className="mt-2 text-xl font-semibold text-foreground">
          Access Forbidden
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
          You don't have permission to access this page. This action is
          restricted to authorized roles only.
        </p>
        <Button onClick={handleGoBack} className="mt-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go to my Dashboard
        </Button>
      </div>
    </div>
  );
}
