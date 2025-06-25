// Agent Workflow Orchestration Engine
// Handles multi-agent flows for deep research

export interface AgentStep {
  id: string;
  name: string;
  description: string;
  agent_type: 'researcher' | 'analyzer' | 'synthesizer' | 'critic' | 'writer';
  model_provider: string;
  model_id: string;
  prompt_template: string;
  input_variables: string[];
  output_format: 'text' | 'json' | 'markdown';
  depends_on?: string[]; // Previous steps this depends on
  parallel?: boolean; // Can run in parallel with other steps
  cost_estimate?: {
    min_tokens: number;
    max_tokens: number;
    estimated_cost: number;
  };
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  steps: AgentStep[];
  estimated_duration_minutes: number;
  estimated_cost_range: {
    min: number;
    max: number;
  };
  tags: string[];
  required_capabilities: string[]; // ['text', 'vision', 'code', 'web_search']
}

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  user_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  current_step: number;
  step_results: Map<string, unknown>;
  total_cost: number;
  started_at: Date;
  completed_at?: Date;
  error_message?: string;
}

export class WorkflowEngine {
  private executions = new Map<string, WorkflowExecution>();

  // Execute a workflow with cost checking
  async executeWorkflow(
    workflowId: string, 
    userId: string, 
    initialInput: string,
    userApiKeys: Map<string, string>
  ): Promise<string> {
    const workflow = await this.getWorkflowDefinition(workflowId);
    const execution = this.createExecution(workflow, userId, initialInput);
    
    // Check spending limits before starting
    if (!await this.checkSpendingLimits(userId, workflow.estimated_cost_range.max)) {
      throw new Error('Spending limit exceeded');
    }

    try {
      for (const step of workflow.steps) {
        // Check if we can continue spending
        if (!await this.checkSpendingLimits(userId, step.cost_estimate?.estimated_cost || 0)) {
          execution.status = 'paused';
          execution.error_message = 'Spending limit reached';
          break;
        }

        // Execute the step
        const stepResult = await this.executeStep(step, execution, userApiKeys);
        execution.step_results.set(step.id, stepResult);
        execution.current_step++;
        
        // Log usage
        await this.logUsage(userId, step, stepResult);
      }

      execution.status = 'completed';
      execution.completed_at = new Date();
      
      // Generate final response
      return this.synthesizeFinalResponse(execution);
      
    } catch (error) {
      execution.status = 'failed';
      execution.error_message = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  private async executeStep(
    step: AgentStep, 
    execution: WorkflowExecution,
    userApiKeys: Map<string, string>
  ): Promise<unknown> {
    // Get the appropriate API client
    const apiClient = this.getApiClient(step.model_provider, userApiKeys);
    
    // Prepare the prompt with variables from previous steps
    const prompt = this.interpolatePrompt(step.prompt_template, execution.step_results);
    
    // Make the API call
    const response = await apiClient.generate({
      model: step.model_id,
      prompt,
      max_tokens: step.cost_estimate?.max_tokens || 4000
    });

    return {
      content: response.content,
      tokens_used: response.usage,
      cost: response.cost,
      latency: response.latency_ms,
      timestamp: new Date()
    };
  }

  private async checkSpendingLimits(userId: string, estimatedCost: number): Promise<boolean> {
    try {
      // Get user's current usage and limits from database
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      
      const { data: userLimits } = await supabase
        .from('user_usage_limits')
        .select('daily_limit_usd, monthly_limit_usd, current_daily_usage, current_monthly_usage')
        .eq('user_id', userId)
        .single();
      
      if (!userLimits) {
        // Default limits if none set
        return estimatedCost <= 10.0; // $10 default daily limit
      }
      
      const newDailyTotal = (userLimits.current_daily_usage || 0) + estimatedCost;
      const newMonthlyTotal = (userLimits.current_monthly_usage || 0) + estimatedCost;
      
      return newDailyTotal <= userLimits.daily_limit_usd && 
             newMonthlyTotal <= userLimits.monthly_limit_usd;
    } catch (error) {
      console.error('Error checking spending limits:', error);
      return estimatedCost <= 1.0; // Conservative fallback
    }
  }

  private getApiClient(provider: string, userApiKeys: Map<string, string>) {
    // Return appropriate API client based on provider
    // This is where you implement the unified interface for different providers
    switch (provider) {
      case 'openai':
        return new OpenAIProvider(userApiKeys.get('openai'));
      case 'anthropic':
        return new AnthropicProvider(userApiKeys.get('anthropic'));
      case 'google':
        return new GoogleProvider(userApiKeys.get('google'));
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private interpolatePrompt(template: string, stepResults: Map<string, unknown>): string {
    let prompt = template;
    
    // Replace variables like {{step_name.content}}
    stepResults.forEach((result, stepId) => {
      const regex = new RegExp(`{{${stepId}\\.(\\w+)}}`, 'g');
      prompt = prompt.replace(regex, (match, property) => {
        // Type assertion to handle unknown type properly
        const resultObj = result as Record<string, unknown>;
        return String(resultObj[property] || '') || match;
      });
    });
    
    return prompt;
  }

  private synthesizeFinalResponse(execution: WorkflowExecution): string {
    // Combine all step results into a final response
    const results = Array.from(execution.step_results.values());
    return results.map((r: unknown) => {
      // Type assertion to handle unknown type properly
      const resultObj = r as Record<string, unknown>;
      return String(resultObj.content || '');
    }).join('\n\n');
  }

  private async getWorkflowDefinition(workflowId: string): Promise<WorkflowDefinition> {
    // Load from database or predefined workflows
    return PREDEFINED_WORKFLOWS[workflowId] || DEFAULT_RESEARCH_WORKFLOW;
  }

  private createExecution(workflow: WorkflowDefinition, userId: string, input: string): WorkflowExecution {
    return {
      id: crypto.randomUUID(),
      workflow_id: workflow.id,
      user_id: userId,
      status: 'pending',
      current_step: 0,
      step_results: new Map([['user_input', { content: input }]]),
      total_cost: 0,
      started_at: new Date()
    };
  }

  private async logUsage(userId: string, step: AgentStep, result: unknown) {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      
      const resultObj = result as { cost?: number; tokens_used?: { input_tokens: number; output_tokens: number } };
      
      await supabase
        .from('api_usage_logs')
        .insert({
          user_id: userId,
          provider_id: step.model_provider,
          model_id: step.model_id,
          agent_step: step.name,
          input_tokens: resultObj.tokens_used?.input_tokens || 0,
          output_tokens: resultObj.tokens_used?.output_tokens || 0,
          total_cost_usd: resultObj.cost || 0,
          created_at: new Date().toISOString()
        });
        
      // Update user's current usage
      await supabase.rpc('increment_user_usage', {
        p_user_id: userId,
        p_cost: resultObj.cost || 0,
        p_tokens: (resultObj.tokens_used?.input_tokens || 0) + (resultObj.tokens_used?.output_tokens || 0)
      });
    } catch (error) {
      console.error('Error logging usage:', error);
    }
  }
}

// Predefined research workflows
const DEFAULT_RESEARCH_WORKFLOW: WorkflowDefinition = {
  id: 'deep-research-default',
  name: 'Deep Research Analysis',
  description: 'Comprehensive research using multiple AI agents',
  version: '1.0',
  steps: [
    {
      id: 'initial_research',
      name: 'Initial Research',
      description: 'Gather comprehensive information on the topic',
      agent_type: 'researcher',
      model_provider: 'google',
      model_id: 'gemini-1.5-pro',
      prompt_template: `You are a world-class researcher. Research the following topic comprehensively:

Topic: {{user_input.content}}

Provide detailed information, statistics, recent developments, and key insights. Focus on accuracy and depth.`,
      input_variables: ['user_input'],
      output_format: 'text',
      cost_estimate: {
        min_tokens: 500,
        max_tokens: 2000,
        estimated_cost: 0.007
      }
    },
    {
      id: 'critical_analysis',
      name: 'Critical Analysis',
      description: 'Analyze and critique the research findings',
      agent_type: 'critic',
      model_provider: 'anthropic',
      model_id: 'claude-3-sonnet-20240229',
      prompt_template: `You are a critical analyst. Review the following research and provide critical analysis:

Original Query: {{user_input.content}}
Research Findings: {{initial_research.content}}

Identify strengths, weaknesses, gaps, potential biases, and areas needing further investigation.`,
      input_variables: ['user_input', 'initial_research'],
      output_format: 'text',
      depends_on: ['initial_research'],
      cost_estimate: {
        min_tokens: 300,
        max_tokens: 1500,
        estimated_cost: 0.0045
      }
    },
    {
      id: 'synthesis',
      name: 'Synthesis & Conclusions',
      description: 'Synthesize findings into actionable insights',
      agent_type: 'synthesizer',
      model_provider: 'openai',
      model_id: 'gpt-4-turbo',
      prompt_template: `You are a synthesis expert. Create a comprehensive, well-structured response that combines the research and analysis:

Original Query: {{user_input.content}}
Research: {{initial_research.content}}
Analysis: {{critical_analysis.content}}

Provide a balanced, insightful synthesis with clear conclusions and actionable insights.`,
      input_variables: ['user_input', 'initial_research', 'critical_analysis'],
      output_format: 'markdown',
      depends_on: ['initial_research', 'critical_analysis'],
      cost_estimate: {
        min_tokens: 400,
        max_tokens: 2000,
        estimated_cost: 0.06
      }
    }
  ],
  estimated_duration_minutes: 3,
  estimated_cost_range: {
    min: 0.01,
    max: 0.08
  },
  tags: ['research', 'analysis', 'multi-agent'],
  required_capabilities: ['text']
};

const PREDEFINED_WORKFLOWS: Record<string, WorkflowDefinition> = {
  'deep-research-default': DEFAULT_RESEARCH_WORKFLOW,
  // Add more predefined workflows here
};

// API Client interfaces
interface ApiClient {
  generate(request: GenerateRequest): Promise<GenerateResponse>;
}

interface GenerateRequest {
  model: string;
  prompt: string;
  max_tokens?: number;
  temperature?: number;
}

interface GenerateResponse {
  content: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  cost: number;
  latency_ms: number;
}

// Placeholder implementations
class OpenAIProvider implements ApiClient {
  constructor(private apiKey: string | undefined) {}
      
    async generate(request: GenerateRequest): Promise<GenerateResponse> {
      if (!this.apiKey) {
        throw new Error('OpenAI API key not provided');
      }
    
    const startTime = Date.now();
    
    try {
      // This would integrate with actual OpenAI SDK
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: request.model,
          messages: [{ role: 'user', content: request.prompt }],
          max_tokens: request.max_tokens,
          temperature: request.temperature || 0.7
        })
      });
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      const latency = Date.now() - startTime;
      
      return {
        content: data.choices[0]?.message?.content || '',
        usage: {
          input_tokens: data.usage?.prompt_tokens || 0,
          output_tokens: data.usage?.completion_tokens || 0
        },
        cost: this.calculateCost(data.usage, request.model),
        latency_ms: latency
      };
    } catch (error) {
      throw new Error(`OpenAI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private calculateCost(usage: { prompt_tokens?: number; completion_tokens?: number }, model: string): number {
    // OpenAI pricing (as of 2024)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.001, output: 0.002 }
    };
    
    const modelPricing = pricing[model] || pricing['gpt-3.5-turbo'];
    const inputCost = ((usage.prompt_tokens || 0) / 1000) * modelPricing.input;
    const outputCost = ((usage.completion_tokens || 0) / 1000) * modelPricing.output;
    
    return inputCost + outputCost;
  }
}

class AnthropicProvider implements ApiClient {
  constructor(private apiKey: string | undefined) {}
      
    async generate(request: GenerateRequest): Promise<GenerateResponse> {
      if (!this.apiKey) {
        throw new Error('Anthropic API key not provided');
      }
    
    const startTime = Date.now();
    
    try {
      // This would integrate with actual Anthropic SDK
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: request.max_tokens || 4000,
          messages: [{ role: 'user', content: request.prompt }],
          temperature: request.temperature || 0.7
        })
      });
      
      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      const latency = Date.now() - startTime;
      
      return {
        content: data.content[0]?.text || '',
        usage: {
          input_tokens: data.usage?.input_tokens || 0,
          output_tokens: data.usage?.output_tokens || 0
        },
        cost: this.calculateCost(data.usage, request.model),
        latency_ms: latency
      };
    } catch (error) {
      throw new Error(`Anthropic generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private calculateCost(usage: { input_tokens?: number; output_tokens?: number }, model: string): number {
    // Anthropic pricing (as of 2024)
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
      'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
      'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 }
    };
    
    const modelPricing = pricing[model] || pricing['claude-3-haiku-20240307'];
    const inputCost = ((usage.input_tokens || 0) / 1000) * modelPricing.input;
    const outputCost = ((usage.output_tokens || 0) / 1000) * modelPricing.output;
    
    return inputCost + outputCost;
  }
}

class GoogleProvider implements ApiClient {
  constructor(private apiKey: string | undefined) {}
      
    async generate(request: GenerateRequest): Promise<GenerateResponse> {
      if (!this.apiKey) {
        throw new Error('Google API key not provided');
      }
    
    const startTime = Date.now();
    
    try {
      // This would integrate with actual Google Gemini API
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: request.prompt }]
          }],
          generationConfig: {
            maxOutputTokens: request.max_tokens || 4000,
            temperature: request.temperature || 0.7
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Google API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      const latency = Date.now() - startTime;
      
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const inputTokens = data.usageMetadata?.promptTokenCount || 0;
      const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
      
      return {
        content,
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens
        },
        cost: this.calculateCost({ input_tokens: inputTokens, output_tokens: outputTokens }, request.model),
        latency_ms: latency
      };
    } catch (error) {
      throw new Error(`Google generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private calculateCost(usage: { input_tokens?: number; output_tokens?: number }, model: string): number {
    // Google Gemini pricing (as of 2024)
    const pricing: Record<string, { input: number; output: number }> = {
      'gemini-1.5-pro': { input: 0.00125, output: 0.00375 },
      'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
      'gemini-pro': { input: 0.0005, output: 0.0015 }
    };
    
    const modelPricing = pricing[model] || pricing['gemini-pro'];
    const inputCost = ((usage.input_tokens || 0) / 1000) * modelPricing.input;
    const outputCost = ((usage.output_tokens || 0) / 1000) * modelPricing.output;
    
    return inputCost + outputCost;
  }
} 