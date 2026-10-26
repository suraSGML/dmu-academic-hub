import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings, Library, FileText, FlaskConical, GraduationCap,
  Save, Loader2, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { toast } from "@/hooks/use-toast";
import { systemSettingsService, auditService } from "@/services/adminService";
import type { SystemSetting } from "@/services/adminService";

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  library:   { label: "Library Rules",      icon: Library,       description: "Borrowing limits, fine rates, and reservation policies." },
  materials: { label: "Course Materials",   icon: FileText,      description: "Upload limits and allowed file types for course materials." },
  research:  { label: "Research Repository",icon: FlaskConical,  description: "Submission and approval workflow settings." },
  academic:  { label: "Academic",           icon: GraduationCap, description: "Academic year and semester configuration." },
  general:   { label: "General",            icon: Settings,      description: "Platform name and institution information." },
};

const CATEGORY_ORDER = ["general", "academic", "library", "materials", "research"];

export function SystemSettingsPage() {
  const qc = useQueryClient();

  const { data: settings, isPending, isError, refetch } = useQuery({
    queryKey: ["system-settings"],
    queryFn:  systemSettingsService.list,
  });

  // Local edits keyed by setting key
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  const handleChange = (key: string, value: string) => {
    setEdits(prev => ({ ...prev, [key]: value }));
    setDirty(prev => new Set(prev).add(key));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (dirty.size === 0) return;
      const updates: Record<string, string> = {};
      dirty.forEach(k => { updates[k] = edits[k]; });
      await systemSettingsService.updateMany(updates);
      await auditService.log({
        action:       "SETTING_UPDATED",
        resourceType: "system_settings",
        details:      { keys: Array.from(dirty) },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["system-settings"] });
      setDirty(new Set());
      toast({ title: "Settings saved", description: "Platform configuration updated successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save settings", description: err.message, variant: "destructive" });
    },
  });

  if (isPending) return <LoadingSkeleton rows={10} />;
  if (isError)   return <ErrorState onRetry={refetch} />;

  // Group settings by category
  const grouped: Record<string, SystemSetting[]> = {};
  (settings ?? []).forEach(s => {
    (grouped[s.category] ??= []).push(s);
  });

  const getValue = (s: SystemSetting) =>
    dirty.has(s.key) ? edits[s.key] : s.value;

  const renderField = (s: SystemSetting) => {
    const value = getValue(s);

    // Boolean toggle
    if (value === "true" || value === "false") {
      return (
        <div className="flex items-center gap-3">
          <Switch
            id={`setting-${s.key}`}
            checked={value === "true"}
            onCheckedChange={(checked: boolean) => handleChange(s.key, checked ? "true" : "false")}
          />
          <Label htmlFor={`setting-${s.key}`} className="text-sm text-muted-foreground">
            {value === "true" ? "Enabled" : "Disabled"}
          </Label>
        </div>
      );
    }

    // Numeric input
    if (!isNaN(Number(value)) && !value.includes(",")) {
      return (
        <Input
          id={`setting-${s.key}`}
          type="number"
          value={value}
          onChange={e => handleChange(s.key, e.target.value)}
          className="max-w-[140px]"
          min={0}
        />
      );
    }

    // Text / comma-list input
    return (
      <Input
        id={`setting-${s.key}`}
        value={value}
        onChange={e => handleChange(s.key, e.target.value)}
        className="max-w-sm"
      />
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">System Settings</h1>
          <p className="page-description">
            Configure platform-wide rules for the DMU Academic Hub.
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={dirty.size === 0 || saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
          ) : (
            <><Save className="mr-2 h-4 w-4" />Save Changes</>
          )}
          {dirty.size > 0 && !saveMutation.isPending && (
            <Badge variant="secondary" className="ml-2">{dirty.size}</Badge>
          )}
        </Button>
      </div>

      {dirty.size > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50/60 px-4 py-3">
          <Info className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            You have <strong>{dirty.size}</strong> unsaved change{dirty.size !== 1 ? "s" : ""}. Click <strong>Save Changes</strong> to apply.
          </p>
        </div>
      )}

      {CATEGORY_ORDER.filter(cat => grouped[cat]).map(cat => {
        const meta = CATEGORY_META[cat] ?? { label: cat, icon: Settings, description: "" };
        const Icon = meta.icon;
        const items = grouped[cat];

        return (
          <Card key={cat}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {meta.label}
              </CardTitle>
              {meta.description && (
                <CardDescription>{meta.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {items.map((s, idx) => (
                  <div key={s.key}>
                    <div className="flex items-start justify-between gap-4 py-4">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <Label htmlFor={`setting-${s.key}`} className="text-sm font-medium">
                          {s.label}
                          {dirty.has(s.key) && (
                            <Badge variant="outline" className="ml-2 text-xs text-amber-600 border-amber-300">unsaved</Badge>
                          )}
                        </Label>
                        {s.description && (
                          <p className="text-xs text-muted-foreground">{s.description}</p>
                        )}
                      </div>
                      <div className="shrink-0">
                        {renderField(s)}
                      </div>
                    </div>
                    {idx < items.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
