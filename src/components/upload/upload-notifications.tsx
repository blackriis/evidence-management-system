'use client';

import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface UploadNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  duration?: number; // milliseconds, 0 for persistent
}

interface UploadNotificationsProps {
  notifications: UploadNotification[];
  onDismiss: (id: string) => void;
  enableSound?: boolean;
}

export function UploadNotifications({ 
  notifications, 
  onDismiss, 
  enableSound = true 
}: UploadNotificationsProps) {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  useEffect(() => {
    // Initialize audio context for sound notifications
    if (enableSound && typeof window !== 'undefined') {
      try {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        setAudioContext(context);
      } catch (error) {
        console.warn('Audio context not supported:', error);
      }
    }
  }, [enableSound]);

  const playNotificationSound = async (type: UploadNotification['type']) => {
    if (!audioContext || !enableSound) return;

    try {
      // Resume audio context if it's suspended
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      // Create oscillator for different tones based on notification type
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Set frequency based on notification type
      switch (type) {
        case 'success':
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.1);
          break;
        case 'error':
          oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.2);
          break;
        case 'info':
          oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
          break;
      }

      // Set volume and duration
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.type = 'sine';
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('Failed to play notification sound:', error);
    }
  };

  useEffect(() => {
    // Play sound for new notifications
    notifications.forEach(notification => {
      playNotificationSound(notification.type);
    });
  }, [notifications.length]);

  useEffect(() => {
    // Auto-dismiss notifications with duration
    notifications.forEach(notification => {
      if (notification.duration && notification.duration > 0) {
        const timer = setTimeout(() => {
          onDismiss(notification.id);
        }, notification.duration);

        return () => clearTimeout(timer);
      }
    });
  }, [notifications, onDismiss]);

  const getIcon = (type: UploadNotification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      case 'info':
        return <Info className="h-4 w-4" />;
    }
  };

  const getVariant = (type: UploadNotification['type']) => {
    switch (type) {
      case 'error':
        return 'destructive' as const;
      default:
        return 'default' as const;
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <Alert
          key={notification.id}
          variant={getVariant(notification.type)}
          className={`shadow-lg border-l-4 animate-in slide-in-from-right duration-300 ${
            notification.type === 'success' ? 'border-l-green-500 bg-green-50' :
            notification.type === 'error' ? 'border-l-red-500' :
            'border-l-blue-500 bg-blue-50'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2">
              {getIcon(notification.type)}
              <div className="flex-1">
                <h4 className="font-medium text-sm">{notification.title}</h4>
                {notification.message && (
                  <AlertDescription className="mt-1 text-xs">
                    {notification.message}
                  </AlertDescription>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-transparent"
              onClick={() => onDismiss(notification.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </Alert>
      ))}
    </div>
  );
}

// Hook for managing upload notifications
export function useUploadNotifications() {
  const [notifications, setNotifications] = useState<UploadNotification[]>([]);

  const addNotification = (notification: Omit<UploadNotification, 'id'>) => {
    const id = `notification-${Date.now()}-${Math.random()}`;
    const newNotification: UploadNotification = {
      ...notification,
      id,
      duration: notification.duration ?? 5000, // Default 5 seconds
    };

    setNotifications(prev => [...prev, newNotification]);
    return id;
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  // Convenience methods
  const notifySuccess = (title: string, message?: string, duration?: number) => {
    return addNotification({ type: 'success', title, message: message || '', duration });
  };

  const notifyError = (title: string, message?: string, duration?: number) => {
    return addNotification({ type: 'error', title, message: message || '', duration: duration || 0 });
  };

  const notifyInfo = (title: string, message?: string, duration?: number) => {
    return addNotification({ type: 'info', title, message: message || '', duration });
  };

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    notifySuccess,
    notifyError,
    notifyInfo,
  };
}