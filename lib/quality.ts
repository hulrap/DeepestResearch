/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// Quality Assurance Layer
// Validates AI outputs, confidence scoring, self-correction, human-in-the-loop

import { createClient } from '@/lib/supabase/client';

export interface QualityMetrics {
  accuracy_score: number; // 0-1
  relevance_score: number; // 0-1
  completeness_score: number; // 0-1
  clarity_score: number; // 0-1
  overall_quality: number; // Weighted average
}

export interface ValidationRule {
  id: string;
  name: string;
  type: 'length' | 'keywords' | 'format' | 'coherence';
  parameters: Record<string, any>;
  weight: number;
  required: boolean;
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
  }>;
  human_review_required: boolean;
}

export class QualityAssuranceSystem {
  private supabase = createClient();

  // Main quality check entry point
  async checkQuality(
    output: string,
    stepType: string,
    validationRules: ValidationRule[]
  ): Promise<QualityCheckResult> {
    // Run all validation rules
    const ruleResults = await this.runValidationRules(output, validationRules);
    
    // Calculate quality metrics
    const metrics = this.calculateQualityMetrics(output, ruleResults, stepType);
    
    // Determine if human review is needed
    const humanReviewRequired = this.shouldRequireHumanReview(metrics, ruleResults);
    
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
          severity: r.severity
        })),
      human_review_required: humanReviewRequired
    };
  }

  // Human-in-the-loop integration
  async requestHumanReview(
    sessionId: string,
    stepId: string,
    output: string,
    qualityIssues: QualityCheckResult,
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<string> {
    // Create human review request
    const reviewId = crypto.randomUUID();
    
    // In a real implementation, this would notify human reviewers
    console.log(`Human review requested for session ${sessionId}, step ${stepId}`);
    
    return reviewId;
  }

  // Confidence scoring based on multiple factors
  calculateConfidenceScore(
    output: string,
    modelUsed: string,
    stepType: string,
    validationResults: any[]
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
    
    return Math.max(0, Math.min(1, confidence));
  }

  // Run validation rules
  private async runValidationRules(
    output: string,
    rules: ValidationRule[]
  ): Promise<Array<{
    rule: ValidationRule;
    passed: boolean;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>> {
    const results = [];
    
    for (const rule of rules) {
      const result = await this.runSingleValidationRule(output, rule);
      results.push(result);
    }
    
    return results;
  }

  // Run a single validation rule
  private async runSingleValidationRule(
    output: string,
    rule: ValidationRule
  ): Promise<{
    rule: ValidationRule;
    passed: boolean;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }> {
    let passed = true;
    let message = 'Validation passed';
    let severity: 'low' | 'medium' | 'high' = 'low';

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
        const coherenceResult = this.validateCoherence(output);
        passed = coherenceResult.passed;
        message = coherenceResult.message;
        severity = coherenceResult.severity;
        break;
    }

    return { rule, passed, message, severity };
  }

  // Length validation
  private validateLength(output: string, params: any): {
    passed: boolean;
    message: string;
    severity: 'low' | 'medium' | 'high';
  } {
    const length = output.length;
    const minLength = params.min_length || 0;
    const maxLength = params.max_length || Infinity;
    
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
    const requiredKeywords = params.required_keywords || [];
    const lowerOutput = output.toLowerCase();
    
    for (const keyword of requiredKeywords) {
      if (!lowerOutput.includes(keyword.toLowerCase())) {
        return {
          passed: false,
          message: `Missing required keyword: "${keyword}"`,
          severity: 'high'
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
  private validateFormat(output: string, params: any): {
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

  // Coherence validation
  private validateCoherence(output: string): {
    passed: boolean;
    message: string;
    severity: 'low' | 'medium' | 'high';
  } {
    const sentences = output.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length < 2) {
      return { passed: true, message: 'Single sentence, coherence check passed', severity: 'low' };
    }
    
    // Basic coherence heuristics
    const hasTransitions = /\b(however|therefore|furthermore|moreover|consequently)\b/i.test(output);
    const coherenceScore = hasTransitions ? 0.8 : 0.6;
    
    return {
      passed: coherenceScore > 0.5,
      message: `Coherence score: ${coherenceScore.toFixed(2)}`,
      severity: coherenceScore < 0.3 ? 'high' : coherenceScore < 0.6 ? 'medium' : 'low'
    };
  }

  // Calculate quality metrics
  private calculateQualityMetrics(
    output: string,
    ruleResults: any[],
    stepType: string
  ): QualityMetrics {
    const passedRules = ruleResults.filter(r => r.passed).length;
    const totalRules = ruleResults.length;
    
    const accuracy_score = totalRules > 0 ? passedRules / totalRules : 1;
    const relevance_score = 0.8; // Simplified
    const completeness_score = this.calculateCompletenessScore(output, stepType);
    const clarity_score = this.calculateClarityScore(output);
    
    const overall_quality = (
      accuracy_score * 0.3 +
      relevance_score * 0.25 +
      completeness_score * 0.25 +
      clarity_score * 0.2
    );
    
    return {
      accuracy_score,
      relevance_score,
      completeness_score,
      clarity_score,
      overall_quality
    };
  }

  private calculateCompletenessScore(output: string, stepType: string): number {
    const wordCount = output.split(/\s+/).length;
    const minWords = this.getMinWordsForStepType(stepType);
    return Math.min(1, wordCount / minWords);
  }

  private calculateClarityScore(output: string): number {
    const words = output.split(/\s+/);
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const sentences = output.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = words.length / sentences.length;
    
    const wordScore = Math.max(0, 1 - Math.abs(avgWordLength - 5) / 10);
    const sentenceScore = Math.max(0, 1 - Math.abs(avgSentenceLength - 15) / 20);
    
    return (wordScore + sentenceScore) / 2;
  }

  private shouldRequireHumanReview(metrics: QualityMetrics, ruleResults: any[]): boolean {
    if (metrics.overall_quality < 0.6) return true;
    if (ruleResults.some(r => !r.passed && r.severity === 'high')) return true;
    if (metrics.accuracy_score < 0.5) return true;
    return false;
  }

  private calculateOverallConfidence(metrics: QualityMetrics, ruleResults: any[]): number {
    const baseConfidence = metrics.overall_quality;
    const ruleCompliance = ruleResults.filter(r => r.passed).length / ruleResults.length;
    return (baseConfidence + ruleCompliance) / 2;
  }

  private getModelReliability(model: string, stepType: string): number {
    return 0.9; // Simplified
  }

  private evaluateOutputLength(output: string, stepType: string): number {
    const length = output.length;
    const expected = this.getExpectedLengthForStepType(stepType);
    const ratio = length / expected;
    
    if (ratio >= 0.8 && ratio <= 1.5) return 1.0;
    if (ratio >= 0.5 && ratio <= 2.0) return 0.8;
    return 0.6;
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