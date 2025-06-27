// AI Platform User Settings Types
// Aligned with database-setup.sql schema

export interface UserProfile {
  readonly id: string;
  readonly email: string;
  readonly username?: string;
  readonly first_name?: string;
  readonly last_name?: string;
  readonly avatar_url?: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly display_name: string;
  readonly base_url: string;
  readonly auth_type: string;
  readonly is_active: boolean;
  readonly rate_limits?: {
    requests_per_minute?: number;
    tokens_per_minute?: number;
  };
}

export interface AIModel {
  readonly id: string;
  readonly provider_id: string;
  readonly model_id: string;
  readonly display_name: string;
  readonly description?: string;
  readonly capabilities: string[];
  readonly pricing?: {
    input_cost_per_1k?: number;
    output_cost_per_1k?: number;
  };
  readonly context_window?: number;
  readonly max_output_tokens?: number;
  readonly is_active: boolean;
  readonly performance_score?: number;
  readonly speed_score?: number;
  readonly cost_efficiency?: number;
  readonly best_use_cases?: string[];
}

export interface UserAPIKey {
  readonly id: string;
  readonly user_id: string;
  readonly provider_id: string;
  readonly provider_name: string;
  readonly provider_display_name: string;
  readonly key_name?: string;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface UsageLimits {
  readonly id: string;
  readonly user_id: string;
  readonly daily_limit_usd: number;
  readonly monthly_limit_usd: number;
  readonly hard_stop_enabled: boolean;
  readonly warning_threshold: number;
  readonly reset_day: number;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface UsageSummary {
  readonly date: string;
  readonly total_requests: number;
  readonly total_tokens: number;
  readonly total_cost_usd: number;
  readonly provider_breakdown?: Record<string, unknown>;
  readonly model_breakdown?: Record<string, unknown>;
}

export interface StripeCustomer {
  readonly id: string;
  readonly user_id: string;
  readonly stripe_customer_id: string;
  readonly email?: string;
}

export interface StripeSubscription {
  readonly id: string;
  readonly user_id: string;
  readonly customer_id: string;
  readonly price_id: string;
  readonly status: string;
  readonly current_period_start?: string;
  readonly current_period_end?: string;
  readonly product_name?: string;
}

export interface StripePrice {
  readonly id: string;
  readonly product_id: string;
  readonly unit_amount?: number;
  readonly currency: string;
  readonly recurring_interval?: string;
  readonly type: string;
  readonly active: boolean;
  readonly product_name?: string;
  readonly product_description?: string;
}

// Settings section types
export type SettingsSection = 'profile' | 'api-keys' | 'usage-limits' | 'billing' | 'account';

export interface ProfileUpdateData {
  username?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}

export interface APIKeyCreateData {
  provider_id: string;
  encrypted_api_key: string;
  key_name?: string;
}

export interface UsageLimitsUpdateData {
  daily_limit_usd?: number;
  monthly_limit_usd?: number;
  hard_stop_enabled?: boolean;
  warning_threshold?: number;
  reset_day?: number;
} 