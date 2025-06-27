// Enhanced AI Platform User Settings Types
// Aligned with the comprehensive database schema

export interface UserProfile {
  readonly id: string;
  readonly email: string;
  readonly username?: string;
  readonly first_name?: string;
  readonly last_name?: string;
  readonly avatar_url?: string;
  readonly bio?: string;
  
  // Location and preferences
  readonly country_code?: string;
  readonly timezone?: string;
  readonly locale?: string;
  readonly date_format?: string;
  readonly time_format?: string;
  readonly currency?: string;
  
  // User classification
  readonly user_type?: 'individual' | 'business' | 'enterprise' | 'developer';
  readonly experience_level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  readonly primary_use_cases?: string[];
  
  // Account status
  readonly is_active: boolean;
  readonly email_verified: boolean;
  readonly onboarding_completed: boolean;
  readonly onboarding_step: number;
  
  readonly created_at: string;
  readonly updated_at: string;
}

export interface UserConfiguration {
  readonly id: string;
  readonly user_id: string;
  
  // User-configurable limits
  readonly preferred_daily_cost_limit?: number;
  readonly preferred_monthly_cost_limit?: number;
  readonly preferred_daily_request_limit?: number;
  readonly preferred_monthly_request_limit?: number;
  readonly preferred_daily_token_limit?: number;
  readonly preferred_monthly_token_limit?: number;
  
  // Plan-enforced limits
  readonly plan_daily_cost_limit: number;
  readonly plan_monthly_cost_limit: number;
  readonly plan_daily_request_limit: number;
  readonly plan_monthly_request_limit: number;
  readonly plan_daily_token_limit: number;
  readonly plan_monthly_token_limit: number;
  
  // Effective limits (computed)
  readonly effective_daily_cost_limit: number;
  readonly effective_monthly_cost_limit: number;
  readonly effective_daily_request_limit: number;
  readonly effective_monthly_request_limit: number;
  readonly effective_daily_token_limit: number;
  readonly effective_monthly_token_limit: number;
  
  // Alert settings
  readonly cost_alert_thresholds: number[];
  readonly usage_alert_thresholds: number[];
  readonly alert_methods: {
    email: boolean;
    push: boolean;
    webhook: boolean;
  };
  readonly webhook_url?: string;
  readonly alert_frequency: 'instant' | 'hourly' | 'daily' | 'smart';
  
  // Data retention
  readonly conversation_retention_days?: number;
  readonly document_retention_days?: number;
  readonly analytics_retention_days?: number;
  readonly auto_cleanup_enabled: boolean;
  
  // AI preferences
  readonly preferred_ai_providers?: string[];
  readonly model_selection_strategy: 'auto' | 'cost_optimized' | 'performance_optimized' | 'user_choice';
  readonly auto_fallback_enabled: boolean;
  readonly cost_optimization_enabled: boolean;
  
  // Processing preferences
  readonly max_concurrent_workflows?: number;
  readonly workflow_timeout_minutes?: number;
  readonly auto_retry_enabled: boolean;
  readonly max_retry_attempts: number;
  
  // Document processing
  readonly max_file_size_mb?: number;
  readonly preferred_chunk_size?: number;
  readonly chunk_overlap_percentage: number;
  readonly auto_extract_entities: boolean;
  readonly auto_generate_summaries: boolean;
  
  // UI preferences
  readonly theme: 'light' | 'dark' | 'system' | 'auto';
  readonly ui_density: 'compact' | 'comfortable' | 'spacious';
  readonly sidebar_collapsed: boolean;
  readonly auto_save_enabled: boolean;
  readonly keyboard_shortcuts_enabled: boolean;
  readonly animations_enabled: boolean;
  
  // Privacy settings
  readonly data_sharing_consent: boolean;
  readonly analytics_consent: boolean;
  readonly marketing_consent: boolean;
  readonly session_timeout_minutes: number;
  readonly require_2fa: boolean;
  
  // Intelligent features
  readonly smart_suggestions_enabled: boolean;
  readonly auto_optimization_enabled: boolean;
  readonly learning_mode_enabled: boolean;
  readonly personalization_enabled: boolean;
  
  // New fields for dashboard
  readonly subscription_plan?: string;
  readonly current_daily_cost: number;
  readonly current_monthly_cost: number;
  
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
  readonly default_rate_limits: {
    requests_per_minute?: number;
    tokens_per_minute?: number;
    concurrent_requests?: number;
  };
  readonly health_status?: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  readonly documentation_url?: string;
  readonly pricing_url?: string;
}

export interface UserAIProviderConfig {
  readonly id: string;
  readonly user_id: string;
  readonly provider_id: string;
  readonly custom_timeout_seconds?: number;
  readonly custom_max_retries?: number;
  readonly custom_rate_limits?: Record<string, number>;
  readonly effective_rate_limits?: Record<string, number>;
  readonly reliability_score?: number;
  readonly performance_score?: number;
  readonly cost_efficiency_score?: number;
  readonly user_priority: number;
  readonly preferred_models?: string[];
  readonly blocked_models?: string[];
  readonly is_enabled: boolean;
  readonly auto_failover_enabled: boolean;
  readonly cost_optimization_enabled: boolean;
  readonly performance_optimization_enabled: boolean;
  readonly notes?: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface AIModel {
  readonly id: string;
  readonly provider_id: string;
  readonly provider_name?: string;
  readonly model_id: string;
  readonly display_name: string;
  readonly description?: string;
  readonly model_family?: string;
  readonly model_version?: string;
  readonly capabilities: string[];
  readonly context_window?: number;
  readonly max_output_tokens?: number;
  readonly supports_streaming: boolean;
  readonly supports_function_calling: boolean;
  readonly supports_vision: boolean;
  readonly supports_json_mode: boolean;
  readonly pricing: {
    input_cost_per_1k: number;
    output_cost_per_1k: number;
    [key: string]: number;
  };
  readonly default_performance_score?: number;
  readonly default_speed_score?: number;
  readonly default_cost_efficiency?: number;
  readonly avg_latency_ms?: number;
  readonly success_rate?: number;
  readonly best_use_cases?: string[];
  readonly limitations?: string[];
  readonly is_active: boolean;
  readonly is_deprecated: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface UserAPIKey {
  readonly id: string;
  readonly user_id: string;
  readonly provider_id: string;
  readonly provider_name: string;
  readonly provider_display_name: string;
  readonly key_name?: string;
  readonly key_hash: string;
  readonly custom_rate_limits?: Record<string, number>;
  readonly daily_usage_limit?: number;
  readonly monthly_usage_limit?: number;
  readonly is_active: boolean;
  readonly is_verified: boolean;
  readonly verification_attempts: number;
  readonly last_verification_at?: string;
  readonly last_used_at?: string;
  readonly usage_count: number;
  readonly total_cost_usd: number;
  readonly total_tokens: number;
  readonly expires_at?: string;
  readonly auto_rotate_enabled: boolean;
  readonly usage_alerts_enabled: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface UsageLimits {
  readonly id: string;
  readonly user_id: string;
  readonly hard_stop_enabled: boolean;
  readonly soft_warning_enabled: boolean;
  readonly auto_optimization_enabled: boolean;
  readonly reset_day?: number;
  readonly reset_hour?: number;
  readonly reset_timezone?: string;
  readonly email_alerts: boolean;
  readonly push_alerts: boolean;
  readonly webhook_url?: string;
  readonly alert_cooldown_minutes: number;
  readonly emergency_stop_enabled: boolean;
  readonly emergency_threshold_multiplier: number;
  readonly auto_scale_enabled: boolean;
  readonly scale_up_threshold: number;
  readonly scale_down_threshold: number;
  readonly max_auto_scale_factor: number;
  readonly current_daily_usage: number;
  readonly current_monthly_usage: number;
  readonly current_daily_requests: number;
  readonly current_monthly_requests: number;
  readonly current_daily_tokens: number;
  readonly current_monthly_tokens: number;
  readonly cost_per_request?: number;
  readonly tokens_per_request?: number;
  readonly avg_request_latency_ms?: number;
  readonly last_daily_reset_at: string;
  readonly last_monthly_reset_at: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface UsageSummary {
  readonly id: string;
  readonly user_id: string;
  readonly period_type: 'hourly' | 'daily' | 'weekly' | 'monthly';
  readonly period_start: string;
  readonly period_end: string;
  readonly total_requests: number;
  readonly successful_requests: number;
  readonly failed_requests: number;
  readonly cached_requests: number;
  readonly total_tokens: number;
  readonly total_input_tokens: number;
  readonly total_output_tokens: number;
  readonly total_cost_usd: number;
  readonly avg_latency_ms: number;
  readonly max_latency_ms: number;
  readonly min_latency_ms: number;
  readonly p95_latency_ms: number;
  readonly avg_tokens_per_request: number;
  readonly avg_cost_per_request: number;
  readonly provider_breakdown: Record<string, unknown>;
  readonly model_breakdown: Record<string, unknown>;
  readonly use_case_breakdown: Record<string, unknown>;
  readonly request_type_breakdown: Record<string, unknown>;
  readonly hourly_distribution: Record<string, unknown>;
  readonly error_breakdown: Record<string, unknown>;
  readonly avg_user_rating?: number;
  readonly avg_quality_score?: number;
  readonly avg_cost_efficiency_score?: number;
  readonly cache_hit_rate?: number;
  readonly cost_limit_utilization?: number;
  readonly request_limit_utilization?: number;
  readonly token_limit_utilization?: number;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface UsageAlert {
  readonly id: string;
  readonly user_id: string;
  readonly alert_type: string;
  readonly severity: 'info' | 'warning' | 'error' | 'critical';
  readonly title: string;
  readonly message: string;
  readonly data: Record<string, unknown>;
  readonly recommendations: string[];
  readonly trigger_type: 'threshold' | 'trend' | 'anomaly' | 'prediction' | 'manual';
  readonly actual_value?: number;
  readonly threshold_value?: number;
  readonly delivery_methods: {
    email: boolean;
    push: boolean;
    webhook: boolean;
  };
  readonly email_sent: boolean;
  readonly email_sent_at?: string;
  readonly push_sent: boolean;
  readonly push_sent_at?: string;
  readonly webhook_sent: boolean;
  readonly webhook_sent_at?: string;
  readonly is_read: boolean;
  readonly read_at?: string;
  readonly is_dismissed: boolean;
  readonly dismissed_at?: string;
  readonly is_resolved: boolean;
  readonly resolved_at?: string;
  readonly auto_resolved: boolean;
  readonly expires_at?: string;
  readonly snooze_until?: string;
  readonly created_at: string;
}

export interface WorkflowTemplate {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly category: string;
  readonly difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  readonly estimated_duration_minutes?: number;
  readonly estimated_cost_range: {
    min: number;
    max: number;
  };
  readonly is_public: boolean;
  readonly is_featured: boolean;
  readonly created_by?: string;
  readonly template_data: Record<string, unknown>;
  readonly tags: string[];
  readonly usage_count: number;
  readonly rating: number;
  readonly review_count: number;
  readonly version: number;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface WorkflowSession {
  readonly id: string;
  readonly user_id: string;
  readonly template_id?: string;
  readonly workspace_id?: string;
  readonly workflow_title?: string;
  readonly title: string;
  readonly description?: string;
  readonly status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  readonly priority: number;
  readonly current_step: number;
  readonly current_step_name?: string;
  readonly total_steps?: number;
  readonly progress_percentage: number;
  readonly execution_state: Record<string, unknown>;
  readonly step_results: Record<string, unknown>;
  readonly error_state?: Record<string, unknown>;
  readonly context_data: Record<string, unknown>;
  readonly estimated_total_cost?: number;
  readonly actual_total_cost: number;
  readonly cost_breakdown: Record<string, unknown>;
  readonly started_at?: string;
  readonly completed_at?: string;
  readonly last_activity_at: string;
  readonly timeout_at?: string;
  readonly metadata: Record<string, unknown>;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface SubscriptionPlan {
  readonly id: string;
  readonly stripe_price_id: string;
  readonly stripe_product_id: string;
  readonly plan_name: string;
  readonly plan_description?: string;
  readonly plan_type: 'free' | 'starter' | 'pro' | 'enterprise' | 'custom';
  readonly billing_interval: 'month' | 'year' | 'one_time' | 'usage_based';
  readonly unit_amount: number;
  readonly currency: string;
  readonly pricing_model: 'per_seat' | 'tiered' | 'volume' | 'usage_based' | 'flat_rate';
  readonly features: Record<string, unknown>;
  readonly feature_limits: Record<string, unknown>;
  readonly is_active: boolean;
  readonly is_featured: boolean;
  readonly target_audience: string[];
  readonly trial_period_days: number;
  readonly sort_order: number;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface UserSubscription {
  readonly id: string;
  readonly user_id: string;
  readonly plan_id: string;
  readonly stripe_subscription_id?: string;
  readonly stripe_customer_id: string;
  readonly status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused' | 'trialing' | 'incomplete';
  readonly subscription_type: 'paid' | 'trial' | 'free' | 'sponsored' | 'legacy' | 'beta';
  readonly current_period_start?: string;
  readonly current_period_end?: string;
  readonly trial_start?: string;
  readonly trial_end?: string;
  readonly usage_based_billing: boolean;
  readonly custom_limits: Record<string, unknown>;
  readonly custom_features: Record<string, unknown>;
  readonly addon_subscriptions: unknown[];
  readonly auto_renewal: boolean;
  readonly payment_method_id?: string;
  readonly billing_email?: string;
  readonly cancel_at_period_end: boolean;
  readonly canceled_at?: string;
  readonly cancellation_reason?: string;
  readonly last_invoice_date?: string;
  readonly next_invoice_date?: string;
  readonly created_at: string;
  readonly updated_at: string;
}

// Settings section types
export type SettingsSection = 'profile' | 'ai-providers' | 'usage-limits' | 'billing' | 'collaboration' | 'privacy' | 'account';

export interface ProfileUpdateData {
  username?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  bio?: string;
  country_code?: string;
  timezone?: string;
  locale?: string;
  date_format?: string;
  time_format?: string;
  currency?: string;
  user_type?: 'individual' | 'business' | 'enterprise' | 'developer';
  experience_level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  primary_use_cases?: string[];
}

export interface UserConfigurationUpdateData {
  preferred_daily_cost_limit?: number;
  preferred_monthly_cost_limit?: number;
  preferred_daily_request_limit?: number;
  preferred_monthly_request_limit?: number;
  preferred_daily_token_limit?: number;
  preferred_monthly_token_limit?: number;
  cost_alert_thresholds?: number[];
  usage_alert_thresholds?: number[];
  alert_methods?: {
    email?: boolean;
    push?: boolean;
    webhook?: boolean;
  };
  webhook_url?: string;
  alert_frequency?: 'instant' | 'hourly' | 'daily' | 'smart';
  conversation_retention_days?: number;
  document_retention_days?: number;
  analytics_retention_days?: number;
  auto_cleanup_enabled?: boolean;
  preferred_ai_providers?: string[];
  model_selection_strategy?: 'auto' | 'cost_optimized' | 'performance_optimized' | 'user_choice';
  auto_fallback_enabled?: boolean;
  cost_optimization_enabled?: boolean;
  max_concurrent_workflows?: number;
  workflow_timeout_minutes?: number;
  auto_retry_enabled?: boolean;
  max_retry_attempts?: number;
  max_file_size_mb?: number;
  preferred_chunk_size?: number;
  chunk_overlap_percentage?: number;
  auto_extract_entities?: boolean;
  auto_generate_summaries?: boolean;
  theme?: 'light' | 'dark' | 'system' | 'auto';
  ui_density?: 'compact' | 'comfortable' | 'spacious';
  sidebar_collapsed?: boolean;
  auto_save_enabled?: boolean;
  keyboard_shortcuts_enabled?: boolean;
  animations_enabled?: boolean;
  data_sharing_consent?: boolean;
  analytics_consent?: boolean;
  marketing_consent?: boolean;
  session_timeout_minutes?: number;
  require_2fa?: boolean;
  smart_suggestions_enabled?: boolean;
  auto_optimization_enabled?: boolean;
  learning_mode_enabled?: boolean;
  personalization_enabled?: boolean;
}

export interface APIKeyCreateData {
  provider_id: string;
  api_key: string; // Raw API key, encryption is handled server-side
  key_name?: string;
  custom_rate_limits?: Record<string, number>;
  daily_usage_limit?: number;
  monthly_usage_limit?: number;
  expires_at?: string;
  auto_rotate_enabled?: boolean;
  usage_alerts_enabled?: boolean;
}

export interface UsageLimitsUpdateData {
  hard_stop_enabled?: boolean;
  soft_warning_enabled?: boolean;
  auto_optimization_enabled?: boolean;
  reset_day?: number;
  reset_hour?: number;
  email_alerts?: boolean;
  push_alerts?: boolean;
  webhook_url?: string;
  alert_cooldown_minutes?: number;
  emergency_stop_enabled?: boolean;
  emergency_threshold_multiplier?: number;
  auto_scale_enabled?: boolean;
  scale_up_threshold?: number;
  scale_down_threshold?: number;
  max_auto_scale_factor?: number;
} 