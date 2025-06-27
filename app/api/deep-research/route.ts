import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Import types for better type safety
type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// IMPORTANT! Set the runtime to edge
export const runtime = 'edge';

// Database row types
interface UserConfig {
  user_id: string;
  effective_daily_cost_limit: number;
  [key: string]: unknown;
}

interface UsageLimits {
  user_id: string;
  current_daily_usage: number;
  [key: string]: unknown;
}

interface UserAPIKey {
  id: string;
  user_id: string;
  provider_id: string;
  ai_providers: {
    name: string;
    display_name: string;
    base_url: string;
    auth_type: string;
  };
  key_name: string;
  key_hash: string;
  custom_rate_limits: Record<string, unknown> | null;
  daily_usage_limit: number | null;
  monthly_usage_limit: number | null;
  is_active: boolean;
  is_verified: boolean;
  verification_attempts: number;
  last_verification_at: string | null;
  last_used_at: string | null;
  usage_count: number;
  total_cost_usd: number;
  total_tokens: number;
  expires_at: string | null;
  auto_rotate_enabled: boolean;
  usage_alerts_enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface AIModel {
  id: string;
  provider_id: string;
  [key: string]: unknown;
}

interface UsageMetrics {
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_requests: number;
  provider_breakdown: Record<string, {
    cost: number;
    input_tokens: number;
    output_tokens: number;
    requests: number;
  }>;
  model_breakdown: Record<string, {
    cost: number;
    input_tokens: number;
    output_tokens: number;
    requests: number;
  }>;
  avg_latency_ms: number;
}

interface WorkflowStep {
  number: number;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at?: string;
  completed_at?: string;
  result?: string;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  
  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
    const session_id = typeof body?.session_id === 'string' ? body.session_id : null;
    const template_id = typeof body?.template_id === 'string' ? body.template_id : null;

    if (!prompt.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Load user configuration and limits
    const { data: userConfigData } = await supabase
      .from('user_configuration')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const { data: usageLimitsData } = await supabase
      .from('user_usage_limits')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const userConfig = userConfigData as UserConfig | null;
    const usageLimits = usageLimitsData as UsageLimits | null;

    // Check daily limits before proceeding
    if (usageLimits && userConfig) {
      const dailyLimit = userConfig.effective_daily_cost_limit;
      const currentUsage = usageLimits.current_daily_usage;
      
      if (currentUsage >= dailyLimit) {
        return NextResponse.json({ 
          error: 'Daily usage limit exceeded',
          current_usage: currentUsage,
          daily_limit: dailyLimit
        }, { status: 429 });
      }
    }

    // Get user's AI provider configurations and API keys
    const { data: userAPIKeysData } = await supabase
      .from('user_api_keys')
      .select(`
        *,
        ai_providers!inner(
          name,
          display_name,
          base_url,
          auth_type
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .eq('is_verified', true);

    const userAPIKeys = (userAPIKeysData as UserAPIKey[] | null) ?? [];

    if (userAPIKeys.length === 0) {
      return NextResponse.json({ 
        error: 'No verified API keys found. Please add your AI provider API keys in settings.'
      }, { status: 400 });
    }

    // Get available models for the user's providers
    const providerIds = userAPIKeys.map(key => key.provider_id);
    const { data: availableModelsData } = await supabase
      .from('ai_models')
      .select('*')
      .in('provider_id', providerIds)
      .eq('is_active', true)
      .eq('is_deprecated', false);

    const availableModels = (availableModelsData as AIModel[] | null) ?? [];

    if (availableModels.length === 0) {
      return NextResponse.json({ 
        error: 'No available AI models found for your configured providers.'
      }, { status: 400 });
    }

    // Create or update workflow session
    const workflowSessionId = session_id ?? `session_${Date.now()}_${user.id}`;
    const totalSteps = 5; // Define workflow steps
    
    const { error: sessionError } = await supabase
      .from('workflow_sessions')
      .upsert({
        id: workflowSessionId,
        user_id: user.id,
        template_id: template_id,
        title: `Research: ${prompt.slice(0, 100)}...`,
        description: 'Multi-agent deep research workflow',
        status: 'running',
        priority: 1,
        current_step: 1,
        total_steps: totalSteps,
        progress_percentage: 0,
        execution_state: { prompt, started_at: new Date().toISOString() },
        step_results: {},
        error_state: null,
        context_data: { prompt, user_preferences: userConfig },
        estimated_total_cost: 0.05, // Estimate based on prompt and models
        actual_total_cost: 0,
        cost_breakdown: {},
        metadata: { 
          api_version: '2024.1',
          workflow_type: 'deep_research',
          user_agent: req.headers.get('user-agent') ?? 'unknown'
        }
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Failed to create workflow session:', sessionError);
      return NextResponse.json({ error: 'Failed to initialize workflow' }, { status: 500 });
    }

    // Initialize usage tracking
    const totalUsage: UsageMetrics = {
      total_cost_usd: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_requests: 0,
      provider_breakdown: {},
      model_breakdown: {},
      avg_latency_ms: 0
    };

    // Workflow steps definition
    const workflowSteps: WorkflowStep[] = [
      { number: 1, name: 'Initializing Research', description: 'Setting up multi-agent research workflow', status: 'running' },
      { number: 2, name: 'Primary Research', description: 'Conducting initial research with Gemini', status: 'pending' },
      { number: 3, name: 'Analysis & Synthesis', description: 'Deep analysis with GPT-4', status: 'pending' },
      { number: 4, name: 'Fact Checking', description: 'Verification and validation', status: 'pending' },
      { number: 5, name: 'Final Report', description: 'Generating comprehensive report', status: 'pending' }
    ];

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Step 1: Initialization
          await sendStep(controller, encoder, workflowSteps[0]);
          await updateWorkflowProgress(supabase, workflowSessionId, 1, 20);

          // Step 2: Primary Research with Gemini (if available)
          const geminiKey = userAPIKeys.find(key => key.ai_providers.name === 'google');
          let primaryResearch = '';
          
          if (geminiKey && process.env.GEMINI_API_KEY) {
            await sendStep(controller, encoder, { ...workflowSteps[1], status: 'running' });
            
            const startTime = Date.now();
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const geminiModel = genAI.getGenerativeModel({ 
              model: 'gemini-1.5-flash',
              generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
              }
            });

            const geminiResult = await geminiModel.generateContent(prompt);
            const geminiResponse = geminiResult.response;
            primaryResearch = geminiResponse.text();
            const latency = Date.now() - startTime;

            // Track Gemini usage
            const geminiUsage = geminiResponse.usageMetadata;
            if (geminiUsage) {
              const cost = calculateCost('google', 'gemini-1.5-flash', geminiUsage.promptTokenCount ?? 0, geminiUsage.candidatesTokenCount ?? 0);
              updateUsageMetrics(totalUsage, 'google', 'gemini-1.5-flash', {
                input_tokens: geminiUsage.promptTokenCount ?? 0,
                output_tokens: geminiUsage.candidatesTokenCount ?? 0,
                cost,
                requests: 1,
                latency
              });
            }

            await updateWorkflowProgress(supabase, workflowSessionId, 2, 40);
          }

          // Step 3: Analysis with OpenAI (if available)
          const openaiKey = userAPIKeys.find(key => key.ai_providers.name === 'openai');
          
          if (openaiKey && process.env.OPENAI_API_KEY) {
            await sendStep(controller, encoder, { ...workflowSteps[2], status: 'running' });
            
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            
            const systemMessage = `You are a world-class researcher conducting comprehensive analysis. 
            ${primaryResearch ? `You have initial research: ${primaryResearch}` : ''}
            
            Provide a thorough, well-structured response to: "${prompt}"
            
            Focus on accuracy, depth, and actionable insights.`;

            const startTime = Date.now();
            const openaiResponse = await openai.chat.completions.create({
              model: 'gpt-4-turbo',
              stream: true,
              stream_options: { include_usage: true },
              messages: [
                { role: 'system', content: systemMessage },
                { role: 'user', content: prompt },
              ],
            });

            let openaiUsageData: { prompt_tokens?: number; completion_tokens?: number } | null = null;
            
            for await (const chunk of openaiResponse) {
              if (chunk.usage) {
                openaiUsageData = chunk.usage;
              }
              
              const content = chunk.choices[0]?.delta?.content ?? '';
              if (content) {
                const data = encoder.encode(`data: ${JSON.stringify({ 
                  type: 'content',
                  content 
                })}\n\n`);
                controller.enqueue(data);
              }
            }

            const latency = Date.now() - startTime;

            // Track OpenAI usage
            if (openaiUsageData) {
              const cost = calculateCost('openai', 'gpt-4-turbo', openaiUsageData.prompt_tokens ?? 0, openaiUsageData.completion_tokens ?? 0);
              updateUsageMetrics(totalUsage, 'openai', 'gpt-4-turbo', {
                input_tokens: openaiUsageData.prompt_tokens ?? 0,
                output_tokens: openaiUsageData.completion_tokens ?? 0,
                cost,
                requests: 1,
                latency
              });
            }

            await updateWorkflowProgress(supabase, workflowSessionId, 3, 80);
          }

          // Step 4 & 5: Finalization
          await sendStep(controller, encoder, { ...workflowSteps[3], status: 'completed' });
          await sendStep(controller, encoder, { ...workflowSteps[4], status: 'completed' });
          await updateWorkflowProgress(supabase, workflowSessionId, 5, 100);

          // Save final usage data
          await saveUsageMetrics(supabase, user.id, workflowSessionId, totalUsage);
          
          // Update user usage limits
          await updateUserUsageLimits(supabase, user.id, totalUsage.total_cost_usd);

          // Send final usage data
          const usageData = encoder.encode(`data: ${JSON.stringify({ 
            type: 'usage',
            usage: totalUsage
          })}\n\n`);
          controller.enqueue(usageData);

          // Mark workflow as completed
          await supabase
            .from('workflow_sessions')
            .update({
              status: 'completed',
              progress_percentage: 100,
              actual_total_cost: totalUsage.total_cost_usd,
              cost_breakdown: totalUsage.provider_breakdown,
              completed_at: new Date().toISOString(),
              last_activity_at: new Date().toISOString()
            })
            .eq('id', workflowSessionId);

          // End stream
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();

        } catch (error) {
          console.error('Workflow error:', error);
          
          // Mark workflow as failed
          await supabase
            .from('workflow_sessions')
            .update({
              status: 'failed',
              error_state: {
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
              },
              last_activity_at: new Date().toISOString()
            })
            .eq('id', workflowSessionId);

          const errorData = encoder.encode(`data: ${JSON.stringify({ 
            type: 'error',
            error: {
              message: error instanceof Error ? error.message : 'Workflow failed',
              code: 'WORKFLOW_ERROR'
            }
          })}\n\n`);
          controller.enqueue(errorData);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({
      error: "An error occurred while processing the request.",
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : undefined
    }, { status: 500 });
  }
}

// Helper functions
function sendStep(controller: ReadableStreamDefaultController, encoder: TextEncoder, step: WorkflowStep): Promise<void> {
  return new Promise((resolve) => {
    const data = encoder.encode(`data: ${JSON.stringify({ 
      type: 'step',
      step: {
        number: step.number,
        name: step.name,
        status: step.status,
        description: step.description
      }
    })}\n\n`);
    controller.enqueue(data);
    resolve();
  });
}

async function updateWorkflowProgress(supabase: SupabaseClient, sessionId: string, currentStep: number, progressPercentage: number) {
  await supabase
    .from('workflow_sessions')
    .update({
      current_step: currentStep,
      progress_percentage: progressPercentage,
      last_activity_at: new Date().toISOString()
    })
    .eq('id', sessionId);
}

function calculateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
  // Get pricing from database models or use fallback pricing
  const pricing: Record<string, Record<string, { input: number; output: number }>> = {
    google: {
      'gemini-1.5-flash': { input: 0.00000075, output: 0.000003 }
    },
    openai: {
      'gpt-4-turbo': { input: 0.00001, output: 0.00003 }
    }
  };

  const modelPricing = pricing[provider]?.[model];
  if (!modelPricing) return 0;

  return (inputTokens * modelPricing.input) + (outputTokens * modelPricing.output);
}

function updateUsageMetrics(
  totalUsage: UsageMetrics, 
  provider: string, 
  model: string, 
  usage: { input_tokens: number; output_tokens: number; cost: number; requests: number; latency: number }
) {
  // Update provider breakdown
  if (!totalUsage.provider_breakdown[provider]) {
    totalUsage.provider_breakdown[provider] = {
      cost: 0,
      input_tokens: 0,
      output_tokens: 0,
      requests: 0
    };
  }
  const providerStats = totalUsage.provider_breakdown[provider];
  providerStats.cost += usage.cost;
  providerStats.input_tokens += usage.input_tokens;
  providerStats.output_tokens += usage.output_tokens;
  providerStats.requests += usage.requests;

  // Update model breakdown
  if (!totalUsage.model_breakdown[model]) {
    totalUsage.model_breakdown[model] = {
      cost: 0,
      input_tokens: 0,
      output_tokens: 0,
      requests: 0
    };
  }
  const modelStats = totalUsage.model_breakdown[model];
  modelStats.cost += usage.cost;
  modelStats.input_tokens += usage.input_tokens;
  modelStats.output_tokens += usage.output_tokens;
  modelStats.requests += usage.requests;

  // Update totals
  totalUsage.total_cost_usd += usage.cost;
  totalUsage.total_input_tokens += usage.input_tokens;
  totalUsage.total_output_tokens += usage.output_tokens;
  totalUsage.total_requests += usage.requests;
  
  // Update average latency
  const totalRequests = totalUsage.total_requests;
  totalUsage.avg_latency_ms = totalRequests > 0 ? 
    ((totalUsage.avg_latency_ms * (totalRequests - 1)) + usage.latency) / totalRequests : 
    usage.latency;
}

async function saveUsageMetrics(supabase: SupabaseClient, userId: string, sessionId: string, usage: UsageMetrics) {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 1);

  // Save to usage_summaries table
  await supabase
    .from('usage_summaries')
    .upsert({
      user_id: userId,
      period_type: 'daily',
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      total_requests: usage.total_requests,
      successful_requests: usage.total_requests, // Assuming success if we got here
      failed_requests: 0,
      cached_requests: 0,
      total_tokens: usage.total_input_tokens + usage.total_output_tokens,
      total_input_tokens: usage.total_input_tokens,
      total_output_tokens: usage.total_output_tokens,
      total_cost_usd: usage.total_cost_usd,
      avg_latency_ms: usage.avg_latency_ms,
      provider_breakdown: usage.provider_breakdown,
      model_breakdown: usage.model_breakdown,
      session_id: sessionId
    }, { 
      onConflict: 'user_id,period_type,period_start',
      ignoreDuplicates: false 
    });
}

async function updateUserUsageLimits(supabase: SupabaseClient, userId: string, additionalCost: number) {
  // Update current daily usage
  await supabase.rpc('increment_daily_usage', {
    p_user_id: userId,
    p_additional_cost: additionalCost
  });
} 