"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Users, 
  UserPlus, 
  Edit2, 
  Trash2, 
  Search, 
  Filter,
  MoreHorizontal,
  Check,
  X,
  Loader2,
  Key,
  Mail,
  User
} from "lucide-react";
import { UserRole } from "@prisma/client";

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  ownedSubIndicators: Array<{
    id: string;
    name: string;
    code: string;
  }>;
  _count: {
    evidence: number;
    evaluations: number;
  };
}

interface UserManagementProps {
  onStatusChange: (status: { type: 'success' | 'error' | null; message: string }) => void;
}

export function UserManagement({ onStatusChange }: UserManagementProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">(""); 
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [processingBulk, setProcessingBulk] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: UserRole.TEACHER,
    isActive: true
  });

  useEffect(() => {
    loadUsers();
  }, [search, roleFilter, statusFilter, currentPage]);

  const loadUsers = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20"
      });
      
      if (search) params.append("search", search);
      if (roleFilter) params.append("role", roleFilter);
      if (statusFilter !== "all") {
        params.append("isActive", statusFilter === "active" ? "true" : "false");
      }

      const response = await fetch(`/api/users?${params}`);
      const data = await response.json();

      if (response.ok) {
        setUsers(data.users);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.total);
      } else {
        onStatusChange({
          type: 'error',
          message: data.error || 'Failed to load users'
        });
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      onStatusChange({
        type: 'error',
        message: 'Failed to load users'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      if (!formData.name || !formData.email || !formData.password) {
        onStatusChange({
          type: 'error',
          message: 'Please fill in all required fields'
        });
        return;
      }

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        onStatusChange({
          type: 'success',
          message: 'User created successfully'
        });
        setShowCreateDialog(false);
        setFormData({
          name: "",
          email: "",
          password: "",
          role: UserRole.TEACHER,
          isActive: true
        });
        loadUsers();
      } else {
        onStatusChange({
          type: 'error',
          message: data.error || 'Failed to create user'
        });
      }
    } catch (error) {
      console.error('Failed to create user:', error);
      onStatusChange({
        type: 'error',
        message: 'Failed to create user'
      });
    }
  };

  const handleUpdateUser = async () => {
    try {
      if (!editingUser) return;

      const updateData: any = {
        userId: editingUser.id,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        isActive: formData.isActive
      };

      if (formData.password) {
        updateData.password = formData.password;
      }

      const response = await fetch('/api/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      const data = await response.json();

      if (response.ok) {
        onStatusChange({
          type: 'success',
          message: 'User updated successfully'
        });
        setEditingUser(null);
        setFormData({
          name: "",
          email: "",
          password: "",
          role: UserRole.TEACHER,
          isActive: true
        });
        loadUsers();
      } else {
        onStatusChange({
          type: 'error',
          message: data.error || 'Failed to update user'
        });
      }
    } catch (error) {
      console.error('Failed to update user:', error);
      onStatusChange({
        type: 'error',
        message: 'Failed to update user'
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/users?userId=${userId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok) {
        onStatusChange({
          type: 'success',
          message: 'User deleted successfully'
        });
        loadUsers();
      } else {
        onStatusChange({
          type: 'error',
          message: data.error || 'Failed to delete user'
        });
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      onStatusChange({
        type: 'error',
        message: 'Failed to delete user'
      });
    }
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedUsers.size === 0) {
      onStatusChange({
        type: 'error',
        message: 'Please select at least one user'
      });
      return;
    }

    try {
      setProcessingBulk(true);

      const promises = Array.from(selectedUsers).map(userId => {
        if (action === 'delete') {
          return fetch(`/api/users?userId=${userId}`, { method: 'DELETE' });
        } else {
          return fetch('/api/users', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              isActive: action === 'activate'
            })
          });
        }
      });

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.ok).length;

      if (successCount === selectedUsers.size) {
        onStatusChange({
          type: 'success',
          message: `Successfully ${action}d ${successCount} users`
        });
      } else {
        onStatusChange({
          type: 'error',
          message: `${action} completed with some errors. ${successCount}/${selectedUsers.size} successful`
        });
      }

      setSelectedUsers(new Set());
      loadUsers();
    } catch (error) {
      console.error(`Bulk ${action} error:`, error);
      onStatusChange({
        type: 'error',
        message: `Failed to ${action} users`
      });
    } finally {
      setProcessingBulk(false);
    }
  };

  const startEditing = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      isActive: user.isActive
    });
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const selectAllUsers = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)));
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

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading users...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
            </div>
            
            <Select value={roleFilter} onValueChange={(value: any) => setRoleFilter(value)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {Object.values(UserRole).map(role => (
                  <SelectItem key={role} value={role}>
                    {role.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Enter user name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="Enter email address"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      placeholder="Enter password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select value={formData.role} onValueChange={(value: any) => setFormData({...formData, role: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(UserRole).map(role => (
                          <SelectItem key={role} value={role}>
                            {role.replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="isActive"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData({...formData, isActive: !!checked})}
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleCreateUser} className="flex-1">
                      Create User
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Bulk Actions */}
          {selectedUsers.size > 0 && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 rounded-lg">
              <Badge variant="outline">{selectedUsers.size} selected</Badge>
              <Button
                size="sm"
                onClick={() => handleBulkAction('activate')}
                disabled={processingBulk}
              >
                {processingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Activate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction('deactivate')}
                disabled={processingBulk}
              >
                {processingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                Deactivate
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleBulkAction('delete')}
                disabled={processingBulk}
              >
                {processingBulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </Button>
            </div>
          )}

          {/* Users Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedUsers.size === users.length && users.length > 0}
                      onCheckedChange={selectAllUsers}
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedUsers.has(user.id)}
                        onCheckedChange={() => toggleUserSelection(user.id)}
                      />
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {user.role.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant={user.isActive ? "default" : "outline"}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm">
                        <p>{user._count.evidence} evidence</p>
                        <p>{user._count.evaluations} evaluations</p>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm text-gray-600">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEditing(user)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">
              Showing {users.length} of {totalCount} users
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="edit-password">Password (leave blank to keep current)</Label>
              <Input
                id="edit-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="Enter new password"
              />
            </div>
            <div>
              <Label htmlFor="edit-role">Role</Label>
              <Select value={formData.role} onValueChange={(value: any) => setFormData({...formData, role: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(UserRole).map(role => (
                    <SelectItem key={role} value={role}>
                      {role.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="edit-isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({...formData, isActive: !!checked})}
              />
              <Label htmlFor="edit-isActive">Active</Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleUpdateUser} className="flex-1">
                Update User
              </Button>
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}