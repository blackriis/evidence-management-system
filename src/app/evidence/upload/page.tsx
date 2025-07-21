"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { RoleGuard } from "@/components/auth/role-guard";
import { FileUpload } from "@/components/upload/file-upload";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { UserRole } from "@/lib/user-role";

interface SubIndicator {
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
}

interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  uploadWindowOpen: boolean;
  isActive: boolean;
}

export default function UploadPage() {
  const { user } = useAuth();
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [subIndicators, setSubIndicators] = useState<SubIndicator[]>([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("");
  const [selectedSubIndicator, setSelectedSubIndicator] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: "" });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load academic years
      const academicYearsResponse = await fetch('/api/academic-years');
      const academicYearsData = await academicYearsResponse.json();
      
      if (academicYearsResponse.ok) {
        setAcademicYears(academicYearsData);
        
        // Auto-select active academic year
        const activeYear = academicYearsData.find((year: AcademicYear) => year.isActive);
        if (activeYear) {
          setSelectedAcademicYear(activeYear.id);
        }
      }

      // Load sub-indicators (user's assigned scope)
      const subIndicatorsResponse = await fetch('/api/sub-indicators');
      const subIndicatorsData = await subIndicatorsResponse.json();
      
      if (subIndicatorsResponse.ok) {
        setSubIndicators(subIndicatorsData);
      }

    } catch (error) {
      console.error('Failed to load data:', error);
      setUploadStatus({
        type: 'error',
        message: 'Failed to load upload data. Please refresh the page.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadComplete = (evidence: any) => {
    setUploadStatus({
      type: 'success',
      message: `Successfully uploaded ${evidence.filename} (Version ${evidence.version})`
    });
    
    // Clear the message after 5 seconds
    setTimeout(() => {
      setUploadStatus({ type: null, message: "" });
    }, 5000);
  };

  const handleUploadError = (error: string) => {
    setUploadStatus({
      type: 'error',
      message: error
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin mr-2" />
          <span>Loading upload page...</span>
        </div>
      </div>
    );
  }

  const selectedYear = academicYears.find(year => year.id === selectedAcademicYear);
  const selectedSI = subIndicators.find(si => si.id === selectedSubIndicator);

  return (
    <RoleGuard allowedRoles={[UserRole.TEACHER, UserRole.ADMIN]}>
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Upload Evidence</h1>
          <p className="text-gray-600">
            Upload evidence files for quality assurance evaluation
          </p>
        </div>

        {/* Status Messages */}
        {uploadStatus.type && (
          <Alert className={`mb-6 ${uploadStatus.type === 'error' ? 'border-red-200' : 'border-green-200'}`}>
            {uploadStatus.type === 'error' ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            <AlertDescription>{uploadStatus.message}</AlertDescription>
          </Alert>
        )}

        {/* Selection Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Academic Year</CardTitle>
              <CardDescription>
                Select the academic year for your evidence
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}>
                <SelectTrigger>
                  <SelectValue placeholder="Select academic year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      <div className="flex items-center gap-2">
                        <span>{year.name}</span>
                        {year.isActive && (
                          <Badge variant="outline" className="text-xs">Active</Badge>
                        )}
                        {year.uploadWindowOpen ? (
                          <Badge variant="outline" className="text-xs text-green-600">Open</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-red-600">Closed</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedYear && (
                <div className="mt-3 text-sm text-gray-600">
                  <p>Period: {new Date(selectedYear.startDate).toLocaleDateString()} - {new Date(selectedYear.endDate).toLocaleDateString()}</p>
                  <p>Upload Window: {selectedYear.uploadWindowOpen ? 'Open' : 'Closed'}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sub-Indicator</CardTitle>
              <CardDescription>
                Select the sub-indicator for your evidence
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedSubIndicator} onValueChange={setSelectedSubIndicator}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sub-indicator" />
                </SelectTrigger>
                <SelectContent>
                  {subIndicators.map((si) => (
                    <SelectItem key={si.id} value={si.id}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{si.code}: {si.name}</span>
                        <span className="text-xs text-gray-500">
                          {si.indicator.standard.educationLevel.code} &gt; {si.indicator.standard.code} &gt; {si.indicator.code}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedSI && (
                <div className="mt-3 text-sm text-gray-600">
                  <p className="font-medium">{selectedSI.indicator.name}</p>
                  <p>{selectedSI.indicator.standard.name}</p>
                  <p>{selectedSI.indicator.standard.educationLevel.name}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* File Upload Component */}
        {selectedAcademicYear && selectedSubIndicator ? (
          <FileUpload
            academicYearId={selectedAcademicYear}
            subIndicatorId={selectedSubIndicator}
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
          />
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center p-12">
              <div className="text-center">
                <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">Select Academic Year and Sub-Indicator</h3>
                <p className="text-gray-600">
                  Please select both an academic year and a sub-indicator to start uploading evidence.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </RoleGuard>
  );
}