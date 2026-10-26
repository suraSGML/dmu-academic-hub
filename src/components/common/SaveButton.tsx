/**
 * SaveButton — a bookmark toggle button for resources.
 *
 * Renders a Bookmark icon that fills when saved.
 * Wires into the useSaveResource hook for optimistic UI and cache invalidation.
 *
 * Props:
 *   resourceType — 'book' | 'material' | 'research'
 *   resourceId   — uuid of the resource
 *   userId       — current user's profile id (pass undefined if not logged in → button is disabled)
 *   className    — optional extra classes
 *   size         — 'sm' | 'md' (default 'sm')
 *   variant      — shadcn Button variant (default 'ghost')
 */

import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSaveResource, type SavedResourceType } from "@/hooks/useSaveResource";
import { cn } from "@/lib/utils";

interface SaveButtonProps {
  resourceType: SavedResourceType;
  resourceId: string;
  userId?: string;
  className?: string;
  size?: "sm" | "md";
  variant?: "ghost" | "outline" | "secondary";
}

export function SaveButton({
  resourceType,
  resourceId,
  userId,
  className,
  size = "sm",
  variant = "ghost",
}: SaveButtonProps) {
  const { isSaved, isLoading, toggle } = useSaveResource({ resourceType, resourceId, userId });

  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <Button
      size="icon"
      variant={variant}
      disabled={!userId || isLoading}
      onClick={(e) => {
        // Stop propagation so clicking the button doesn't navigate the parent <Link>
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      title={isSaved ? "Remove from saved" : "Save resource"}
      aria-label={isSaved ? "Remove from saved" : "Save resource"}
      className={cn(
        "shrink-0 transition-all",
        isSaved
          ? "text-primary hover:text-primary/80"
          : "text-muted-foreground hover:text-primary",
        className
      )}
    >
      <Bookmark
        className={cn(iconSize, isSaved && "fill-primary")}
        aria-hidden
      />
    </Button>
  );
}
