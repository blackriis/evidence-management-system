"use client";

import { StatsCard } from "@/components/dashboard/stats-card";
import { 
  FileText, 
  ClipboardCheck, 
  Users, 
  TrendingUp, 
  Upload,
  Eye,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { UserRole } from "@/lib/user-role";

interface DashboardData {
  summary: {
    totalEvidence: number;
    totalEvaluations: number;
    pendingEvaluations: number;
    completionRate: number;
    recentCompletionRate: number;
    activeUsers: number;
    recentUploads: number;
    recentEvaluations: number;
  };
}

interface EnhancedDashboardMetricsProps {
  data: DashboardData;
  loading?: boolean;
  userRole?: UserRole;
}

export function EnhancedDashboardMetrics({ data, loading, userRole }: EnhancedDashboardMetricsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-lg h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  const stats = [
    {
      title: "Total Evidence",
      value: data.summary.totalEvidence.toLocaleString(),
      icon: FileText,
      description: "Files uploaded",
      trend: {
        value: data.summary.recentUploads > 0 ? 12 : 0,
        label: "vs last period",
        isPositive: data.summary.recentUploads > 0
      },
      iconColor: "text-blue-600",
      gradient: "from-blue-500 to-blue-600"
    },
    {
      title: "Evaluations",
      value: data.summary.totalEvaluations.toLocaleString(),
      icon: ClipboardCheck,
      description: "Completed evaluations",
      trend: {
        value: data.summary.recentEvaluations > 0 ? 8 : 0,
        label: "vs last period",
        isPositive: data.summary.recentEvaluations > 0
      },
      iconColor: "text-green-600",
      gradient: "from-green-500 to-green-600"
    },
    {
      title: "Pending Reviews",
      value: data.summary.pendingEvaluations.toLocaleString(),
      icon: AlertTriangle,
      description: "Awaiting evaluation",
      trend: {
        value: data.summary.pendingEvaluations > 10 ? -5 : 5,
        label: "vs last period",
        isPositive: data.summary.pendingEvaluations <= 10
      },
      iconColor: "text-orange-600",
      gradient: "from-orange-500 to-orange-600"
    },
    {
      title: "Completion Rate",
      value: `${data.summary.completionRate.toFixed(1)}%`,
      icon: CheckCircle,
      description: "Overall progress",
      trend: {
        value: data.summary.recentCompletionRate - data.summary.completionRate,
        label: "vs last period",
        isPositive: data.summary.recentCompletionRate >= data.summary.completionRate
      },
      iconColor: "text-purple-600",
      gradient: "from-purple-500 to-purple-600"
    }
  ];

  // Filter stats based on user role
  const visibleStats = stats.filter(stat => {
    if (userRole === UserRole.TEACHER) {
      return stat.title === "Total Evidence" || stat.title === "Pending Reviews";
    }
    if (userRole === UserRole.IQA_EVALUATOR || userRole === UserRole.EQA_EVALUATOR) {
      return stat.title === "Evaluations" || stat.title === "Pending Reviews" || stat.title === "Completion Rate";
    }
    if (userRole === UserRole.EXECUTIVE) {
      return stat.title === "Completion Rate" || stat.title === "Total Evidence" || stat.title === "Evaluations";
    }
    return true; // ADMIN sees all
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {visibleStats.map((stat, index) => (
        <StatsCard
          key={index}
          title={stat.title}
          value={stat.value}
          icon={stat.icon}
          description={stat.description}
          trend={stat.trend}
          iconColor={stat.iconColor}
          gradient={stat.gradient}
        />
      ))}
    </div>
  );
}