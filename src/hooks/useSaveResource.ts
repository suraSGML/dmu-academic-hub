/**
 * useSaveResource — hook for toggling a resource saved/unsaved in `saved_resources`.
 *
 * Supports resource_type: 'book' | 'material' | 'research'
 *
 * Usage:
 *   const { isSaved, isLoading, toggle } = useSaveResource({
 *     resourceType: 'research',
 *     resourceId: r.id,
 *     userId: profile?.id,
 *   });
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";

export type SavedResourceType = "book" | "material" | "research";

interface UseSaveResourceOptions {
  resourceType: SavedResourceType;
  resourceId: string;
  userId?: string;
}

export function useSaveResource({ resourceType, resourceId, userId }: UseSaveResourceOptions) {
  const qc = useQueryClient();
  const queryKey = ["saved-resource-check", userId, resourceType, resourceId];

  // Check whether this specific resource is already saved
  const { data: savedRow, isPending: isCheckPending } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("saved_resources" as never)
        .select("id")
        .eq("user_id", userId)
        .eq("resource_type", resourceType)
        .eq("resource_id", resourceId)
        .maybeSingle();
      if (error) throw error;
      return (data as { id: string } | null);
    },
    enabled: !!userId && !!resourceId,
    staleTime: 30_000,
  });

  const isSaved = !!savedRow;

  const { mutate, isPending: isMutating } = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sign in to save resources.");
      if (isSaved && savedRow) {
        // Remove
        const { error } = await supabase
          .from("saved_resources" as never)
          .delete()
          .eq("id", savedRow.id);
        if (error) throw error;
        return "removed";
      } else {
        // Insert — unique constraint prevents duplicates
        const { error } = await supabase
          .from("saved_resources" as never)
          .insert({ user_id: userId, resource_type: resourceType, resource_id: resourceId });
        if (error) throw error;
        return "saved";
      }
    },
    onSuccess: (action) => {
      // Refresh the per-item check and the saved resources page list + dashboard count
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["saved-resources"] });
      qc.invalidateQueries({ queryKey: ["student-stats"] });
      toast({
        title: action === "saved" ? "Saved" : "Removed from saved",
        description:
          action === "saved"
            ? "Added to your saved resources."
            : "Removed from your saved resources.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    },
  });

  return {
    isSaved,
    isLoading: isCheckPending || isMutating,
    toggle: () => mutate(),
  };
}
