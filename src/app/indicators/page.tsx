"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { RoleGuard } from "@/components/auth/role-guard";
import { IndicatorTree } from "@/components/indicators/indicator-tree";
import { ScopeAssignment } from "@/components/indicators/scope-assignment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  TreePine, 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X,
  Loader2,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { UserRole } from "@prisma/client";

interface TreeNode {
  id: string;
  name: string;
  code: string;
  type: "educationLevel" | "standard" | "indicator" | "subIndicator";
  parentId?: string;
  owner?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
}

interface NodeFormData {
  name: string;
  code: string;
  ownerId?: string;
}

export default function IndicatorsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("tree");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<TreeNode | null>(null);
  const [nodeFormData, setNodeFormData] = useState<NodeFormData>({
    name: "",
    code: "",
    ownerId: ""
  });
  const [teachers, setTeachers] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: "" });

  const handleNodeAdd = (parentNode: TreeNode, type: TreeNode["type"]) => {
    setEditingNode({
      id: "",
      name: "",
      code: "",
      type,
      parentId: parentNode.id || undefined
    });
    setNodeFormData({
      name: "",
      code: "",
      ownerId: ""
    });
    setIsEditDialogOpen(true);
    
    // Load teachers if adding sub-indicator
    if (type === "subIndicator") {
      loadTeachers();
    }
  };

  const handleNodeEdit = (node: TreeNode) => {
    setEditingNode(node);
    setNodeFormData({
      name: node.name,
      code: node.code,
      ownerId: node.owner?.id || ""
    });
    setIsEditDialogOpen(true);
    
    // Load teachers if editing sub-indicator
    if (node.type === "subIndicator") {
      loadTeachers();
    }
  };

  const handleNodeDelete = (node: TreeNode) => {
    setEditingNode(node);
    setIsDeleteDialogOpen(true);
  };

  const loadTeachers = async () => {
    try {
      const response = await fetch('/api/users?role=TEACHER');
      const data = await response.json();
      
      if (response.ok) {
        setTeachers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to load teachers:', error);
    }
  };

  const handleSaveNode = async () => {
    if (!editingNode) return;
    
    try {
      setProcessing(true);
      
      const isCreating = !editingNode.id;
      const method = isCreating ? 'POST' : 'PUT';
      const url = '/api/indicator-tree';
      
      const requestData = isCreating ? {
        type: editingNode.type,
        parentId: editingNode.parentId,
        data: {
          name: nodeFormData.name,
          code: nodeFormData.code,
          ownerId: nodeFormData.ownerId || null
        }
      } : {
        type: editingNode.type,
        id: editingNode.id,
        data: {
          name: nodeFormData.name,
          code: nodeFormData.code,
          ownerId: nodeFormData.ownerId || null
        }
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({
          type: 'success',
          message: `Successfully ${isCreating ? 'created' : 'updated'} ${editingNode.type}`
        });
        setIsEditDialogOpen(false);
        setEditingNode(null);
        
        // Refresh tree would be handled by parent component
      } else {
        setStatus({
          type: 'error',
          message: data.error || `Failed to ${isCreating ? 'create' : 'update'} ${editingNode.type}`
        });
      }
    } catch (error) {
      console.error('Node save error:', error);
      setStatus({
        type: 'error',
        message: 'An error occurred while saving. Please try again.'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteNode = async () => {
    if (!editingNode) return;
    
    try {
      setProcessing(true);
      
      const response = await fetch(`/api/indicator-tree?type=${editingNode.type}&id=${editingNode.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok) {
        setStatus({
          type: 'success',
          message: `Successfully deleted ${editingNode.type}`
        });
        setIsDeleteDialogOpen(false);
        setEditingNode(null);
        
        // Refresh tree would be handled by parent component
      } else {
        setStatus({
          type: 'error',
          message: data.error || `Failed to delete ${editingNode.type}`
        });
      }
    } catch (error) {
      console.error('Node deletion error:', error);
      setStatus({
        type: 'error',
        message: 'An error occurred while deleting. Please try again.'
      });
    } finally {
      setProcessing(false);
    }
  };

  const getNodeTypeLabel = (type: TreeNode["type"]) => {
    switch (type) {
      case "educationLevel": return "Education Level";
      case "standard": return "Standard";
      case "indicator": return "Indicator";
      case "subIndicator": return "Sub-Indicator";
    }
  };

  const clearStatus = () => {
    setStatus({ type: null, message: "" });
  };

  return (
    <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.TEACHER, UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR, UserRole.EXECUTIVE]}>
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Indicator Management</h1>
          <p className="text-gray-600">
            Manage the hierarchical structure of education indicators and scope assignments
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

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tree" className="flex items-center gap-2">
              <TreePine className="h-4 w-4" />
              Indicator Tree
            </TabsTrigger>
            <TabsTrigger value="assignments" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Scope Assignments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tree" className="mt-6">
            <IndicatorTree
              onNodeAdd={handleNodeAdd}
              onNodeEdit={handleNodeEdit}
              onNodeDelete={handleNodeDelete}
              showActions={user?.role === UserRole.ADMIN}
              showAssignments={true}
            />
          </TabsContent>

          <TabsContent value="assignments" className="mt-6">
            <ScopeAssignment />
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingNode?.id ? 'Edit' : 'Add'} {editingNode && getNodeTypeLabel(editingNode.type)}
              </DialogTitle>
              <DialogDescription>
                {editingNode?.id 
                  ? `Update the details for this ${getNodeTypeLabel(editingNode.type).toLowerCase()}`
                  : `Create a new ${getNodeTypeLabel(editingNode?.type || 'educationLevel').toLowerCase()}`
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={nodeFormData.code}
                  onChange={(e) => setNodeFormData(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="Enter code"
                />
              </div>

              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={nodeFormData.name}
                  onChange={(e) => setNodeFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter name"
                />
              </div>

              {editingNode?.type === "subIndicator" && (
                <div>
                  <Label htmlFor="owner">Assigned Teacher (Optional)</Label>
                  <Select
                    value={nodeFormData.ownerId}
                    onValueChange={(value) => setNodeFormData(prev => ({ ...prev, ownerId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No assignment</SelectItem>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.name} ({teacher.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={processing}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSaveNode}
                disabled={processing || !nodeFormData.name || !nodeFormData.code}
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {editingNode?.id ? 'Update' : 'Create'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {editingNode && getNodeTypeLabel(editingNode.type)}</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{editingNode?.name}"? This action cannot be undone.
                {editingNode?.type !== "subIndicator" && (
                  <div className="mt-2 text-orange-600">
                    Note: You cannot delete items that have children. Please remove all children first.
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={processing}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteNode}
                disabled={processing}
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
}