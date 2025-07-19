"use client";

import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  className?: string;
  iconColor?: string;
  gradient?: string;
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  className,
  iconColor = "text-blue-600",
  gradient = "from-blue-500 to-blue-600"
}: StatsCardProps) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {title}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {value}
            </p>
            {description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {description}
              </p>
            )}
            {trend && (
              <div className="flex items-center mt-2">
                <span
                  className={cn(
                    "text-xs font-medium",
                    trend.isPositive
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  )}
                >
                  {trend.isPositive ? "+" : ""}{trend.value}%
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                  {trend.label}
                </span>
              </div>
            )}
          </div>
          <div className="flex-shrink-0">
            <div className={cn(
              "w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center",
              gradient
            )}>
              <Icon className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </CardContent>
      
      {/* Decorative gradient overlay */}
      <div className="absolute top-0 right-0 w-24 h-24 opacity-10">
        <div className={cn(
          "w-full h-full rounded-full bg-gradient-to-br transform translate-x-8 -translate-y-8",
          gradient
        )} />
      </div>
    </Card>
  );
}