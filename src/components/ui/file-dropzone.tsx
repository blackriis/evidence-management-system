"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  File, 
  FileText, 
  Image, 
  Video, 
  Music, 
  Archive, 
  X,
  CheckCircle,
  AlertCircle,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FileItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

interface FileDropzoneProps {
  onFilesAdded?: (files: File[]) => void;
  onFileRemoved?: (fileId: string) => void;
  onUpload?: (files: FileItem[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  maxFiles?: number;
  className?: string;
  disabled?: boolean;
  showPreview?: boolean;
  uploadOnDrop?: boolean;
}

export function FileDropzone({
  onFilesAdded,
  onFileRemoved,
  onUpload,
  accept,
  multiple = true,
  maxSize = 10 * 1024 * 1024, // 10MB
  maxFiles = 10,
  className,
  disabled = false,
  showPreview = true,
  uploadOnDrop = false
}: FileDropzoneProps) {
  const [files, setFiles] = React.useState<FileItem[]>([]);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return Image;
    if (mimeType.startsWith('video/')) return Video;
    if (mimeType.startsWith('audio/')) return Music;
    if (mimeType.includes('pdf')) return FileText;
    if (mimeType.includes('zip') || mimeType.includes('rar')) return Archive;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    if (file.size > maxSize) {
      return `File size exceeds ${formatFileSize(maxSize)}`;
    }
    if (accept && !accept.split(',').some(type => file.type.match(type.trim()))) {
      return 'File type not supported';
    }
    return null;
  };

  const handleFilesAdded = (newFiles: File[]) => {
    const validFiles: FileItem[] = [];
    const errors: string[] = [];

    newFiles.forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push({
          id: `${Date.now()}-${Math.random()}`,
          file,
          progress: 0,
          status: 'pending'
        });
      }
    });

    if (files.length + validFiles.length > maxFiles) {
      errors.push(`Maximum ${maxFiles} files allowed`);
      return;
    }

    setFiles(prev => [...prev, ...validFiles]);
    onFilesAdded?.(validFiles.map(f => f.file));

    if (uploadOnDrop && validFiles.length > 0) {
      handleUpload(validFiles);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFilesAdded(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    handleFilesAdded(selectedFiles);
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    onFileRemoved?.(fileId);
  };

  const handleUpload = async (filesToUpload?: FileItem[]) => {
    const targetFiles = filesToUpload || files.filter(f => f.status === 'pending');
    if (targetFiles.length === 0) return;

    setIsUploading(true);
    onUpload?.(targetFiles);
    
    // Simulate upload progress
    for (const file of targetFiles) {
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, status: 'uploading' } : f
      ));
      
      // Simulate progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, progress } : f
        ));
      }
      
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, status: 'completed', progress: 100 } : f
      ));
    }
    
    setIsUploading(false);
  };

  const clearAll = () => {
    setFiles([]);
  };

  const getStatusIcon = (status: FileItem['status']) => {
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

  return (
    <div className={cn("space-y-4", className)}>
      {/* Dropzone */}
      <Card className={cn(
        "border-2 border-dashed transition-colors",
        isDragOver ? "border-primary bg-primary/5" : "border-gray-300 hover:border-gray-400",
        disabled && "opacity-50 cursor-not-allowed"
      )}>
        <CardContent className="p-8">
          <div
            className="text-center cursor-pointer"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !disabled && fileInputRef.current?.click()}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">
              {isDragOver ? 'Drop files here' : 'Choose files or drag them here'}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {accept ? `Accepted formats: ${accept}` : 'All file types accepted'}
            </p>
            <p className="text-xs text-gray-400">
              Maximum file size: {formatFileSize(maxSize)} • Maximum files: {maxFiles}
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple={multiple}
              accept={accept}
              onChange={handleFileSelect}
              className="hidden"
              disabled={disabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && showPreview && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Files ({files.length})</h3>
              <div className="flex space-x-2">
                {!uploadOnDrop && (
                  <Button
                    onClick={() => handleUpload()}
                    disabled={isUploading || files.every(f => f.status !== 'pending')}
                    size="sm"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload All
                      </>
                    )}
                  </Button>
                )}
                <Button
                  onClick={clearAll}
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                >
                  Clear All
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {files.map((fileItem) => {
                const Icon = getFileIcon(fileItem.file.type);
                return (
                  <div
                    key={fileItem.id}
                    className="flex items-center space-x-3 p-3 border rounded-lg"
                  >
                    <Icon className="h-8 w-8 text-gray-400" />
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {fileItem.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(fileItem.file.size)}
                      </p>
                      
                      {fileItem.status === 'uploading' && (
                        <div className="mt-2">
                          <Progress value={fileItem.progress} className="h-2" />
                        </div>
                      )}
                      
                      {fileItem.error && (
                        <p className="text-xs text-red-500 mt-1">{fileItem.error}</p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {getStatusIcon(fileItem.status)}
                      <Badge variant={
                        fileItem.status === 'completed' ? 'default' :
                        fileItem.status === 'error' ? 'destructive' :
                        fileItem.status === 'uploading' ? 'secondary' : 'outline'
                      }>
                        {fileItem.status}
                      </Badge>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(fileItem.id)}
                        disabled={fileItem.status === 'uploading'}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}