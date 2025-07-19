"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
import { UploadNotifications, useUploadNotifications } from "./upload-notifications";

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
  uploadSpeed?: number; // bytes per second
  remainingTime?: number; // seconds
  uploadedBytes?: number;
  startTime?: number;
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
  const [overallProgress, setOverallProgress] = useState(0);
  const [totalUploadSpeed, setTotalUploadSpeed] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { 
    notifications, 
    removeNotification, 
    notifySuccess, 
    notifyError, 
    notifyInfo 
  } = useUploadNotifications();

  const loadQuotaInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/upload?academicYearId=${academicYearId}&subIndicatorId=${subIndicatorId}`);
      const data = await response.json();
      setQuotaInfo(data);
    } catch (error) {
      console.error('Failed to load quota info:', error);
    }
  }, [academicYearId, subIndicatorId]);

  // Load quota info when component mounts or dependencies change
  useEffect(() => {
    loadQuotaInfo();
  }, [loadQuotaInfo]);

  // Calculate overall upload statistics
  useEffect(() => {
    const uploadingFiles = files.filter(f => f.status === 'uploading');
    
    if (uploadingFiles.length === 0) {
      setOverallProgress(0);
      setTotalUploadSpeed(0);
      setEstimatedTimeRemaining(0);
      return;
    }

    const totalSize = uploadingFiles.reduce((sum, f) => sum + f.file.size, 0);
    const totalUploaded = uploadingFiles.reduce((sum, f) => sum + (f.uploadedBytes || 0), 0);
    const totalSpeed = uploadingFiles.reduce((sum, f) => sum + (f.uploadSpeed || 0), 0);

    const progress = totalSize > 0 ? (totalUploaded / totalSize) * 100 : 0;
    const remaining = totalSpeed > 0 ? (totalSize - totalUploaded) / totalSpeed : 0;

    setOverallProgress(progress);
    setTotalUploadSpeed(totalSpeed);
    setEstimatedTimeRemaining(remaining);
  }, [files]);

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
      const errorMessage = validationResult.errors.join(', ');
      onUploadError?.(errorMessage);
      notifyError('ไฟล์ไม่ถูกต้อง', errorMessage);
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

    const startTime = Date.now();

    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Initial status update
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { 
              ...f, 
              status: 'uploading', 
              progress: 0, 
              startTime,
              uploadedBytes: 0,
              uploadSpeed: 0,
              remainingTime: 0
            }
          : f
      ));

      // Progress tracking
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          const currentTime = Date.now();
          const elapsedTime = (currentTime - startTime) / 1000; // seconds
          const uploadSpeed = elapsedTime > 0 ? event.loaded / elapsedTime : 0; // bytes per second
          const remainingBytes = event.total - event.loaded;
          const remainingTime = uploadSpeed > 0 ? remainingBytes / uploadSpeed : 0; // seconds

          setFiles(prev => prev.map(f => 
            f.id === uploadFile.id 
              ? { 
                  ...f, 
                  progress,
                  uploadedBytes: event.loaded,
                  uploadSpeed,
                  remainingTime
                }
              : f
          ));
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        try {
          const data = JSON.parse(xhr.responseText);

          if (xhr.status >= 200 && xhr.status < 300) {
            setFiles(prev => prev.map(f => 
              f.id === uploadFile.id 
                ? { 
                    ...f, 
                    status: 'completed', 
                    progress: 100, 
                    evidenceId: data.evidence.id,
                    uploadSpeed: 0,
                    remainingTime: 0
                  }
                : f
            ));

            onUploadComplete?.(data.evidence);
            loadQuotaInfo(); // Refresh quota info
            notifySuccess(
              'อัพโหลดสำเร็จ', 
              `ไฟล์ ${uploadFile.file.name} ถูกอัพโหลดเรียบร้อยแล้ว`
            );
            resolve();
          } else {
            throw new Error(data.error || 'Upload failed');
          }
        } catch (error) {
          setFiles(prev => prev.map(f => 
            f.id === uploadFile.id 
              ? { 
                  ...f, 
                  status: 'error', 
                  error: error instanceof Error ? error.message : 'Upload failed',
                  uploadSpeed: 0,
                  remainingTime: 0
                }
              : f
          ));

          const errorMessage = error instanceof Error ? error.message : 'Upload failed';
          onUploadError?.(errorMessage);
          notifyError('อัพโหลดล้มเหลว', `ไฟล์ ${uploadFile.file.name}: ${errorMessage}`);
          reject(error);
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        const errorMessage = 'Network error occurred during upload';
        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { 
                ...f, 
                status: 'error', 
                error: errorMessage,
                uploadSpeed: 0,
                remainingTime: 0
              }
            : f
        ));

        onUploadError?.(errorMessage);
        notifyError('เครือข่ายขัดข้อง', `ไฟล์ ${uploadFile.file.name}: ${errorMessage}`);
        reject(new Error(errorMessage));
      });

      // Handle abort
      xhr.addEventListener('abort', () => {
        const errorMessage = 'Upload was cancelled';
        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { 
                ...f, 
                status: 'error', 
                error: errorMessage,
                uploadSpeed: 0,
                remainingTime: 0
              }
            : f
        ));

        reject(new Error(errorMessage));
      });

      // Start the upload
      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    });
  };

  const uploadAllFiles = async () => {
    setIsLoading(true);
    const pendingFiles = files.filter(f => f.status === 'pending');
    
    if (pendingFiles.length === 0) {
      setIsLoading(false);
      return;
    }

    notifyInfo(
      'เริ่มต้นการอัพโหลด', 
      `กำลังอัพโหลด ${pendingFiles.length} ไฟล์`
    );

    let successCount = 0;
    let errorCount = 0;

    for (const file of pendingFiles) {
      try {
        await uploadFile(file);
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }
    
    setIsLoading(false);

    // Summary notification
    if (errorCount === 0) {
      notifySuccess(
        'อัพโหลดเสร็จสิ้น', 
        `อัพโหลดสำเร็จ ${successCount} ไฟล์`
      );
    } else if (successCount === 0) {
      notifyError(
        'อัพโหลดล้มเหลว', 
        `อัพโหลดล้มเหลวทั้งหมด ${errorCount} ไฟล์`
      );
    } else {
      notifyInfo(
        'อัพโหลดเสร็จสิ้นบางส่วน', 
        `สำเร็จ ${successCount} ไฟล์, ล้มเหลว ${errorCount} ไฟล์`
      );
    }
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

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond === 0) return '0 B/s';
    return formatBytes(bytesPerSecond) + '/s';
  };

  const formatTime = (seconds: number): string => {
    if (seconds === 0 || !isFinite(seconds)) return '--';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getUploadDetails = (uploadFile: UploadFile) => {
    if (uploadFile.status === 'uploading') {
      return (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{uploadFile.progress}%</span>
            <span>{formatBytes(uploadFile.uploadedBytes || 0)} / {formatBytes(uploadFile.file.size)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{formatSpeed(uploadFile.uploadSpeed || 0)}</span>
            <span>เหลืออีก {formatTime(uploadFile.remainingTime || 0)}</span>
          </div>
        </div>
      );
    }
    return null;
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
            
            {/* Overall upload progress */}
            {isLoading && files.some(f => f.status === 'uploading') && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>รวมความคืบหน้า</span>
                  <span>{Math.round(overallProgress)}%</span>
                </div>
                <Progress value={overallProgress} className="h-2" />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>ความเร็วรวม: {formatSpeed(totalUploadSpeed)}</span>
                  <span>เวลาที่เหลืออีก: {formatTime(estimatedTimeRemaining)}</span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={uploadAllFiles} 
                disabled={isLoading || files.every(f => f.status !== 'pending')}
                size="sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    กำลังอัพโหลด...
                  </>
                ) : (
                  'อัพโหลดทั้งหมด'
                )}
              </Button>
              <Button 
                onClick={clearAllFiles} 
                variant="outline" 
                size="sm"
                disabled={isLoading}
              >
                ล้างทั้งหมด
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {files.map((uploadFile) => (
                <div key={uploadFile.id} className="border rounded-lg p-4 space-y-3">
                  {/* File info header */}
                  <div className="flex items-center gap-3">
                    {getStatusIcon(uploadFile.status)}
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{uploadFile.file.name}</p>
                      <p className="text-xs text-gray-500">
                        {FileValidator.formatFileSize(uploadFile.file.size)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {getStatusBadge(uploadFile.status)}
                      
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

                  {/* Progress bar for uploading files */}
                  {uploadFile.status === 'uploading' && (
                    <div className="space-y-2">
                      <Progress value={uploadFile.progress} className="h-3" />
                      {getUploadDetails(uploadFile)}
                    </div>
                  )}

                  {/* Error message */}
                  {uploadFile.status === 'error' && uploadFile.error && (
                    <div className="bg-red-50 border border-red-200 rounded p-2">
                      <p className="text-xs text-red-600">{uploadFile.error}</p>
                    </div>
                  )}

                  {/* Success message */}
                  {uploadFile.status === 'completed' && (
                    <div className="bg-green-50 border border-green-200 rounded p-2">
                      <p className="text-xs text-green-600">
                        อัพโหลดเสร็จสิ้น - หลักฐาน ID: {uploadFile.evidenceId}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Notifications */}
      <UploadNotifications 
        notifications={notifications} 
        onDismiss={removeNotification}
        enableSound={true}
      />
    </div>
  );
}