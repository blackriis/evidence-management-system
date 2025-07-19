'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bell, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  PlayCircle,
  StopCircle,
  RefreshCw,
  Activity,
  Users,
  TrendingUp
} from 'lucide-react';

interface SchedulerStatus {
  totalJobs: number;
  jobs: Array<{
    name: string;
    isRunning: boolean;
  }>;
}

interface NotificationStats {
  totalNotifications: number;
  unreadCount: number;
  sentToday: number;
  pendingCount: number;
  escalationAlerts: number;
}

export function NotificationDashboard() {
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchSchedulerStatus = async () => {
    try {
      const response = await fetch('/api/notifications/scheduler');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setSchedulerStatus(data);
    } catch (err) {
      console.error('Failed to fetch scheduler status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch scheduler status');
    }
  };

  const fetchNotificationStats = async () => {
    try {
      // This would be a new API endpoint for admin stats
      const response = await fetch('/api/admin/notification-stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch notification stats:', err);
    }
  };

  const performSchedulerAction = async (action: string) => {
    try {
      setActionLoading(action);
      setError(null);

      const response = await fetch('/api/notifications/scheduler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      alert(result.message);
      
      // Refresh status after action
      await fetchSchedulerStatus();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Action failed';
      setError(errorMessage);
      alert(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchSchedulerStatus(),
        fetchNotificationStats(),
      ]);
      setLoading(false);
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading notification dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Notification System Dashboard</h2>
        <p className="text-gray-600">Monitor and manage the notification system</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Notifications</p>
                  <p className="text-2xl font-bold">{stats.totalNotifications}</p>
                </div>
                <Bell className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Unread</p>
                  <p className="text-2xl font-bold">{stats.unreadCount}</p>
                </div>
                <Users className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Sent Today</p>
                  <p className="text-2xl font-bold">{stats.sentToday}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending</p>
                  <p className="text-2xl font-bold">{stats.pendingCount}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Escalation Alerts</p>
                  <p className="text-2xl font-bold">{stats.escalationAlerts}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="scheduler" className="space-y-4">
        <TabsList>
          <TabsTrigger value="scheduler">Scheduler Status</TabsTrigger>
          <TabsTrigger value="notifications">Recent Notifications</TabsTrigger>
          <TabsTrigger value="escalations">Escalation Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="scheduler" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Notification Scheduler
              </CardTitle>
              <CardDescription>
                Manage the background notification scheduler and monitoring jobs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Scheduler Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => performSchedulerAction('initialize')}
                  disabled={!!actionLoading}
                  className="flex items-center gap-2"
                >
                  <PlayCircle className="h-4 w-4" />
                  {actionLoading === 'initialize' ? 'Starting...' : 'Start Scheduler'}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => performSchedulerAction('stop')}
                  disabled={!!actionLoading}
                  className="flex items-center gap-2"
                >
                  <StopCircle className="h-4 w-4" />
                  {actionLoading === 'stop' ? 'Stopping...' : 'Stop All Jobs'}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => performSchedulerAction('trigger-deadline-checks')}
                  disabled={!!actionLoading}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  {actionLoading === 'trigger-deadline-checks' ? 'Running...' : 'Run Deadline Checks'}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => performSchedulerAction('trigger-notifications')}
                  disabled={!!actionLoading}
                  className="flex items-center gap-2"
                >
                  <Bell className="h-4 w-4" />
                  {actionLoading === 'trigger-notifications' ? 'Processing...' : 'Process Notifications'}
                </Button>

                <Button
                  variant="ghost"
                  onClick={fetchSchedulerStatus}
                  disabled={!!actionLoading}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh Status
                </Button>
              </div>

              {/* Scheduler Status */}
              {schedulerStatus && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Active Jobs</h4>
                    <Badge variant="outline">
                      {schedulerStatus.totalJobs} total
                    </Badge>
                  </div>

                  {schedulerStatus.jobs.length === 0 ? (
                    <p className="text-gray-600 text-sm">No active jobs</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {schedulerStatus.jobs.map((job) => (
                        <div
                          key={job.name}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                job.isRunning ? 'bg-green-500' : 'bg-gray-400'
                              }`}
                            />
                            <span className="font-medium text-sm">
                              {job.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          </div>
                          <Badge variant={job.isRunning ? 'default' : 'secondary'}>
                            {job.isRunning ? 'Running' : 'Stopped'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Recent Notifications</CardTitle>
              <CardDescription>
                Recent notifications sent by the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* This would show the NotificationHistory component for admin view */}
              <p className="text-gray-600">
                Recent notification history would be displayed here.
                This could include a table or list of recent notifications with delivery status.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="escalations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Escalation Alerts
              </CardTitle>
              <CardDescription>
                Critical notifications requiring immediate attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Escalation alerts and overdue evaluation notifications would be displayed here.
                This could include notifications that have reached escalation levels 3-5.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}