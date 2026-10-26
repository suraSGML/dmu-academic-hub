import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <Lock className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="text-5xl font-bold text-foreground">401</h1>
        <h2 className="mt-2 text-xl font-semibold text-foreground">
          Authentication Required
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
          You need to sign in to access this resource.
        </p>
        <Button asChild className="mt-6">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
