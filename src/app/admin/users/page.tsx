"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { RoleGuard } from "@/components/auth/role-guard";
import { UserManagement } from "@/components/admin/user-management";
import { UserImport } from "@/components/admin/user-import";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Users, 
  UserPlus, 
  Upload,
  AlertCircle,
  CheckCircle,
  BarChart3,
  Shield,
  UserCheck
} from "lucide-react";
import { UserRole } from "@prisma/client";

interface UserStats {
  total: number;
  active: number;
  inactive: number;
  byRole: Record<UserRole, number>;
  recentlyCreated: number;
}

export default function UsersPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("manage");
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: "" });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/users/stats');
      const data = await response.json();
      
      if (response.ok) {
        setStats(data);
      } else {
        setStatus({
          type: 'error',
          message: data.error || 'Failed to load user statistics'
        });
      }
    } catch (error) {
      console.error('Failed to load user stats:', error);
      setStatus({
        type: 'error',
        message: 'Failed to load user statistics'
      });
    } finally {
      setLoading(false);
    }
  };

  const clearStatus = () => {
    setStatus({ type: null, message: "" });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2">Loading user management...</span>
        </div>
      </div>
    );
  }

  return (
    <RoleGuard allowedRoles={[UserRole.ADMIN]}>
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">User Management</h1>
          <p className="text-gray-600">
            Manage system users, roles, and permissions
          </p>
        </div>

        {/* Status Messages */}
        {status.type && (
          <Alert className={`mb-6 ${status.type === 'error' ? 'border-red-200' : 'border-green-200'}`}>
            {status.type === 'error' ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            <AlertDescription>{status.message}</AlertDescription>
            <button
              onClick={clearStatus}
              className="ml-auto text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </Alert>
        )}

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="flex items-center p-6">
                <Users className="h-8 w-8 text-blue-500 mr-4" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-gray-600">Total Users</p>
                  <p className="text-xs text-gray-500">
                    {stats.active} active, {stats.inactive} inactive
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="flex items-center p-6">
                <Shield className="h-8 w-8 text-green-500 mr-4" />
                <div>
                  <p className="text-2xl font-bold">{stats.byRole.ADMIN + stats.byRole.EXECUTIVE}</p>
                  <p className="text-sm text-gray-600">Administrators</p>
                  <p className="text-xs text-gray-500">
                    Admin: {stats.byRole.ADMIN} | Exec: {stats.byRole.EXECUTIVE}
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="flex items-center p-6">
                <UserCheck className="h-8 w-8 text-purple-500 mr-4" />
                <div>
                  <p className="text-2xl font-bold">{stats.byRole.IQA_EVALUATOR + stats.byRole.EQA_EVALUATOR}</p>
                  <p className="text-sm text-gray-600">Evaluators</p>
                  <p className="text-xs text-gray-500">
                    IQA: {stats.byRole.IQA_EVALUATOR} | EQA: {stats.byRole.EQA_EVALUATOR}
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="flex items-center p-6">
                <BarChart3 className="h-8 w-8 text-orange-500 mr-4" />
                <div>
                  <p className="text-2xl font-bold">{stats.byRole.TEACHER}</p>
                  <p className="text-sm text-gray-600">Teachers</p>
                  <p className="text-xs text-gray-500">
                    {stats.recentlyCreated} added recently
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manage" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Manage Users
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Import Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manage" className="mt-6">
            <UserManagement onStatusChange={setStatus} />
          </TabsContent>

          <TabsContent value="import" className="mt-6">
            <UserImport 
              onStatusChange={setStatus} 
              onImportComplete={loadStats}
            />
          </TabsContent>
        </Tabs>
      </div>
    </RoleGuard>
  );
}