import { useRouteError, Link } from "react-router-dom";
import { AlertTriangle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorPage() {
  const error = useRouteError();
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred.";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-5xl font-bold text-foreground">500</h1>
        <h2 className="mt-2 text-xl font-semibold text-foreground">
          Something Went Wrong
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
          {message}
        </p>
        <Button asChild className="mt-6">
          <Link to="/">
            <Home className="mr-2 h-4 w-4" />
            Go to Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
