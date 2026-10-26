import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Eye, EyeOff, Bell, BellOff, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { supabase } from "@/lib/supabase";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/schemas/auth.schemas";
import { toast } from "@/hooks/use-toast";

// ── Notification preference types ──────────────────────────────────────────────
const NOTIF_PREFS = [
  {
    key:   "notif_new_material",
    label: "New Course Materials",
    desc:  "When a lecturer uploads new materials to your enrolled courses.",
    default: true,
  },
  {
    key:   "notif_book_due",
    label: "Book Due Soon",
    desc:  "Reminder 3 days before your borrowed book is due.",
    default: true,
  },
  {
    key:   "notif_book_overdue",
    label: "Overdue Books",
    desc:  "When a borrowed book passes its due date.",
    default: true,
  },
  {
    key:   "notif_reservation_ready",
    label: "Reservation Ready",
    desc:  "When a reserved book becomes available for pickup.",
    default: true,
  },
  {
    key:   "notif_research_update",
    label: "Research Status Updates",
    desc:  "When your research submission is approved or rejected.",
    default: true,
  },
  {
    key:   "notif_announcements",
    label: "Platform Announcements",
    desc:  "System-wide announcements from administrators.",
    default: true,
  },
] as const;

type PrefKey = (typeof NOTIF_PREFS)[number]["key"];

const STORAGE_KEY = "dmu_notif_prefs";

function loadPrefs(): Record<PrefKey, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return Object.fromEntries(NOTIF_PREFS.map(p => [p.key, p.default])) as Record<PrefKey, boolean>;
}

function savePrefs(prefs: Record<PrefKey, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function SettingsPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [notifPrefs,   setNotifPrefs]   = useState<Record<PrefKey, boolean>>(loadPrefs);
  const [prefsDirty,   setPrefsDirty]   = useState(false);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      toast({ title: "Failed to update password", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated", description: "Your password has been changed successfully." });
      form.reset();
    }
  };

  const togglePref = (key: PrefKey, value: boolean) => {
    setNotifPrefs(prev => ({ ...prev, [key]: value }));
    setPrefsDirty(true);
  };

  const saveNotifPrefs = () => {
    savePrefs(notifPrefs);
    setPrefsDirty(false);
    toast({ title: "Notification preferences saved" });
  };

  const enableAll  = () => { setNotifPrefs(Object.fromEntries(NOTIF_PREFS.map(p => [p.key, true])) as Record<PrefKey, boolean>); setPrefsDirty(true); };
  const disableAll = () => { setNotifPrefs(Object.fromEntries(NOTIF_PREFS.map(p => [p.key, false])) as Record<PrefKey, boolean>); setPrefsDirty(true); };

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-description">Manage your account security and notification preferences.</p>
      </div>

      {/* Password Change */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change Password</CardTitle>
          <CardDescription>
            Update your account password. Choose a strong password you don't use elsewhere.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-sm">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} className="pr-10" {...field} />
                        <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showPassword ? "Hide" : "Show"}>
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm new password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showConfirm ? "text" : "password"} className="pr-10" {...field} />
                        <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showConfirm ? "Hide" : "Show"}>
                          {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</> : "Update password"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Notification Preferences</CardTitle>
              <CardDescription className="mt-1">
                Control which in-app notifications you receive.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={enableAll}>
                <Bell className="mr-1.5 h-3.5 w-3.5" />All on
              </Button>
              <Button variant="ghost" size="sm" onClick={disableAll}>
                <BellOff className="mr-1.5 h-3.5 w-3.5" />All off
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {NOTIF_PREFS.map((pref, idx) => (
              <div key={pref.key}>
                <div className="flex items-center justify-between gap-4 py-4">
                  <div className="space-y-0.5">
                    <Label htmlFor={`pref-${pref.key}`} className="text-sm font-medium cursor-pointer">
                      {pref.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{pref.desc}</p>
                  </div>
                  <Switch
                    id={`pref-${pref.key}`}
                    checked={notifPrefs[pref.key]}
                    onCheckedChange={(v: boolean) => togglePref(pref.key, v)}
                  />
                </div>
                {idx < NOTIF_PREFS.length - 1 && <Separator />}
              </div>
            ))}
          </div>
          {prefsDirty && (
            <div className="mt-4 flex justify-end">
              <Button onClick={saveNotifPrefs} size="sm">
                <Save className="mr-2 h-4 w-4" />Save preferences
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
