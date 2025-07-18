"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Download,
  X,
  Loader2,
  Eye,
  Import,
  Users
} from "lucide-react";
import { UserRole } from "@prisma/client";

interface ImportPreview {
  row: number;
  name: string;
  email: string;
  role: UserRole;
  password: string;
  isActive: boolean;
  isDuplicate: boolean;
}

interface ImportError {
  row: number;
  email: string;
  error: string;
}

interface ImportResult {
  success: boolean;
  processed: number;
  created: number;
  errors: ImportError[];
  duplicates: Array<{
    row: number;
    email: string;
    existingId: string;
  }>;
  message: string;
}

interface UserImportProps {
  onStatusChange: (status: { type: 'success' | 'error' | null; message: string }) => void;
  onImportComplete: () => void;
}

export function UserImport({ onStatusChange, onImportComplete }: UserImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<ImportPreview[]>([]);
  const [previewErrors, setPreviewErrors] = useState<ImportError[]>([]);
  const [previewStats, setPreviewStats] = useState({
    totalRows: 0,
    validRows: 0,
    existingUsers: 0
  });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [defaultPassword, setDefaultPassword] = useState("password123");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setShowPreview(false);
      setPreviewData([]);
      setPreviewErrors([]);
      setImportResult(null);
    }
  };

  const handlePreview = async () => {
    if (!file) {
      onStatusChange({
        type: 'error',
        message: 'Please select a file to preview'
      });
      return;
    }

    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/users/import', {
        method: 'PUT',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setPreviewData(data.preview);
        setPreviewErrors(data.errors);
        setPreviewStats({
          totalRows: data.totalRows,
          validRows: data.validRows,
          existingUsers: data.existingUsers
        });
        setShowPreview(true);
        
        onStatusChange({
          type: 'success',
          message: `Preview loaded: ${data.validRows} valid rows, ${data.errors.length} errors`
        });
      } else {
        onStatusChange({
          type: 'error',
          message: data.error || 'Failed to preview file'
        });
      }
    } catch (error) {
      console.error('Preview error:', error);
      onStatusChange({
        type: 'error',
        message: 'Failed to preview file'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    if (!file) {
      onStatusChange({
        type: 'error',
        message: 'Please select a file to import'
      });
      return;
    }

    try {
      setImporting(true);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('defaultPassword', defaultPassword);
      formData.append('skipDuplicates', skipDuplicates.toString());

      const response = await fetch('/api/users/import', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setImportResult(data);
        onStatusChange({
          type: 'success',
          message: data.message
        });
        onImportComplete();
      } else {
        onStatusChange({
          type: 'error',
          message: data.error || 'Failed to import users'
        });
      }
    } catch (error) {
      console.error('Import error:', error);
      onStatusChange({
        type: 'error',
        message: 'Failed to import users'
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "name,email,role,password,isActive\n" +
      "John Doe,john@example.com,TEACHER,password123,true\n" +
      "Jane Smith,jane@example.com,IQA_EVALUATOR,password456,true\n" +
      "Bob Johnson,bob@example.com,EQA_EVALUATOR,password789,false";
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const resetImport = () => {
    setFile(null);
    setShowPreview(false);
    setPreviewData([]);
    setPreviewErrors([]);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN: return 'bg-red-100 text-red-800';
      case UserRole.EXECUTIVE: return 'bg-blue-100 text-blue-800';
      case UserRole.IQA_EVALUATOR: return 'bg-green-100 text-green-800';
      case UserRole.EQA_EVALUATOR: return 'bg-purple-100 text-purple-800';
      case UserRole.TEACHER: return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Users
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-6">
            {/* File Upload */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="file-upload">Select CSV or Excel file</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  ref={fileInputRef}
                  className="mt-1"
                />
                <p className="text-sm text-gray-600 mt-1">
                  Supported formats: CSV, Excel (.xlsx, .xls)
                </p>
              </div>

              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={downloadTemplate}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </Button>
                
                {file && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetImport}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Import Settings */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="default-password">Default Password</Label>
                <Input
                  id="default-password"
                  type="password"
                  value={defaultPassword}
                  onChange={(e) => setDefaultPassword(e.target.value)}
                  placeholder="Default password for users"
                  className="mt-1"
                />
                <p className="text-sm text-gray-600 mt-1">
                  Used when password column is empty or missing
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="skip-duplicates"
                  checked={skipDuplicates}
                  onCheckedChange={(checked) => setSkipDuplicates(!!checked)}
                />
                <Label htmlFor="skip-duplicates">Skip duplicate emails</Label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={handlePreview}
                disabled={!file || uploading}
                variant="outline"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Eye className="h-4 w-4 mr-2" />
                )}
                Preview
              </Button>
              
              <Button
                onClick={handleImport}
                disabled={!file || importing || (!showPreview && previewData.length === 0)}
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Import className="h-4 w-4 mr-2" />
                )}
                Import Users
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Results */}
      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Import Preview
            </CardTitle>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              {/* Preview Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{previewStats.totalRows}</div>
                  <div className="text-sm text-blue-600">Total Rows</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{previewStats.validRows}</div>
                  <div className="text-sm text-green-600">Valid Rows</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{previewStats.existingUsers}</div>
                  <div className="text-sm text-yellow-600">Existing Users</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{previewErrors.length}</div>
                  <div className="text-sm text-red-600">Errors</div>
                </div>
              </div>

              {/* Errors */}
              {previewErrors.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    Errors ({previewErrors.length})
                  </h4>
                  <div className="space-y-2">
                    {previewErrors.slice(0, 10).map((error, index) => (
                      <div key={index} className="bg-red-50 p-3 rounded border-l-4 border-red-400">
                        <p className="text-sm">
                          <strong>Row {error.row}:</strong> {error.email} - {error.error}
                        </p>
                      </div>
                    ))}
                    {previewErrors.length > 10 && (
                      <p className="text-sm text-gray-600">
                        ... and {previewErrors.length - 10} more errors
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Preview Data */}
              {previewData.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Preview Data (first 20 rows)</h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.slice(0, 20).map((row, index) => (
                          <TableRow key={index}>
                            <TableCell>{row.row}</TableCell>
                            <TableCell>{row.name}</TableCell>
                            <TableCell>{row.email}</TableCell>
                            <TableCell>
                              <Badge className={getRoleBadgeColor(row.role)}>
                                {row.role.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={row.isActive ? "default" : "outline"}>
                                {row.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {row.isDuplicate && (
                                <Badge variant="outline" className="text-yellow-600">
                                  Duplicate
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Results */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Import Results
            </CardTitle>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{importResult.processed}</div>
                  <div className="text-sm text-blue-600">Processed</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{importResult.created}</div>
                  <div className="text-sm text-green-600">Created</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{importResult.errors.length}</div>
                  <div className="text-sm text-red-600">Errors</div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Import Errors</h4>
                  <div className="space-y-2">
                    {importResult.errors.map((error, index) => (
                      <div key={index} className="bg-red-50 p-3 rounded border-l-4 border-red-400">
                        <p className="text-sm">
                          <strong>Row {error.row}:</strong> {error.email} - {error.error}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importResult.duplicates.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Skipped Duplicates</h4>
                  <div className="space-y-2">
                    {importResult.duplicates.map((duplicate, index) => (
                      <div key={index} className="bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
                        <p className="text-sm">
                          <strong>Row {duplicate.row}:</strong> {duplicate.email} - Already exists
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={resetImport} className="w-full">
                <Users className="h-4 w-4 mr-2" />
                Import More Users
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}