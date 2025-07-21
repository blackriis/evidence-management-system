"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { RoleGuard } from "@/components/auth/role-guard";
import { EvaluationForm } from "@/components/evaluation/evaluation-form";
import { EvaluationList } from "@/components/evaluation/evaluation-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, 
  FileText, 
  Search, 
  Filter,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle,
  Plus
} from "lucide-react";
import { UserRole } from "@/lib/user-role";

interface Evidence {
  id: string;
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploader: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
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
    id: string;
    qualitativeScore: number | null;
    quantitativeScore: number | null;
    comments: string | null;
    evaluatedAt: string;
    evaluator: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
    };
  }>;
}

export default function EvaluationPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("pending");
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [subIndicators, setSubIndicators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState("");
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
  const [selectedSubIndicator, setSelectedSubIndicator] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "evaluated" | "pending">("pending");
  
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: "" });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadEvidence();
  }, [search, selectedAcademicYear, selectedSubIndicator, filterStatus]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load academic years and sub-indicators
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

  const loadEvidence = async () => {
    try {
      const params = new URLSearchParams({
        includeEvaluations: "true"
      });

      if (search) params.append('search', search);
      if (selectedAcademicYear) params.append('academicYearId', selectedAcademicYear);
      if (selectedSubIndicator) params.append('subIndicatorId', selectedSubIndicator);

      const response = await fetch(`/api/evidence?${params}`);
      const data = await response.json();

      if (response.ok) {
        let filteredEvidence = data.evidence;

        // Apply evaluation status filter
        if (filterStatus === "evaluated") {
          filteredEvidence = filteredEvidence.filter((evidence: Evidence) => 
            evidence.evaluations.some(evaluation => evaluation.evaluator.id === user?.id)
          );
        } else if (filterStatus === "pending") {
          filteredEvidence = filteredEvidence.filter((evidence: Evidence) => 
            !evidence.evaluations.some(evaluation => evaluation.evaluator.id === user?.id)
          );
        }

        setEvidenceList(filteredEvidence);
      } else {
        setStatus({
          type: 'error',
          message: data.error || 'Failed to load evidence'
        });
      }
    } catch (error) {
      console.error('Failed to load evidence:', error);
      setStatus({
        type: 'error',
        message: 'Failed to load evidence. Please try again.'
      });
    }
  };

  const handleEvaluationSubmit = (evaluation: any) => {
    setStatus({
      type: 'success',
      message: 'Evaluation submitted successfully'
    });
    
    // Refresh evidence list to update evaluation status
    loadEvidence();
    
    // Clear selected evidence to return to list
    setSelectedEvidence(null);
  };

  const handleEvaluationDelete = () => {
    setStatus({
      type: 'success',
      message: 'Evaluation deleted successfully'
    });
    
    // Refresh evidence list
    loadEvidence();
    
    // Clear selected evidence to return to list
    setSelectedEvidence(null);
  };

  const getUserEvaluation = (evidence: Evidence) => {
    return evidence.evaluations.find(evaluation => evaluation.evaluator.id === user?.id);
  };

  const getEvaluationStatus = (evidence: Evidence) => {
    const userEvaluation = getUserEvaluation(evidence);
    
    if (userEvaluation) {
      return {
        status: 'evaluated',
        color: 'bg-green-100 text-green-800',
        label: 'Evaluated'
      };
    }
    
    return {
      status: 'pending',
      color: 'bg-yellow-100 text-yellow-800', 
      label: 'Pending'
    };
  };

  const clearStatus = () => {
    setStatus({ type: null, message: "" });
  };

  const canEvaluate = user && [UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR, UserRole.ADMIN].includes(user.role);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <span>Loading evaluation system...</span>
        </div>
      </div>
    );
  }

  if (!canEvaluate) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-8">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You don't have permission to access the evaluation system.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If evidence is selected, show evaluation form
  if (selectedEvidence) {
    return (
      <RoleGuard allowedRoles={[UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR, UserRole.ADMIN]}>
        <div className="container mx-auto p-6 max-w-4xl">
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={() => setSelectedEvidence(null)}
              className="mb-4"
            >
              ← Back to Evidence List
            </Button>
            
            <h1 className="text-3xl font-bold mb-2">Evaluate Evidence</h1>
            <p className="text-gray-600">
              Provide qualitative and quantitative assessment for the selected evidence
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

          <EvaluationForm
            evidence={selectedEvidence}
            existingEvaluation={getUserEvaluation(selectedEvidence)}
            onEvaluationSubmit={handleEvaluationSubmit}
            onEvaluationDelete={handleEvaluationDelete}
          />
        </div>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowedRoles={[UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR, UserRole.ADMIN]}>
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Evaluation System</h1>
          <p className="text-gray-600">
            Evaluate evidence files with qualitative and quantitative assessments
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

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Evidence to Evaluate
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              My Evaluations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Evidence Requiring Evaluation
                </CardTitle>
              </CardHeader>
              
              <CardContent>
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search evidence..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="All academic years" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All academic years</SelectItem>
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
                      <SelectItem value="all">All sub-indicators</SelectItem>
                      {subIndicators.map((si) => (
                        <SelectItem key={si.id} value={si.id}>
                          {si.code}: {si.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Evidence</SelectItem>
                      <SelectItem value="pending">Pending Evaluation</SelectItem>
                      <SelectItem value="evaluated">Already Evaluated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Evidence List */}
                {evidenceList.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-medium mb-2">No evidence found</h3>
                    <p className="text-gray-600">
                      No evidence files match your current filters.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {evidenceList.map((evidence) => {
                      const evaluationStatus = getEvaluationStatus(evidence);
                      const userEvaluation = getUserEvaluation(evidence);
                      
                      return (
                        <div key={evidence.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <FileText className="h-5 w-5 text-gray-500" />
                                <h3 className="font-medium">{evidence.originalName}</h3>
                                <Badge className={evaluationStatus.color}>
                                  {evaluationStatus.label}
                                </Badge>
                              </div>
                              
                              <div className="text-sm text-gray-600 space-y-1">
                                <p><strong>Sub-Indicator:</strong> {evidence.subIndicator.code} - {evidence.subIndicator.name}</p>
                                <p><strong>Academic Year:</strong> {evidence.academicYear.name}</p>
                                <p><strong>Uploaded by:</strong> {evidence.uploader.name}</p>
                                <p><strong>Upload Date:</strong> {new Date(evidence.uploadedAt).toLocaleDateString()}</p>
                                
                                {userEvaluation && (
                                  <div className="mt-2 p-2 bg-blue-50 rounded">
                                    <p className="text-blue-800 font-medium">Your Evaluation:</p>
                                    <div className="flex gap-4 text-sm">
                                      {userEvaluation.qualitativeScore && (
                                        <span>Qualitative: {userEvaluation.qualitativeScore}/5</span>
                                      )}
                                      {userEvaluation.quantitativeScore && (
                                        <span>Quantitative: {userEvaluation.quantitativeScore}%</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {/* Handle download */}}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              
                              <Button
                                onClick={() => setSelectedEvidence(evidence)}
                                size="sm"
                              >
                                {userEvaluation ? 'Edit Evaluation' : 'Evaluate'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            <EvaluationList evaluatorId={user?.id} />
          </TabsContent>
        </Tabs>
      </div>
    </RoleGuard>
  );
}