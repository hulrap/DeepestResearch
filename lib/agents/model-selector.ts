// AI Model Selection and Performance Tracking
// Chooses optimal models based on task requirements and performance history

// Model Selection Intelligence System
// Automatically selects optimal AI models based on task type, cost, and capabilities

import { createClient } from '@/lib/supabase/client';

export interface ModelCapability {
  text: boolean;
  vision: boolean;
  code: boolean;
  function_calling: boolean;
  json_mode: boolean;
  large_context: boolean;
}

export interface ModelMetrics {
  performance_score: number; // 0-1
  speed_score: number; // 0-1  
  cost_efficiency: number; // 0-1
  reliability_score: number; // 0-1
  avg_latency_ms: number;
  success_rate: number; // 0-1
}

export interface ModelInfo {
  id: string;
  provider_id: string;
  model_id: string;
  display_name: string;
  capabilities: ModelCapability;
  pricing: {
    input_cost_per_1k: number;
    output_cost_per_1k: number;
  };
  context_window: number;
  max_output_tokens: number;
  metrics: ModelMetrics;
  best_use_cases: string[];
  is_active: boolean;
}

export interface TaskRequirements {
  task_type: 'research' | 'analysis' | 'writing' | 'coding' | 'reasoning' | 'summarization' | 'translation';
  priority: 'cost' | 'quality' | 'speed' | 'balanced';
  required_capabilities: string[];
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  quality_threshold: number; // Minimum acceptable quality score 0-1
  max_cost_per_request?: number;
  max_latency_ms?: number;
  context_length_needed?: number;
}

export interface ModelSelection {
  primary_model: ModelInfo;
  fallback_models: ModelInfo[];
  estimated_cost: number;
  confidence: number; // How confident we are in this selection
  reasoning: string; // Why this model was selected
}

export class ModelSelector {
  private supabase = createClient();
  private modelsCache = new Map<string, ModelInfo>();
  private lastCacheUpdate = 0;
  private cacheValidityMs = 5 * 60 * 1000; // 5 minutes

  // Main model selection method
  async selectOptimalModel(
    requirements: TaskRequirements,
    userApiKeys: Map<string, string>,
    excludeModels: string[] = []
  ): Promise<ModelSelection> {
    // Ensure we have fresh model data
    await this.ensureModelsCache();

    // Get available models (user has API keys for)
    const availableModels = this.getAvailableModels(userApiKeys, excludeModels);

    if (availableModels.length === 0) {
      throw new Error('No available models found. Please configure API keys.');
    }

    // Filter models by capabilities
    const capableModels = this.filterByCapabilities(availableModels, requirements);

    if (capableModels.length === 0) {
      throw new Error('No models found that meet the capability requirements.');
    }

    // Score and rank models
    const scoredModels = this.scoreModels(capableModels, requirements);

    // Select primary and fallback models
    const primaryModel = scoredModels[0];
    const fallbackModels = scoredModels.slice(1, 4); // Top 3 alternatives

    // Calculate estimated cost
    const estimatedCost = this.calculateEstimatedCost(
      primaryModel.model,
      requirements.estimated_input_tokens,
      requirements.estimated_output_tokens
    );

    // Generate selection reasoning
    const reasoning = this.generateSelectionReasoning(primaryModel, requirements);

    return {
      primary_model: primaryModel.model,
      fallback_models: fallbackModels.map(m => m.model),
      estimated_cost: estimatedCost,
      confidence: primaryModel.score,
      reasoning
    };
  }

  // Get model recommendation for a specific use case
  async getModelRecommendations(
    useCase: string,
    userApiKeys: Map<string, string>
  ): Promise<ModelInfo[]> {
    await this.ensureModelsCache();
    
    const availableModels = this.getAvailableModels(userApiKeys);
    
    return availableModels
      .filter(model => model.best_use_cases.includes(useCase))
      .sort((a, b) => {
        // Sort by performance score for the use case
        const scoreA = this.getUseCaseScore(a, useCase);
        const scoreB = this.getUseCaseScore(b, useCase);
        return scoreB - scoreA;
      });
  }

  // Update model performance metrics based on actual usage
  async updateModelMetrics(
    modelId: string,
    actualLatency: number,
    success: boolean,
    qualityScore?: number
  ): Promise<void> {
    const { data: currentModel } = await this.supabase
      .from('ai_models')
      .select('performance_score, speed_score, reliability_score')
      .eq('model_id', modelId)
      .single();

    if (!currentModel) return;

    // Update metrics with exponential moving average
    const alpha = 0.1; // Learning rate

    const newReliabilityScore = success 
      ? currentModel.reliability_score + alpha * (1 - currentModel.reliability_score)
      : currentModel.reliability_score - alpha * currentModel.reliability_score;

    // Update speed score based on actual latency
    const normalizedLatency = Math.min(actualLatency / 10000, 1);
    const latencyScore = 1 - normalizedLatency;
    const newSpeedScore = currentModel.speed_score + alpha * (latencyScore - currentModel.speed_score);

    // Update quality score if provided
    let newPerformanceScore = currentModel.performance_score;
    if (qualityScore !== undefined) {
      const normalizedQuality = Math.max(0, Math.min(1, qualityScore));
      newPerformanceScore = currentModel.performance_score + alpha * (normalizedQuality - currentModel.performance_score);
    }

    await this.supabase
      .from('ai_models')
      .update({
        performance_score: Math.max(0, Math.min(1, newPerformanceScore)),
        speed_score: Math.max(0, Math.min(1, newSpeedScore)),
        reliability_score: Math.max(0, Math.min(1, newReliabilityScore)),
        updated_at: new Date().toISOString()
      })
      .eq('model_id', modelId);

    // Invalidate cache
    this.modelsCache.clear();
  }

  // Get fallback model when primary fails
  async getFallbackModel(
    primaryModelId: string,
    requirements: TaskRequirements,
    userApiKeys: Map<string, string>
  ): Promise<ModelInfo | null> {
    const selection = await this.selectOptimalModel(
      requirements,
      userApiKeys,
      [primaryModelId] // Exclude the failed model
    );

    return selection.primary_model;
  }

  // Check if a model supports required capabilities
  private supportsRequiredCapabilities(model: ModelInfo, requirements: TaskRequirements): boolean {
    // Check each required capability
    for (const capability of requirements.required_capabilities) {
      switch (capability) {
        case 'vision':
          if (!model.capabilities.vision) return false;
          break;
        case 'code':
          if (!model.capabilities.code) return false;
          break;
        case 'function_calling':
          if (!model.capabilities.function_calling) return false;
          break;
        case 'json_mode':
          if (!model.capabilities.json_mode) return false;
          break;
        case 'large_context':
          if (!model.capabilities.large_context || model.context_window < (requirements.context_length_needed || 32000)) return false;
          break;
        default:
          // For any other capability, check if it exists in model capabilities
          if (capability in model.capabilities && !(model.capabilities as unknown as Record<string, boolean>)[capability]) return false;
      }
    }
    
    // Additional validation based on task requirements
    if (requirements.context_length_needed && model.context_window < requirements.context_length_needed) {
      return false;
    }
    
    if (requirements.max_cost_per_request) {
      const estimatedCost = this.calculateEstimatedCost(
        model,
        requirements.estimated_input_tokens,
        requirements.estimated_output_tokens
      );
      if (estimatedCost > requirements.max_cost_per_request) {
        return false;
      }
    }
    
    return true;
  }

  // Ensure models cache is fresh
  private async ensureModelsCache(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCacheUpdate > this.cacheValidityMs || this.modelsCache.size === 0) {
      await this.refreshModelsCache();
    }
  }

  // Refresh models cache from database
  private async refreshModelsCache(): Promise<void> {
    const { data: models, error } = await this.supabase
      .from('ai_models')
      .select(`
        *,
        ai_providers (
          id,
          name,
          display_name
        )
      `)
      .eq('is_active', true);

    if (error) {
      console.error('Failed to fetch models:', error);
      return;
    }

    this.modelsCache.clear();

    for (const model of models || []) {
      const modelInfo: ModelInfo = {
        id: model.id,
        provider_id: model.provider_id,
        model_id: model.model_id,
        display_name: model.display_name,
        capabilities: model.capabilities || {},
        pricing: model.pricing || { input_cost_per_1k: 0.01, output_cost_per_1k: 0.03 },
        context_window: model.context_window || 4096,
        max_output_tokens: model.max_output_tokens || 4096,
        metrics: {
          performance_score: model.performance_score || 0.8,
          speed_score: model.speed_score || 0.8,
          cost_efficiency: model.cost_efficiency || 0.8,
          reliability_score: 0.9, // Default high reliability
          avg_latency_ms: 2000, // Default latency
          success_rate: 0.95 // Default success rate
        },
        best_use_cases: model.best_use_cases || [],
        is_active: model.is_active
      };

      this.modelsCache.set(model.model_id, modelInfo);
    }

    this.lastCacheUpdate = Date.now();
  }

  // Get models that user has API keys for
  private getAvailableModels(userApiKeys: Map<string, string>, excludeModels: string[] = []): ModelInfo[] {
    const available: ModelInfo[] = [];

    for (const [modelId, model] of this.modelsCache) {
      if (excludeModels.includes(modelId)) continue;

      // Check if user has API key for this model's provider
      const providerName = this.getProviderName(model.provider_id);
      if (userApiKeys.has(providerName)) {
        available.push(model);
      }
    }

    return available;
  }

  // Filter models by required capabilities
  private filterByCapabilities(models: ModelInfo[], requirements: TaskRequirements): ModelInfo[] {
    return models.filter(model => {
      // Check basic capability requirements
      if (!this.supportsRequiredCapabilities(model, requirements)) {
        return false;
      }

      // Check context length if specified
      if (requirements.context_length_needed && model.context_window < requirements.context_length_needed) {
        return false;
      }

      // Check quality threshold
      if (model.metrics.performance_score < requirements.quality_threshold) {
        return false;
      }

      return true;
    });
  }

  // Score models based on requirements
  private scoreModels(models: ModelInfo[], requirements: TaskRequirements): Array<{
    model: ModelInfo;
    score: number;
    breakdown: Record<string, number>;
  }> {
    const scored = models.map(model => {
      const breakdown = this.calculateModelScore(model, requirements);
      const score = this.combineScores(breakdown, requirements.priority);
      
      return { model, score, breakdown };
    });

    return scored.sort((a, b) => b.score - a.score);
  }

  // Calculate detailed score breakdown for a model
  private calculateModelScore(model: ModelInfo, requirements: TaskRequirements): Record<string, number> {
    const breakdown: Record<string, number> = {};

    // Task type alignment score
    breakdown.task_alignment = model.best_use_cases.includes(requirements.task_type) ? 1.0 : 0.6;

    // Quality score
    breakdown.quality = model.metrics.performance_score;

    // Speed score  
    breakdown.speed = model.metrics.speed_score;

    // Cost efficiency score
    const estimatedCost = this.calculateEstimatedCost(
      model,
      requirements.estimated_input_tokens,
      requirements.estimated_output_tokens
    );
    breakdown.cost = this.normalizeCostScore(estimatedCost);

    // Reliability score
    breakdown.reliability = model.metrics.reliability_score;

    // Capability bonus
    breakdown.capabilities = this.calculateCapabilityBonus(model, requirements);

    return breakdown;
  }

  // Combine individual scores based on priority
  private combineScores(breakdown: Record<string, number>, priority: string): number {
    const weights = this.getPriorityWeights(priority);
    
    let totalScore = 0;
    let totalWeight = 0;

    for (const [aspect, weight] of Object.entries(weights)) {
      if (breakdown[aspect] !== undefined) {
        totalScore += breakdown[aspect] * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  // Get scoring weights based on priority
  private getPriorityWeights(priority: string): Record<string, number> {
    switch (priority) {
      case 'cost':
        return { cost: 0.4, reliability: 0.2, quality: 0.2, speed: 0.1, capabilities: 0.1 };
      case 'quality':
        return { quality: 0.4, reliability: 0.2, capabilities: 0.2, speed: 0.1, cost: 0.1 };
      case 'speed':
        return { speed: 0.4, reliability: 0.2, cost: 0.2, quality: 0.1, capabilities: 0.1 };
      case 'balanced':
      default:
        return { quality: 0.25, cost: 0.2, speed: 0.2, reliability: 0.15, capabilities: 0.1, task_alignment: 0.1 };
    }
  }

  // Calculate estimated cost for a model
  private calculateEstimatedCost(model: ModelInfo, inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1000) * model.pricing.input_cost_per_1k;
    const outputCost = (outputTokens / 1000) * model.pricing.output_cost_per_1k;
    return inputCost + outputCost;
  }

  // Normalize cost to 0-1 score (lower cost = higher score)
  private normalizeCostScore(cost: number): number {
    // Assuming $0.10 is maximum reasonable cost for normalization
    const maxCost = 0.10;
    return Math.max(0, 1 - (cost / maxCost));
  }

  // Calculate capability bonus score
  private calculateCapabilityBonus(model: ModelInfo, requirements: TaskRequirements): number {
    let bonus = 0;
    const capabilities = model.capabilities;

    // Bonus for having extra useful capabilities
    if (capabilities.vision) bonus += 0.1;
    if (capabilities.function_calling) bonus += 0.1;
    if (capabilities.json_mode) bonus += 0.05;
    if (capabilities.code) bonus += 0.1;
    if (model.context_window > 100000) bonus += 0.1; // Large context bonus

    // Additional bonus for task-specific requirements
    if (requirements.required_capabilities.includes('vision') && capabilities.vision) bonus += 0.1;
    if (requirements.required_capabilities.includes('function_calling') && capabilities.function_calling) bonus += 0.1;
    if (requirements.required_capabilities.includes('code') && capabilities.code) bonus += 0.1;

    return Math.min(1, bonus);
  }

  // Get use case specific score
  private getUseCaseScore(model: ModelInfo, useCase: string): number {
    if (model.best_use_cases.includes(useCase)) {
      return model.metrics.performance_score;
    }
    return model.metrics.performance_score * 0.8; // Penalty for non-optimal use case
  }

  // Generate human-readable selection reasoning
  private generateSelectionReasoning(selection: { model: ModelInfo; score: number; breakdown: Record<string, number> }, requirements: TaskRequirements): string {
    const model = selection.model;
    const reasons: string[] = [];

    reasons.push(`Selected ${model.display_name} for ${requirements.task_type} task`);

    if (model.best_use_cases.includes(requirements.task_type)) {
      reasons.push(`optimized for ${requirements.task_type}`);
    }

    if (selection.breakdown.quality > 0.9) {
      reasons.push('high quality performance');
    }

    if (selection.breakdown.cost > 0.8) {
      reasons.push('cost-effective pricing');
    }

    if (selection.breakdown.speed > 0.8) {
      reasons.push('fast response times');
    }

    // Add capability reasons
    const caps: string[] = [];
    if (model.capabilities.vision) caps.push('vision');
    if (model.capabilities.function_calling) caps.push('function calling');
    if (model.capabilities.code) caps.push('code generation');
    if (caps.length > 0) {
      reasons.push(`supports ${caps.join(', ')}`);
    }

    return reasons.join(', ');
  }

  // Get provider name from provider ID (simplified)
  private getProviderName(providerId: string): string {
    // This would normally look up from providers table
    // Simplified mapping for now
    const providerMap: Record<string, string> = {
      'openai': 'openai',
      'anthropic': 'anthropic', 
      'google': 'google',
      'cohere': 'cohere',
      'mistral': 'mistral'
    };
    
    return providerMap[providerId] || 'unknown';
  }
} 