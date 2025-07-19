'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bell, 
  Mail, 
  MessageCircle, 
  Clock, 
  AlertCircle, 
  CheckCircle,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Filter,
  ClipboardCheck,
  UserCheck
} from 'lucide-react';
import { Notification } from '@/types/notification';

interface NotificationHistoryProps {
  userId?: string; // If provided, shows history for specific user (admin view)
  limit?: number;
}

export function NotificationHistory({ userId, limit = 20 }: NotificationHistoryProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
        unreadOnly: showUnreadOnly.toString(),
      });

      if (userId) {
        params.append('userId', userId);
      }

      const response = await fetch(`/api/notifications?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setNotifications(data.notifications || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'markAsRead' }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, isRead: true }
            : notification
        )
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      alert('Failed to mark notification as read. Please try again.');
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [page, showUnreadOnly, userId, limit]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'UPLOAD_DEADLINE_REMINDER':
      case 'UPLOAD_WINDOW_OPENING':
      case 'UPLOAD_WINDOW_CLOSING':
        return <Bell className="h-4 w-4" />;
      case 'EVALUATION_DEADLINE_REMINDER':
      case 'EVALUATION_WINDOW_OPENING':
      case 'EVALUATION_WINDOW_CLOSING':
      case 'EVALUATION_OVERDUE':
        return <ClipboardCheck className="h-4 w-4" />;
      case 'ASSIGNMENT_NOTIFICATION':
        return <UserCheck className="h-4 w-4" />;
      case 'SYSTEM_ALERT':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationVariant = (type: string, isRead: boolean) => {
    if (isRead) return 'outline';
    
    switch (type) {
      case 'EVALUATION_OVERDUE':
      case 'SYSTEM_ALERT':
        return 'destructive';
      case 'UPLOAD_DEADLINE_REMINDER':
      case 'EVALUATION_DEADLINE_REMINDER':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const formatNotificationType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const hasNextPage = (page + 1) * limit < total;
  const hasPrevPage = page > 0;

  if (loading && notifications.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading notifications...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load notifications: {error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Notification History</h3>
          <p className="text-sm text-gray-600">
            {total} total notification{total !== 1 ? 's' : ''}
            {showUnreadOnly && ' (unread only)'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={showUnreadOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setShowUnreadOnly(!showUnreadOnly);
              setPage(0); // Reset to first page
            }}
          >
            <Filter className="h-4 w-4 mr-2" />
            {showUnreadOnly ? 'Show All' : 'Unread Only'}
          </Button>
        </div>
      </div>

      {/* Notifications list */}
      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {showUnreadOnly ? 'No unread notifications' : 'No notifications found'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <Card 
              key={notification.id} 
              className={`transition-all ${!notification.isRead ? 'bg-blue-50 border-blue-200' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-medium text-gray-900 text-sm">
                        {notification.title}
                      </h4>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant={getNotificationVariant(notification.type, notification.isRead)}>
                          {formatNotificationType(notification.type)}
                        </Badge>
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsRead(notification.id)}
                            className="h-6 w-6 p-0"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {notification.message}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{formatTimestamp(notification.createdAt.toString())}</span>
                      <div className="flex items-center gap-3">
                        {notification.sentAt && (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Delivered
                          </span>
                        )}
                        {notification.scheduledFor && !notification.sentAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Scheduled
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata for escalation or detailed info */}
                    {notification.metadata && typeof notification.metadata === 'object' && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                        {(notification.metadata as any).escalationLevel && (
                          <span className="text-orange-600 font-medium">
                            Escalation Level: {(notification.metadata as any).escalationLevel}
                          </span>
                        )}
                        {(notification.metadata as any).daysSinceClosure && (
                          <span className="ml-2 text-gray-600">
                            ({(notification.metadata as any).daysSinceClosure} days overdue)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of {total}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPrevPage}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            
            <span className="text-sm text-gray-600">
              Page {page + 1} of {Math.ceil(total / limit)}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNextPage}
              onClick={() => setPage(page + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}