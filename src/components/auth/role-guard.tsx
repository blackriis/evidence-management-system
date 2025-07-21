"use client";

import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@/lib/user-role";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield } from "lucide-react";

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUnauthorized?: boolean;
}

export function RoleGuard({ 
  allowedRoles, 
  children, 
  fallback,
  showUnauthorized = true 
}: RoleGuardProps) {
  const { isLoading, isAuthenticated, canAccessRoute } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return fallback || (
      showUnauthorized && (
        <Alert variant="destructive" className="m-4">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You must be signed in to access this content.
          </AlertDescription>
        </Alert>
      )
    );
  }

  if (!canAccessRoute(allowedRoles)) {
    return fallback || (
      showUnauthorized && (
        <Alert variant="destructive" className="m-4">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access this content.
          </AlertDescription>
        </Alert>
      )
    );
  }

  return <>{children}</>;
}