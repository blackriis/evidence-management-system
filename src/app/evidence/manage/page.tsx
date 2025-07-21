"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { RoleGuard } from "@/components/auth/role-guard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  FileText, 
  Download, 
  Trash2, 
  Search, 
  Filter, 
  Eye, 
  Calendar,
  User,
  FileIcon,
  Loader2,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { FileValidator } from "@/lib/file-validation";
import { UserRole } from "@/lib/user-role";

interface Evidence {
  id: string;
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  version: number;
  isLatest: boolean;
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
    startDate: string;
    endDate: string;
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

export default function EvidenceManagePage() {
  const { user } = useAuth();
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [subIndicators, setSubIndicators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  
  // Filters
  const [search, setSearch] = useState("");
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
  const [selectedSubIndicator, setSelectedSubIndicator] = useState("");
  const [sortBy, setSortBy] = useState("uploadedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  
  // Status
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: "" });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadEvidence();
  }, [search, selectedAcademicYear, selectedSubIndicator, sortBy, sortOrder, page]);

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
        page: page.toString(),
        limit: "20",
        sortBy,
        sortOrder
      });

      if (search) params.append('search', search);
      if (selectedAcademicYear) params.append('academicYearId', selectedAcademicYear);
      if (selectedSubIndicator) params.append('subIndicatorId', selectedSubIndicator);

      const response = await fetch(`/api/evidence?${params}`);
      const data = await response.json();

      if (response.ok) {
        setEvidence(data.evidence);
        setPagination(data.pagination);
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

  const handleDownload = async (evidenceId: string) => {
    try {
      setDownloading(evidenceId);
      
      const response = await fetch(`/api/evidence/${evidenceId}/download`);
      const data = await response.json();

      if (response.ok) {
        // Open download URL in new tab
        window.open(data.downloadUrl, '_blank');
        
        setStatus({
          type: 'success',
          message: 'Download started successfully'
        });
      } else {
        setStatus({
          type: 'error',
          message: data.error || 'Failed to download file'
        });
      }
    } catch (error) {
      console.error('Download error:', error);
      setStatus({
        type: 'error',
        message: 'Failed to download file. Please try again.'
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (evidenceId: string) => {
    if (!confirm('Are you sure you want to delete this evidence? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(evidenceId);
      
      const response = await fetch(`/api/evidence?id=${evidenceId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setStatus({
          type: 'success',
          message: 'Evidence deleted successfully'
        });
        loadEvidence(); // Refresh the list
      } else {
        const data = await response.json();
        setStatus({
          type: 'error',
          message: data.error || 'Failed to delete evidence'
        });
      }
    } catch (error) {
      console.error('Delete error:', error);
      setStatus({
        type: 'error',
        message: 'Failed to delete evidence. Please try again.'
      });
    } finally {
      setDeleting(null);
    }
  };

  const clearStatus = () => {
    setStatus({ type: null, message: "" });
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📈';
    return '📎';
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN: return 'bg-red-100 text-red-800';
      case UserRole.TEACHER: return 'bg-blue-100 text-blue-800';
      case UserRole.IQA_EVALUATOR: return 'bg-green-100 text-green-800';
      case UserRole.EQA_EVALUATOR: return 'bg-purple-100 text-purple-800';
      case UserRole.EXECUTIVE: return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <span>Loading evidence management...</span>
        </div>
      </div>
    );
  }

  return (
    <RoleGuard allowedRoles={[UserRole.TEACHER, UserRole.ADMIN, UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR, UserRole.EXECUTIVE]}>
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Evidence Management</h1>
          <p className="text-gray-600">
            View, manage, and download evidence files
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

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search files..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Academic Year</label>
                <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="All years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All years</SelectItem>
                    {academicYears.map((year) => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Sub-Indicator</label>
                <Select value={selectedSubIndicator} onValueChange={setSelectedSubIndicator}>
                  <SelectTrigger>
                    <SelectValue placeholder="All indicators" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All indicators</SelectItem>
                    {subIndicators.map((si) => (
                      <SelectItem key={si.id} value={si.id}>
                        {si.code}: {si.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Sort By</label>
                <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                  const [field, order] = value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uploadedAt-desc">Newest first</SelectItem>
                    <SelectItem value="uploadedAt-asc">Oldest first</SelectItem>
                    <SelectItem value="filename-asc">Name A-Z</SelectItem>
                    <SelectItem value="filename-desc">Name Z-A</SelectItem>
                    <SelectItem value="fileSize-desc">Largest first</SelectItem>
                    <SelectItem value="fileSize-asc">Smallest first</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Evidence Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Evidence Files
              {pagination && (
                <span className="text-sm font-normal text-gray-500">
                  ({pagination.total} total)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {evidence.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">No evidence found</h3>
                <p className="text-gray-600">
                  No evidence files match your current filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Sub-Indicator</TableHead>
                      <TableHead>Academic Year</TableHead>
                      <TableHead>Uploader</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Evaluations</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evidence.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getFileIcon(item.mimeType)}</span>
                            <div>
                              <p className="font-medium">{item.originalName}</p>
                              <p className="text-xs text-gray-500">{item.mimeType}</p>
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.subIndicator.code}</p>
                            <p className="text-xs text-gray-500">{item.subIndicator.name}</p>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <Badge variant="outline">
                            {item.academicYear.name}
                          </Badge>
                        </TableCell>
                        
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.uploader.name}</p>
                            <Badge className={`text-xs ${getRoleBadgeColor(item.uploader.role)}`}>
                              {item.uploader.role.replace('_', ' ')}
                            </Badge>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          {FileValidator.formatFileSize(item.fileSize)}
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span>v{item.version}</span>
                            {item.isLatest && (
                              <Badge variant="outline" className="text-xs">Latest</Badge>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div>
                            <p className="text-sm">
                              {new Date(item.uploadedAt).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(item.uploadedAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex gap-1">
                            {item.evaluations.map((evaluation, index) => (
                              <Badge 
                                key={index} 
                                variant="outline" 
                                className={`text-xs ${getRoleBadgeColor(evaluation.evaluator.role)}`}
                              >
                                {evaluation.evaluator.role.replace('_', ' ')}
                              </Badge>
                            ))}
                            {item.evaluations.length === 0 && (
                              <span className="text-xs text-gray-500">No evaluations</span>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(item.id)}
                              disabled={downloading === item.id}
                            >
                              {downloading === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                            
                            {(user?.role === UserRole.ADMIN || 
                              (user?.role === UserRole.TEACHER && item.uploader.id === user.id)) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(item.id)}
                                disabled={deleting === item.id}
                                className="text-red-600 hover:text-red-700"
                              >
                                {deleting === item.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}