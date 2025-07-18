"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Users, 
  UserCheck, 
  FileText, 
  Search, 
  Filter,
  Send,
  Shuffle,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle,
  BarChart3,
  Award,
  Bell
} from "lucide-react";
import { UserRole } from "@prisma/client";

interface Evaluator {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface Evidence {
  id: string;
  filename: string;
  originalName: string;
  uploadedAt: string;
  academicYear: {
    id: string;
    name: string;
    evaluationWindowOpen: boolean;
  };
  subIndicator: {
    id: string;
    name: string;
    code: string;
    indicator: {
      name: string;
      code: string;
      standard: {
        name: string;
        code: string;
        educationLevel: {
          name: string;
          code: string;
        };
      };
    };
  };
  evaluations: Array<{
    evaluator: {
      id: string;
      name: string;
      role: UserRole;
    };
  }>;
}

interface AssignmentStats {
  totalEvaluators: number;
  iqaEvaluators: number;
  eqaEvaluators: number;
  totalEvaluations: number;
  evidenceNeedingEvaluation: number;
  evaluationsByType: {
    IQA: number;
    EQA: number;
  };
}

export function EvaluatorAssignments() {
  const { user } = useAuth();
  const [evaluators, setEvaluators] = useState<Evaluator[]>([]);
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [assignmentsByEvaluator, setAssignmentsByEvaluator] = useState<any[]>([]);
  const [stats, setStats] = useState<AssignmentStats | null>(null);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [subIndicators, setSubIndicators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Filters
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
  const [selectedSubIndicator, setSelectedSubIndicator] = useState("");
  const [evaluatorType, setEvaluatorType] = useState<"IQA" | "EQA" | "">("");
  const [search, setSearch] = useState("");
  
  // Selections
  const [selectedEvaluators, setSelectedEvaluators] = useState<Set<string>>(new Set());
  const [selectedEvidence, setSelectedEvidence] = useState<Set<string>>(new Set());
  
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: "" });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [selectedAcademicYear, selectedSubIndicator, evaluatorType]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load academic years and sub-indicators for filters
      const [academicYearsRes, subIndicatorsRes] = await Promise.all([
        fetch('/api/academic-years'),
        fetch('/api/sub-indicators')
      ]);
      
      if (academicYearsRes.ok) {
        const academicYearsData = await academicYearsRes.json();
        setAcademicYears(academicYearsData);
      }
      
      if (subIndicatorsRes.ok) {
        const subIndicatorsData = await subIndicatorsRes.json();
        setSubIndicators(subIndicatorsData);
      }
      
    } catch (error) {
      console.error('Failed to load data:', error);
      setStatus({
        type: 'error',
        message: 'Failed to load page data. Please refresh.'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async () => {
    try {
      const params = new URLSearchParams();
      
      if (selectedAcademicYear) params.append('academicYearId', selectedAcademicYear);
      if (selectedSubIndicator) params.append('subIndicatorId', selectedSubIndicator);
      if (evaluatorType) params.append('evaluatorType', evaluatorType);

      const response = await fetch(`/api/evaluator-assignments?${params}`);
      const data = await response.json();

      if (response.ok) {
        setEvaluators(data.evaluators);
        setEvidenceList(data.evidenceNeedingEvaluation);
        setAssignmentsByEvaluator(data.assignmentsByEvaluator);
        setStats(data.stats);
      } else {
        setStatus({
          type: 'error',
          message: data.error || 'Failed to load assignments'
        });
      }
    } catch (error) {
      console.error('Failed to load assignments:', error);
      setStatus({
        type: 'error',
        message: 'Failed to load assignments. Please try again.'
      });
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedEvaluators.size === 0) {
      setStatus({
        type: 'error',
        message: 'Please select at least one evaluator.'
      });
      return;
    }

    try {
      setProcessing(true);
      
      const requestData = {
        action,
        evaluatorIds: Array.from(selectedEvaluators),
        evidenceIds: selectedEvidence.size > 0 ? Array.from(selectedEvidence) : undefined,
        academicYearId: selectedAcademicYear || undefined,
        subIndicatorId: selectedSubIndicator || undefined
      };

      const response = await fetch('/api/evaluator-assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({
          type: 'success',
          message: data.result.message || `${action} completed successfully`
        });
        
        // Clear selections
        setSelectedEvaluators(new Set());
        setSelectedEvidence(new Set());
        
        // Refresh data
        loadAssignments();
      } else {
        setStatus({
          type: 'error',
          message: data.error || `Failed to ${action}`
        });
      }
    } catch (error) {
      console.error(`${action} error:`, error);
      setStatus({
        type: 'error',
        message: `Failed to ${action}. Please try again.`
      });
    } finally {
      setProcessing(false);
    }
  };

  const toggleEvaluatorSelection = (evaluatorId: string) => {
    setSelectedEvaluators(prev => {
      const newSet = new Set(prev);
      if (newSet.has(evaluatorId)) {
        newSet.delete(evaluatorId);
      } else {
        newSet.add(evaluatorId);
      }
      return newSet;
    });
  };

  const toggleEvidenceSelection = (evidenceId: string) => {
    setSelectedEvidence(prev => {
      const newSet = new Set(prev);
      if (newSet.has(evidenceId)) {
        newSet.delete(evidenceId);
      } else {
        newSet.add(evidenceId);
      }
      return newSet;
    });
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.IQA_EVALUATOR: return 'bg-green-100 text-green-800';
      case UserRole.EQA_EVALUATOR: return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEvaluationStatus = (evidence: Evidence) => {
    const hasIQA = evidence.evaluations.some(e => e.evaluator.role === UserRole.IQA_EVALUATOR);
    const hasEQA = evidence.evaluations.some(e => e.evaluator.role === UserRole.EQA_EVALUATOR);
    
    if (hasIQA && hasEQA) {
      return { status: 'completed', color: 'bg-green-100 text-green-800', label: 'Complete' };
    } else if (hasIQA) {
      return { status: 'iqa_done', color: 'bg-blue-100 text-blue-800', label: 'IQA Done' };
    } else if (hasEQA) {
      return { status: 'eqa_done', color: 'bg-purple-100 text-purple-800', label: 'EQA Done' };
    } else {
      return { status: 'pending', color: 'bg-yellow-100 text-yellow-800', label: 'Pending' };
    }
  };

  const clearStatus = () => {
    setStatus({ type: null, message: "" });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading evaluator assignments...
        </CardContent>
      </Card>
    );
  }

  if (user?.role !== UserRole.ADMIN) {
    return (
      <Card>
        <CardContent className="p-8">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You don't have permission to manage evaluator assignments.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="flex items-center p-6">
              <Users className="h-8 w-8 text-blue-500 mr-4" />
              <div>
                <p className="text-2xl font-bold">{stats.totalEvaluators}</p>
                <p className="text-sm text-gray-600">Total Evaluators</p>
                <p className="text-xs text-gray-500">
                  IQA: {stats.iqaEvaluators} | EQA: {stats.eqaEvaluators}
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <BarChart3 className="h-8 w-8 text-green-500 mr-4" />
              <div>
                <p className="text-2xl font-bold">{stats.totalEvaluations}</p>
                <p className="text-sm text-gray-600">Total Evaluations</p>
                <p className="text-xs text-gray-500">
                  IQA: {stats.evaluationsByType.IQA} | EQA: {stats.evaluationsByType.EQA}
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <FileText className="h-8 w-8 text-orange-500 mr-4" />
              <div>
                <p className="text-2xl font-bold">{stats.evidenceNeedingEvaluation}</p>
                <p className="text-sm text-gray-600">Needs Evaluation</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <Award className="h-8 w-8 text-purple-500 mr-4" />
              <div>
                <p className="text-2xl font-bold">
                  {stats.totalEvaluations > 0 ? Math.round((stats.totalEvaluations / (stats.totalEvaluations + stats.evidenceNeedingEvaluation)) * 100) : 0}%
                </p>
                <p className="text-sm text-gray-600">Completion Rate</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Assignment Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Evaluator Assignment Management
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          {/* Status Messages */}
          {status.type && (
            <Alert className={`mb-4 ${status.type === 'error' ? 'border-red-200' : 'border-green-200'}`}>
              {status.type === 'error' ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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

            <Select value={selectedSubIndicator} onValueChange={setSelectedSubIndicator}>
              <SelectTrigger>
                <SelectValue placeholder="All sub-indicators" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All sub-indicators</SelectItem>
                {subIndicators.map((si) => (
                  <SelectItem key={si.id} value={si.id}>
                    {si.code}: {si.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={evaluatorType} onValueChange={(value: any) => setEvaluatorType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="All evaluator types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Types</SelectItem>
                <SelectItem value="IQA">IQA Evaluators</SelectItem>
                <SelectItem value="EQA">EQA Evaluators</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                {evidenceList.length} evidence files
              </span>
            </div>
          </div>

          {/* Bulk Actions */}
          <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Bulk Actions:</span>
              <Badge variant="outline">
                {selectedEvaluators.size} evaluators
              </Badge>
              <Badge variant="outline">
                {selectedEvidence.size} evidence
              </Badge>
            </div>
            
            <Button
              onClick={() => handleBulkAction('notify')}
              disabled={processing || selectedEvaluators.size === 0}
              size="sm"
              variant="outline"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Bell className="h-4 w-4 mr-2" />
              )}
              Notify
            </Button>
            
            <Button
              onClick={() => handleBulkAction('auto_assign_iqa')}
              disabled={processing || selectedEvaluators.size === 0}
              size="sm"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Shuffle className="h-4 w-4 mr-2" />
              )}
              Auto-Assign IQA
            </Button>
            
            <Button
              onClick={() => handleBulkAction('auto_assign_eqa')}
              disabled={processing || selectedEvaluators.size === 0}
              size="sm"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Shuffle className="h-4 w-4 mr-2" />
              )}
              Auto-Assign EQA
            </Button>
          </div>

          {/* Evaluators Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Select Evaluators</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {evaluators.map((evaluator) => (
                <div 
                  key={evaluator.id} 
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                    selectedEvaluators.has(evaluator.id) ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => toggleEvaluatorSelection(evaluator.id)}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedEvaluators.has(evaluator.id)}
                      readOnly
                    />
                    <div className="flex-1">
                      <p className="font-medium">{evaluator.name}</p>
                      <p className="text-sm text-gray-600">{evaluator.email}</p>
                      <Badge className={`text-xs ${getRoleBadgeColor(evaluator.role)}`}>
                        {evaluator.role.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence Needing Evaluation */}
          <div>
            <h3 className="text-lg font-medium mb-3">Evidence Needing Evaluation</h3>
            {evidenceList.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h4 className="text-lg font-medium mb-2">No evidence needs evaluation</h4>
                <p className="text-gray-600">
                  All evidence has been evaluated or evaluation windows are closed.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedEvidence.size === evidenceList.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedEvidence(new Set(evidenceList.map(e => e.id)));
                            } else {
                              setSelectedEvidence(new Set());
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Evidence</TableHead>
                      <TableHead>Sub-Indicator</TableHead>
                      <TableHead>Academic Year</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Upload Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evidenceList.map((evidence) => {
                      const evaluationStatus = getEvaluationStatus(evidence);
                      
                      return (
                        <TableRow key={evidence.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedEvidence.has(evidence.id)}
                              onCheckedChange={() => toggleEvidenceSelection(evidence.id)}
                            />
                          </TableCell>
                          
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-gray-500" />
                              <span className="font-medium">{evidence.originalName}</span>
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <div>
                              <p className="font-medium">{evidence.subIndicator.code}</p>
                              <p className="text-sm text-gray-600">{evidence.subIndicator.name}</p>
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <Badge variant="outline">
                              {evidence.academicYear.name}
                            </Badge>
                          </TableCell>
                          
                          <TableCell>
                            <Badge className={evaluationStatus.color}>
                              {evaluationStatus.label}
                            </Badge>
                          </TableCell>
                          
                          <TableCell>
                            <div className="text-sm">
                              {new Date(evidence.uploadedAt).toLocaleDateString()}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}