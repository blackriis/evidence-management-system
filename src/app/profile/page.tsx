import { Metadata } from 'next';
import { UserProfile } from '@/components/profile/user-profile';

export const metadata: Metadata = {
  title: 'Profile | Evidence Management System',
  description: 'Manage your profile and notification preferences',
};

export default function ProfilePage() {
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
          <p className="text-gray-600 mt-2">
            Manage your account information and notification preferences.
          </p>
        </div>
        
        <UserProfile />
      </div>
    </div>
  );
}