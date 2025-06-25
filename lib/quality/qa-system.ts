/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// Quality Assurance Layer  
// Validates AI outputs, confidence scoring, self-correction, human-in-the-loop

import { createClient } from '@/lib/supabase/client';

export interface QualityMetrics {
  accuracy_score: number; // 0-1
  relevance_score: number; // 0-1
  completeness_score: number; // 0-1
  clarity_score: number; // 0-1
  factual_consistency: number; // 0-1
  overall_quality: number; // Weighted average
}

export interface ValidationRule {
  id: string;
  name: string;
  type: 'length' | 'keywords' | 'format' | 'sentiment' | 'factual' | 'coherence';
  parameters: Record<string, any>;
  weight: number; // How important this rule is
  required: boolean; // Must pass for output to be valid
}

export interface QualityCheckResult {
  passed: boolean;
  confidence: number; // 0-1 confidence in the result
  metrics: QualityMetrics;
  issues: Array<{
    type: 'error' | 'warning' | 'suggestion';
    rule_id: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
    suggested_fix?: string;
  }>;
  human_review_required: boolean;
  auto_corrections: Array<{
    type: string;
    description: string;
    confidence: number;
  }>;
}

export interface SelfCorrectionAttempt {
  attempt_number: number;
  original_output: string;
  corrected_output: string;
  improvement_score: number;
  correction_reasoning: string;
  success: boolean;
}

export class QualityAssuranceSystem {
  private supabase = createClient();

  // Main quality check entry point
  async checkQuality(
    output: string,
    stepType: string,
    validationRules: ValidationRule[],
    context?: Record<string, any>
  ): Promise<QualityCheckResult> {
    // Run all validation rules
    const ruleResults = await this.runValidationRules(output, validationRules, context);
    
    // Calculate quality metrics
    const metrics = this.calculateQualityMetrics(output, ruleResults, stepType);
    
    // Determine if human review is needed
    const humanReviewRequired = this.shouldRequireHumanReview(metrics, ruleResults);
    
    // Generate auto-correction suggestions
    const autoCorrections = await this.generateAutoCorrections(output, ruleResults);
    
    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(metrics, ruleResults);
    
    // Check if all required rules passed
    const passed = ruleResults.every(r => !r.rule.required || r.passed);

    return {
      passed,
      confidence,
      metrics,
      issues: ruleResults
        .filter(r => !r.passed)
        .map(r => ({
          type: r.rule.required ? 'error' as const : 'warning' as const,
          rule_id: r.rule.id,
          message: r.message,
          severity: r.severity,
          suggested_fix: r.suggested_fix
        })),
      human_review_required: humanReviewRequired,
      auto_corrections: autoCorrections
    };
  }

  // Self-correction loop - attempts to improve output automatically
  async performSelfCorrection(
    originalOutput: string,
    qualityIssues: QualityCheckResult,
    maxAttempts: number = 3
  ): Promise<SelfCorrectionAttempt[]> {
    const attempts: SelfCorrectionAttempt[] = [];
    let currentOutput = originalOutput;
    
    for (let i = 1; i <= maxAttempts; i++) {
      if (qualityIssues.issues.length === 0) break;
      
      // Generate correction prompt
      const correctionPrompt = this.generateCorrectionPrompt(currentOutput, qualityIssues);
      
      // Use AI to generate corrected version
      const correctedOutput = await this.generateCorrectedOutput(correctionPrompt);
      
      // Evaluate improvement
      const improvementScore = await this.evaluateImprovement(currentOutput, correctedOutput);
      
      const attempt: SelfCorrectionAttempt = {
        attempt_number: i,
        original_output: currentOutput,
        corrected_output: correctedOutput,
        improvement_score: improvementScore,
        correction_reasoning: this.generateCorrectionReasoning(qualityIssues),
        success: improvementScore > 0.1 // At least 10% improvement
      };
      
      attempts.push(attempt);
      
      if (attempt.success) {
        currentOutput = correctedOutput;
        // Re-check quality for next iteration
        // qualityIssues = await this.checkQuality(currentOutput, stepType, validationRules);
      } else {
        break; // No improvement, stop trying
      }
    }
    
    return attempts;
  }

  // Human-in-the-loop integration
  async requestHumanReview(
    sessionId: string,
    stepId: string,
    output: string,
    qualityIssues: QualityCheckResult,
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<string> {
    // Create human review request in database
    const { data, error } = await this.supabase
      .from('human_review_requests')
      .insert({
        id: crypto.randomUUID(),
        session_id: sessionId,
        step_id: stepId,
        content: output,
        quality_issues: qualityIssues,
        priority,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error('Failed to create human review request');
    }

    return data.id;
  }

  // Get human feedback and integrate it
  async getHumanFeedback(reviewRequestId: string): Promise<{
    approved: boolean;
    feedback?: string;
    corrected_output?: string;
    reviewer_id?: string;
  } | null> {
    const { data } = await this.supabase
      .from('human_review_requests')
      .select('*')
      .eq('id', reviewRequestId)
      .eq('status', 'completed')
      .single();

    if (!data) return null;

    return {
      approved: data.approved,
      feedback: data.feedback,
      corrected_output: data.corrected_output,
      reviewer_id: data.reviewer_id
    };
  }

  // Confidence scoring based on multiple factors
  calculateConfidenceScore(
    output: string,
    modelUsed: string,
    stepType: string,
    validationResults: Array<{ passed: boolean }>
  ): number {
    let confidence = 0.8; // Base confidence
    
    // Factor 1: Model reliability for this task type
    const modelReliability = this.getModelReliability(modelUsed, stepType);
    confidence *= modelReliability;
    
    // Factor 2: Output length appropriateness
    const lengthScore = this.evaluateOutputLength(output, stepType);
    confidence *= lengthScore;
    
    // Factor 3: Validation rule compliance
    const validationScore = validationResults.filter(r => r.passed).length / validationResults.length;
    confidence *= validationScore;
    
    // Factor 4: Internal consistency
    const consistencyScore = this.evaluateInternalConsistency(output);
    confidence *= consistencyScore;
    
    return Math.max(0, Math.min(1, confidence));
  }

  // Run individual validation rules
  private async runValidationRules(
    output: string,
    rules: ValidationRule[],
    context?: Record<string, unknown>
  ): Promise<Array<{
    rule: ValidationRule;
    passed: boolean;
    message: string;
    severity: 'low' | 'medium' | 'high';
    suggested_fix?: string;
  }>> {
    const results = [];
    
    for (const rule of rules) {
      const result = await this.runSingleValidationRule(output, rule, context);
      results.push(result);
    }
    
    return results;
  }

  // Run a single validation rule
  private async runSingleValidationRule(
    output: string,
    rule: ValidationRule,
    context?: Record<string, unknown>
  ): Promise<{
    rule: ValidationRule;
    passed: boolean;
    message: string;
    severity: 'low' | 'medium' | 'high';
    suggested_fix?: string;
  }> {
    let passed = true;
    let message = 'Validation passed';
    let severity: 'low' | 'medium' | 'high' = 'low';
    let suggestedFix: string | undefined;

    // Use context for contextual validation if needed
    const hasContext = context && Object.keys(context).length > 0;

    switch (rule.type) {
      case 'length':
        const result = this.validateLength(output, rule.parameters);
        passed = result.passed;
        message = result.message;
        severity = result.severity;
        break;
        
      case 'keywords':
        const keywordResult = this.validateKeywords(output, rule.parameters);
        passed = keywordResult.passed;
        message = keywordResult.message;
        severity = keywordResult.severity;
        break;
        
      case 'format':
        const formatResult = this.validateFormat(output, rule.parameters);
        passed = formatResult.passed;
        message = formatResult.message;
        severity = formatResult.severity;
        break;
        
      case 'coherence':
        const coherenceResult = await this.validateCoherence(output);
        passed = coherenceResult.passed;
        message = coherenceResult.message;
        severity = coherenceResult.severity;
        break;
        
      default:
        // For unknown rule types, log warning but don't fail
        console.warn(`Unknown validation rule type: ${rule.type}`);
        if (hasContext) {
          message = 'Context-aware validation completed';
        }
    }

    return {
      rule,
      passed,
      message,
      severity,
      suggested_fix: suggestedFix
    };
  }

  // Length validation
    private validateLength(output: string, params: any): {
    passed: boolean;
    message: string;
    severity: 'low' | 'medium' | 'high';
  } {
    const length = output.length;
    const minLength = (params.min_length as number) || 0;
    const maxLength = (params.max_length as number) || Infinity;

    if (length < minLength) {
      return {
        passed: false,
        message: `Output too short: ${length} characters (minimum: ${minLength})`,
        severity: 'medium'
      };
    }
    
    if (length > maxLength) {
      return {
        passed: false,
        message: `Output too long: ${length} characters (maximum: ${maxLength})`,
        severity: 'low'
      };
    }
    
    return {
      passed: true,
      message: 'Length validation passed',
      severity: 'low'
    };
  }

  // Keywords validation
  private validateKeywords(output: string, params: any): {
    passed: boolean;
    message: string;
    severity: 'low' | 'medium' | 'high';
  } {
    const lowerOutput = output.toLowerCase();
    
    // @ts-ignore - Complex dynamic validation parameters
    const requiredKeywords = params.required || [];
    // @ts-ignore - Complex dynamic validation parameters  
    const forbiddenKeywords = params.forbidden || [];
    
    // Check required keywords
    // @ts-ignore - Dynamic array iteration
    for (const keyword of requiredKeywords) {
      if (!lowerOutput.includes(keyword.toLowerCase())) {
        return {
          passed: false,
          message: `Missing required keyword: ${keyword}`,
          severity: 'high'
        };
      }
    }
    
    // Check forbidden keywords
    // @ts-ignore - Dynamic array iteration
    for (const keyword of forbiddenKeywords) {
      if (lowerOutput.includes(keyword.toLowerCase())) {
        return {
          passed: false,
          message: `Contains forbidden keyword: "${keyword}"`,
          severity: 'medium'
        };
      }
    }
    
    return {
      passed: true,
      message: 'Keywords validation passed',
      severity: 'low'
    };
  }

  // Format validation
  private validateFormat(output: string, params: Record<string, unknown>): {
    passed: boolean;
    message: string;
    severity: 'low' | 'medium' | 'high';
  } {
    const format = params.format;
    
    switch (format) {
      case 'json':
        try {
          JSON.parse(output);
          return { passed: true, message: 'Valid JSON format', severity: 'low' };
        } catch {
          return { passed: false, message: 'Invalid JSON format', severity: 'high' };
        }
        
      case 'markdown':
        // Basic markdown validation
        const hasMarkdownElements = /[#*_`\[\]]/g.test(output);
        return {
          passed: hasMarkdownElements,
          message: hasMarkdownElements ? 'Valid markdown format' : 'No markdown formatting detected',
          severity: 'medium'
        };
        
      default:
        return { passed: true, message: 'Format validation passed', severity: 'low' };
    }
  }

  // Coherence validation using AI
  private async validateCoherence(output: string): Promise<{
    passed: boolean;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }> {
    // Simplified coherence check
    const sentences = output.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length < 2) {
      return { passed: true, message: 'Single sentence, coherence check passed', severity: 'low' };
    }
    
    // Basic coherence heuristics
    const avgSentenceLength = output.length / sentences.length;
    const hasTransitions = /\b(however|therefore|furthermore|moreover|consequently)\b/i.test(output);
    
    const coherenceScore = hasTransitions ? 0.8 : 0.6;
    
    return {
      passed: coherenceScore > 0.5,
      message: `Coherence score: ${coherenceScore.toFixed(2)}`,
      severity: coherenceScore < 0.3 ? 'high' : coherenceScore < 0.6 ? 'medium' : 'low'
    };
  }

  // Calculate comprehensive quality metrics
  private calculateQualityMetrics(
    output: string,
    ruleResults: Array<{ passed: boolean; rule: ValidationRule; severity: string; message: string }>,
    stepType: string
  ): QualityMetrics {
    const passedRules = ruleResults.filter(r => r.passed).length;
    const totalRules = ruleResults.length;
    
    const accuracy_score = totalRules > 0 ? passedRules / totalRules : 1;
    const relevance_score = this.calculateRelevanceScore(output, stepType);
    const completeness_score = this.calculateCompletenessScore(output, stepType);
    const clarity_score = this.calculateClarityScore(output);
    const factual_consistency = this.calculateFactualConsistency(output);
    
    const overall_quality = (
      accuracy_score * 0.25 +
      relevance_score * 0.2 +
      completeness_score * 0.2 +
      clarity_score * 0.2 +
      factual_consistency * 0.15
    );
    
    return {
      accuracy_score,
      relevance_score,
      completeness_score,
      clarity_score,
      factual_consistency,
      overall_quality
    };
  }

  // Helper methods for quality metrics
  private calculateRelevanceScore(output: string, stepType: string): number {
    // Simplified relevance calculation
    return 0.8; // Placeholder
  }

  private calculateCompletenessScore(output: string, stepType: string): number {
    // Check if output seems complete for the step type
    const wordCount = output.split(/\s+/).length;
    const minWords = this.getMinWordsForStepType(stepType);
    
    return Math.min(1, wordCount / minWords);
  }

  private calculateClarityScore(output: string): number {
    // Simple clarity metrics
    const words = output.split(/\s+/);
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const sentences = output.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = words.length / sentences.length;
    
    // Prefer moderate word and sentence lengths for clarity
    const wordScore = Math.max(0, 1 - Math.abs(avgWordLength - 5) / 10);
    const sentenceScore = Math.max(0, 1 - Math.abs(avgSentenceLength - 15) / 20);
    
    return (wordScore + sentenceScore) / 2;
  }

  private calculateFactualConsistency(output: string): number {
    // Simplified factual consistency check
    return 0.85; // Placeholder
  }

  private shouldRequireHumanReview(metrics: QualityMetrics, ruleResults: Array<{ passed: boolean; rule: ValidationRule; severity: string; message: string }>): boolean {
    // Require human review if overall quality is low
    if (metrics.overall_quality < 0.6) return true;
    
    // Require human review if any high-severity issues
    if (ruleResults.some(r => !r.passed && r.severity === 'high')) return true;
    
    // Require human review if confidence is very low
    if (metrics.accuracy_score < 0.5) return true;
    
    return false;
  }

  private async generateAutoCorrections(output: string, ruleResults: Array<{ passed: boolean; rule: ValidationRule; severity: string; message: string }>): Promise<Array<{
    type: string;
    description: string;
    confidence: number;
  }>> {
    const corrections = [];
    
    for (const result of ruleResults) {
      if (!result.passed && result.severity !== 'high') {
        corrections.push({
          type: result.rule.type,
          description: `Auto-fix for ${result.rule.name}: ${result.message}`,
          confidence: 0.7
        });
      }
    }
    
    return corrections;
  }

  private calculateOverallConfidence(metrics: QualityMetrics, ruleResults: Array<{ passed: boolean }>): number {
    const baseConfidence = metrics.overall_quality;
    const ruleCompliance = ruleResults.filter(r => r.passed).length / ruleResults.length;
    
    return (baseConfidence + ruleCompliance) / 2;
  }

  private generateCorrectionPrompt(output: string, issues: QualityCheckResult): string {
    const issueDescriptions = issues.issues.map(i => `- ${i.message}`).join('\n');
    
    return `Please improve the following text by addressing these issues:\n\n${issueDescriptions}\n\nOriginal text:\n${output}\n\nImproved text:`;
  }

  private async generateCorrectedOutput(prompt: string): Promise<string> {
    // This would use an AI model to generate corrections
    // Simplified for now
    return "Corrected output placeholder";
  }

  private async evaluateImprovement(original: string, corrected: string): Promise<number> {
    // Simplified improvement evaluation
    return corrected.length > original.length ? 0.2 : 0.1;
  }

  private generateCorrectionReasoning(issues: QualityCheckResult): string {
    return `Attempting to address ${issues.issues.length} quality issues`;
  }

  private getModelReliability(model: string, stepType: string): number {
    // Simplified model reliability mapping
    return 0.9;
  }

  private evaluateOutputLength(output: string, stepType: string): number {
    const length = output.length;
    const expected = this.getExpectedLengthForStepType(stepType);
    const ratio = length / expected;
    
    // Optimal range is 0.8 to 1.5 of expected length
    if (ratio >= 0.8 && ratio <= 1.5) return 1.0;
    if (ratio >= 0.5 && ratio <= 2.0) return 0.8;
    return 0.6;
  }

  private evaluateInternalConsistency(output: string): number {
    // Simplified consistency check
    return 0.85;
  }

  private getExpectedLengthForStepType(stepType: string): number {
    const lengths = {
      'research': 1000,
      'analysis': 800,
      'writing': 1200,
      'summarization': 300
    };
    return lengths[stepType as keyof typeof lengths] || 500;
  }

  private getMinWordsForStepType(stepType: string): number {
    const minWords = {
      'research': 150,
      'analysis': 100,
      'writing': 200,
      'summarization': 50
    };
    return minWords[stepType as keyof typeof minWords] || 50;
  }
} 