"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3, 
  PieChart, 
  TrendingUp,
  Users,
  FileText,
  Award,
  Target
} from "lucide-react";

interface DashboardChartsProps {
  data: {
    summary: any;
    evidence: any;
    evaluations: any;
    users: any;
  };
  loading: boolean;
  timeRange: string;
}

export function DashboardCharts({ data, loading, timeRange }: DashboardChartsProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-40 bg-gray-200 rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { evidence, evaluations, users } = data;

  return (
    <div className="space-y-6">
      {/* Evidence Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Evidence Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Top Sub-Indicators by Evidence Count
            </div>
            
            {evidence.bySubIndicator.slice(0, 5).map((item: any, index: number) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {item.subIndicator?.code || 'Unknown'}
                    </Badge>
                    <span className="text-sm font-medium truncate max-w-[200px]">
                      {item.subIndicator?.name || 'Unknown Sub-Indicator'}
                    </span>
                  </div>
                  <span className="text-sm font-medium">{item.count}</span>
                </div>
                <Progress 
                  value={(item.count / evidence.bySubIndicator[0]?.count) * 100} 
                  className="h-2"
                />
              </div>
            ))}
            
            {evidence.bySubIndicator.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No evidence data available for the selected period</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Evaluation Scores Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Evaluation Scores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Qualitative Score Distribution
            </div>
            
            {evaluations.byScore.length > 0 ? (
              <div className="space-y-3">
                {evaluations.byScore.map((item: any, index: number) => {
                  const scoreLabel = item.score ? `${item.score} Star${item.score > 1 ? 's' : ''}` : 'No Score';
                  const maxCount = Math.max(...evaluations.byScore.map((s: any) => s.count));
                  const percentage = (item.count / maxCount) * 100;
                  
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <div
                                key={i}
                                className={`w-3 h-3 rounded-full mr-1 ${
                                  i < (item.score || 0) ? 'bg-yellow-400' : 'bg-gray-200'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm font-medium">{scoreLabel}</span>
                        </div>
                        <span className="text-sm font-medium">{item.count}</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Award className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No evaluation scores available for the selected period</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Contributors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Top Contributors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Most Active Evidence Uploaders
            </div>
            
            {evidence.byUploader.slice(0, 5).map((item: any, index: number) => {
              const uploader = item.uploader;
              const maxCount = evidence.byUploader[0]?.count || 1;
              const percentage = (item.count / maxCount) * 100;
              
              return (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">
                          {uploader?.name?.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium">
                          {uploader?.name || 'Unknown User'}
                        </span>
                        <div className="text-xs text-gray-500">
                          {uploader?.role?.replace('_', ' ') || 'Unknown Role'}
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-medium">{item.count}</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
            
            {evidence.byUploader.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No contributor data available for the selected period</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Evaluators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Top Evaluators
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Most Active Evaluators
            </div>
            
            {evaluations.byEvaluator.slice(0, 5).map((item: any, index: number) => {
              const evaluator = item.evaluator;
              const maxCount = evaluations.byEvaluator[0]?.count || 1;
              const percentage = (item.count / maxCount) * 100;
              
              return (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-green-600">
                          {evaluator?.name?.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium">
                          {evaluator?.name || 'Unknown Evaluator'}
                        </span>
                        <div className="text-xs text-gray-500">
                          {evaluator?.role?.replace('_', ' ') || 'Unknown Role'}
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-medium">{item.count}</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
            
            {evaluations.byEvaluator.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Target className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No evaluator data available for the selected period</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Academic Year Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Academic Year Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Evidence by Academic Year
            </div>
            
            {evidence.byAcademicYear.slice(0, 5).map((item: any, index: number) => {
              const academicYear = item.academicYear;
              const maxCount = evidence.byAcademicYear[0]?.count || 1;
              const percentage = (item.count / maxCount) * 100;
              
              return (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {academicYear?.name || 'Unknown Year'}
                      </Badge>
                      <span className="text-sm">
                        {academicYear?.startDate && academicYear?.endDate && (
                          <span className="text-gray-500">
                            {new Date(academicYear.startDate).getFullYear()} - {new Date(academicYear.endDate).getFullYear()}
                          </span>
                        )}
                      </span>
                    </div>
                    <span className="text-sm font-medium">{item.count}</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
            
            {evidence.byAcademicYear.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <PieChart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No academic year data available for the selected period</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}