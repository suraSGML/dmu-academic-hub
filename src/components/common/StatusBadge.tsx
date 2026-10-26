import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";

type StatusVariant = "success" | "warning" | "destructive" | "info" | "secondary" | "outline";

const STATUS_CONFIG: Record<string, { label: string; variant: StatusVariant }> = {
  // Book copy statuses
  AVAILABLE: { label: "Available", variant: "success" },
  BORROWED: { label: "Borrowed", variant: "warning" },
  RESERVED: { label: "Reserved", variant: "info" },
  LOST: { label: "Lost", variant: "destructive" },
  DAMAGED: { label: "Damaged", variant: "destructive" },
  MAINTENANCE: { label: "In Maintenance", variant: "secondary" },

  // Borrowing statuses
  ACTIVE: { label: "Active", variant: "success" },
  RETURNED: { label: "Returned", variant: "secondary" },
  OVERDUE: { label: "Overdue", variant: "destructive" },

  // Reservation statuses
  PENDING: { label: "Pending", variant: "warning" },
  READY: { label: "Ready for Pickup", variant: "success" },
  FULFILLED: { label: "Fulfilled", variant: "secondary" },
  CANCELLED: { label: "Cancelled", variant: "secondary" },
  EXPIRED: { label: "Expired", variant: "destructive" },

  // Material/publication statuses
  DRAFT: { label: "Draft", variant: "secondary" },
  PUBLISHED: { label: "Published", variant: "success" },
  ARCHIVED: { label: "Archived", variant: "secondary" },

  // Research statuses
  SUBMITTED: { label: "Submitted", variant: "info" },
  UNDER_REVIEW: { label: "Under Review", variant: "warning" },
  APPROVED: { label: "Approved", variant: "success" },
  REJECTED: { label: "Rejected", variant: "destructive" },

  // User statuses
  ACTIVE_USER: { label: "Active", variant: "success" },
  INACTIVE: { label: "Inactive", variant: "secondary" },
  SUSPENDED: { label: "Suspended", variant: "destructive" },
};

interface StatusBadgeProps extends Omit<BadgeProps, "variant"> {
  status: string;
  customLabel?: string;
}

export function StatusBadge({ status, customLabel, ...props }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: customLabel ?? status,
    variant: "secondary" as StatusVariant,
  };

  return (
    <Badge variant={config.variant} {...props}>
      {customLabel ?? config.label}
    </Badge>
  );
}
