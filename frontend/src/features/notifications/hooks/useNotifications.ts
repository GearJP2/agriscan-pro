import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationAPI } from "@/lib/api";

export interface NotificationData {
  id: number;
  notification_type: "risk_alert" | "sample_status" | "system";
  title: string;
  message: string;
  link: string;
  metadata: Record<string, any>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface PaginatedNotifications {
  count: number;
  next: string | null;
  previous: string | null;
  results: NotificationData[];
}

// 30 seconds polling interval
const POLLING_INTERVAL = 30_000;

export const useUnreadCount = () => {
  return useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: () => notificationAPI.unreadCount(),
    refetchInterval: POLLING_INTERVAL,
    refetchIntervalInBackground: false,
  });
};

export const useNotificationList = (page: number = 1) => {
  const queryClient = useQueryClient();

  const query = useQuery<PaginatedNotifications | NotificationData[]>({
    queryKey: ["notifications", page],
    queryFn: () => notificationAPI.list(page),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string | number) => notificationAPI.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationAPI.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  return {
    ...query,
    markRead: markReadMutation.mutate,
    markAllRead: markAllReadMutation.mutate,
    isMarkingRead: markReadMutation.isPending,
    isMarkingAllRead: markAllReadMutation.isPending,
  };
};
