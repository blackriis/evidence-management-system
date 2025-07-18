"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  BarChart3, 
  Search, 
  Filter, 
  Star, 
  FileText, 
  User, 
  Calendar,
  Loader2,
  AlertCircle,
  TrendingUp,
  Award,
  Eye
} from "lucide-react";
import { UserRole } from "@prisma/client";

interface Evaluation {
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
  evidence: {
    id: string;
    filename: string;
    originalName: string;
    fileSize: number;
    uploadedAt: string;
    uploader?: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
    };
    academicYear?: {
      id: string;
      name: string;
    };
    subIndicator?: {
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
  };
}

interface EvaluationStats {
  total: number;
  averageQualitative: number | null;
  averageQuantitative: number | null;
  scoreDistribution: Array<{
    qualitativeScore: number | null;
    _count: { id: number };
  }>;
}

interface EvaluationListProps {
  evidenceId?: string;
  evaluatorId?: string;
  academicYearId?: string;
  subIndicatorId?: string;
  onEvaluationSelect?: (evaluation: Evaluation) => void;
}

export function EvaluationList({
  evidenceId,
  evaluatorId,
  academicYearId,
  subIndicatorId,
  onEvaluationSelect
}: EvaluationListProps) {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [stats, setStats] = useState<EvaluationStats | null>(null);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [subIndicators, setSubIndicators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState("");
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(academicYearId || "");
  const [selectedSubIndicator, setSelectedSubIndicator] = useState(subIndicatorId || "");
  const [selectedEvaluator, setSelectedEvaluator] = useState(evaluatorId || "");
  const [sortBy, setSortBy] = useState("evaluatedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: "" });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadEvaluations();
  }, [search, selectedAcademicYear, selectedSubIndicator, selectedEvaluator, sortBy, sortOrder, page]);

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

  const loadEvaluations = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        includeEvidence: "true"
      });

      if (evidenceId) params.append('evidenceId', evidenceId);
      if (selectedEvaluator) params.append('evaluatorId', selectedEvaluator);
      if (selectedAcademicYear) params.append('academicYearId', selectedAcademicYear);
      if (selectedSubIndicator) params.append('subIndicatorId', selectedSubIndicator);

      const response = await fetch(`/api/evaluations?${params}`);
      const data = await response.json();

      if (response.ok) {
        setEvaluations(data.evaluations);
        setPagination(data.pagination);
        setStats(data.stats);
      } else {
        setStatus({
          type: 'error',
          message: data.error || 'Failed to load evaluations'
        });
      }
    } catch (error) {
      console.error('Failed to load evaluations:', error);
      setStatus({
        type: 'error',
        message: 'Failed to load evaluations. Please try again.'
      });
    }
  };

  const renderStars = (score: number | null) => {
    if (score === null) return <span className="text-gray-400">No score</span>;

    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star 
          key={i} 
          className={`h-4 w-4 ${i <= score ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
        />
      );
    }
    return <div className="flex">{stars}</div>;
  };

  const getScoreColor = (score: number | null, isPercentage: boolean = false) => {
    if (score === null) return 'text-gray-400';
    
    if (isPercentage) {
      if (score >= 80) return 'text-green-600';
      if (score >= 60) return 'text-yellow-600';
      return 'text-red-600';
    } else {
      if (score >= 4) return 'text-green-600';
      if (score >= 3) return 'text-yellow-600';
      return 'text-red-600';
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.IQA_EVALUATOR: return 'bg-green-100 text-green-800';
      case UserRole.EQA_EVALUATOR: return 'bg-purple-100 text-purple-800';
      case UserRole.ADMIN: return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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
          Loading evaluations...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="flex items-center p-6">
              <BarChart3 className="h-8 w-8 text-blue-500 mr-4" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-gray-600">Total Evaluations</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <Award className="h-8 w-8 text-yellow-500 mr-4" />
              <div>
                <p className="text-2xl font-bold">
                  {stats.averageQualitative ? stats.averageQualitative.toFixed(1) : 'N/A'}
                </p>
                <p className="text-sm text-gray-600">Avg Qualitative</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <TrendingUp className="h-8 w-8 text-green-500 mr-4" />
              <div>
                <p className="text-2xl font-bold">
                  {stats.averageQuantitative ? `${stats.averageQuantitative.toFixed(0)}%` : 'N/A'}
                </p>
                <p className="text-sm text-gray-600">Avg Quantitative</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-6">
              <Star className="h-8 w-8 text-orange-500 mr-4" />
              <div>
                <p className="text-2xl font-bold">
                  {stats.scoreDistribution.find(d => d.qualitativeScore === 5)?._count.id || 0}
                </p>
                <p className="text-sm text-gray-600">Excellent (5★)</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Evaluations Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Evaluations
            {pagination && (
              <span className="text-sm font-normal text-gray-500">
                ({pagination.total} total)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          {/* Status Messages */}
          {status.type && (
            <Alert className={`mb-4 ${status.type === 'error' ? 'border-red-200' : 'border-green-200'}`}>
              <AlertCircle className="h-4 w-4" />
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
          {!evidenceId && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search evaluations..."
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

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">
                  {evaluations.length} results
                </span>
              </div>
            </div>
          )}

          {/* Evaluations Table */}
          {evaluations.length === 0 ? (
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">No evaluations found</h3>
              <p className="text-gray-600">
                No evaluations match your current filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evidence</TableHead>
                    <TableHead>Evaluator</TableHead>
                    <TableHead>Qualitative Score</TableHead>
                    <TableHead>Quantitative Score</TableHead>
                    <TableHead>Comments</TableHead>
                    <TableHead>Evaluated At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluations.map((evaluation) => (
                    <TableRow key={evaluation.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="font-medium">{evaluation.evidence.originalName}</p>
                            {evaluation.evidence.subIndicator && (
                              <p className="text-xs text-gray-500">
                                {evaluation.evidence.subIndicator.code}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="font-medium">{evaluation.evaluator.name}</p>
                            <Badge className={`text-xs ${getRoleBadgeColor(evaluation.evaluator.role)}`}>
                              {evaluation.evaluator.role.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {renderStars(evaluation.qualitativeScore)}
                          {evaluation.qualitativeScore && (
                            <span className={`text-sm font-medium ${getScoreColor(evaluation.qualitativeScore)}`}>
                              {evaluation.qualitativeScore}/5
                            </span>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        {evaluation.quantitativeScore !== null ? (
                          <span className={`font-medium ${getScoreColor(evaluation.quantitativeScore, true)}`}>
                            {evaluation.quantitativeScore}%
                          </span>
                        ) : (
                          <span className="text-gray-400">No score</span>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        {evaluation.comments ? (
                          <div className="max-w-xs">
                            <p className="text-sm truncate" title={evaluation.comments}>
                              {evaluation.comments}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-400">No comments</span>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <div>
                            <p>{new Date(evaluation.evaluatedAt).toLocaleDateString()}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(evaluation.evaluatedAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEvaluationSelect?.(evaluation)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-600">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={!pagination.hasPrev}
                >
                  Previous
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasNext}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}