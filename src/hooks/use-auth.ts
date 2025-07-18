"use client";

import { useSession } from "next-auth/react";
import { UserRole } from "@prisma/client";

export function useAuth() {
  const { data: session, status, update } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated" && !!session?.user;
  const user = session?.user;

  const hasRole = (role: UserRole): boolean => {
    return user?.role === role;
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return user ? roles.includes(user.role) : false;
  };

  const isAdmin = (): boolean => {
    return hasRole(UserRole.ADMIN);
  };

  const isTeacher = (): boolean => {
    return hasRole(UserRole.TEACHER);
  };

  const isIQAEvaluator = (): boolean => {
    return hasRole(UserRole.IQA_EVALUATOR);
  };

  const isEQAEvaluator = (): boolean => {
    return hasRole(UserRole.EQA_EVALUATOR);
  };

  const isExecutive = (): boolean => {
    return hasRole(UserRole.EXECUTIVE);
  };

  const canAccessRoute = (allowedRoles: UserRole[]): boolean => {
    if (!isAuthenticated || !user) return false;
    return allowedRoles.includes(user.role);
  };

  const refreshSession = async () => {
    await update();
  };

  return {
    user,
    session,
    isLoading,
    isAuthenticated,
    hasRole,
    hasAnyRole,
    isAdmin,
    isTeacher,
    isIQAEvaluator,
    isEQAEvaluator,
    isExecutive,
    canAccessRoute,
    refreshSession,
  };
}