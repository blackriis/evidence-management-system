"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronDown, 
  ChevronRight, 
  Home, 
  Upload, 
  FileText, 
  ClipboardCheck, 
  Eye, 
  BarChart3, 
  Users, 
  Settings,
  Menu,
  X
} from "lucide-react";
import { UserRole } from "@/lib/user-role";

interface SidebarItem {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  allowedRoles?: UserRole[];
  children?: SidebarItem[];
}

interface SidebarProps {
  items: SidebarItem[];
  userRole?: UserRole;
  isCollapsed?: boolean;
  onToggle?: () => void;
  className?: string;
}

const sidebarItems: SidebarItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: Home,
    allowedRoles: [UserRole.TEACHER, UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR, UserRole.EXECUTIVE, UserRole.ADMIN],
  },
  {
    label: "Evidence",
    icon: FileText,
    allowedRoles: [UserRole.TEACHER, UserRole.ADMIN],
    children: [
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
    ],
  },
  {
    label: "Evaluation",
    icon: ClipboardCheck,
    allowedRoles: [UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR, UserRole.ADMIN],
    children: [
      {
        label: "Evaluation List",
        href: "/evaluation",
        icon: ClipboardCheck,
        allowedRoles: [UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR, UserRole.ADMIN],
      },
      {
        label: "Evaluation Management",
        href: "/evaluation/manage",
        icon: Eye,
        allowedRoles: [UserRole.ADMIN],
      },
    ],
  },
  {
    label: "Management",
    icon: Settings,
    allowedRoles: [UserRole.ADMIN],
    children: [
      {
        label: "Indicators",
        href: "/indicators",
        icon: BarChart3,
        allowedRoles: [UserRole.ADMIN],
      },
      {
        label: "User Management",
        href: "/admin/users",
        icon: Users,
        allowedRoles: [UserRole.ADMIN],
      },
    ],
  },
];

function SidebarItemComponent({ 
  item, 
  isCollapsed, 
  currentPath, 
  userRole,
  level = 0 
}: {
  item: SidebarItem;
  isCollapsed: boolean;
  currentPath: string;
  userRole?: UserRole;
  level?: number;
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const hasChildren = item.children && item.children.length > 0;
  const hasAccess = !item.allowedRoles || (userRole && item.allowedRoles.includes(userRole));
  
  if (!hasAccess) return null;

  const isActive = item.href === currentPath || (item.href && currentPath.startsWith(item.href + "/"));
  const hasActiveChild = item.children?.some(child => 
    child.href === currentPath || (child.href && currentPath.startsWith(child.href + "/"))
  );

  React.useEffect(() => {
    if (hasActiveChild) {
      setIsExpanded(true);
    }
  }, [hasActiveChild]);

  const Icon = item.icon;

  const itemContent = (
    <div className={cn(
      "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors relative",
      level > 0 && "ml-4",
      isActive || hasActiveChild 
        ? "bg-primary text-primary-foreground shadow-sm" 
        : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800",
      isCollapsed && "justify-center px-2"
    )}>
      <Icon className={cn("h-5 w-5 flex-shrink-0", isCollapsed && "h-6 w-6")} />
      
      {!isCollapsed && (
        <>
          <span className="flex-1 truncate text-sm font-medium">{item.label}</span>
          
          {item.badge && (
            <Badge variant="secondary" className="ml-auto">
              {item.badge}
            </Badge>
          )}
          
          {hasChildren && (
            <button
              onClick={(e) => {
                e.preventDefault();
                setIsExpanded(!isExpanded);
              }}
              className="p-1 hover:bg-white/20 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-1">
      {item.href ? (
        <Link href={item.href} className="block">
          {itemContent}
        </Link>
      ) : (
        <button
          onClick={() => hasChildren && setIsExpanded(!isExpanded)}
          className="w-full text-left"
        >
          {itemContent}
        </button>
      )}
      
      {!isCollapsed && hasChildren && isExpanded && (
        <div className="space-y-1">
          {item.children?.map((child, index) => (
            <SidebarItemComponent
              key={index}
              item={child}
              isCollapsed={isCollapsed}
              currentPath={currentPath}
              userRole={userRole}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ 
  items = sidebarItems, 
  userRole, 
  isCollapsed = false, 
  onToggle, 
  className 
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className={cn(
      "flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300",
      isCollapsed ? "w-16" : "w-64",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        {!isCollapsed && (
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">EMS</span>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">
              Evidence Management
            </span>
          </Link>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="p-2"
        >
          {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {items.map((item, index) => (
          <SidebarItemComponent
            key={index}
            item={item}
            isCollapsed={isCollapsed}
            currentPath={pathname}
            userRole={userRole}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        {!isCollapsed && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p>Evidence Management System</p>
            <p>Version 1.0.0</p>
          </div>
        )}
      </div>
    </div>
  );
}