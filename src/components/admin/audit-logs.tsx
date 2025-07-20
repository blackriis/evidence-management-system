'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Search, Filter, Download, Trash2, Eye, Calendar, User, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  oldValues: any;
  newValues: any;
  metadata: any;
  timestamp: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

interface AuditLogsResponse {
  auditLogs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  LOGIN: 'bg-purple-100 text-purple-800',
  LOGOUT: 'bg-gray-100 text-gray-800',
  UPLOAD: 'bg-orange-100 text-orange-800',
  DOWNLOAD: 'bg-cyan-100 text-cyan-800',
  EVALUATE: 'bg-yellow-100 text-yellow-800',
  ASSIGN: 'bg-indigo-100 text-indigo-800',
  RESTORE: 'bg-emerald-100 text-emerald-800',
  EXPORT: 'bg-pink-100 text-pink-800',
  IMPORT: 'bg-violet-100 text-violet-800',
  SYSTEM_CONFIG: 'bg-amber-100 text-amber-800',
};

const actionLabels: Record<string, string> = {
  CREATE: 'สร้าง',
  UPDATE: 'แก้ไข',
  DELETE: 'ลบ',
  LOGIN: 'เข้าสู่ระบบ',
  LOGOUT: 'ออกจากระบบ',
  UPLOAD: 'อัปโหลด',
  DOWNLOAD: 'ดาวน์โหลด',
  EVALUATE: 'ประเมิน',
  ASSIGN: 'มอบหมาย',
  RESTORE: 'กู้คืน',
  EXPORT: 'ส่งออก',
  IMPORT: 'นำเข้า',
  SYSTEM_CONFIG: 'ตั้งค่าระบบ',
};

const resourceLabels: Record<string, string> = {
  evidence: 'หลักฐาน',
  evaluation: 'การประเมิน',
  user: 'ผู้ใช้',
  auth: 'การยืนยันตัวตน',
  audit_logs: 'บันทึกการตรวจสอบ',
  academic_year: 'ปีการศึกษา',
  indicator: 'ตัวชี้วัด',
  sub_indicator: 'ตัวชี้วัดย่อย',
};

export default function AuditLogs() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  // Filters
  const [filters, setFilters] = useState({
    userId: '',
    action: '',
    resource: '',
    startDate: '',
    endDate: '',
    search: '',
  });

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    fetchAuditLogs();
  }, [pagination.page, pagination.limit]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.action && { action: filters.action }),
        ...(filters.resource && { resource: filters.resource }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      });

      const response = await fetch(`/api/audit-logs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch audit logs');

      const data: AuditLogsResponse = await response.json();
      setAuditLogs(data.auditLogs);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchAuditLogs();
  };

  const clearFilters = () => {
    setFilters({
      userId: '',
      action: '',
      resource: '',
      startDate: '',
      endDate: '',
      search: '',
    });
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchAuditLogs();
  };

  const exportAuditLogs = async () => {
    try {
      const params = new URLSearchParams({
        ...filters,
        export: 'true',
      });

      const response = await fetch(`/api/audit-logs/export?${params}`);
      if (!response.ok) throw new Error('Failed to export audit logs');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting audit logs:', error);
    }
  };

  const cleanupOldLogs = async () => {
    if (!confirm('คุณต้องการลบบันทึกการตรวจสอบที่เก่ากว่า 7 ปีหรือไม่?')) {
      return;
    }

    try {
      const response = await fetch('/api/audit-logs?retentionDays=2555', {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to cleanup audit logs');

      const result = await response.json();
      alert(`ลบบันทึกการตรวจสอบจำนวน ${result.deletedCount} รายการเรียบร้อยแล้ว`);
      fetchAuditLogs();
    } catch (error) {
      console.error('Error cleaning up audit logs:', error);
      alert('เกิดข้อผิดพลาดในการลบบันทึกการตรวจสอบ');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">บันทึกการตรวจสอบ (Audit Logs)</h1>
        <div className="flex gap-2">
          <Button onClick={exportAuditLogs} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            ส่งออก
          </Button>
          <Button onClick={cleanupOldLogs} variant="outline" className="text-red-600">
            <Trash2 className="h-4 w-4 mr-2" />
            ลบข้อมูลเก่า
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            ตัวกรอง
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <Label htmlFor="action">การกระทำ</Label>
              <Select value={filters.action} onValueChange={(value) => handleFilterChange('action', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกการกระทำ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">ทั้งหมด</SelectItem>
                  {Object.entries(actionLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="resource">ทรัพยากร</Label>
              <Select value={filters.resource} onValueChange={(value) => handleFilterChange('resource', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกทรัพยากร" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">ทั้งหมด</SelectItem>
                  {Object.entries(resourceLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="startDate">วันที่เริ่มต้น</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="endDate">วันที่สิ้นสุด</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="userId">รหัสผู้ใช้</Label>
              <Input
                id="userId"
                placeholder="รหัสผู้ใช้"
                value={filters.userId}
                onChange={(e) => handleFilterChange('userId', e.target.value)}
              />
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={applyFilters} className="flex-1">
                <Search className="h-4 w-4 mr-2" />
                ค้นหา
              </Button>
              <Button onClick={clearFilters} variant="outline">
                ล้าง
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>บันทึกการตรวจสอบ ({pagination.total} รายการ)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่/เวลา</TableHead>
                    <TableHead>ผู้ใช้</TableHead>
                    <TableHead>การกระทำ</TableHead>
                    <TableHead>ทรัพยากร</TableHead>
                    <TableHead>รายละเอียด</TableHead>
                    <TableHead>การดำเนินการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <div>
                            <div className="font-medium">
                              {format(new Date(log.timestamp), 'dd/MM/yyyy', { locale: th })}
                            </div>
                            <div className="text-sm text-gray-500">
                              {format(new Date(log.timestamp), 'HH:mm:ss')}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.user ? (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-500" />
                            <div>
                              <div className="font-medium">{log.user.name}</div>
                              <div className="text-sm text-gray-500">{log.user.email}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500">ระบบ</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={actionColors[log.action] || 'bg-gray-100 text-gray-800'}>
                          {actionLabels[log.action] || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-gray-500" />
                          {resourceLabels[log.resource] || log.resource}
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.resourceId && (
                          <div className="text-sm text-gray-600">
                            ID: {log.resourceId.substring(0, 8)}...
                          </div>
                        )}
                        {log.metadata?.method && (
                          <div className="text-sm text-gray-500">
                            {log.metadata.method}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>รายละเอียดบันทึกการตรวจสอบ</DialogTitle>
                            </DialogHeader>
                            {selectedLog && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>วันที่/เวลา</Label>
                                    <p className="text-sm">
                                      {format(new Date(selectedLog.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: th })}
                                    </p>
                                  </div>
                                  <div>
                                    <Label>ผู้ใช้</Label>
                                    <p className="text-sm">
                                      {selectedLog.user ? `${selectedLog.user.name} (${selectedLog.user.email})` : 'ระบบ'}
                                    </p>
                                  </div>
                                  <div>
                                    <Label>การกระทำ</Label>
                                    <Badge className={actionColors[selectedLog.action] || 'bg-gray-100 text-gray-800'}>
                                      {actionLabels[selectedLog.action] || selectedLog.action}
                                    </Badge>
                                  </div>
                                  <div>
                                    <Label>ทรัพยากร</Label>
                                    <p className="text-sm">{resourceLabels[selectedLog.resource] || selectedLog.resource}</p>
                                  </div>
                                </div>

                                <Separator />

                                {selectedLog.oldValues && (
                                  <div>
                                    <Label>ค่าเดิม</Label>
                                    <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                                      {JSON.stringify(selectedLog.oldValues, null, 2)}
                                    </pre>
                                  </div>
                                )}

                                {selectedLog.newValues && (
                                  <div>
                                    <Label>ค่าใหม่</Label>
                                    <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                                      {JSON.stringify(selectedLog.newValues, null, 2)}
                                    </pre>
                                  </div>
                                )}

                                {selectedLog.metadata && (
                                  <div>
                                    <Label>ข้อมูลเพิ่มเติม</Label>
                                    <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                                      {JSON.stringify(selectedLog.metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-500">
                  แสดง {((pagination.page - 1) * pagination.limit) + 1} ถึง{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} จาก {pagination.total} รายการ
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  >
                    ก่อนหน้า
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  >
                    ถัดไป
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}