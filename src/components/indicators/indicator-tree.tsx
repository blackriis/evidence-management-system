"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  Edit, 
  Trash2, 
  User, 
  FileText,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle,
  FolderOpen,
  Folder
} from "lucide-react";
import { UserRole } from "@/lib/user-role";

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
  children?: TreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
  evidenceCount?: number;
}

interface IndicatorTreeProps {
  onNodeSelect?: (node: TreeNode) => void;
  onNodeEdit?: (node: TreeNode) => void;
  onNodeDelete?: (node: TreeNode) => void;
  onNodeAdd?: (parentNode: TreeNode, type: TreeNode["type"]) => void;
  onAssignmentChange?: (subIndicatorId: string, userId: string | null) => void;
  showAssignments?: boolean;
  showActions?: boolean;
  selectable?: boolean;
  selectedNodeId?: string;
}

export function IndicatorTree({
  onNodeSelect,
  onNodeEdit,
  onNodeDelete,
  onNodeAdd,
  onAssignmentChange,
  showAssignments = false,
  showActions = false,
  selectable = false,
  selectedNodeId
}: IndicatorTreeProps) {
  const { user } = useAuth();
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: "" });

  useEffect(() => {
    loadTree();
  }, []);

  const loadTree = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/indicator-tree?includeAssignments=${showAssignments}`);
      const data = await response.json();

      if (response.ok) {
        const formattedTree = formatTreeData(data.tree);
        setTree(formattedTree);
      } else {
        setStatus({
          type: 'error',
          message: data.error || 'Failed to load indicator tree'
        });
      }
    } catch (error) {
      console.error('Failed to load tree:', error);
      setStatus({
        type: 'error',
        message: 'Failed to load indicator tree. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTreeData = (educationLevels: any[]): TreeNode[] => {
    return educationLevels.map(el => ({
      id: el.id,
      name: el.name,
      code: el.code,
      type: "educationLevel" as const,
      children: el.standards?.map((std: any) => ({
        id: std.id,
        name: std.name,
        code: std.code,
        type: "standard" as const,
        parentId: el.id,
        children: std.indicators?.map((ind: any) => ({
          id: ind.id,
          name: ind.name,
          code: ind.code,
          type: "indicator" as const,
          parentId: std.id,
          children: ind.subIndicators?.map((sub: any) => ({
            id: sub.id,
            name: sub.name,
            code: sub.code,
            type: "subIndicator" as const,
            parentId: ind.id,
            owner: sub.owner,
            evidenceCount: sub.evidence?.length || 0
          }))
        }))
      }))
    }));
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(nodeId)) {
        newExpanded.delete(nodeId);
      } else {
        newExpanded.add(nodeId);
      }
      return newExpanded;
    });
  };

  const handleNodeClick = (node: TreeNode) => {
    if (selectable) {
      onNodeSelect?.(node);
    } else {
      toggleNode(node.id);
    }
  };

  const handleAddNode = (parentNode: TreeNode, type: TreeNode["type"]) => {
    if (onNodeAdd) {
      onNodeAdd(parentNode, type);
    }
  };

  const handleEditNode = (node: TreeNode) => {
    if (onNodeEdit) {
      onNodeEdit(node);
    }
  };

  const handleDeleteNode = (node: TreeNode) => {
    if (onNodeDelete) {
      onNodeDelete(node);
    }
  };

  const filterTree = (nodes: TreeNode[], searchTerm: string): TreeNode[] => {
    if (!searchTerm) return nodes;

    return nodes.reduce((filtered: TreeNode[], node) => {
      const matchesSearch = 
        node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.code.toLowerCase().includes(searchTerm.toLowerCase());

      const filteredChildren = node.children ? filterTree(node.children, searchTerm) : [];

      if (matchesSearch || filteredChildren.length > 0) {
        filtered.push({
          ...node,
          children: filteredChildren
        });
      }

      return filtered;
    }, []);
  };

  const getNodeIcon = (type: TreeNode["type"], isExpanded: boolean) => {
    switch (type) {
      case "educationLevel":
        return isExpanded ? <FolderOpen className="h-4 w-4 text-blue-500" /> : <Folder className="h-4 w-4 text-blue-500" />;
      case "standard":
        return isExpanded ? <FolderOpen className="h-4 w-4 text-green-500" /> : <Folder className="h-4 w-4 text-green-500" />;
      case "indicator":
        return isExpanded ? <FolderOpen className="h-4 w-4 text-orange-500" /> : <Folder className="h-4 w-4 text-orange-500" />;
      case "subIndicator":
        return <FileText className="h-4 w-4 text-purple-500" />;
    }
  };

  const getNextChildType = (type: TreeNode["type"]): TreeNode["type"] | null => {
    switch (type) {
      case "educationLevel": return "standard";
      case "standard": return "indicator";
      case "indicator": return "subIndicator";
      case "subIndicator": return null;
    }
  };

  const renderNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedNodeId === node.id;
    const canExpand = hasChildren && node.type !== "subIndicator";
    const nextChildType = getNextChildType(node.type);

    return (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center gap-2 py-2 px-3 rounded-md hover:bg-gray-50 transition-colors ${
            isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
          }`}
          style={{ marginLeft: `${depth * 16}px` }}
        >
          {/* Expand/Collapse Button */}
          <div className="w-4 h-4 flex items-center justify-center">
            {canExpand && (
              <Button
                variant="ghost"
                size="sm"
                className="w-4 h-4 p-0"
                onClick={() => toggleNode(node.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>

          {/* Node Icon */}
          {getNodeIcon(node.type, isExpanded)}

          {/* Node Content */}
          <div 
            className="flex-1 flex items-center gap-2 cursor-pointer"
            onClick={() => handleNodeClick(node)}
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{node.code}</span>
                <span className="text-gray-600">{node.name}</span>
              </div>
              
              {/* Sub-indicator specific info */}
              {node.type === "subIndicator" && (
                <div className="flex items-center gap-2 mt-1">
                  {showAssignments && node.owner && (
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <User className="h-3 w-3" />
                      <span>{node.owner.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {node.owner.role.replace('_', ' ')}
                      </Badge>
                    </div>
                  )}
                  {showAssignments && !node.owner && (
                    <Badge variant="outline" className="text-xs text-orange-600">
                      Unassigned
                    </Badge>
                  )}
                  {node.evidenceCount !== undefined && (
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <FileText className="h-3 w-3" />
                      <span>{node.evidenceCount} evidence</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          {showActions && user?.role === UserRole.ADMIN && (
            <div className="flex items-center gap-1">
              {nextChildType && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAddNode(node, nextChildType)}
                  className="h-8 w-8 p-0"
                  title={`Add ${nextChildType}`}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEditNode(node)}
                className="h-8 w-8 p-0"
                title="Edit"
              >
                <Edit className="h-3 w-3" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteNode(node)}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Children */}
        {canExpand && isExpanded && hasChildren && (
          <div className="ml-4">
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredTree = filterTree(tree, searchTerm);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading indicator tree...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Indicator Tree
        </CardTitle>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search indicators..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
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
          </Alert>
        )}

        {/* Tree */}
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {filteredTree.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'No indicators match your search.' : 'No indicators found.'}
            </div>
          ) : (
            filteredTree.map(node => renderNode(node))
          )}
        </div>

        {/* Actions */}
        {showActions && user?.role === UserRole.ADMIN && (
          <div className="mt-4 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAddNode({ id: "", name: "", code: "", type: "educationLevel" }, "educationLevel")}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Education Level
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}