"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { FileText, Users, BarChart3, Shield, ArrowRight, LogIn } from "lucide-react";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md mx-auto">
            <h2 className="text-2xl font-bold mb-4">Welcome Back!</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              You are already signed in. Access your dashboard to continue working.
            </p>
            <Button asChild className="w-full">
              <Link href="/dashboard">
                <ArrowRight className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Evidence Management System
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
            Streamline educational quality assurance with our comprehensive
            platform for evidence upload, evaluation, and reporting. Designed
            for IQA and EQA compliance.
          </p>
          <Button asChild size="lg" className="text-lg px-8 py-3">
            <Link href="/auth/signin">
              <LogIn className="mr-2 h-5 w-5" />
              Sign In to Get Started
            </Link>
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <FileText className="h-12 w-12 text-blue-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Evidence Management</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Upload, organize, and version control your educational evidence
              with ease.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <Users className="h-12 w-12 text-green-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Role-Based Access</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Secure access control for Teachers, IQA, EQA, Executives, and
              Admins.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <BarChart3 className="h-12 w-12 text-purple-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Analytics & Reports</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Comprehensive dashboards and export capabilities for stakeholders.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <Shield className="h-12 w-12 text-red-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Quality Assurance</h3>
            <p className="text-gray-600 dark:text-gray-300">
              Built-in evaluation workflows for internal and external quality
              assessment.
            </p>
          </div>
        </div>

        <div className="text-center">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Sign in with your credentials to access the Evidence Management System.
              Contact your administrator if you need an account.
            </p>
            <div className="flex justify-center space-x-4 mb-6">
              <div className="px-4 py-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm">
                ✓ Authentication Ready
              </div>
              <div className="px-4 py-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm">
                ✓ Database Connected
              </div>
              <div className="px-4 py-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm">
                ✓ UI Components Ready
              </div>
            </div>
            <Button asChild variant="outline" size="lg">
              <Link href="/auth/signin">
                Access System
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
