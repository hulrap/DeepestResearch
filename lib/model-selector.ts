// Model Selection and Performance Optimization System
// Chooses the best AI model for each task based on requirements and performance history

import { createClient } from '@/lib/supabase/client';

export interface TaskRequirements {
  task_type: 'research' | 'analysis' | 'writing' | 'coding' | 'reasoning' | 'summarization';
  priority: 'cost' | 'quality' | 'speed' | 'balanced';
  required_capabilities: string[];
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  quality_threshold: number;
  max_cost_per_request?: number;
  context_length_needed?: number;
}

export interface ModelInfo {
  id: string;
  provider_id: string;
  model_id: string;
  display_name: string;
  capabilities: Record<string, boolean>;
  pricing: {
    input_cost_per_1k: number;
    output_cost_per_1k: number;
  };
  context_window: number;
  max_output_tokens: number;
  performance_score: number;
  speed_score: number;
  cost_efficiency: number;
  best_use_cases: string[];
  is_active: boolean;
}

export interface ModelSelection {
  primary_model: ModelInfo;
  fallback_models: ModelInfo[];
  estimated_cost: number;
  confidence: number;
  reasoning: string;
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
    const fallbackModels = scoredModels.slice(1, 4);

    // Calculate estimated cost
    const estimatedCost = this.calculateEstimatedCost(
      primaryModel.model,
      requirements.estimated_input_tokens,
      requirements.estimated_output_tokens
    );

    return {
      primary_model: primaryModel.model,
      fallback_models: fallbackModels.map(m => m.model),
      estimated_cost: estimatedCost,
      confidence: primaryModel.score,
      reasoning: `Selected ${primaryModel.model.display_name} for ${requirements.task_type}`
    };
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
    const alpha = 0.1;

    const newReliabilityScore = success 
      ? currentModel.reliability_score + alpha * (1 - currentModel.reliability_score)
      : currentModel.reliability_score - alpha * currentModel.reliability_score;

    // Update speed score based on actual latency
    const normalizedLatency = Math.min(actualLatency / 5000, 1); // Normalize against 5s baseline
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

    this.modelsCache.clear();
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
      .select('*')
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
        performance_score: model.performance_score || 0.8,
        speed_score: model.speed_score || 0.8,
        cost_efficiency: model.cost_efficiency || 0.8,
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
      // Check context length if specified
      if (requirements.context_length_needed && model.context_window < requirements.context_length_needed) {
        return false;
      }

      // Check quality threshold
      if (model.performance_score < requirements.quality_threshold) {
        return false;
      }

      return true;
    });
  }

  // Score models based on requirements
  private scoreModels(models: ModelInfo[], requirements: TaskRequirements): Array<{
    model: ModelInfo;
    score: number;
  }> {
    const scored = models.map(model => {
      const score = this.calculateModelScore(model, requirements);
      return { model, score };
    });

    return scored.sort((a, b) => b.score - a.score);
  }

  // Calculate score for a model
  private calculateModelScore(model: ModelInfo, requirements: TaskRequirements): number {
    let score = 0;

    // Task type alignment
    if (model.best_use_cases.includes(requirements.task_type)) {
      score += 0.3;
    }

    // Quality
    score += model.performance_score * 0.25;

    // Speed
    score += model.speed_score * 0.2;

    // Cost efficiency
    score += model.cost_efficiency * 0.25;

    return score;
  }

  // Calculate estimated cost for a model
  private calculateEstimatedCost(model: ModelInfo, inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1000) * model.pricing.input_cost_per_1k;
    const outputCost = (outputTokens / 1000) * model.pricing.output_cost_per_1k;
    return inputCost + outputCost;
  }

  // Get provider name from provider ID
  private getProviderName(providerId: string): string {
    // Map provider IDs to actual provider names for API key lookup
    const providerMap: Record<string, string> = {
      'openai': 'openai',
      'anthropic': 'anthropic', 
      'google': 'google',
      'cohere': 'cohere',
      'mistral': 'mistral',
      'openai-compatible': 'openai'
    };
    
    return providerMap[providerId] || providerId.toLowerCase();
  }
} 