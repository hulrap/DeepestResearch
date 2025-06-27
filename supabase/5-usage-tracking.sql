-- =============================================
-- USAGE TRACKING & COST MANAGEMENT
-- Dynamic usage monitoring with user-configurable limits and intelligent scaling
-- =============================================

-- User usage limits (now purely references user_configuration)
CREATE TABLE public.user_usage_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    
    -- Control settings (user configurable)
    hard_stop_enabled BOOLEAN DEFAULT true,
    soft_warning_enabled BOOLEAN DEFAULT true,
    auto_optimization_enabled BOOLEAN DEFAULT false,
    
    -- Reset settings (user configurable)
    reset_day INTEGER, -- Day of month for monthly reset (from user config)
    reset_hour INTEGER, -- Hour of day for daily reset (UTC, from user config)
    reset_timezone TEXT, -- User's timezone for reset calculations
    
    -- Alert settings (user configurable)
    email_alerts BOOLEAN DEFAULT true,
    push_alerts BOOLEAN DEFAULT true,
    webhook_url TEXT,
    alert_cooldown_minutes INTEGER DEFAULT 15,
    
    -- Emergency controls (user configurable)
    emergency_stop_enabled BOOLEAN DEFAULT false,
    emergency_threshold_multiplier DECIMAL(3,2) DEFAULT 1.5,
    
    -- Auto-scaling settings
    auto_scale_enabled BOOLEAN DEFAULT false,
    scale_up_threshold DECIMAL(3,2) DEFAULT 0.80,
    scale_down_threshold DECIMAL(3,2) DEFAULT 0.30,
    max_auto_scale_factor DECIMAL(3,2) DEFAULT 2.0,
    
    -- Current period tracking
    current_daily_usage DECIMAL(10,8) DEFAULT 0,
    current_monthly_usage DECIMAL(10,8) DEFAULT 0,
    current_daily_requests INTEGER DEFAULT 0,
    current_monthly_requests INTEGER DEFAULT 0,
    current_daily_tokens INTEGER DEFAULT 0,
    current_monthly_tokens INTEGER DEFAULT 0,
    
    -- Usage efficiency metrics
    cost_per_request DECIMAL(10,8),
    tokens_per_request DECIMAL(8,2),
    avg_request_latency_ms INTEGER,
    
    -- Last reset tracking
    last_daily_reset_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now(),
    last_monthly_reset_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now(),
    
    -- Metadata
    custom_limits JSONB DEFAULT '{}',
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_reset_settings CHECK (
        (reset_day IS NULL OR (reset_day >= 1 AND reset_day <= 31)) AND
        (reset_hour IS NULL OR (reset_hour >= 0 AND reset_hour <= 23))
    ),
    CONSTRAINT valid_alert_cooldown CHECK (alert_cooldown_minutes BETWEEN 1 AND 1440),
    CONSTRAINT valid_emergency_multiplier CHECK (emergency_threshold_multiplier >= 1.0),
    CONSTRAINT valid_scale_thresholds CHECK (
        scale_up_threshold BETWEEN 0.1 AND 1.0 AND
        scale_down_threshold BETWEEN 0.1 AND 1.0 AND
        scale_up_threshold > scale_down_threshold
    ),
    CONSTRAINT valid_scale_factor CHECK (max_auto_scale_factor BETWEEN 1.0 AND 10.0),
    CONSTRAINT valid_current_usage CHECK (
        current_daily_usage >= 0 AND current_monthly_usage >= 0 AND
        current_daily_requests >= 0 AND current_monthly_requests >= 0 AND
        current_daily_tokens >= 0 AND current_monthly_tokens >= 0
    )
);

-- Enhanced API usage tracking with comprehensive metrics
CREATE TABLE public.api_usage_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES public.ai_providers(id),
    model_id UUID REFERENCES public.ai_models(id),
    session_id UUID REFERENCES public.workflow_sessions(id),
    step_execution_id UUID REFERENCES public.workflow_step_executions(id),
    api_key_id UUID REFERENCES public.user_api_keys(id),
    
    -- Request identification and correlation
    request_id TEXT,
    correlation_id UUID DEFAULT uuid_generate_v4(),
    batch_id UUID, -- For batch requests
    parent_request_id UUID REFERENCES public.api_usage_logs(id),
    
    -- Token usage and cost
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
    
    -- Dynamic cost calculation (no hardcoded pricing)
    input_cost_usd DECIMAL(10,8) DEFAULT 0,
    output_cost_usd DECIMAL(10,8) DEFAULT 0,
    additional_costs_usd DECIMAL(10,8) DEFAULT 0, -- Vision, function calls, etc.
    total_cost_usd DECIMAL(10,8) GENERATED ALWAYS AS (input_cost_usd + output_cost_usd + additional_costs_usd) STORED,
    
    -- Performance metrics
    latency_ms INTEGER,
    processing_time_ms INTEGER,
    queue_time_ms INTEGER,
    ttfb_ms INTEGER, -- Time to first byte
    retry_count INTEGER DEFAULT 0,
    
    -- Request details and metadata
    request_type TEXT DEFAULT 'completion',
    endpoint TEXT,
    http_method TEXT DEFAULT 'POST',
    status TEXT DEFAULT 'success',
    error_message TEXT,
    error_code TEXT,
    http_status_code INTEGER,
    
    -- Request/response characteristics
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    model_version TEXT,
    temperature DECIMAL(3,2),
    max_tokens INTEGER,
    context_window_used INTEGER,
    context_utilization DECIMAL(3,2), -- Percentage of context window used
    
    -- Quality and optimization metrics
    user_rating INTEGER CHECK (user_rating IS NULL OR (user_rating >= 1 AND user_rating <= 5)),
    quality_score DECIMAL(3,2) CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 1)),
    cost_efficiency_score DECIMAL(3,2) CHECK (cost_efficiency_score IS NULL OR (cost_efficiency_score >= 0 AND cost_efficiency_score <= 1)),
    
    -- Request context and optimization
    use_case TEXT, -- research, writing, coding, analysis, etc.
    optimization_applied JSONB DEFAULT '{}', -- What optimizations were applied
    cache_hit BOOLEAN DEFAULT false,
    streaming_used BOOLEAN DEFAULT false,
    
    -- Billing and attribution
    billable BOOLEAN DEFAULT true,
    billing_period DATE,
    cost_allocation JSONB DEFAULT '{}', -- How cost is allocated across projects/teams
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_tokens CHECK (input_tokens >= 0 AND output_tokens >= 0),
    CONSTRAINT valid_costs CHECK (
        input_cost_usd >= 0 AND output_cost_usd >= 0 AND additional_costs_usd >= 0
    ),
    CONSTRAINT valid_latency CHECK (
        (latency_ms IS NULL OR latency_ms >= 0) AND
        (processing_time_ms IS NULL OR processing_time_ms >= 0) AND
        (queue_time_ms IS NULL OR queue_time_ms >= 0) AND
        (ttfb_ms IS NULL OR ttfb_ms >= 0)
    ),
    CONSTRAINT valid_status CHECK (status IN ('success', 'error', 'timeout', 'cancelled', 'rate_limited', 'quota_exceeded')),
    CONSTRAINT valid_retry_count CHECK (retry_count >= 0),
    CONSTRAINT valid_http_status CHECK (http_status_code IS NULL OR (http_status_code >= 100 AND http_status_code <= 599)),
    CONSTRAINT valid_request_type CHECK (request_type IN ('completion', 'embedding', 'image_generation', 'audio', 'vision', 'function_call')),
    CONSTRAINT valid_context_utilization CHECK (context_utilization IS NULL OR (context_utilization >= 0 AND context_utilization <= 1))
);

-- Real-time usage summaries with intelligent aggregation
CREATE TABLE public.usage_summaries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    period_type TEXT NOT NULL, -- hourly, daily, weekly, monthly
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Aggregate metrics
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    cached_requests INTEGER DEFAULT 0,
    
    -- Token and cost aggregations
    total_tokens INTEGER DEFAULT 0,
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(10,8) DEFAULT 0,
    
    -- Performance aggregations
    avg_latency_ms INTEGER DEFAULT 0,
    max_latency_ms INTEGER DEFAULT 0,
    min_latency_ms INTEGER DEFAULT 0,
    p95_latency_ms INTEGER DEFAULT 0,
    avg_tokens_per_request INTEGER DEFAULT 0,
    avg_cost_per_request DECIMAL(10,8) DEFAULT 0,
    
    -- Breakdowns and distributions
    provider_breakdown JSONB DEFAULT '{}',
    model_breakdown JSONB DEFAULT '{}',
    use_case_breakdown JSONB DEFAULT '{}',
    request_type_breakdown JSONB DEFAULT '{}',
    hourly_distribution JSONB DEFAULT '{}',
    error_breakdown JSONB DEFAULT '{}',
    
    -- Quality and efficiency metrics
    avg_user_rating DECIMAL(3,2),
    avg_quality_score DECIMAL(3,2),
    avg_cost_efficiency_score DECIMAL(3,2),
    cache_hit_rate DECIMAL(3,2),
    
    -- Usage patterns and optimization insights
    peak_usage_hour INTEGER,
    usage_trend DECIMAL(3,2), -- Period-over-period change
    optimization_opportunities JSONB DEFAULT '{}',
    cost_optimization_potential DECIMAL(10,8),
    
    -- Limit tracking relative to user configuration
    cost_limit_utilization DECIMAL(3,2),
    request_limit_utilization DECIMAL(3,2),
    token_limit_utilization DECIMAL(3,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    UNIQUE(user_id, period_type, period_start),
    
    -- Constraints
    CONSTRAINT valid_period_type CHECK (period_type IN ('hourly', 'daily', 'weekly', 'monthly')),
    CONSTRAINT valid_period CHECK (period_end > period_start),
    CONSTRAINT valid_request_counts CHECK (
        total_requests >= 0 AND 
        successful_requests >= 0 AND 
        failed_requests >= 0 AND
        cached_requests >= 0 AND
        total_requests >= (successful_requests + failed_requests)
    ),
    CONSTRAINT valid_token_counts CHECK (
        total_tokens >= 0 AND 
        total_input_tokens >= 0 AND 
        total_output_tokens >= 0
    ),
    CONSTRAINT valid_cost CHECK (total_cost_usd >= 0),
    CONSTRAINT valid_utilization CHECK (
        (cost_limit_utilization IS NULL OR cost_limit_utilization BETWEEN 0 AND 2) AND
        (request_limit_utilization IS NULL OR request_limit_utilization BETWEEN 0 AND 2) AND
        (token_limit_utilization IS NULL OR token_limit_utilization BETWEEN 0 AND 2)
    )
);

-- Intelligent usage alerts with dynamic thresholds
CREATE TABLE public.usage_alerts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    
    -- Alert content (dynamic based on user configuration)
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    recommendations JSONB DEFAULT '[]', -- AI-generated recommendations
    
    -- Alert triggers (based on user configuration)
    trigger_type TEXT NOT NULL, -- threshold, trend, anomaly, prediction
    trigger_config JSONB DEFAULT '{}',
    actual_value DECIMAL(15,8),
    threshold_value DECIMAL(15,8),
    
    -- Delivery tracking
    delivery_methods JSONB DEFAULT '{}', -- {email: true, push: false, webhook: true}
    email_sent BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMP WITH TIME ZONE,
    push_sent BOOLEAN DEFAULT false,
    push_sent_at TIMESTAMP WITH TIME ZONE,
    webhook_sent BOOLEAN DEFAULT false,
    webhook_sent_at TIMESTAMP WITH TIME ZONE,
    webhook_response_code INTEGER,
    
    -- Alert state management
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    is_dismissed BOOLEAN DEFAULT false,
    dismissed_at TIMESTAMP WITH TIME ZONE,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    auto_resolved BOOLEAN DEFAULT false,
    
    -- Context and attribution
    related_usage_log_id UUID REFERENCES public.api_usage_logs(id),
    related_summary_id UUID REFERENCES public.usage_summaries(id),
    correlation_id UUID,
    
    -- Alert lifecycle
    expires_at TIMESTAMP WITH TIME ZONE,
    snooze_until TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_alert_type CHECK (alert_type IN (
        'cost_threshold', 'usage_threshold', 'quota_exceeded', 'rate_limit', 'anomaly_detected',
        'prediction_warning', 'optimization_opportunity', 'budget_exhausted', 'usage_spike'
    )),
    CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    CONSTRAINT valid_trigger_type CHECK (trigger_type IN ('threshold', 'trend', 'anomaly', 'prediction', 'manual')),
    CONSTRAINT valid_webhook_response CHECK (webhook_response_code IS NULL OR (webhook_response_code >= 100 AND webhook_response_code <= 599))
);

-- Dynamic rate limiting with intelligent adaptation
CREATE TABLE public.rate_limit_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES public.ai_providers(id),
    
    -- Rate limit details (dynamic based on user configuration)
    limit_type TEXT NOT NULL,
    limit_scope TEXT DEFAULT 'user', -- user, provider, model, endpoint
    limit_window_seconds INTEGER NOT NULL,
    limit_value INTEGER NOT NULL,
    current_value INTEGER NOT NULL,
    
    -- Time window
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Event details
    blocked_request_count INTEGER DEFAULT 1,
    retry_after_seconds INTEGER,
    backoff_multiplier DECIMAL(3,2) DEFAULT 1.0,
    
    -- Adaptive rate limiting
    auto_adjustment_enabled BOOLEAN DEFAULT false,
    suggested_new_limit INTEGER,
    adjustment_reason TEXT,
    
    -- Context
    endpoint TEXT,
    user_agent TEXT,
    ip_address INET,
    request_metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_limit_type CHECK (limit_type IN (
        'requests_per_minute', 'tokens_per_minute', 'requests_per_hour', 
        'cost_per_hour', 'requests_per_day', 'concurrent_requests'
    )),
    CONSTRAINT valid_limit_scope CHECK (limit_scope IN ('user', 'provider', 'model', 'endpoint', 'ip')),
    CONSTRAINT valid_values CHECK (limit_value > 0 AND current_value >= 0),
    CONSTRAINT valid_window CHECK (window_end > window_start),
    CONSTRAINT valid_blocked_count CHECK (blocked_request_count > 0),
    CONSTRAINT valid_backoff CHECK (backoff_multiplier >= 1.0)
);

-- Cost prediction and optimization tracking
CREATE TABLE public.cost_predictions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Prediction parameters
    prediction_type TEXT NOT NULL, -- daily, weekly, monthly, project
    prediction_horizon_days INTEGER NOT NULL,
    confidence_level DECIMAL(3,2) DEFAULT 0.80,
    
    -- Predicted values
    predicted_cost_usd DECIMAL(10,8) NOT NULL,
    predicted_requests INTEGER,
    predicted_tokens INTEGER,
    cost_lower_bound DECIMAL(10,8),
    cost_upper_bound DECIMAL(10,8),
    
    -- Model and data used for prediction
    prediction_model TEXT DEFAULT 'linear_trend', -- linear_trend, seasonal, ml_model
    training_data_days INTEGER DEFAULT 30,
    feature_importance JSONB DEFAULT '{}',
    model_accuracy DECIMAL(3,2),
    
    -- Factors and assumptions
    usage_trends JSONB DEFAULT '{}',
    seasonal_factors JSONB DEFAULT '{}',
    external_factors JSONB DEFAULT '{}', -- holidays, events, etc.
    
    -- Optimization opportunities
    optimization_recommendations JSONB DEFAULT '[]',
    potential_savings_usd DECIMAL(10,8),
    recommended_actions JSONB DEFAULT '[]',
    
    -- Prediction tracking
    actual_cost_usd DECIMAL(10,8), -- Filled in after prediction period
    accuracy_score DECIMAL(3,2), -- How accurate was the prediction
    
    -- Metadata
    created_for_date DATE NOT NULL,
    prediction_made_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_prediction_type CHECK (prediction_type IN ('daily', 'weekly', 'monthly', 'project', 'annual')),
    CONSTRAINT valid_horizon CHECK (prediction_horizon_days BETWEEN 1 AND 365),
    CONSTRAINT valid_confidence CHECK (confidence_level BETWEEN 0.1 AND 1.0),
    CONSTRAINT valid_predicted_values CHECK (
        predicted_cost_usd >= 0 AND
        (predicted_requests IS NULL OR predicted_requests >= 0) AND
        (predicted_tokens IS NULL OR predicted_tokens >= 0)
    ),
    CONSTRAINT valid_bounds CHECK (
        (cost_lower_bound IS NULL OR cost_lower_bound >= 0) AND
        (cost_upper_bound IS NULL OR cost_upper_bound >= cost_lower_bound)
    ),
    CONSTRAINT valid_accuracy CHECK (
        (model_accuracy IS NULL OR model_accuracy BETWEEN 0 AND 1) AND
        (accuracy_score IS NULL OR accuracy_score BETWEEN 0 AND 1)
    )
);

-- =============================================
-- PARTITIONING FOR PERFORMANCE
-- =============================================

-- Partition api_usage_logs by date for better performance
-- This should be done automatically via pg_partman or similar

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Usage limits indexes
CREATE INDEX idx_user_usage_limits_user ON public.user_usage_limits(user_id);
CREATE INDEX idx_user_usage_limits_auto_scale ON public.user_usage_limits(auto_scale_enabled, updated_at) WHERE auto_scale_enabled = true;

-- API usage logs indexes (critical for performance)
CREATE INDEX idx_api_usage_logs_user_date ON public.api_usage_logs(user_id, created_at DESC);
CREATE INDEX idx_api_usage_logs_session ON public.api_usage_logs(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_api_usage_logs_provider_model ON public.api_usage_logs(provider_id, model_id, created_at DESC);
CREATE INDEX idx_api_usage_logs_cost ON public.api_usage_logs(total_cost_usd DESC, created_at DESC);
CREATE INDEX idx_api_usage_logs_status ON public.api_usage_logs(status, created_at DESC) WHERE status != 'success';
CREATE INDEX idx_api_usage_logs_correlation ON public.api_usage_logs(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_api_usage_logs_use_case ON public.api_usage_logs(use_case, created_at DESC) WHERE use_case IS NOT NULL;
CREATE INDEX idx_api_usage_logs_billing ON public.api_usage_logs(billable, billing_period) WHERE billable = true;

-- Usage summaries indexes
CREATE INDEX idx_usage_summaries_user_period ON public.usage_summaries(user_id, period_type, period_start DESC);
CREATE INDEX idx_usage_summaries_cost ON public.usage_summaries(total_cost_usd DESC, period_start DESC);
CREATE INDEX idx_usage_summaries_utilization ON public.usage_summaries(cost_limit_utilization DESC) WHERE cost_limit_utilization > 0.8;

-- Alert indexes
CREATE INDEX idx_usage_alerts_user_unread ON public.usage_alerts(user_id, created_at DESC) WHERE is_read = false;
CREATE INDEX idx_usage_alerts_type_severity ON public.usage_alerts(alert_type, severity, created_at DESC);
CREATE INDEX idx_usage_alerts_unresolved ON public.usage_alerts(created_at DESC) WHERE is_resolved = false;
CREATE INDEX idx_usage_alerts_delivery ON public.usage_alerts(webhook_sent, email_sent, push_sent);

-- Rate limit indexes
CREATE INDEX idx_rate_limit_events_user_window ON public.rate_limit_events(user_id, window_start, window_end);
CREATE INDEX idx_rate_limit_events_provider_window ON public.rate_limit_events(provider_id, window_start, window_end);
CREATE INDEX idx_rate_limit_events_adaptive ON public.rate_limit_events(auto_adjustment_enabled, created_at DESC) WHERE auto_adjustment_enabled = true;

-- Cost prediction indexes
CREATE INDEX idx_cost_predictions_user_date ON public.cost_predictions(user_id, created_for_date DESC);
CREATE INDEX idx_cost_predictions_type ON public.cost_predictions(prediction_type, created_for_date DESC);
CREATE INDEX idx_cost_predictions_accuracy ON public.cost_predictions(accuracy_score DESC) WHERE accuracy_score IS NOT NULL;

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE TRIGGER update_user_usage_limits_updated_at
    BEFORE UPDATE ON public.user_usage_limits
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_usage_summaries_updated_at
    BEFORE UPDATE ON public.usage_summaries
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- DYNAMIC USAGE MANAGEMENT FUNCTIONS
-- =============================================

-- Function to create usage limits from user configuration
CREATE OR REPLACE FUNCTION public.create_usage_limits_from_config(user_uuid UUID)
RETURNS UUID AS $$
DECLARE
    config_record RECORD;
    limits_id UUID;
BEGIN
    -- Get user configuration
    SELECT 
        uc.*,
        p.timezone,
        p.locale,
        p.user_type
    INTO config_record
    FROM public.user_configuration uc
    JOIN public.profiles p ON p.id = uc.user_id
    WHERE uc.user_id = user_uuid;
    
    -- Create usage limits based on configuration
    INSERT INTO public.user_usage_limits (
        user_id,
        reset_hour,
        reset_timezone,
        email_alerts,
        push_alerts,
        hard_stop_enabled,
        auto_optimization_enabled,
        auto_scale_enabled,
        emergency_stop_enabled
    ) VALUES (
        user_uuid,
        EXTRACT(hour FROM public.utc_now() AT TIME ZONE COALESCE(config_record.timezone, 'UTC')),
        COALESCE(config_record.timezone, 'UTC'),
        COALESCE((config_record.alert_methods->>'email')::BOOLEAN, true),
        COALESCE((config_record.alert_methods->>'push')::BOOLEAN, true),
        true, -- Always enable hard stop for safety
        config_record.auto_optimization_enabled,
        CASE config_record.user_type 
            WHEN 'enterprise' THEN true 
            WHEN 'business' THEN true 
            ELSE false 
        END,
        CASE config_record.user_type 
            WHEN 'enterprise' THEN true 
            ELSE false 
        END
    ) RETURNING id INTO limits_id;
    
    RETURN limits_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check spending limits with dynamic thresholds
CREATE OR REPLACE FUNCTION public.check_dynamic_spending_limit(
    user_uuid UUID, 
    estimated_cost DECIMAL DEFAULT 0,
    estimated_tokens INTEGER DEFAULT 0,
    check_type TEXT DEFAULT 'both'
)
RETURNS TABLE(
    allowed BOOLEAN,
    reason TEXT,
    current_daily_cost DECIMAL,
    current_monthly_cost DECIMAL,
    current_daily_tokens INTEGER,
    current_monthly_tokens INTEGER,
    suggested_action TEXT,
    auto_scale_recommended BOOLEAN
) AS $$
DECLARE
    config_record RECORD;
    limits_record RECORD;
    daily_spent DECIMAL := 0;
    monthly_spent DECIMAL := 0;
    daily_tokens_used INTEGER := 0;
    monthly_tokens_used INTEGER := 0;
    scale_recommended BOOLEAN := false;
    action_suggestion TEXT;
BEGIN
    -- Get user configuration and limits
    SELECT 
        uc.*,
        ul.*,
        p.user_type
    INTO config_record
    FROM public.user_configuration uc
    JOIN public.user_usage_limits ul ON ul.user_id = uc.user_id
    JOIN public.profiles p ON p.id = uc.user_id
    WHERE uc.user_id = user_uuid;
    
    IF NOT FOUND THEN
        -- Create default limits if they don't exist
        PERFORM public.create_usage_limits_from_config(user_uuid);
        -- Re-fetch
        SELECT * INTO config_record 
        FROM public.user_configuration uc
        JOIN public.user_usage_limits ul ON ul.user_id = uc.user_id
        JOIN public.profiles p ON p.id = uc.user_id
        WHERE uc.user_id = user_uuid;
    END IF;
    
    -- Get current usage from limits record (updated in real-time)
    daily_spent := config_record.current_daily_usage;
    monthly_spent := config_record.current_monthly_usage;
    daily_tokens_used := config_record.current_daily_tokens;
    monthly_tokens_used := config_record.current_monthly_tokens;
    
    -- Check if auto-scaling is recommended
    IF config_record.auto_scale_enabled THEN
        IF (daily_spent + estimated_cost) / config_record.effective_daily_cost_limit > config_record.scale_up_threshold THEN
            scale_recommended := true;
            action_suggestion := 'Consider increasing daily limits or optimizing usage patterns';
        END IF;
    END IF;
    
    -- Check hard limits if enabled
    IF config_record.hard_stop_enabled THEN
        -- Check cost limits
        IF check_type IN ('cost', 'both') THEN
            IF (daily_spent + estimated_cost) > config_record.effective_daily_cost_limit THEN
                RETURN QUERY SELECT false, 'Daily cost limit exceeded', daily_spent, monthly_spent, 
                            daily_tokens_used, monthly_tokens_used, 
                            'Optimize usage or increase daily limit', scale_recommended;
                RETURN;
            END IF;
            
            IF (monthly_spent + estimated_cost) > config_record.effective_monthly_cost_limit THEN
                RETURN QUERY SELECT false, 'Monthly cost limit exceeded', daily_spent, monthly_spent, 
                            daily_tokens_used, monthly_tokens_used,
                            'Wait for monthly reset or upgrade plan', scale_recommended;
                RETURN;
            END IF;
        END IF;
        
        -- Check token limits
        IF check_type IN ('tokens', 'both') THEN
            IF (daily_tokens_used + estimated_tokens) > config_record.effective_daily_token_limit THEN
                RETURN QUERY SELECT false, 'Daily token limit exceeded', daily_spent, monthly_spent, 
                            daily_tokens_used, monthly_tokens_used,
                            'Optimize prompts or increase token limit', scale_recommended;
                RETURN;
            END IF;
            
            IF (monthly_tokens_used + estimated_tokens) > config_record.effective_monthly_token_limit THEN
                RETURN QUERY SELECT false, 'Monthly token limit exceeded', daily_spent, monthly_spent, 
                            daily_tokens_used, monthly_tokens_used,
                            'Wait for monthly reset or upgrade plan', scale_recommended;
                RETURN;
            END IF;
        END IF;
    END IF;
    
    -- Check soft warning thresholds and provide recommendations
    action_suggestion := CASE 
        WHEN (daily_spent + estimated_cost) / config_record.effective_daily_cost_limit > 0.90 THEN
            'Approaching daily limit - consider cost optimization'
        WHEN (monthly_spent + estimated_cost) / config_record.effective_monthly_cost_limit > 0.90 THEN
            'Approaching monthly limit - monitor usage closely'
        WHEN (daily_spent + estimated_cost) / config_record.effective_daily_cost_limit > 0.75 THEN
            'Usage is high - review optimization opportunities'
        ELSE
            'Usage within normal limits'
    END;
    
    RETURN QUERY SELECT true, 'Within limits', daily_spent, monthly_spent, 
                daily_tokens_used, monthly_tokens_used, action_suggestion, scale_recommended;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record usage and update real-time counters
CREATE OR REPLACE FUNCTION public.record_dynamic_usage(
    user_uuid UUID,
    cost_amount DECIMAL DEFAULT 0,
    tokens_count INTEGER DEFAULT 0,
    requests_count INTEGER DEFAULT 1,
    provider_name TEXT DEFAULT NULL,
    model_name TEXT DEFAULT NULL,
    use_case_param TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    current_hour TIMESTAMP WITH TIME ZONE := date_trunc('hour', public.utc_now());
    current_date DATE := CURRENT_DATE;
BEGIN
    -- Update real-time usage counters
    UPDATE public.user_usage_limits
    SET 
        current_daily_usage = current_daily_usage + cost_amount,
        current_monthly_usage = current_monthly_usage + cost_amount,
        current_daily_requests = current_daily_requests + requests_count,
        current_monthly_requests = current_monthly_requests + requests_count,
        current_daily_tokens = current_daily_tokens + tokens_count,
        current_monthly_tokens = current_monthly_tokens + tokens_count,
        cost_per_request = (current_daily_usage + cost_amount) / GREATEST(current_daily_requests + requests_count, 1),
        tokens_per_request = (current_daily_tokens + tokens_count)::DECIMAL / GREATEST(current_daily_requests + requests_count, 1),
        updated_at = public.utc_now()
    WHERE user_id = user_uuid;
    
    -- Update or create hourly summary
    INSERT INTO public.usage_summaries (
        user_id, period_type, period_start, period_end,
        total_requests, successful_requests, total_tokens, total_cost_usd,
        provider_breakdown, model_breakdown, use_case_breakdown
    ) VALUES (
        user_uuid, 'hourly', current_hour, current_hour + INTERVAL '1 hour',
        requests_count, requests_count, tokens_count, cost_amount,
        CASE WHEN provider_name IS NOT NULL THEN jsonb_build_object(provider_name, requests_count) ELSE '{}' END,
        CASE WHEN model_name IS NOT NULL THEN jsonb_build_object(model_name, requests_count) ELSE '{}' END,
        CASE WHEN use_case_param IS NOT NULL THEN jsonb_build_object(use_case_param, requests_count) ELSE '{}' END
    )
    ON CONFLICT (user_id, period_type, period_start) DO UPDATE SET
        total_requests = usage_summaries.total_requests + requests_count,
        successful_requests = usage_summaries.successful_requests + requests_count,
        total_tokens = usage_summaries.total_tokens + tokens_count,
        total_cost_usd = usage_summaries.total_cost_usd + cost_amount,
        provider_breakdown = CASE 
            WHEN provider_name IS NOT NULL THEN 
                usage_summaries.provider_breakdown || jsonb_build_object(
                    provider_name, 
                    COALESCE((usage_summaries.provider_breakdown->>provider_name)::INTEGER, 0) + requests_count
                )
            ELSE usage_summaries.provider_breakdown
        END,
        model_breakdown = CASE 
            WHEN model_name IS NOT NULL THEN 
                usage_summaries.model_breakdown || jsonb_build_object(
                    model_name, 
                    COALESCE((usage_summaries.model_breakdown->>model_name)::INTEGER, 0) + requests_count
                )
            ELSE usage_summaries.model_breakdown
        END,
        use_case_breakdown = CASE 
            WHEN use_case_param IS NOT NULL THEN 
                usage_summaries.use_case_breakdown || jsonb_build_object(
                    use_case_param, 
                    COALESCE((usage_summaries.use_case_breakdown->>use_case_param)::INTEGER, 0) + requests_count
                )
            ELSE usage_summaries.use_case_breakdown
        END,
        updated_at = public.utc_now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate intelligent usage alerts
CREATE OR REPLACE FUNCTION public.generate_intelligent_alert(
    user_uuid UUID,
    alert_type TEXT,
    current_value DECIMAL,
    threshold_value DECIMAL,
    severity TEXT DEFAULT 'warning'
)
RETURNS UUID AS $$
DECLARE
    alert_id UUID;
    user_config RECORD;
    alert_title TEXT;
    alert_message TEXT;
    recommendations JSONB := '[]';
BEGIN
    -- Get user configuration for personalized alerts
    SELECT 
        uc.*,
        p.first_name,
        p.user_type,
        p.experience_level
    INTO user_config
    FROM public.user_configuration uc
    JOIN public.profiles p ON p.id = uc.user_id
    WHERE uc.user_id = user_uuid;
    
    -- Generate personalized alert content
    alert_title := CASE alert_type
        WHEN 'cost_threshold' THEN 
            CASE severity
                WHEN 'critical' THEN 'Critical: Cost limit exceeded'
                WHEN 'error' THEN 'Error: Approaching cost limit'
                ELSE 'Warning: High usage detected'
            END
        WHEN 'usage_threshold' THEN 'Usage Alert: ' || (current_value/threshold_value*100)::INTEGER || '% of limit reached'
        ELSE 'Usage Alert'
    END;
    
    alert_message := 'Hello ' || COALESCE(user_config.first_name, 'there') || ', ';
    alert_message := alert_message || CASE alert_type
        WHEN 'cost_threshold' THEN 
            'your current spending of $' || current_value || ' has reached ' || 
            (current_value/threshold_value*100)::INTEGER || '% of your $' || threshold_value || ' limit.'
        ELSE 
            'your usage has reached ' || (current_value/threshold_value*100)::INTEGER || '% of your configured limit.'
    END;
    
    -- Generate intelligent recommendations based on user profile
    recommendations := CASE user_config.experience_level
        WHEN 'beginner' THEN 
            '["Review your recent requests in the dashboard", "Consider using cost-effective models", "Contact support for optimization tips"]'::jsonb
        WHEN 'intermediate' THEN 
            '["Enable cost optimization in settings", "Review model selection strategy", "Consider batch processing"]'::jsonb
        WHEN 'advanced' THEN 
            '["Analyze usage patterns for optimization", "Implement request caching", "Review provider performance metrics"]'::jsonb
        ELSE 
            '["Configure auto-scaling limits", "Implement advanced cost controls", "Set up predictive alerts"]'::jsonb
    END;
    
    -- Create alert
    INSERT INTO public.usage_alerts (
        user_id, alert_type, severity, title, message, 
        recommendations, trigger_type, actual_value, threshold_value,
        delivery_methods
    ) VALUES (
        user_uuid, alert_type, severity, alert_title, alert_message,
        recommendations, 'threshold', current_value, threshold_value,
        user_config.alert_methods
    ) RETURNING id INTO alert_id;
    
    RETURN alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create usage limits after user configuration is created
CREATE OR REPLACE FUNCTION public.create_usage_limits_after_config()
RETURNS TRIGGER AS $$
BEGIN
    -- Create usage limits based on configuration
    PERFORM public.create_usage_limits_from_config(NEW.user_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_usage_limits_trigger
    AFTER INSERT ON public.user_configuration
    FOR EACH ROW
    EXECUTE FUNCTION public.create_usage_limits_after_config();

SELECT 'Dynamic usage tracking and cost management system completed!' as status; 