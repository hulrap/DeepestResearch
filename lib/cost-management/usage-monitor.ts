// Cursor-Style Cost Management & Usage Monitoring System
// Provides real-time spending limits and cost controls

import { createClient } from '@/lib/supabase/client';

export interface UsageLimits {
  daily_limit_usd: number;
  monthly_limit_usd: number;
  hard_stop_enabled: boolean;
  warning_threshold: number; // Percentage (0.8 = 80%)
  notification_enabled: boolean;
  auto_pause_workflows: boolean;
}

export interface UsageStats {
  today: {
    cost: number;
    requests: number;
    tokens: number;
    limit: number;
    percentage: number;
  };
  this_month: {
    cost: number;
    requests: number;
    tokens: number;
    limit: number;
    percentage: number;
  };
  remaining: {
    daily: number;
    monthly: number;
  };
  status: 'safe' | 'warning' | 'limit_reached' | 'exceeded';
}

export interface CostPrediction {
  estimated_tokens: number;
  estimated_cost: number;
  will_exceed_daily: boolean;
  will_exceed_monthly: boolean;
  recommendation: string;
}

export class UsageMonitor {
  private supabase = createClient();

  // Check if user can make a request with estimated cost
  async canMakeRequest(userId: string, estimatedCost: number): Promise<{
    allowed: boolean;
    reason?: string;
    suggestion?: string;
  }> {
    const limits = await this.getUserLimits(userId);
    const stats = await this.getCurrentUsage(userId);

    // Check daily limit
    if (limits.hard_stop_enabled) {
      const newDailyTotal = stats.today.cost + estimatedCost;
      if (newDailyTotal > limits.daily_limit_usd) {
        return {
          allowed: false,
          reason: `Request would exceed daily limit ($${limits.daily_limit_usd})`,
          suggestion: `Current usage: $${stats.today.cost.toFixed(4)}, Request cost: $${estimatedCost.toFixed(4)}`
        };
      }

      // Check monthly limit
      const newMonthlyTotal = stats.this_month.cost + estimatedCost;
      if (newMonthlyTotal > limits.monthly_limit_usd) {
        return {
          allowed: false,
          reason: `Request would exceed monthly limit ($${limits.monthly_limit_usd})`,
          suggestion: `Current usage: $${stats.this_month.cost.toFixed(4)}, Request cost: $${estimatedCost.toFixed(4)}`
        };
      }
    }

    // Check warning threshold
    const dailyPercentage = (stats.today.cost + estimatedCost) / limits.daily_limit_usd;
    const monthlyPercentage = (stats.this_month.cost + estimatedCost) / limits.monthly_limit_usd;

    if (dailyPercentage > limits.warning_threshold || monthlyPercentage > limits.warning_threshold) {
      const percentage = Math.max(dailyPercentage, monthlyPercentage) * 100;
      return {
        allowed: true,
        reason: `Warning: ${percentage.toFixed(1)}% of limit reached`,
        suggestion: 'Consider monitoring your usage more closely'
      };
    }

    return { allowed: true };
  }

  // Predict cost for a multi-step workflow
  async predictWorkflowCost(userId: string, workflowSteps: Array<{
    model: string;
    estimated_input_tokens: number;
    estimated_output_tokens: number;
  }>): Promise<CostPrediction> {
    let totalCost = 0;
    let totalTokens = 0;

    // Calculate estimated cost for each step
    for (const step of workflowSteps) {
      const pricing = await this.getModelPricing(step.model);
      const stepCost = 
        (step.estimated_input_tokens / 1000) * pricing.input_cost_per_1k +
        (step.estimated_output_tokens / 1000) * pricing.output_cost_per_1k;
      
      totalCost += stepCost;
      totalTokens += step.estimated_input_tokens + step.estimated_output_tokens;
    }

    const stats = await this.getCurrentUsage(userId);
    const limits = await this.getUserLimits(userId);

    const willExceedDaily = (stats.today.cost + totalCost) > limits.daily_limit_usd;
    const willExceedMonthly = (stats.this_month.cost + totalCost) > limits.monthly_limit_usd;

    let recommendation = 'Workflow is within your limits';
    if (willExceedDaily) {
      recommendation = 'This workflow will exceed your daily limit. Consider reducing scope or increasing limits.';
    } else if (willExceedMonthly) {
      recommendation = 'This workflow will exceed your monthly limit. Consider upgrading your plan.';
    } else if ((stats.today.cost + totalCost) / limits.daily_limit_usd > 0.8) {
      recommendation = 'This workflow will use a significant portion of your daily limit.';
    }

    return {
      estimated_tokens: totalTokens,
      estimated_cost: totalCost,
      will_exceed_daily: willExceedDaily,
      will_exceed_monthly: willExceedMonthly,
      recommendation
    };
  }

  // Get current usage statistics
  async getCurrentUsage(userId: string): Promise<UsageStats> {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    // Get daily usage
    const { data: dailyUsage } = await this.supabase
      .from('daily_usage_summaries')
      .select('total_cost_usd, total_requests, total_tokens')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    // Get monthly usage
    const { data: monthlyUsage } = await this.supabase
      .from('daily_usage_summaries')
      .select('total_cost_usd, total_requests, total_tokens')
      .eq('user_id', userId)
      .gte('date', monthStart)
      .lt('date', new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().split('T')[0]);

    const limits = await this.getUserLimits(userId);

    const todayCost = Number(dailyUsage?.total_cost_usd) || 0;
    const monthCost = monthlyUsage?.reduce((sum: number, day: { total_cost_usd: unknown }) => sum + Number(day.total_cost_usd), 0) || 0;

    const dailyPercentage = todayCost / limits.daily_limit_usd;
    const monthlyPercentage = monthCost / limits.monthly_limit_usd;

    let status: UsageStats['status'] = 'safe';
    if (dailyPercentage >= 1 || monthlyPercentage >= 1) {
      status = 'exceeded';
    } else if (dailyPercentage > limits.warning_threshold || monthlyPercentage > limits.warning_threshold) {
      status = 'warning';
    } else if (dailyPercentage > 0.95 || monthlyPercentage > 0.95) {
      status = 'limit_reached';
    }

    return {
      today: {
        cost: todayCost,
        requests: Number(dailyUsage?.total_requests) || 0,
        tokens: Number(dailyUsage?.total_tokens) || 0,
        limit: limits.daily_limit_usd,
        percentage: dailyPercentage * 100
      },
      this_month: {
        cost: monthCost,
        requests: monthlyUsage?.reduce((sum, day: { total_requests: unknown }) => sum + Number(day.total_requests), 0) || 0,
        tokens: monthlyUsage?.reduce((sum, day: { total_tokens: unknown }) => sum + Number(day.total_tokens), 0) || 0,
        limit: limits.monthly_limit_usd,
        percentage: monthlyPercentage * 100
      },
      remaining: {
        daily: Math.max(0, limits.daily_limit_usd - todayCost),
        monthly: Math.max(0, limits.monthly_limit_usd - monthCost)
      },
      status
    };
  }

  // Update user's spending limits (Cursor-style interface)
  async updateLimits(userId: string, limits: Partial<UsageLimits>): Promise<void> {
    const { error } = await this.supabase
      .from('user_usage_limits')
      .upsert({
        user_id: userId,
        ...limits,
        updated_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Failed to update limits: ${error.message}`);
    }
  }

  // Log actual usage after API call
  async logUsage(usage: {
    user_id: string;
    provider_id: string;
    model_id: string;
    session_id?: string;
    workflow_id?: string;
    agent_step?: string;
    input_tokens: number;
    output_tokens: number;
    input_cost_usd: number;
    output_cost_usd: number;
    latency_ms: number;
    status: string;
    request_data?: Record<string, unknown>;
    response_data?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('api_usage_logs')
      .insert({
        ...usage,
        created_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Failed to log usage: ${error.message}`);
    }

    // Trigger warning notifications if needed
    await this.checkWarningThresholds(usage.user_id);
  }

  // Get detailed usage analytics
  async getUsageAnalytics(userId: string, days: number = 30): Promise<{
    daily_breakdown: Array<{
      date: string;
      cost: number;
      requests: number;
      tokens: number;
      top_models: Array<{ model: string; cost: number }>;
    }>;
    provider_breakdown: Record<string, number>;
    model_breakdown: Record<string, number>;
    cost_trends: {
      trend: 'increasing' | 'decreasing' | 'stable';
      percentage_change: number;
    };
  }> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    // Get detailed usage logs
    const { data: logs } = await this.supabase
      .from('api_usage_logs')
      .select(`
        created_at,
        total_cost_usd,
        total_tokens,
        ai_providers(name),
        ai_models(model_id)
      `)
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    // Process analytics
    const dailyBreakdown = this.processLogsForAnalytics(logs || []);
    const providerBreakdown = this.calculateProviderBreakdown(logs || []);
    const modelBreakdown = this.calculateModelBreakdown(logs || []);
    const costTrends = this.calculateCostTrends(dailyBreakdown);

    return {
      daily_breakdown: dailyBreakdown,
      provider_breakdown: providerBreakdown,
      model_breakdown: modelBreakdown,
      cost_trends: costTrends
    };
  }

  // Private helper methods
  private async getUserLimits(userId: string): Promise<UsageLimits> {
    const { data } = await this.supabase
      .from('user_usage_limits')
      .select('*')
      .eq('user_id', userId)
      .single();

    return data || {
      daily_limit_usd: 10.00,
      monthly_limit_usd: 100.00,
      hard_stop_enabled: true,
      warning_threshold: 0.8,
      notification_enabled: true,
      auto_pause_workflows: true
    };
  }

  private async getModelPricing(model: string): Promise<{
    input_cost_per_1k: number;
    output_cost_per_1k: number;
  }> {
    const { data } = await this.supabase
      .from('ai_models')
      .select('pricing')
      .eq('model_id', model)
      .single();

    return data?.pricing || { input_cost_per_1k: 0.01, output_cost_per_1k: 0.03 };
  }

  private async checkWarningThresholds(userId: string): Promise<void> {
    const stats = await this.getCurrentUsage(userId);
    const limits = await this.getUserLimits(userId);

    if (!limits.notification_enabled) return;

    if (stats.status === 'warning' || stats.status === 'limit_reached') {
      // Send notification (implement your notification system here)
      console.log(`Usage warning for user ${userId}: ${stats.status}`);
    }
  }

  private processLogsForAnalytics(logs: Array<{
    created_at: unknown;
    total_cost_usd: unknown;
    total_tokens: unknown;
    ai_models?: unknown;
    ai_providers?: unknown;
  }>): Array<{
    date: string;
    cost: number;
    requests: number;
    tokens: number;
    top_models: Array<{ model: string; cost: number }>;
  }> {
    // Group by date and calculate daily totals
    const dailyMap = new Map();
    
    logs.forEach(log => {
      const date = String(log.created_at).split('T')[0];
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          cost: 0,
          requests: 0,
          tokens: 0,
          models: new Map()
        });
      }
      
      const day = dailyMap.get(date);
      day.cost += Number(log.total_cost_usd);
      day.requests += 1;
      day.tokens += Number(log.total_tokens);
      
      const model = (log.ai_models as { model_id?: string })?.model_id || 'unknown';
      day.models.set(model, (day.models.get(model) || 0) + Number(log.total_cost_usd));
    });

    return Array.from(dailyMap.values()).map(day => ({
      ...day,
      top_models: Array.from(day.models.entries() as [string, number][])
        .map(([model, cost]) => ({ model, cost }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 3)
    }));
  }

  private calculateProviderBreakdown(logs: Array<{
    total_cost_usd: unknown;
    ai_providers?: unknown;
  }>): Record<string, number> {
    const breakdown: Record<string, number> = {};
    
    logs.forEach(log => {
      const provider = (log.ai_providers as { name?: string })?.name || 'unknown';
      breakdown[provider] = (breakdown[provider] || 0) + Number(log.total_cost_usd);
    });
    
    return breakdown;
  }

  private calculateModelBreakdown(logs: Array<{
    total_cost_usd: unknown;
    ai_models?: unknown;
  }>): Record<string, number> {
    const breakdown: Record<string, number> = {};
    
    logs.forEach(log => {
      const model = (log.ai_models as { model_id?: string })?.model_id || 'unknown';
      breakdown[model] = (breakdown[model] || 0) + Number(log.total_cost_usd);
    });
    
    return breakdown;
  }

  private calculateCostTrends(dailyBreakdown: Array<{ cost: number }>): {
    trend: 'increasing' | 'decreasing' | 'stable';
    percentage_change: number;
  } {
    if (dailyBreakdown.length < 2) {
      return { trend: 'stable', percentage_change: 0 };
    }

    const firstHalf = dailyBreakdown.slice(0, Math.floor(dailyBreakdown.length / 2));
    const secondHalf = dailyBreakdown.slice(Math.floor(dailyBreakdown.length / 2));

    const firstAvg = firstHalf.reduce((sum, day) => sum + day.cost, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, day) => sum + day.cost, 0) / secondHalf.length;

    const percentageChange = ((secondAvg - firstAvg) / firstAvg) * 100;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (percentageChange > 10) trend = 'increasing';
    else if (percentageChange < -10) trend = 'decreasing';

    return { trend, percentage_change: percentageChange };
  }
} 