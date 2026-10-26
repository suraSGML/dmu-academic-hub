import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Search, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { DataTable, type Column } from "@/components/common/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { UserAvatar } from "@/components/common/UserAvatar";
import { toast } from "@/hooks/use-toast";
import { userService, type UserWithRole } from "@/services/academicService";
import { formatDate } from "@/lib/utils";
import type { AppRole } from "@/types/roles.types";

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "STUDENT", label: "Student" },
  { value: "LECTURER", label: "Lecturer" },
  { value: "LIBRARIAN", label: "Librarian" },
  { value: "ACADEMIC_LIBRARY_ADMIN", label: "Resource & Library Admin" },
];

const ROLE_BADGE: Record<AppRole, "default" | "secondary" | "info" | "warning"> = {
  STUDENT: "secondary",
  LECTURER: "info",
  LIBRARIAN: "default",
  ACADEMIC_LIBRARY_ADMIN: "default",
};

const roleSchema = z.object({
  role: z.enum(["STUDENT", "LECTURER", "LIBRARIAN", "ACADEMIC_LIBRARY_ADMIN"]),
});
type RoleFormValues = z.infer<typeof roleSchema>;

type UserRow = UserWithRole;

export function UserManagementPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [roleDialogTarget, setRoleDialogTarget] = useState<UserRow | null>(null);

  const { data: users, isPending, isError, error, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: userService.listWithRoles,
  });

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: { role: "STUDENT" },
  });

  const filtered = (users ?? []).filter(u => {
    const matchSearch = !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const userRole = u.user_roles?.[0]?.role?.name ?? "";
    const matchRole = !roleFilter || userRole === roleFilter;
    return matchSearch && matchRole;
  });

  const openRoleDialog = (user: UserRow) => {
    setRoleDialogTarget(user);
    form.reset({ role: (user.user_roles?.[0]?.role?.name as AppRole) ?? "STUDENT" });
  };

  const changeRoleMutation = useMutation({
    mutationFn: (v: RoleFormValues) => userService.changeRole(roleDialogTarget!.id, v.role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setRoleDialogTarget(null);
      toast({ title: "Role updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      userService.toggleActive(id, isActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Account status updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const columns: Column<UserRow>[] = [
    {
      header: "User", accessor: (r) => (
        <div className="flex items-center gap-3">
          <UserAvatar name={r.full_name} avatarUrl={r.avatar_url} size="sm" />
          <div>
            <p className="font-medium text-sm">{r.full_name ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{r.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Role", accessor: (r) => {
        const role = r.user_roles?.[0]?.role;
        if (!role) return <span className="text-muted-foreground text-xs">No role</span>;
        return <Badge variant={ROLE_BADGE[role.name as AppRole] ?? "secondary"}>{role.display_name}</Badge>;
      },
    },
    { header: "Student ID", accessor: (r) => r.student_id ?? <span className="text-muted-foreground">—</span> },
    { header: "Joined", accessor: (r) => formatDate(r.created_at) },
    {
      header: "Status", accessor: (r) => (
        <Badge variant={r.is_active ? "success" : "destructive"}>{r.is_active ? "Active" : "Inactive"}</Badge>
      ),
    },
    {
      header: "Actions", accessor: (r) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => openRoleDialog(r)} title="Change role">
            <ShieldCheck className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={r.is_active ? "text-destructive hover:text-destructive" : "text-green-600 hover:text-green-600"}
            onClick={() => toggleActiveMutation.mutate({ id: r.id, isActive: !r.is_active })}
          >
            {r.is_active ? "Deactivate" : "Activate"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">User Management</h1>
        <p className="page-description">Manage platform users, roles, and account statuses.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
        >
          <option value="">All roles</option>
          {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {isPending ? (
        <LoadingSkeleton rows={8} />
      ) : isError ? (
        <ErrorState
          onRetry={refetch}
          description={(error as Error)?.message ?? "Failed to load users. Ensure migration 007 has been applied in Supabase."}
        />
      ) : !filtered.length ? (
        <EmptyState icon={Users} title="No users found" description="No users match your search criteria." />
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{filtered.length} user(s) found</p>
          <DataTable columns={columns} data={filtered} keyField="id" />
        </div>
      )}

      {/* Change Role Dialog */}
      <Dialog open={!!roleDialogTarget} onOpenChange={(o) => !o && setRoleDialogTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role — {roleDialogTarget?.full_name ?? roleDialogTarget?.email}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => changeRoleMutation.mutate(v))} className="space-y-4">
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>New role</FormLabel>
                  <FormControl>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...field}>
                      {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <p className="text-xs text-muted-foreground">
                Changing a user's role immediately affects their access. They will see the new dashboard on next login.
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRoleDialogTarget(null)}>Cancel</Button>
                <Button type="submit" disabled={changeRoleMutation.isPending}>
                  {changeRoleMutation.isPending ? "Saving..." : "Update role"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
