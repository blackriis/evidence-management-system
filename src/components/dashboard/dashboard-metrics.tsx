"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  Users, 
  TrendingUp, 
  TrendingDown,
  Activity,
  BarChart3,
  AlertTriangle
} from "lucide-react";
import { UserRole } from "@prisma/client";

interface DashboardMetricsProps {
  data: {
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
    evidence: any;
    evaluations: any;
    users: any;
  };
  loading: boolean;
  userRole?: UserRole;
}

export function DashboardMetrics({ data, loading, userRole }: DashboardMetricsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-3 bg-gray-200 rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const { summary } = data;
  
  // Calculate trends (mock data for now - in real implementation, compare with previous period)
  const evidenceTrend = 12; // +12%
  const evaluationTrend = -5; // -5%
  const userTrend = 8; // +8%
  const completionTrend = summary.recentCompletionRate - summary.completionRate;

  const metrics = [
    {
      title: "Total Evidence",
      value: summary.totalEvidence.toLocaleString(),
      change: evidenceTrend,
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      description: `${summary.recentUploads} uploaded recently`
    },
    {
      title: "Total Evaluations",
      value: summary.totalEvaluations.toLocaleString(),
      change: evaluationTrend,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100",
      description: `${summary.recentEvaluations} completed recently`
    },
    {
      title: "Pending Evaluations",
      value: summary.pendingEvaluations.toLocaleString(),
      change: null,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
      description: "Awaiting evaluation"
    },
    {
      title: "Active Users",
      value: summary.activeUsers.toLocaleString(),
      change: userTrend,
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      description: "In current period"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <Card key={index} className="relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-3 rounded-lg ${metric.bgColor}`}>
                      <Icon className={`h-6 w-6 ${metric.color}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                      <p className="text-2xl font-bold">{metric.value}</p>
                    </div>
                  </div>
                  {metric.change !== null && (
                    <div className="flex items-center space-x-1">
                      {metric.change > 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      <span className={`text-sm font-medium ${
                        metric.change > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {metric.change > 0 ? '+' : ''}{metric.change}%
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">{metric.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Completion Rate Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Completion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Completion</span>
                  <span className="text-sm font-medium">{summary.completionRate}%</span>
                </div>
                <Progress value={summary.completionRate} className="h-2" />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Recent Period</span>
                  <span className="text-sm font-medium">{summary.recentCompletionRate}%</span>
                </div>
                <Progress value={summary.recentCompletionRate} className="h-2" />
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                {completionTrend > 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className={completionTrend > 0 ? 'text-green-600' : 'text-red-600'}>
                  {completionTrend > 0 ? '+' : ''}{completionTrend.toFixed(1)}% vs overall
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Activity Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              User Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.users.byRole.map((roleData: any) => (
                <div key={roleData.role} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {roleData.role.replace('_', ' ')}
                    </Badge>
                  </div>
                  <span className="text-sm font-medium">{roleData.count}</span>
                </div>
              ))}
              
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Active</span>
                  <span className="text-sm font-medium">{summary.activeUsers}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role-specific Insights */}
      {userRole && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {userRole.replace('_', ' ')} Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {userRole === UserRole.TEACHER && (
                <>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {data.evidence.byUploader.find((u: any) => u.uploader?.role === UserRole.TEACHER)?._count?.id || 0}
                    </div>
                    <div className="text-sm text-blue-600">Your Evidence</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {Math.round(summary.completionRate)}%
                    </div>
                    <div className="text-sm text-green-600">Evaluation Rate</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {summary.pendingEvaluations}
                    </div>
                    <div className="text-sm text-orange-600">Pending Reviews</div>
                  </div>
                </>
              )}
              
              {(userRole === UserRole.IQA_EVALUATOR || userRole === UserRole.EQA_EVALUATOR) && (
                <>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {data.evaluations.byEvaluator.find((e: any) => e.evaluator?.role === userRole)?._count?.id || 0}
                    </div>
                    <div className="text-sm text-purple-600">Your Evaluations</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {summary.pendingEvaluations}
                    </div>
                    <div className="text-sm text-blue-600">Pending Reviews</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {summary.recentEvaluations}
                    </div>
                    <div className="text-sm text-green-600">Recent Activity</div>
                  </div>
                </>
              )}
              
              {(userRole === UserRole.ADMIN || userRole === UserRole.EXECUTIVE) && (
                <>
                  <div className="text-center p-4 bg-indigo-50 rounded-lg">
                    <div className="text-2xl font-bold text-indigo-600">
                      {summary.totalEvidence}
                    </div>
                    <div className="text-sm text-indigo-600">Total Evidence</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {Math.round(summary.completionRate)}%
                    </div>
                    <div className="text-sm text-green-600">System Completion</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {summary.activeUsers}
                    </div>
                    <div className="text-sm text-purple-600">Active Users</div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}