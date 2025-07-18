"use client";

import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  File, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  HardDrive,
  FileText
} from "lucide-react";
import { FileValidator } from "@/lib/file-validation";

interface FileUploadProps {
  subIndicatorId: string;
  academicYearId: string;
  onUploadComplete?: (evidence: any) => void;
  onUploadError?: (error: string) => void;
}

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  evidenceId?: string;
}

export function FileUpload({ 
  subIndicatorId, 
  academicYearId, 
  onUploadComplete, 
  onUploadError 
}: FileUploadProps) {
  const { user } = useAuth();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadQuotaInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/upload?academicYearId=${academicYearId}&subIndicatorId=${subIndicatorId}`);
      const data = await response.json();
      setQuotaInfo(data);
    } catch (error) {
      console.error('Failed to load quota info:', error);
    }
  }, [academicYearId, subIndicatorId]);

  // Load quota info on component mount
  useState(() => {
    loadQuotaInfo();
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    addFiles(selectedFiles);
  }, []);

  const addFiles = useCallback((newFiles: File[]) => {
    if (!quotaInfo) return;

    const uploadFiles: UploadFile[] = newFiles.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      progress: 0,
      status: 'pending'
    }));

    // Validate files
    const fileInfos = newFiles.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type
    }));

    const validationResult = FileValidator.validateMultipleFiles(fileInfos, quotaInfo.quota.available);
    
    if (!validationResult.isValid) {
      onUploadError?.(validationResult.errors.join(', '));
      return;
    }

    setFiles(prev => [...prev, ...uploadFiles]);
  }, [quotaInfo, onUploadError]);

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  const uploadFile = async (uploadFile: UploadFile) => {
    const formData = new FormData();
    formData.append('file', uploadFile.file);
    formData.append('subIndicatorId', subIndicatorId);
    formData.append('replace', 'true');

    try {
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'uploading', progress: 0 }
          : f
      ));

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'completed', progress: 100, evidenceId: data.evidence.id }
          : f
      ));

      onUploadComplete?.(data.evidence);
      loadQuotaInfo(); // Refresh quota info

    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' }
          : f
      ));

      onUploadError?.(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  const uploadAllFiles = async () => {
    setIsLoading(true);
    const pendingFiles = files.filter(f => f.status === 'pending');
    
    for (const file of pendingFiles) {
      await uploadFile(file);
    }
    
    setIsLoading(false);
  };

  const clearAllFiles = () => {
    setFiles([]);
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'pending':
        return <File className="h-4 w-4 text-gray-400" />;
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: UploadFile['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'uploading':
        return <Badge variant="outline" className="text-blue-600">Uploading</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-green-600">Completed</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
    }
  };

  if (!quotaInfo) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading upload information...
        </CardContent>
      </Card>
    );
  }

  if (!quotaInfo.uploadWindow.isOpen) {
    return (
      <Card>
        <CardContent className="p-8">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Upload window is currently closed for {quotaInfo.uploadWindow.academicYear}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quota Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage Quota
          </CardTitle>
          <CardDescription>
            Your storage usage for {quotaInfo.uploadWindow.academicYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Used: {FileValidator.formatFileSize(quotaInfo.quota.used)}</span>
              <span>Available: {FileValidator.formatFileSize(quotaInfo.quota.available)}</span>
            </div>
            <Progress value={quotaInfo.quota.usagePercentage} className="h-2" />
            <p className="text-xs text-gray-500">
              Total: {FileValidator.formatFileSize(quotaInfo.quota.total)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Evidence
          </CardTitle>
          <CardDescription>
            Drag and drop files here or click to browse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver 
                ? 'border-primary bg-primary/5' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">
              {isDragOver ? 'Drop files here' : 'Choose files or drag them here'}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Supported formats: PDF, Office documents, images, text files
            </p>
            <p className="text-xs text-gray-400">
              Maximum file size: {FileValidator.formatFileSize(quotaInfo.maxFileSize)}
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={quotaInfo.allowedTypes.join(',')}
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Files to Upload ({files.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                onClick={uploadAllFiles} 
                disabled={isLoading || files.every(f => f.status !== 'pending')}
                size="sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload All'
                )}
              </Button>
              <Button 
                onClick={clearAllFiles} 
                variant="outline" 
                size="sm"
                disabled={isLoading}
              >
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {files.map((uploadFile) => (
                <div key={uploadFile.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  {getStatusIcon(uploadFile.status)}
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{uploadFile.file.name}</p>
                    <p className="text-xs text-gray-500">
                      {FileValidator.formatFileSize(uploadFile.file.size)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(uploadFile.status)}
                    
                    {uploadFile.status === 'uploading' && (
                      <div className="w-24">
                        <Progress value={uploadFile.progress} className="h-2" />
                      </div>
                    )}
                    
                    {uploadFile.status === 'error' && uploadFile.error && (
                      <p className="text-xs text-red-500 max-w-xs truncate">{uploadFile.error}</p>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(uploadFile.id)}
                      disabled={uploadFile.status === 'uploading'}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}