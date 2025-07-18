"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  AlertTriangle, 
  AlertCircle,
  Clock,
  Users,
  FileText,
  XCircle,
  CheckCircle,
  Eye,
  ExternalLink
} from "lucide-react";
import { UserRole } from "@prisma/client";

interface Risk {
  id: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedCount: number;
  createdAt: string;
  [key: string]: any;
}

interface RiskMonitoringProps {
  risks: {
    summary: {
      total: number;
      high: number;
      medium: number;
      low: number;
      byType: Record<string, number>;
    };
    risks: Risk[];
    generatedAt: string;
  };
  loading: boolean;
  userRole?: UserRole;
}

export function RiskMonitoring({ risks, loading, userRole }: RiskMonitoringProps) {
  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return AlertTriangle;
      case 'medium': return AlertCircle;
      case 'low': return Clock;
      default: return AlertCircle;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'unassigned_scope': return Users;
      case 'unevaluated_evidence': return FileText;
      case 'partial_evaluation': return Clock;
      case 'inactive_user_with_scopes': return XCircle;
      case 'evaluation_window_closing': return AlertTriangle;
      case 'low_evidence_submission': return FileText;
      default: return AlertCircle;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'unassigned_scope': return 'Unassigned Scope';
      case 'unevaluated_evidence': return 'Unevaluated Evidence';
      case 'partial_evaluation': return 'Partial Evaluation';
      case 'inactive_user_with_scopes': return 'Inactive User';
      case 'evaluation_window_closing': return 'Deadline Approaching';
      case 'low_evidence_submission': return 'Low Submission';
      default: return 'Unknown';
    }
  };

  const handleRiskAction = (risk: Risk, action: string) => {
    // TODO: Implement risk action handlers
    console.log(`Action ${action} for risk ${risk.id}`);
  };

  const { summary, risks: riskList } = risks;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Risk Monitoring
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Risk Summary */}
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold">{summary.total}</div>
              <div className="text-xs text-gray-600">Total</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-lg font-bold text-red-600">{summary.high}</div>
              <div className="text-xs text-red-600">High</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-lg font-bold text-yellow-600">{summary.medium}</div>
              <div className="text-xs text-yellow-600">Medium</div>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-lg font-bold text-blue-600">{summary.low}</div>
              <div className="text-xs text-blue-600">Low</div>
            </div>
          </div>

          {/* Risk List */}
          <div className="space-y-3">
            {riskList.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <h3 className="text-lg font-medium mb-2">No Active Risks</h3>
                <p className="text-gray-600">
                  All systems are operating normally. Great job!
                </p>
              </div>
            ) : (
              riskList.slice(0, 10).map((risk) => {
                const SeverityIcon = getSeverityIcon(risk.severity);
                const TypeIcon = getTypeIcon(risk.type);
                
                return (
                  <Alert key={risk.id} className={`${getSeverityColor(risk.severity)} border-l-4`}>
                    <div className="flex items-start gap-3">
                      <SeverityIcon className="h-4 w-4 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <TypeIcon className="h-3 w-3" />
                          <Badge variant="outline" className="text-xs">
                            {getTypeLabel(risk.type)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {risk.severity.toUpperCase()}
                          </Badge>
                        </div>
                        <AlertDescription className="text-sm">
                          <div className="font-medium mb-1">{risk.title}</div>
                          <div className="text-xs text-gray-600">{risk.description}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Affects {risk.affectedCount} item{risk.affectedCount !== 1 ? 's' : ''}
                          </div>
                        </AlertDescription>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRiskAction(risk, 'view')}
                          className="text-xs"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        {userRole === UserRole.ADMIN && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRiskAction(risk, 'resolve')}
                            className="text-xs"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Alert>
                );
              })
            )}
          </div>

          {/* Show More Button */}
          {riskList.length > 10 && (
            <div className="text-center">
              <Button variant="outline" size="sm">
                View All {summary.total} Risks
              </Button>
            </div>
          )}

          {/* Risk Types Summary */}
          {summary.total > 0 && (
            <div className="pt-4 border-t">
              <div className="text-sm font-medium mb-3">Risk Breakdown</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(summary.byType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span>{getTypeLabel(type)}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Last Updated */}
          <div className="text-xs text-gray-500 text-center pt-2 border-t">
            Last updated: {new Date(risks.generatedAt).toLocaleString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}