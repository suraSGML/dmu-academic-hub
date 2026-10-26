import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/hooks/useAuth";
import { loginSchema, type LoginFormValues } from "@/schemas/auth.schemas";
import { auditService } from "@/services/adminService";
import { ROLE_DEFAULT_ROUTES } from "@/lib/navigation/navigation.config";
import type { AppRole } from "@/types/roles.types";

function getPostLoginPath(role: AppRole, intendedPath?: string): string {
  if (!intendedPath) return ROLE_DEFAULT_ROUTES[role];

  const sharedPaths = ["/research", "/search", "/notifications", "/profile", "/settings"];
  if (sharedPaths.some((path) => intendedPath === path || intendedPath.startsWith(`${path}/`))) {
    return intendedPath;
  }

  const rolePaths: Record<AppRole, string[]> = {
    STUDENT: ["/dashboard", "/courses", "/library", "/saved", "/materials"],
    LECTURER: ["/lecturer"],
    LIBRARIAN: ["/librarian"],
    ACADEMIC_LIBRARY_ADMIN: ["/admin", "/librarian"],
  };
  const canAccessPath = rolePaths[role].some(
    (path) => intendedPath === path || intendedPath.startsWith(`${path}/`),
  );

  return canAccessPath ? intendedPath : ROLE_DEFAULT_ROUTES[role];
}

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from
    ?.pathname;

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    const { error, role } = await signIn(values);

    if (error) {
      if (
        error.message.toLowerCase().includes("invalid") ||
        error.message.toLowerCase().includes("credentials")
      ) {
        setServerError("Invalid email or password. Please try again.");
      } else if (
        error.message.toLowerCase().includes("email not confirmed") ||
        error.message.toLowerCase().includes("email is not confirmed")
      ) {
        setServerError(
          "This account is still marked as unconfirmed in Supabase. Turning off Confirm email does not confirm accounts created earlier. In Supabase, open Authentication → Users, find this account, and confirm it; then try signing in again."
        );
      } else {
        setServerError(error.message ?? "Sign in failed. Please try again.");
      }
      return;
    }

    await auditService.log({ action: "USER_LOGIN", resourceType: "auth" });

    if (!role) {
      setServerError("Your account role could not be loaded. Please contact the administrator.");
      return;
    }
    navigate(getPostLoginPath(role, from), { replace: true });
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-primary px-12 text-primary-foreground">
        <GraduationCap className="h-16 w-16 mb-6 opacity-90" />
        <h1 className="text-3xl font-bold text-center">DMU Academic Hub</h1>
        <p className="mt-3 text-center text-primary-foreground/80 text-sm max-w-xs leading-relaxed">
          Smart Academic Resource and Digital Library Management System for
          Debre Markos University
        </p>
        <div className="mt-12 space-y-4 w-full max-w-xs">
          {[
            "Access course materials & digital resources",
            "Manage physical library books & borrowings",
            "Discover research papers & theses",
            "Unified academic search platform",
          ].map((feature) => (
            <div key={feature} className="flex items-start gap-3 text-sm">
              <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-accent/80" />
              <span className="text-primary-foreground/80">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex w-full items-center justify-center bg-background px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <GraduationCap className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="mt-3 text-xl font-bold text-foreground">
              DMU Academic Hub
            </h1>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to your DMU account to continue
            </p>
          </div>

          {serverError && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {serverError}
            </div>
          )}

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@dmu.edu.et"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      <Link
                        to="/forgot-password"
                        className="text-xs text-primary hover:underline"
                        tabIndex={-1}
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </Form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
