import { Bell, AlertTriangle, Info, Filter, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Notification {
  id: string;
  type: 'risk' | 'general';
  severity?: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  approver?: string;
  timestamp: string;
}

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'risk',
    severity: 'high',
    title: 'Warning',
    description: 'Sample12 has High mycotoxin risk',
    approver: 'Mr.Sinu',
    timestamp: '17:44 PM (4 Feb 2026)',
  },
  {
    id: '2',
    type: 'risk',
    severity: 'medium',
    title: 'Warning',
    description: 'Sample13 has Medium mycotoxin risk',
    approver: 'Mr.Sinu',
    timestamp: '20:44 PM (4 Feb 2026)',
  },
  {
    id: '3',
    type: 'general',
    title: 'Request for a site visit',
    description: 'We have received your request for a site visit. Please wait 3-7 days for our response.',
    timestamp: '10:44 PM (29 Jan 2026)',
  },
];

const Notifications = () => {
  const riskNotifications = mockNotifications.filter((n) => n.type === 'risk');
  const generalNotifications = mockNotifications.filter((n) => n.type === 'general');

  const getSeverityStyles = (severity?: string) => {
    switch (severity) {
      case 'high':
        return 'border-l-4 border-l-danger bg-danger/5';
      case 'medium':
        return 'border-l-4 border-l-warning bg-warning/5';
      default:
        return 'border-l-4 border-l-info bg-info/5';
    }
  };

  const getSeverityIconColor = (severity?: string) => {
    switch (severity) {
      case 'high':
        return 'text-danger';
      case 'medium':
        return 'text-warning';
      default:
        return 'text-info';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8 max-w-3xl">
        {/* Page Title */}
        <div className="flex items-center gap-3 mb-6">
          <Bell className="h-6 w-6 text-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Notification</h1>
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
        <div className="mb-8">
          <div className="bg-warning/80 text-warning-foreground py-2 px-4 rounded-t-lg font-medium text-center">
            Risk Notification
          </div>
          <Card className="glass-card rounded-t-none">
            <CardContent className="p-4 space-y-4">
              {riskNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg ${getSeverityStyles(notification.severity)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded ${notification.severity === 'high' ? 'bg-danger/20' : 'bg-warning/20'}`}>
                      <AlertTriangle className={`h-6 w-6 ${getSeverityIconColor(notification.severity)}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">{notification.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{notification.description}</p>
                          {notification.approver && (
                            <p className="text-sm text-muted-foreground">Approve by {notification.approver}</p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {notification.timestamp}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full">
                View More
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* General Notifications Section */}
        <div>
          <div className="bg-info/80 text-info-foreground py-2 px-4 rounded-t-lg font-medium text-center">
            General
          </div>
          <Card className="glass-card rounded-t-none">
            <CardContent className="p-4 space-y-4">
              {generalNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-4 rounded-lg border-l-4 border-l-info bg-info/5"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded bg-info/20">
                      <Info className="h-6 w-6 text-info" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">{notification.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{notification.description}</p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {notification.timestamp}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full">
                View More
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Notifications;
