"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { UserRole } from "@prisma/client";
import {
  FileText,
  BarChart3,
  Users,
  Settings,
  Upload,
  ClipboardCheck,
  Eye,
  LogOut,
  Menu,
  X,
  Home,
} from "lucide-react";

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: UserRole[];
}

const navigationItems: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: Home,
    allowedRoles: [UserRole.TEACHER, UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR, UserRole.EXECUTIVE, UserRole.ADMIN],
  },
  {
    label: "Upload Evidence",
    href: "/evidence/upload",
    icon: Upload,
    allowedRoles: [UserRole.TEACHER, UserRole.ADMIN],
  },
  {
    label: "Manage Evidence",
    href: "/evidence/manage",
    icon: FileText,
    allowedRoles: [UserRole.TEACHER, UserRole.ADMIN],
  },
  {
    label: "IQA Evaluation",
    href: "/evaluation/iqa",
    icon: ClipboardCheck,
    allowedRoles: [UserRole.IQA_EVALUATOR, UserRole.ADMIN],
  },
  {
    label: "EQA Review",
    href: "/evaluation/eqa",
    icon: Eye,
    allowedRoles: [UserRole.EQA_EVALUATOR, UserRole.ADMIN],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
    allowedRoles: [UserRole.EXECUTIVE, UserRole.ADMIN],
  },
  {
    label: "User Management",
    href: "/users",
    icon: Users,
    allowedRoles: [UserRole.ADMIN],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    allowedRoles: [UserRole.ADMIN],
  },
];

export function Navigation() {
  const { user, isAuthenticated, canAccessRoute } = useAuth();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!isAuthenticated || !user) {
    return null;
  }

  const visibleItems = navigationItems.filter(item => 
    canAccessRoute(item.allowedRoles)
  );

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/dashboard" className="text-xl font-bold text-primary">
                EMS
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:ml-6 md:flex md:space-x-8">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "border-primary text-primary"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-300 dark:hover:text-gray-100"
                    }`}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* User Menu */}
          <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">{user.name}</span>
              <span className="ml-2 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                {user.role.replace("_", " ")}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMobileMenu}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-300"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div className="md:hidden">
          <div className="pt-2 pb-3 space-y-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 border-primary text-primary"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <div className="flex items-center">
                    <Icon className="mr-3 h-5 w-5" />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </div>
          
          <div className="pt-4 pb-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center px-4">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="ml-3">
                <div className="text-base font-medium text-gray-800 dark:text-gray-200">
                  {user.name}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {user.email}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {user.role.replace("_", " ")}
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="w-full justify-start text-gray-500 hover:text-gray-700 dark:text-gray-300"
              >
                <LogOut className="mr-3 h-5 w-5" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}