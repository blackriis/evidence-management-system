'use client';

import { useState, useEffect } from 'react';
import { NotificationPreferences } from '@/types/notification';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  emailNotifications: boolean;
  lineNotifications: boolean;
  deadlineReminderDays: number;
}

export function useUserPreferences() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/users/preferences');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
      console.error('Failed to fetch user profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (preferences: Partial<NotificationPreferences>) => {
    try {
      setError(null);

      const response = await fetch('/api/users/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const updatedProfile = await response.json();
      setProfile(updatedProfile);
      return updatedProfile;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update preferences';
      setError(errorMessage);
      console.error('Failed to update preferences:', err);
      throw new Error(errorMessage);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return {
    profile,
    loading,
    error,
    updatePreferences,
    refetch: fetchProfile,
  };
}