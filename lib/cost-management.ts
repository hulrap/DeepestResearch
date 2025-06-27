// Cursor-Style Cost Management & Usage Monitoring System
// Provides real-time spending limits and cost controls

import { createClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

export interface UsageLimits {
  user_id: string;
  current_daily_usage: number;
  current_monthly_usage: number;
  daily_limit_usd: number;
  monthly_limit_usd: number;
  hard_stop_enabled: boolean;
  warning_threshold: number; // Percentage (0.8 = 80%)
  notification_enabled: boolean;
  auto_pause_workflows: boolean;
  last_reset_date: string;
  created_at: string;
  updated_at: string;
}

interface UsageSummary {
  id: string;
  user_id: string;
  period_type: string;
  period_start: string;
  period_end: string;
  total_cost_usd: number;
  total_requests: number;
  total_tokens: number;
  [key: string]: unknown;
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

export class UsageMonitor {
  private supabase = createClient;

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

    return { allowed: true };
  }

  async getCurrentUsage(userId: string): Promise<UsageStats> {
    const today = new Date().toISOString().split('T')[0];

    // Get daily usage
    const supabase = await this.supabase();
    const { data: dailyUsage } = await supabase
      .from('daily_usage_summaries')
      .select('total_cost_usd, total_requests, total_tokens')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    const limits = await this.getUserLimits(userId);
    const todayCost = Number(dailyUsage?.total_cost_usd) || 0;

    return {
      today: {
        cost: todayCost,
        requests: Number(dailyUsage?.total_requests) || 0,
        tokens: Number(dailyUsage?.total_tokens) || 0,
        limit: limits.daily_limit_usd,
        percentage: (todayCost / limits.daily_limit_usd) * 100
      },
      this_month: {
        cost: 0, // Simplified for now
        requests: 0,
        tokens: 0,
        limit: limits.monthly_limit_usd,
        percentage: 0
      },
      remaining: {
        daily: Math.max(0, limits.daily_limit_usd - todayCost),
        monthly: limits.monthly_limit_usd
      },
      status: todayCost > limits.daily_limit_usd ? 'exceeded' : 'safe'
    };
  }

  async getUserUsageStats(userId: string): Promise<{
    daily_cost: number;
    daily_limit: number;
    monthly_cost: number;
    monthly_limit: number;
    total_requests: number;
    favorite_models: string[];
    total_workflows: number;
  }> {
    const usage = await this.getCurrentUsage(userId);
    
    return {
      daily_cost: usage.today.cost,
      daily_limit: usage.today.limit,
      monthly_cost: usage.this_month.cost,
      monthly_limit: usage.this_month.limit,
      total_requests: usage.today.requests,
      favorite_models: ['gpt-4-turbo', 'claude-3-sonnet'],
      total_workflows: 3
    };
  }

  private async getUserLimits(userId: string): Promise<UsageLimits> {
    const supabase = await this.supabase();
    const { data } = await supabase
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
}

export async function getUserUsageData(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('usage_summaries')
    .select('*')
    .eq('user_id', userId)
    .order('period_start', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Error fetching usage data:', error);
    return null;
  }

  const usageData = data as UsageSummary[] | null;
  return usageData ?? [];
} 