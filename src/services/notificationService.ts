import { supabase } from "@/lib/supabase";

let notificationSubscriptionId = 0;

export type NotificationType =
  | "NEW_MATERIAL"
  | "MATERIAL_UPDATED"
  | "BOOK_DUE_SOON"
  | "BOOK_ISSUED"
  | "BOOK_OVERDUE"
  | "BOOK_RETURNED"
  | "RESERVATION_READY"
  | "RESEARCH_SUBMITTED"
  | "RESEARCH_APPROVED"
  | "RESEARCH_REJECTED"
  | "ANNOUNCEMENT"
  | "SYSTEM";

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  resource_type: string | null;
  resource_id: string | null;
  created_at: string;
}

export const notificationService = {
  list: async (userId: string, unreadOnly = false): Promise<Notification[]> => {
    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (unreadOnly) query = query.eq("is_read", false);

    const { data, error } = await query;
    if (error) throw error;
    return data as Notification[];
  },

  getUnreadCount: async (userId: string): Promise<number> => {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (error) throw error;
    return count ?? 0;
  },

  markRead: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
    if (error) throw error;
  },

  markAllRead: async (userId: string): Promise<void> => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (error) throw error;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  // Create a notification (used server-side / admin actions)
  create: async (
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
    resourceType?: string,
    resourceId?: string
  ): Promise<void> => {
    const { error } = await supabase.from("notifications").insert({
      user_id:       userId,
      title,
      message,
      type,
      resource_type: resourceType ?? null,
      resource_id:   resourceId   ?? null,
    });
    if (error) throw error;
  },

  // Subscribe to realtime new notifications for a user
  subscribe: (
    userId: string,
    onNew: (notification: Notification) => void,
    onError?: (error: Error) => void,
  ) => {
    const channel = supabase
      .channel(`notifications:${userId}:${++notificationSubscriptionId}`)
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => onNew(payload.new as Notification)
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          const subscriptionError = error ?? new Error(`Notification realtime subscription ${status.toLowerCase()}.`);
          console.error("Notification realtime subscription failed.", subscriptionError);
          onError?.(subscriptionError);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  },
};
