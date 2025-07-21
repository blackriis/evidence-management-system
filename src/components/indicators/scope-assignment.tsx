"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  User, 
  Users, 
  FileText, 
  Search,
  UserCheck,
  UserX,
  Loader2,
  AlertCircle,
  CheckCircle,
  Filter
} from "lucide-react";
import { UserRole } from "@/lib/user-role";

interface Teacher {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

interface SubIndicator {
  id: string;
  name: string;
  code: string;
  owner?: Teacher;
  indicator: {
    id: string;
    name: string;
    code: string;
    standard: {
      id: string;
      name: string;
      code: string;
      educationLevel: {
        id: string;
        name: string;
        code: string;
      };
    };
  };
}

interface Assignment {
  user: Teacher;
  assignments: SubIndicator[];
}

interface ScopeAssignmentProps {
  onAssignmentChange?: (subIndicatorId: string, userId: string | null) => void;
}

export function ScopeAssignment({ onAssignmentChange }: ScopeAssignmentProps) {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignmentsByUser, setAssignmentsByUser] = useState<Assignment[]>([]);
  const [unassigned, setUnassigned] = useState<SubIndicator[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [selectedSubIndicators, setSelectedSubIndicators] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "assigned" | "unassigned">("all");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({
    totalCount: 0,
    assignedCount: 0,
    unassignedCount: 0
  });
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: "" });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load teachers and assignments
      const [teachersResponse, assignmentsResponse] = await Promise.all([
        fetch('/api/users?role=TEACHER'),
        fetch('/api/scope-assignments')
      ]);

      if (teachersResponse.ok) {
        const teachersData = await teachersResponse.json();
        setTeachers(teachersData.users || []);
      }

      if (assignmentsResponse.ok) {
        const assignmentsData = await assignmentsResponse.json();
        setAssignmentsByUser(assignmentsData.assignmentsByUser || []);
        setUnassigned(assignmentsData.unassigned || []);
        setStats({
          totalCount: assignmentsData.totalCount || 0,
          assignedCount: assignmentsData.assignedCount || 0,
          unassignedCount: assignmentsData.unassignedCount || 0
        });
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      setStatus({
        type: 'error',
        message: 'Failed to load assignment data. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAssign = async () => {
    if (!selectedTeacher || selectedSubIndicators.size === 0) {
      setStatus({
        type: 'error',
        message: 'Please select a teacher and at least one sub-indicator.'
      });
      return;
    }

    try {
      setProcessing(true);
      
      const response = await fetch('/api/scope-assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subIndicatorIds: Array.from(selectedSubIndicators),
          userId: selectedTeacher
        })
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({
          type: 'success',
          message: `Successfully assigned ${data.updatedCount} sub-indicators`
        });
        
        setSelectedSubIndicators(new Set());
        setSelectedTeacher("");
        loadData(); // Refresh data
        
        onAssignmentChange?.(Array.from(selectedSubIndicators)[0], selectedTeacher);
      } else {
        setStatus({
          type: 'error',
          message: data.error || 'Failed to assign sub-indicators'
        });
      }
    } catch (error) {
      console.error('Assignment error:', error);
      setStatus({
        type: 'error',
        message: 'Failed to assign sub-indicators. Please try again.'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkUnassign = async () => {
    if (selectedSubIndicators.size === 0) {
      setStatus({
        type: 'error',
        message: 'Please select at least one sub-indicator to unassign.'
      });
      return;
    }

    try {
      setProcessing(true);
      
      const response = await fetch('/api/scope-assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subIndicatorIds: Array.from(selectedSubIndicators),
          userId: null
        })
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({
          type: 'success',
          message: `Successfully unassigned ${data.updatedCount} sub-indicators`
        });
        
        setSelectedSubIndicators(new Set());
        loadData(); // Refresh data
      } else {
        setStatus({
          type: 'error',
          message: data.error || 'Failed to unassign sub-indicators'
        });
      }
    } catch (error) {
      console.error('Unassignment error:', error);
      setStatus({
        type: 'error',
        message: 'Failed to unassign sub-indicators. Please try again.'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleIndividualAssign = async (subIndicatorId: string, userId: string | null) => {
    try {
      const response = await fetch('/api/scope-assignments', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subIndicatorId,
          userId
        })
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({
          type: 'success',
          message: `Successfully ${data.action} sub-indicator`
        });
        
        loadData(); // Refresh data
        onAssignmentChange?.(subIndicatorId, userId);
      } else {
        setStatus({
          type: 'error',
          message: data.error || 'Failed to update assignment'
        });
      }
    } catch (error) {
      console.error('Assignment error:', error);
      setStatus({
        type: 'error',
        message: 'Failed to update assignment. Please try again.'
      });
    }
  };

  const toggleSubIndicatorSelection = (subIndicatorId: string) => {
    setSelectedSubIndicators(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subIndicatorId)) {
        newSet.delete(subIndicatorId);
      } else {
        newSet.add(subIndicatorId);
      }
      return newSet;
    });
  };

  const getAllSubIndicators = (): SubIndicator[] => {
    const assigned = assignmentsByUser.flatMap(assignment => assignment.assignments);
    return [...assigned, ...unassigned];
  };

  const getFilteredSubIndicators = (): SubIndicator[] => {
    const allSubIndicators = getAllSubIndicators();
    
    let filtered = allSubIndicators;

    // Apply status filter
    if (filterStatus === "assigned") {
      filtered = filtered.filter(si => si.owner);
    } else if (filterStatus === "unassigned") {
      filtered = filtered.filter(si => !si.owner);
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(si => 
        si.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        si.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        si.indicator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        si.indicator.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        si.owner?.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  const clearStatus = () => {
    setStatus({ type: null, message: "" });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading scope assignments...
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
              You don't have permission to manage scope assignments.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const filteredSubIndicators = getFilteredSubIndicators();

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center p-6">
            <FileText className="h-8 w-8 text-blue-500 mr-4" />
            <div>
              <p className="text-2xl font-bold">{stats.totalCount}</p>
              <p className="text-sm text-gray-600">Total Sub-Indicators</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-6">
            <UserCheck className="h-8 w-8 text-green-500 mr-4" />
            <div>
              <p className="text-2xl font-bold">{stats.assignedCount}</p>
              <p className="text-sm text-gray-600">Assigned</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-6">
            <UserX className="h-8 w-8 text-red-500 mr-4" />
            <div>
              <p className="text-2xl font-bold">{stats.unassignedCount}</p>
              <p className="text-sm text-gray-600">Unassigned</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assignment Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Scope Assignments
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

          {/* Filters and Search */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search sub-indicators..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sub-Indicators</SelectItem>
                <SelectItem value="assigned">Assigned Only</SelectItem>
                <SelectItem value="unassigned">Unassigned Only</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                {filteredSubIndicators.length} of {stats.totalCount} shown
              </span>
            </div>
          </div>

          {/* Bulk Actions */}
          <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Bulk Actions:</span>
              <Badge variant="outline">
                {selectedSubIndicators.size} selected
              </Badge>
            </div>
            
            <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select teacher" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.name} ({teacher.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              onClick={handleBulkAssign}
              disabled={processing || selectedSubIndicators.size === 0 || !selectedTeacher}
              size="sm"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserCheck className="h-4 w-4 mr-2" />
              )}
              Assign
            </Button>
            
            <Button
              onClick={handleBulkUnassign}
              disabled={processing || selectedSubIndicators.size === 0}
              variant="outline"
              size="sm"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserX className="h-4 w-4 mr-2" />
              )}
              Unassign
            </Button>
          </div>

          {/* Sub-Indicators Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedSubIndicators.size === filteredSubIndicators.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedSubIndicators(new Set(filteredSubIndicators.map(si => si.id)));
                        } else {
                          setSelectedSubIndicators(new Set());
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Sub-Indicator</TableHead>
                  <TableHead>Indicator</TableHead>
                  <TableHead>Standard</TableHead>
                  <TableHead>Education Level</TableHead>
                  <TableHead>Current Assignment</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubIndicators.map((subIndicator) => (
                  <TableRow key={subIndicator.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedSubIndicators.has(subIndicator.id)}
                        onCheckedChange={() => toggleSubIndicatorSelection(subIndicator.id)}
                      />
                    </TableCell>
                    
                    <TableCell>
                      <div>
                        <p className="font-medium">{subIndicator.code}</p>
                        <p className="text-sm text-gray-600">{subIndicator.name}</p>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div>
                        <p className="font-medium">{subIndicator.indicator.code}</p>
                        <p className="text-sm text-gray-600">{subIndicator.indicator.name}</p>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div>
                        <p className="font-medium">{subIndicator.indicator.standard.code}</p>
                        <p className="text-sm text-gray-600">{subIndicator.indicator.standard.name}</p>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant="outline">
                        {subIndicator.indicator.standard.educationLevel.code}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      {subIndicator.owner ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-green-500" />
                          <div>
                            <p className="font-medium">{subIndicator.owner.name}</p>
                            <p className="text-sm text-gray-600">{subIndicator.owner.email}</p>
                          </div>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-orange-600">
                          Unassigned
                        </Badge>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <Select
                        value={subIndicator.owner?.id || "unassign"}
                        onValueChange={(value) => handleIndividualAssign(subIndicator.id, value === "unassign" ? null : value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Assign..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassign">Unassign</SelectItem>
                          {teachers.map((teacher) => (
                            <SelectItem key={teacher.id} value={teacher.id}>
                              {teacher.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredSubIndicators.length === 0 && (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">No sub-indicators found</h3>
              <p className="text-gray-600">
                No sub-indicators match your current filters.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}