'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import { Badge } from '@/components/ui/badge';
import { NotificationHistory } from '@/components/notifications/notification-history';
import { User, Bell, Mail, MessageCircle, Clock, AlertCircle, CheckCircle } from 'lucide-react';
// import { useToast } from '@/hooks/use-toast';

export function UserProfile() {
  const { profile, loading, error, updatePreferences } = useUserPreferences();
  // const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [preferences, setPreferences] = useState({
    emailNotifications: false,
    lineNotifications: false,
    deadlineReminderDays: 7,
  });

  // Update local state when profile loads
  React.useEffect(() => {
    if (profile) {
      setPreferences({
        emailNotifications: profile.emailNotifications,
        lineNotifications: profile.lineNotifications,
        deadlineReminderDays: profile.deadlineReminderDays,
      });
    }
  }, [profile]);

  const handleSavePreferences = async () => {
    try {
      setIsUpdating(true);
      await updatePreferences(preferences);
      
      alert("Your notification preferences have been updated.");
    } catch (error) {
      alert("Failed to update notification preferences. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'TEACHER':
        return 'Teacher';
      case 'IQA_EVALUATOR':
        return 'IQA Evaluator';
      case 'EQA_EVALUATOR':
        return 'EQA Evaluator';
      case 'EXECUTIVE':
        return 'Executive';
      case 'ADMIN':
        return 'Administrator';
      default:
        return role;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'destructive';
      case 'EXECUTIVE':
        return 'default';
      case 'IQA_EVALUATOR':
      case 'EQA_EVALUATOR':
        return 'secondary';
      case 'TEACHER':
        return 'outline';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load user profile: {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!profile) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No profile data available.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Your account details and role information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-600">Name</Label>
              <p className="text-lg font-semibold">{profile.name}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-600">Email</Label>
              <p className="text-lg">{profile.email}</p>
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600">Role</Label>
            <div className="mt-1">
              <Badge variant={getRoleBadgeVariant(profile.role)}>
                {getRoleDisplayName(profile.role)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Configure how you receive notifications about deadlines and system events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <Label htmlFor="email-notifications" className="text-base font-medium">
                  Email Notifications
                </Label>
              </div>
              <p className="text-sm text-gray-600">
                Receive notifications via email
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={preferences.emailNotifications}
              onCheckedChange={(checked) =>
                setPreferences(prev => ({ ...prev, emailNotifications: checked }))
              }
            />
          </div>

          <Separator />

          {/* Line Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                <Label htmlFor="line-notifications" className="text-base font-medium">
                  Line Notifications
                </Label>
              </div>
              <p className="text-sm text-gray-600">
                Receive notifications via Line Notify
              </p>
            </div>
            <Switch
              id="line-notifications"
              checked={preferences.lineNotifications}
              onCheckedChange={(checked) =>
                setPreferences(prev => ({ ...prev, lineNotifications: checked }))
              }
            />
          </div>

          <Separator />

          {/* Deadline Reminder Days */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <Label htmlFor="reminder-days" className="text-base font-medium">
                Deadline Reminder
              </Label>
            </div>
            <p className="text-sm text-gray-600">
              How many days before a deadline should you receive reminder notifications?
            </p>
            <div className="flex items-center gap-3">
              <Input
                id="reminder-days"
                type="number"
                min="1"
                max="30"
                value={preferences.deadlineReminderDays}
                onChange={(e) =>
                  setPreferences(prev => ({ 
                    ...prev, 
                    deadlineReminderDays: parseInt(e.target.value) || 7 
                  }))
                }
                className="w-24"
              />
              <span className="text-sm text-gray-600">days before deadline</span>
            </div>
          </div>

          <Separator />

          {/* Notification Types Info */}
          <div className="space-y-3">
            <Label className="text-base font-medium">You will receive notifications for:</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                Upload deadline reminders
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                Evaluation deadline reminders
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                Window opening/closing alerts
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                Assignment notifications
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                Overdue evaluation alerts
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3" />
                System announcements
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4">
            <Button 
              onClick={handleSavePreferences}
              disabled={isUpdating}
              className="w-full md:w-auto"
            >
              {isUpdating ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Notification History
          </CardTitle>
          <CardDescription>
            View your recent notifications and delivery status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationHistory limit={10} />
        </CardContent>
      </Card>
    </div>
  );
}