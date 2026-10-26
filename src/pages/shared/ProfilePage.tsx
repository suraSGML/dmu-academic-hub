import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Camera } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { UserAvatar } from "@/components/common/UserAvatar";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/lib/supabase";
import { profileUpdateSchema, type ProfileUpdateFormValues } from "@/schemas/auth.schemas";
import { ROLE_DISPLAY_NAMES } from "@/lib/navigation/navigation.config";
import type { AppRole } from "@/types/roles.types";
import { toast } from "@/hooks/use-toast";

const ROLE_DISPLAY: Record<AppRole, string> = {
  STUDENT: "Student",
  LECTURER: "Lecturer",
  LIBRARIAN: "Librarian",
  ACADEMIC_LIBRARY_ADMIN: "Academic Resource & Library Administrator",
};

export function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const { role } = useRole();
  const [avatarUploading, setAvatarUploading] = useState(false);

  const form = useForm<ProfileUpdateFormValues>({
    resolver: zodResolver(profileUpdateSchema),
    values: {
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: ProfileUpdateFormValues) => {
      if (!profile?.id) throw new Error("No profile");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: values.full_name,
          phone: values.phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshProfile();
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;

    // Validate
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload a JPEG, PNG, or WebP image.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Avatar must be under 2MB.", variant: "destructive" });
      return;
    }

    setAvatarUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${profile.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", profile.id);
      await refreshProfile();
      toast({ title: "Avatar updated" });
    } catch (err) {
      toast({ title: "Upload failed", description: String(err), variant: "destructive" });
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">My Profile</h1>
        <p className="page-description">Manage your personal information and account details.</p>
      </div>

      {/* Avatar + basic info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile Photo</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div className="relative">
            <UserAvatar name={profile?.full_name} avatarUrl={profile?.avatar_url} size="lg" className="h-20 w-20" />
            <label
              htmlFor="avatar-upload"
              className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground hover:bg-primary/90"
              aria-label="Change avatar"
            >
              {avatarUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={handleAvatarChange}
              disabled={avatarUploading}
            />
          </div>
          <div>
            <p className="font-semibold text-foreground">{profile?.full_name ?? "—"}</p>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
            {role && (
              <Badge variant="secondary" className="mt-1 text-xs">
                {ROLE_DISPLAY[role]}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Editable fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal Information</CardTitle>
          <CardDescription>
            Keep your information accurate. Use your real full name as shown in your university records, not a nickname or placeholder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Real full name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name as registered with the university" autoComplete="name" {...field} />
                    </FormControl>
                    <FormDescription>Enter your real first and family names so staff can identify your account correctly.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone number <span className="text-muted-foreground">(optional)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="+251 9xx xxx xxx" type="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Read-only account info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Information</CardTitle>
          <CardDescription>These fields are managed by your administrator and cannot be changed here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ReadOnlyField label="Email address" value={profile?.email ?? "—"} />
          {profile?.student_id && <ReadOnlyField label="Student ID" value={profile.student_id} />}
          {profile?.staff_id && <ReadOnlyField label="Staff ID" value={profile.staff_id} />}
          <ReadOnlyField label="Account role" value={role ? ROLE_DISPLAY[role] : "—"} />
          <ReadOnlyField label="Account status" value={profile?.is_active ? "Active" : "Inactive"} />
        </CardContent>
      </Card>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground">{value}</p>
      <Separator className="mt-3" />
    </div>
  );
}
