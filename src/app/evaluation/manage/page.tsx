"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { RoleGuard } from "@/components/auth/role-guard";
import { EvaluatorAssignments } from "@/components/evaluation/evaluator-assignments";
import { EvaluationList } from "@/components/evaluation/evaluation-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  UserCheck, 
  BarChart3, 
  Settings,
  AlertCircle
} from "lucide-react";
import { UserRole } from "@/lib/user-role";

export default function EvaluationManagePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("assignments");

  return (
    <RoleGuard allowedRoles={[UserRole.ADMIN]}>
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Evaluation Management</h1>
          <p className="text-gray-600">
            Manage evaluator assignments and monitor evaluation progress
          </p>
        </div>

        {user?.role !== UserRole.ADMIN ? (
          <Card>
            <CardContent className="p-8">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You don't have permission to access evaluation management.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="assignments" className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Evaluator Assignments
              </TabsTrigger>
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Evaluation Overview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="assignments" className="mt-6">
              <EvaluatorAssignments />
            </TabsContent>

            <TabsContent value="overview" className="mt-6">
              <EvaluationList />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </RoleGuard>
  );
}