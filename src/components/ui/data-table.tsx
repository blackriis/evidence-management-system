"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  MoreHorizontal,
  Eye,
  Edit,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface DataTableProps {
  title?: string;
  columns: Column[];
  data: any[];
  searchable?: boolean;
  filterable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  onRowClick?: (row: any) => void;
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  onView?: (row: any) => void;
  className?: string;
}

export function DataTable({
  title,
  columns,
  data,
  searchable = true,
  filterable = false,
  pagination = true,
  pageSize = 10,
  onRowClick,
  onEdit,
  onDelete,
  onView,
  className
}: DataTableProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');

  // Filter data based on search term
  const filteredData = React.useMemo(() => {
    if (!searchTerm) return data;
    
    return data.filter(row => 
      Object.values(row).some(value => 
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data, searchTerm]);

  // Sort data
  const sortedData = React.useMemo(() => {
    if (!sortColumn) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortColumn, sortDirection]);

  // Paginate data
  const paginatedData = React.useMemo(() => {
    if (!pagination) return sortedData;
    
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize, pagination]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return (
    <Card className={cn("w-full", className)}>
      {(title || searchable || filterable) && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          {title && (
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          )}
          
          <div className="flex items-center space-x-2">
            {searchable && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            )}
            
            {filterable && (
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            )}
          </div>
        </CardHeader>
      )}
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      "px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider",
                      column.sortable && "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700",
                      column.className
                    )}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{column.label}</span>
                      {column.sortable && sortColumn === column.key && (
                        <span className="text-gray-400">
                          {sortDirection === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
                {(onEdit || onDelete || onView) && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedData.map((row, index) => (
                <tr
                  key={index}
                  className={cn(
                    "hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100",
                        column.className
                      )}
                    >
                      {column.render ? column.render(row[column.key], row) : row[column.key]}
                    </td>
                  ))}
                  {(onEdit || onDelete || onView) && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {onView && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onView(row);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(row);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(row);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {pagination && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} results
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className="w-8 h-8"
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}