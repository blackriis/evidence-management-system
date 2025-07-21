"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  Star, 
  StarHalf, 
  Save, 
  Edit, 
  Trash2, 
  FileText, 
  User,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle,
  BarChart3
} from "lucide-react";
import { EVALUATION_SCORES } from "@/lib/constants";
import { UserRole } from "@/lib/user-role";

interface Evidence {
  id: string;
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploader: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
  academicYear: {
    id: string;
    name: string;
    evaluationWindowOpen: boolean;
  };
  subIndicator: {
    id: string;
    name: string;
    code: string;
    indicator: {
      name: string;
      code: string;
      standard: {
        name: string;
        code: string;
        educationLevel: {
          name: string;
          code: string;
        };
      };
    };
  };
}

interface Evaluation {
  id: string;
  qualitativeScore: number | null;
  quantitativeScore: number | null;
  comments: string | null;
  evaluatedAt: string;
  evaluator: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
}

interface EvaluationFormProps {
  evidence: Evidence;
  existingEvaluation?: Evaluation;
  onEvaluationSubmit?: (evaluation: Evaluation) => void;
  onEvaluationDelete?: () => void;
  readOnly?: boolean;
}

export function EvaluationForm({ 
  evidence, 
  existingEvaluation, 
  onEvaluationSubmit, 
  onEvaluationDelete,
  readOnly = false 
}: EvaluationFormProps) {
  const { user } = useAuth();
  const [qualitativeScore, setQualitativeScore] = useState<number | null>(
    existingEvaluation?.qualitativeScore ?? null
  );
  const [quantitativeScore, setQuantitativeScore] = useState<number | null>(
    existingEvaluation?.quantitativeScore ?? null
  );
  const [comments, setComments] = useState<string>(
    existingEvaluation?.comments ?? ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: "" });

  const canEvaluate = user && [UserRole.IQA_EVALUATOR, UserRole.EQA_EVALUATOR, UserRole.ADMIN].includes(user.role);
  const canEdit = !readOnly && canEvaluate && evidence.academicYear.evaluationWindowOpen;
  const isOwnEvaluation = existingEvaluation?.evaluator.id === user?.id;

  const validateForm = (): boolean => {
    if (qualitativeScore === null && quantitativeScore === null) {
      setStatus({
        type: 'error',
        message: 'At least one score (qualitative or quantitative) must be provided'
      });
      return false;
    }

    if (qualitativeScore !== null && 
        (qualitativeScore < EVALUATION_SCORES.QUALITATIVE_MIN || 
         qualitativeScore > EVALUATION_SCORES.QUALITATIVE_MAX)) {
      setStatus({
        type: 'error',
        message: `Qualitative score must be between ${EVALUATION_SCORES.QUALITATIVE_MIN} and ${EVALUATION_SCORES.QUALITATIVE_MAX}`
      });
      return false;
    }

    if (quantitativeScore !== null && 
        (quantitativeScore < EVALUATION_SCORES.QUANTITATIVE_MIN || 
         quantitativeScore > EVALUATION_SCORES.QUANTITATIVE_MAX)) {
      setStatus({
        type: 'error',
        message: `Quantitative score must be between ${EVALUATION_SCORES.QUANTITATIVE_MIN} and ${EVALUATION_SCORES.QUANTITATIVE_MAX}`
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);
      setStatus({ type: null, message: "" });

      const method = existingEvaluation ? 'PUT' : 'POST';
      const url = '/api/evaluations';
      
      const requestData = existingEvaluation ? {
        id: existingEvaluation.id,
        qualitativeScore,
        quantitativeScore,
        comments: comments || null
      } : {
        evidenceId: evidence.id,
        qualitativeScore,
        quantitativeScore,
        comments: comments || null
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
          message: `Evaluation ${data.action || (existingEvaluation ? 'updated' : 'submitted')} successfully`
        });
        
        onEvaluationSubmit?.(data.evaluation);
      } else {
        setStatus({
          type: 'error',
          message: data.error || 'Failed to submit evaluation'
        });
      }
    } catch (error) {
      console.error('Evaluation submission error:', error);
      setStatus({
        type: 'error',
        message: 'An error occurred while submitting evaluation. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingEvaluation) return;

    if (!confirm('Are you sure you want to delete this evaluation? This action cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(true);
      
      const response = await fetch(`/api/evaluations?id=${existingEvaluation.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setStatus({
          type: 'success',
          message: 'Evaluation deleted successfully'
        });
        
        onEvaluationDelete?.();
      } else {
        const data = await response.json();
        setStatus({
          type: 'error',
          message: data.error || 'Failed to delete evaluation'
        });
      }
    } catch (error) {
      console.error('Evaluation deletion error:', error);
      setStatus({
        type: 'error',
        message: 'An error occurred while deleting evaluation. Please try again.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const renderStars = (score: number | null, max: number = 5) => {
    if (score === null) return null;

    const stars = [];
    for (let i = 1; i <= max; i++) {
      if (i <= score) {
        stars.push(<Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />);
      } else if (i - 0.5 <= score) {
        stars.push(<StarHalf key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />);
      } else {
        stars.push(<Star key={i} className="h-4 w-4 text-gray-300" />);
      }
    }
    return <div className="flex">{stars}</div>;
  };

  const clearStatus = () => {
    setStatus({ type: null, message: "" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {existingEvaluation ? 'Edit Evaluation' : 'Evaluate Evidence'}
        </CardTitle>
        
        {/* Evidence Info */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-500" />
            <span className="font-medium">{evidence.originalName}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-500" />
            <span className="text-sm">Uploaded by {evidence.uploader.name}</span>
            <Badge variant="outline" className="text-xs">
              {evidence.uploader.role.replace('_', ' ')}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-sm">
              {new Date(evidence.uploadedAt).toLocaleDateString()}
            </span>
          </div>
          
          <div className="text-sm text-gray-600">
            <p><strong>Sub-Indicator:</strong> {evidence.subIndicator.code} - {evidence.subIndicator.name}</p>
            <p><strong>Indicator:</strong> {evidence.subIndicator.indicator.code} - {evidence.subIndicator.indicator.name}</p>
            <p><strong>Standard:</strong> {evidence.subIndicator.indicator.standard.code} - {evidence.subIndicator.indicator.standard.name}</p>
          </div>
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

        {/* Access Control Messages */}
        {!canEvaluate && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You don't have permission to evaluate evidence.
            </AlertDescription>
          </Alert>
        )}

        {canEvaluate && !evidence.academicYear.evaluationWindowOpen && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Evaluation window is not open for {evidence.academicYear.name}.
            </AlertDescription>
          </Alert>
        )}

        {/* Existing Evaluation Info */}
        {existingEvaluation && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-blue-600" />
              <span className="font-medium">Evaluated by {existingEvaluation.evaluator.name}</span>
              <Badge variant="outline" className="text-xs">
                {existingEvaluation.evaluator.role.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>{new Date(existingEvaluation.evaluatedAt).toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Evaluation Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Qualitative Score */}
          <div>
            <Label className="text-base font-medium">
              Qualitative Score (1-5 scale)
              {qualitativeScore !== null && (
                <span className="ml-2 text-sm text-gray-500">
                  Current: {qualitativeScore}/5
                </span>
              )}
            </Label>
            
            <div className="mt-2 space-y-3">
              {/* Stars Display */}
              {qualitativeScore !== null && (
                <div className="flex items-center gap-2">
                  {renderStars(qualitativeScore)}
                  <span className="text-sm text-gray-600">({qualitativeScore}/5)</span>
                </div>
              )}
              
              {/* Slider */}
              {canEdit && (
                <div className="space-y-2">
                  <Slider
                    value={qualitativeScore !== null ? [qualitativeScore] : [3]}
                    onValueChange={(value) => setQualitativeScore(value[0])}
                    max={EVALUATION_SCORES.QUALITATIVE_MAX}
                    min={EVALUATION_SCORES.QUALITATIVE_MIN}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Poor (1)</span>
                    <span>Fair (2)</span>
                    <span>Good (3)</span>
                    <span>Very Good (4)</span>
                    <span>Excellent (5)</span>
                  </div>
                </div>
              )}
              
              {canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQualitativeScore(null)}
                  disabled={qualitativeScore === null}
                >
                  Clear Qualitative Score
                </Button>
              )}
            </div>
          </div>

          {/* Quantitative Score */}
          <div>
            <Label className="text-base font-medium">
              Quantitative Score (0-100%)
              {quantitativeScore !== null && (
                <span className="ml-2 text-sm text-gray-500">
                  Current: {quantitativeScore}%
                </span>
              )}
            </Label>
            
            <div className="mt-2 space-y-3">
              {/* Input Field */}
              {canEdit ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={EVALUATION_SCORES.QUANTITATIVE_MIN}
                    max={EVALUATION_SCORES.QUANTITATIVE_MAX}
                    value={quantitativeScore ?? ""}
                    onChange={(e) => {
                      const value = e.target.value === "" ? null : parseInt(e.target.value);
                      setQuantitativeScore(value);
                    }}
                    placeholder="Enter percentage (0-100)"
                    className="max-w-xs"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              ) : (
                quantitativeScore !== null && (
                  <div className="text-lg font-medium">
                    {quantitativeScore}%
                  </div>
                )
              )}
              
              {canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuantitativeScore(null)}
                  disabled={quantitativeScore === null}
                >
                  Clear Quantitative Score
                </Button>
              )}
            </div>
          </div>

          {/* Comments */}
          <div>
            <Label htmlFor="comments" className="text-base font-medium">
              Comments
            </Label>
            <Textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add evaluation comments (optional)"
              rows={4}
              disabled={!canEdit}
              className="mt-2"
            />
          </div>

          {/* Actions */}
          {canEdit && (
            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting || (qualitativeScore === null && quantitativeScore === null)}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : existingEvaluation ? (
                  <Edit className="h-4 w-4 mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {existingEvaluation ? 'Update Evaluation' : 'Submit Evaluation'}
              </Button>
              
              {existingEvaluation && (isOwnEvaluation || user?.role === UserRole.ADMIN) && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete
                </Button>
              )}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}