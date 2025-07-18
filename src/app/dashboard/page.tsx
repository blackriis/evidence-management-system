"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { RoleGuard } from "@/components/auth/role-guard";
import { DashboardMetrics } from "@/components/dashboard/dashboard-metrics";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { RiskMonitoring } from "@/components/dashboard/risk-monitoring";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  BarChart3,
  Activity,
  AlertTriangle,
  RefreshCw,
  Calendar,
  TrendingUp,
  Users,
  FileText,
  CheckCircle,
  Clock,
  Filter,
  Download
} from "lucide-react";
import { UserRole } from "@prisma/client";

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
  evidence: any;
  evaluations: any;
  users: any;
  risks: any;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [risks, setRisks] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
  const [timeRange, setTimeRange] = useState("30");
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const [status, setStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: "" });

  useEffect(() => {
    loadAcademicYears();
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [selectedAcademicYear, timeRange]);

  const loadAcademicYears = async () => {
    try {
      const response = await fetch('/api/academic-years');
      const data = await response.json();
      
      if (response.ok) {
        setAcademicYears(data);
      }
    } catch (error) {
      console.error('Failed to load academic years:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (selectedAcademicYear) params.append('academicYearId', selectedAcademicYear);
      if (timeRange) params.append('timeRange', timeRange);

      const [metricsResponse, risksResponse] = await Promise.all([
        fetch(`/api/dashboard/metrics?${params}`),
        fetch(`/api/dashboard/risks?${params}`)
      ]);

      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setData(metricsData);
      } else {
        const error = await metricsResponse.json();
        setStatus({
          type: 'error',
          message: error.error || 'Failed to load dashboard metrics'
        });
      }

      if (risksResponse.ok) {
        const risksData = await risksResponse.json();
        setRisks(risksData);
      } else {
        const error = await risksResponse.json();
        setStatus({
          type: 'error',
          message: error.error || 'Failed to load risk data'
        });
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setStatus({
        type: 'error',
        message: 'Failed to load dashboard data'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleExportData = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedAcademicYear) params.append('academicYearId', selectedAcademicYear);
      if (timeRange) params.append('timeRange', timeRange);

      const response = await fetch(`/api/dashboard/export?${params}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard-report-${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        setStatus({
          type: 'error',
          message: 'Failed to export dashboard data'
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      setStatus({
        type: 'error',
        message: 'Failed to export dashboard data'
      });
    }
  };

  const clearStatus = () => {
    setStatus({ type: null, message: "" });
  };

  const canViewDashboard = user && [
    UserRole.ADMIN, 
    UserRole.EXECUTIVE, 
    UserRole.IQA_EVALUATOR, 
    UserRole.EQA_EVALUATOR
  ].includes(user.role);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="h-8 w-8 animate-spin mr-2" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (!canViewDashboard) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-8">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You don't have permission to access the dashboard.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.EXECUTIVE, UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR]}>
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
              <p className="text-gray-600">
                Overview of evidence management and evaluation progress
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportData}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {status.type && (
          <Alert className={`mb-6 ${status.type === 'error' ? 'border-red-200' : 'border-green-200'}`}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{status.message}</AlertDescription>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearStatus}
              className="ml-auto"
            >
              ×
            </Button>
          </Alert>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">Academic Year</label>
            <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
              <SelectTrigger>
                <SelectValue placeholder="All academic years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All academic years</SelectItem>
                {academicYears.map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Time Range</label>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 3 months</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-end">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Filter className="h-4 w-4" />
              <span>Role: {user?.role.replace('_', ' ')}</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Key Metrics */}
          {data && (
            <DashboardMetrics 
              data={data} 
              loading={loading}
              userRole={user?.role}
            />
          )}

          {/* Charts and Visualizations */}
          {data && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DashboardCharts 
                data={data} 
                loading={loading}
                timeRange={timeRange}
              />
              
              <div className="space-y-6">
                {/* Risk Monitoring */}
                {risks && (
                  <RiskMonitoring 
                    risks={risks} 
                    loading={loading}
                    userRole={user?.role}
                  />
                )}
                
                {/* Recent Activity */}
                <RecentActivity 
                  academicYearId={selectedAcademicYear}
                  userRole={user?.role}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}