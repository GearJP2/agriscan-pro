import { Bell, AlertTriangle, Info, Filter, ChevronDown, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotificationList, NotificationData } from '@/features/notifications/hooks/useNotifications';

const Notifications = () => {
  const { data, isLoading, isError, markRead, markAllRead, isMarkingRead, isMarkingAllRead } = useNotificationList(1);

  // DRF returns an array directly if pagination is disabled, or { results: [] } if enabled.
  const notifications: NotificationData[] = Array.isArray(data) ? data : (data?.results || []);

  const riskNotifications = notifications.filter((n) => n.notification_type === 'risk_alert');
  const generalNotifications = notifications.filter((n) => n.notification_type !== 'risk_alert');

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container py-8 max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="h-6 w-6 text-foreground" />
            <h1 className="text-2xl font-bold text-foreground">Notification</h1>
          </div>
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-muted rounded-lg w-full"></div>
            <div className="h-32 bg-muted rounded-lg w-full"></div>
            <div className="h-32 bg-muted rounded-lg w-full"></div>
          </div>
        </main>
      </div>
    );
  }

  if (isError) {
    return <div className="text-center text-danger p-8">Failed to load notifications.</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8 max-w-3xl">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-foreground" />
            <h1 className="text-2xl font-bold text-foreground">Notification</h1>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => markAllRead()}
            disabled={isMarkingAllRead || notifications.every(n => n.is_read)}
            className="flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            Mark all as read
          </Button>
        </div>

        {/* Filter */}
        <Card className="glass-card mb-6">
          <CardContent className="p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 text-muted-foreground">
                  <Filter className="h-4 w-4" />
                  <span>Filter:</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>All Notifications</DropdownMenuItem>
                <DropdownMenuItem>Risk Notifications</DropdownMenuItem>
                <DropdownMenuItem>General Notifications</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>

        {/* Risk Notifications Section */}
        {riskNotifications.length > 0 && (
          <div className="mb-8">
            <div className="bg-danger/80 text-danger-foreground py-2 px-4 rounded-t-lg font-medium text-center">
              Risk Notification
            </div>
            <Card className="glass-card rounded-t-none">
              <CardContent className="p-4 space-y-4">
                {riskNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg border-l-4 border-l-danger transition-colors ${
                      notification.is_read ? 'bg-background opacity-75' : 'bg-danger/5'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded bg-danger/20">
                        <AlertTriangle className="h-6 w-6 text-danger" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-foreground">{notification.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                            {notification.link && (
                              <a href={notification.link} className="text-sm text-primary hover:underline mt-2 inline-block">
                                View Details
                              </a>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(notification.created_at)}
                            </span>
                            {!notification.is_read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => markRead(notification.id)}
                                disabled={isMarkingRead}
                              >
                                Mark as read
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* General Notifications Section */}
        {generalNotifications.length > 0 && (
          <div>
            <div className="bg-info/80 text-info-foreground py-2 px-4 rounded-t-lg font-medium text-center">
              General
            </div>
            <Card className="glass-card rounded-t-none">
              <CardContent className="p-4 space-y-4">
                {generalNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg border-l-4 border-l-info transition-colors ${
                      notification.is_read ? 'bg-background opacity-75' : 'bg-info/5'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded bg-info/20">
                        <Info className="h-6 w-6 text-info" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-foreground">{notification.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(notification.created_at)}
                            </span>
                            {!notification.is_read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => markRead(notification.id)}
                                disabled={isMarkingRead}
                              >
                                Mark as read
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {notifications.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>You have no notifications.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Notifications;
