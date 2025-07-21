"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  FileText, 
  CheckCircle, 
  Upload, 
  User,
  Clock,
  Eye,
  Loader2,
  RefreshCw
} from "lucide-react";
import { UserRole } from "@/lib/user-role";

interface ActivityItem {
  id: string;
  type: 'evidence_upload' | 'evaluation_submitted' | 'user_created' | 'system_action';
  title: string;
  description: string;
  timestamp: string;
  user: {
    id: string;
    name: string;
    role: UserRole;
  };
  metadata?: any;
}

interface RecentActivityProps {
  academicYearId?: string;
  userRole?: UserRole;
}

export function RecentActivity({ academicYearId, userRole }: RecentActivityProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadActivities();
  }, [academicYearId, userRole]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (academicYearId) params.append('academicYearId', academicYearId);
      params.append('limit', '20');

      const response = await fetch(`/api/dashboard/activities?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      } else {
        console.error('Failed to load activities');
      }
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadActivities();
    setRefreshing(false);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'evidence_upload': return Upload;
      case 'evaluation_submitted': return CheckCircle;
      case 'user_created': return User;
      case 'system_action': return Activity;
      default: return FileText;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'evidence_upload': return 'text-blue-600';
      case 'evaluation_submitted': return 'text-green-600';
      case 'user_created': return 'text-purple-600';
      case 'system_action': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN: return 'bg-red-100 text-red-800';
      case UserRole.EXECUTIVE: return 'bg-blue-100 text-blue-800';
      case UserRole.IQA_EVALUATOR: return 'bg-green-100 text-green-800';
      case UserRole.EQA_EVALUATOR: return 'bg-purple-100 text-purple-800';
      case UserRole.TEACHER: return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return past.toLocaleDateString();
  };

  // Mock data when API is not available
  const mockActivities: ActivityItem[] = [
    {
      id: '1',
      type: 'evidence_upload',
      title: 'New Evidence Uploaded',
      description: 'Teaching Portfolio.pdf uploaded for sub-indicator EL1.1.1',
      timestamp: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
      user: {
        id: '1',
        name: 'John Doe',
        role: UserRole.TEACHER
      }
    },
    {
      id: '2',
      type: 'evaluation_submitted',
      title: 'Evaluation Completed',
      description: 'IQA evaluation completed for evidence ID: EV123',
      timestamp: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
      user: {
        id: '2',
        name: 'Jane Smith',
        role: UserRole.IQA_EVALUATOR
      }
    },
    {
      id: '3',
      type: 'user_created',
      title: 'New User Added',
      description: 'New teacher account created for Bob Johnson',
      timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      user: {
        id: '3',
        name: 'Admin User',
        role: UserRole.ADMIN
      }
    },
    {
      id: '4',
      type: 'evaluation_submitted',
      title: 'EQA Review Completed',
      description: 'External evaluation completed for evidence batch #45',
      timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      user: {
        id: '4',
        name: 'Sarah Wilson',
        role: UserRole.EQA_EVALUATOR
      }
    },
    {
      id: '5',
      type: 'evidence_upload',
      title: 'Multiple Files Uploaded',
      description: '3 evidence files uploaded for different sub-indicators',
      timestamp: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
      user: {
        id: '5',
        name: 'Mike Brown',
        role: UserRole.TEACHER
      }
    }
  ];

  const displayActivities = activities.length > 0 ? activities : mockActivities;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : displayActivities.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">No Recent Activity</h3>
              <p className="text-gray-600">
                Activity will appear here as users interact with the system.
              </p>
            </div>
          ) : (
            displayActivities.map((activity) => {
              const Icon = getActivityIcon(activity.type);
              const iconColor = getActivityColor(activity.type);
              
              return (
                <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className={`p-2 rounded-full bg-gray-100 ${iconColor}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{activity.title}</span>
                      <Badge className={`text-xs ${getRoleBadgeColor(activity.user.role)}`}>
                        {activity.user.role.replace('_', ' ')}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-1">
                      {activity.description}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <User className="h-3 w-3" />
                        <span>{activity.user.name}</span>
                        <span>•</span>
                        <span>{formatTimeAgo(activity.timestamp)}</span>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          
          {/* View All Button */}
          {displayActivities.length > 0 && (
            <div className="text-center pt-4 border-t">
              <Button variant="outline" size="sm">
                View All Activity
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}