// Unified AI API Client System
// Provides consistent interface across all AI providers

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface UnifiedRequest {
  model: string;
  messages?: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  prompt?: string; // For legacy/simple models
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface UnifiedResponse {
  content: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  cost: {
    input_cost: number;
    output_cost: number;
    total_cost: number;
  };
  metadata: {
    model: string;
    provider: string;
    latency_ms: number;
    finish_reason?: string;
  };
}

export interface ProviderConfig {
  name: string;
  api_key: string;
  base_url?: string;
  pricing: {
    input_cost_per_1k: number;
    output_cost_per_1k: number;
  };
}

export class UnifiedAIClient {
  private providers = new Map<string, any>(); // eslint-disable-line @typescript-eslint/no-explicit-any
  private configs = new Map<string, ProviderConfig>();

  constructor() {
    // Initialize with default configurations
    this.setupDefaultConfigs();
  }

  addProvider(config: ProviderConfig) {
    this.configs.set(config.name, config);
    
    switch (config.name) {
      case 'openai':
        this.providers.set('openai', new OpenAI({ apiKey: config.api_key }));
        break;
      case 'anthropic':
        this.providers.set('anthropic', new Anthropic({ apiKey: config.api_key }));
        break;
      case 'google':
        this.providers.set('google', new GoogleGenerativeAI(config.api_key));
        break;
      case 'cohere':
        this.providers.set('cohere', this.createCohereClient(config));
        break;
      case 'mistral':
        this.providers.set('mistral', this.createMistralClient(config));
        break;
      default:
        throw new Error(`Unsupported provider: ${config.name}`);
    }
  }

  async generate(request: UnifiedRequest): Promise<UnifiedResponse> {
    const provider = this.detectProvider(request.model);
    const client = this.providers.get(provider);
    const config = this.configs.get(provider);

    if (!client || !config) {
      throw new Error(`Provider ${provider} not configured`);
    }

    const startTime = Date.now();

    try {
      let response: any; // eslint-disable-line @typescript-eslint/no-explicit-any
      
      switch (provider) {
        case 'openai':
          response = await this.callOpenAI(client, request);
          break;
        case 'anthropic':
          response = await this.callAnthropic(client, request);
          break;
        case 'google':
          response = await this.callGoogle(client, request);
          break;
        case 'cohere':
          response = await this.callCohere(client, request);
          break;
        case 'mistral':
          response = await this.callMistral(client, request);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      const latency = Date.now() - startTime;
      return this.normalizeResponse(response, provider, request.model, latency, config);
      
    } catch (error) {
      throw new Error(`API call failed for ${provider}: ${error}`);
    }
  }

  private async callOpenAI(client: OpenAI, request: UnifiedRequest) {
    const messages = request.messages || [
      { role: 'user' as const, content: request.prompt || '' }
    ];

    return await client.chat.completions.create({
      model: request.model,
      messages,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      stream: false
    });
  }

  private async callAnthropic(client: Anthropic, request: UnifiedRequest) {
    const messages = request.messages || [
      { role: 'user' as const, content: request.prompt || '' }
    ];

    return await client.messages.create({
      model: request.model,
      max_tokens: request.max_tokens || 4000,
      temperature: request.temperature,
      messages: messages.map(msg => ({
        role: msg.role === 'system' ? 'user' : msg.role,
        content: msg.content
      }))
    });
  }

  private async callGoogle(client: GoogleGenerativeAI, request: UnifiedRequest) {
    const model = client.getGenerativeModel({ model: request.model });
    const prompt = request.prompt || request.messages?.map(m => m.content).join('\n') || '';
    
    return await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        maxOutputTokens: request.max_tokens,
        temperature: request.temperature,
      }
    });
  }

  private async callCohere(client: any, request: UnifiedRequest) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const prompt = request.prompt || request.messages?.map(m => m.content).join('\n') || '';
    
    return await client.generate({
      model: request.model,
      prompt,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
    });
  }

  private async callMistral(client: any, request: UnifiedRequest) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const messages = request.messages || [
      { role: 'user', content: request.prompt || '' }
    ];

    return await client.chat({
      model: request.model,
      messages,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
    });
  }

  private detectProvider(model: string): string {
    // Model name patterns to detect provider
    const patterns = {
      'gpt-': 'openai',
      'claude-': 'anthropic',
      'gemini-': 'google',
      'command': 'cohere',
      'mistral-': 'mistral',
    };

    for (const [pattern, provider] of Object.entries(patterns)) {
      if (model.startsWith(pattern)) {
        return provider;
      }
    }

    throw new Error(`Cannot detect provider for model: ${model}`);
  }

  private normalizeResponse(
    response: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    provider: string, 
    model: string, 
    latency: number,
    config: ProviderConfig
  ): UnifiedResponse {
    let content = '';
    let inputTokens = 0;
    let outputTokens = 0;

    switch (provider) {
      case 'openai':
        content = response.choices[0]?.message?.content || '';
        inputTokens = response.usage?.prompt_tokens || 0;
        outputTokens = response.usage?.completion_tokens || 0;
        break;
        
      case 'anthropic':
        content = response.content[0]?.text || '';
        inputTokens = response.usage?.input_tokens || 0;
        outputTokens = response.usage?.output_tokens || 0;
        break;
        
      case 'google':
        content = response.response?.text() || '';
        const usage = response.response?.usageMetadata;
        inputTokens = usage?.promptTokenCount || 0;
        outputTokens = usage?.candidatesTokenCount || 0;
        break;
        
      case 'cohere':
        content = response.generations?.[0]?.text || '';
        // Cohere doesn't always provide token counts
        inputTokens = this.estimateTokens(response.prompt || '');
        outputTokens = this.estimateTokens(content);
        break;
        
      case 'mistral':
        content = response.choices?.[0]?.message?.content || '';
        inputTokens = response.usage?.prompt_tokens || 0;
        outputTokens = response.usage?.completion_tokens || 0;
        break;
    }

    const inputCost = (inputTokens / 1000) * config.pricing.input_cost_per_1k;
    const outputCost = (outputTokens / 1000) * config.pricing.output_cost_per_1k;

    return {
      content,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens
      },
      cost: {
        input_cost: inputCost,
        output_cost: outputCost,
        total_cost: inputCost + outputCost
      },
      metadata: {
        model,
        provider,
        latency_ms: latency,
        finish_reason: this.extractFinishReason(response, provider)
      }
    };
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private extractFinishReason(response: any, provider: string): string { // eslint-disable-line @typescript-eslint/no-explicit-any
    switch (provider) {
      case 'openai':
        return response.choices?.[0]?.finish_reason || 'unknown';
      case 'anthropic':
        return response.stop_reason || 'unknown';
      default:
        return 'completed';
    }
  }

  private createCohereClient(config: ProviderConfig) {
    // Placeholder for Cohere client
    return {
      generate: async (params: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const response = await fetch('https://api.cohere.ai/v1/generate', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params)
        });
        return await response.json();
      }
    };
  }

  private createMistralClient(config: ProviderConfig) {
    // Placeholder for Mistral client
    return {
      chat: async (params: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params)
        });
        return await response.json();
      }
    };
  }

  private setupDefaultConfigs() {
    // Default pricing (update with current rates)
    const defaultConfigs: ProviderConfig[] = [
      {
        name: 'openai',
        api_key: '',
        pricing: { input_cost_per_1k: 0.01, output_cost_per_1k: 0.03 }
      },
      {
        name: 'anthropic',
        api_key: '',
        pricing: { input_cost_per_1k: 0.003, output_cost_per_1k: 0.015 }
      },
      {
        name: 'google',
        api_key: '',
        pricing: { input_cost_per_1k: 0.00035, output_cost_per_1k: 0.00105 }
      },
      {
        name: 'cohere',
        api_key: '',
        pricing: { input_cost_per_1k: 0.0015, output_cost_per_1k: 0.002 }
      },
      {
        name: 'mistral',
        api_key: '',
        pricing: { input_cost_per_1k: 0.0007, output_cost_per_1k: 0.0007 }
      }
    ];

    defaultConfigs.forEach(config => {
      this.configs.set(config.name, config);
    });
  }

  // Get available models for a provider
  getAvailableModels(provider: string): string[] {
    const modelMap: Record<string, string[]> = {
      'openai': ['gpt-4-turbo', 'gpt-4o', 'gpt-3.5-turbo'],
      'anthropic': ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
      'google': ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'],
      'cohere': ['command-r-plus', 'command-r', 'command'],
      'mistral': ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest']
    };

    return modelMap[provider] || [];
  }

  // Check if a model supports certain capabilities
  supportsCapability(model: string, capability: 'vision' | 'function_calling' | 'json_mode'): boolean {
    const capabilities: Record<string, string[]> = {
      'gpt-4-turbo': ['vision', 'function_calling', 'json_mode'],
      'gpt-4o': ['vision', 'function_calling', 'json_mode'],
      'claude-3-opus-20240229': ['vision'],
      'claude-3-sonnet-20240229': ['vision'],
      'gemini-1.5-pro': ['vision'],
      'gemini-1.5-flash': ['vision'],
    };

    return capabilities[model]?.includes(capability) || false;
  }
} 