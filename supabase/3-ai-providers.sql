-- =============================================
-- AI PROVIDERS & MODEL MANAGEMENT
-- Dynamic AI provider and model management with user-configurable settings
-- =============================================

-- System-wide AI provider configurations (base templates)
CREATE TABLE public.ai_providers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    auth_type TEXT NOT NULL DEFAULT 'api_key',
    is_active BOOLEAN DEFAULT true,
    
    -- Default system limits (used as templates for user configurations)
    default_rate_limits JSONB NOT NULL DEFAULT '{}',
    default_headers JSONB DEFAULT '{}',
    default_timeout_seconds INTEGER,
    default_retry_config JSONB DEFAULT '{"max_retries": 3, "backoff_factor": 2}',
    
    -- Health monitoring
    health_check_url TEXT,
    last_health_check TIMESTAMP WITH TIME ZONE,
    health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
    
    -- Provider metadata
    provider_type TEXT DEFAULT 'api', -- api, sdk, webhook
    documentation_url TEXT,
    pricing_url TEXT,
    status_page_url TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_auth_type CHECK (auth_type IN ('api_key', 'oauth', 'bearer_token', 'custom')),
    CONSTRAINT valid_base_url CHECK (base_url ~ '^https?://'),
    CONSTRAINT valid_timeout CHECK (default_timeout_seconds IS NULL OR (default_timeout_seconds > 0 AND default_timeout_seconds <= 300)),
    CONSTRAINT valid_provider_type CHECK (provider_type IN ('api', 'sdk', 'webhook')),
    CONSTRAINT valid_rate_limits CHECK (jsonb_typeof(default_rate_limits) = 'object')
);

-- User-specific AI provider configurations (replaces hardcoded defaults)
CREATE TABLE public.user_ai_provider_configs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    provider_id UUID REFERENCES public.ai_providers(id) ON DELETE CASCADE NOT NULL,
    
    -- User-configurable settings (override provider defaults)
    custom_timeout_seconds INTEGER,
    custom_max_retries INTEGER,
    custom_backoff_factor DECIMAL(3,1),
    
    -- User-specific rate limits (can be lower than provider defaults)
    custom_rate_limits JSONB,
    effective_rate_limits JSONB, -- Computed from user config + plan limits
    
    -- Performance and reliability preferences
    reliability_score DECIMAL(3,2),
    performance_score DECIMAL(3,2),
    cost_efficiency_score DECIMAL(3,2),
    user_priority INTEGER DEFAULT 50, -- 1-100, higher = preferred
    
    -- Model preferences for this provider
    preferred_models JSONB DEFAULT '[]',
    blocked_models JSONB DEFAULT '[]',
    model_priority_order JSONB DEFAULT '[]',
    
    -- Custom headers and configuration
    custom_headers JSONB DEFAULT '{}',
    custom_config JSONB DEFAULT '{}',
    
    -- Usage preferences
    auto_failover_enabled BOOLEAN DEFAULT true,
    cost_optimization_enabled BOOLEAN DEFAULT false,
    performance_optimization_enabled BOOLEAN DEFAULT false,
    
    -- Status and metadata
    is_enabled BOOLEAN DEFAULT true,
    notes TEXT,
    configuration_source TEXT DEFAULT 'user', -- user, system, ai_suggested
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    UNIQUE(user_id, provider_id),
    
    -- Constraints
    CONSTRAINT valid_custom_timeout CHECK (custom_timeout_seconds IS NULL OR (custom_timeout_seconds BETWEEN 5 AND 300)),
    CONSTRAINT valid_custom_retries CHECK (custom_max_retries IS NULL OR (custom_max_retries BETWEEN 0 AND 10)),
    CONSTRAINT valid_custom_backoff CHECK (custom_backoff_factor IS NULL OR (custom_backoff_factor BETWEEN 1.0 AND 10.0)),
    CONSTRAINT valid_scores CHECK (
        (reliability_score IS NULL OR reliability_score BETWEEN 0.0 AND 1.0) AND
        (performance_score IS NULL OR performance_score BETWEEN 0.0 AND 1.0) AND
        (cost_efficiency_score IS NULL OR cost_efficiency_score BETWEEN 0.0 AND 1.0)
    ),
    CONSTRAINT valid_priority CHECK (user_priority BETWEEN 1 AND 100),
    CONSTRAINT valid_notes CHECK (notes IS NULL OR length(notes) <= 1000),
    CONSTRAINT valid_configuration_source CHECK (configuration_source IN ('user', 'system', 'ai_suggested', 'imported'))
);

-- Available AI models with dynamic pricing and capabilities
CREATE TABLE public.ai_models (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    provider_id UUID REFERENCES public.ai_providers(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    model_family TEXT,
    model_version TEXT,
    
    -- Capabilities (dynamically updated)
    capabilities JSONB DEFAULT '[]',
    context_window INTEGER,
    max_output_tokens INTEGER,
    supports_streaming BOOLEAN DEFAULT false,
    supports_function_calling BOOLEAN DEFAULT false,
    supports_vision BOOLEAN DEFAULT false,
    supports_json_mode BOOLEAN DEFAULT false,
    
    -- Dynamic pricing (updated from provider APIs)
    pricing JSONB NOT NULL DEFAULT '{}',
    pricing_last_updated TIMESTAMP WITH TIME ZONE,
    pricing_source TEXT DEFAULT 'manual', -- manual, api, estimated
    
    -- Performance metrics (updated from usage data)
    default_performance_score DECIMAL(3,2),
    default_speed_score DECIMAL(3,2),
    default_cost_efficiency DECIMAL(3,2),
    avg_latency_ms INTEGER,
    success_rate DECIMAL(5,2),
    
    -- Model metadata
    best_use_cases TEXT[] DEFAULT '{}',
    limitations TEXT[],
    is_active BOOLEAN DEFAULT true,
    is_deprecated BOOLEAN DEFAULT false,
    deprecation_date TIMESTAMP WITH TIME ZONE,
    replacement_model_id UUID REFERENCES public.ai_models(id),
    
    -- Usage statistics
    total_requests INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(15,8) DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    -- Constraints
    CONSTRAINT unique_provider_model UNIQUE(provider_id, model_id),
    CONSTRAINT valid_context_window CHECK (context_window IS NULL OR context_window > 0),
    CONSTRAINT valid_max_output CHECK (max_output_tokens IS NULL OR max_output_tokens > 0),
    CONSTRAINT valid_pricing CHECK (jsonb_typeof(pricing) = 'object'),
    CONSTRAINT valid_capabilities CHECK (jsonb_typeof(capabilities) = 'array'),
    CONSTRAINT valid_performance_scores CHECK (
        (default_performance_score IS NULL OR default_performance_score BETWEEN 0 AND 1) AND
        (default_speed_score IS NULL OR default_speed_score BETWEEN 0 AND 1) AND
        (default_cost_efficiency IS NULL OR default_cost_efficiency BETWEEN 0 AND 1)
    ),
    CONSTRAINT valid_success_rate CHECK (success_rate IS NULL OR (success_rate BETWEEN 0 AND 100)),
    CONSTRAINT valid_pricing_source CHECK (pricing_source IN ('manual', 'api', 'estimated', 'user_reported'))
);

-- User's API keys with enhanced security and usage tracking
CREATE TABLE public.user_api_keys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES public.ai_providers(id) ON DELETE CASCADE,
    
    -- Key information
    encrypted_api_key TEXT NOT NULL,
    key_name TEXT,
    key_hash TEXT NOT NULL,
    
    -- Key configuration and limits
    custom_rate_limits JSONB,
    daily_usage_limit DECIMAL(10,6), -- Cost limit per day
    monthly_usage_limit DECIMAL(10,6), -- Cost limit per month
    
    -- Key status and verification
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    verification_attempts INTEGER DEFAULT 0,
    last_verification_at TIMESTAMP WITH TIME ZONE,
    
    -- Usage tracking
    last_used_at TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(10,8) DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    
    -- Key lifecycle
    expires_at TIMESTAMP WITH TIME ZONE,
    auto_rotate_enabled BOOLEAN DEFAULT false,
    rotation_frequency_days INTEGER,
    
    -- Security and monitoring
    allowed_ips INET[],
    allowed_domains TEXT[],
    usage_alerts_enabled BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    -- Constraints
    CONSTRAINT unique_user_provider_key UNIQUE(user_id, provider_id, key_hash),
    CONSTRAINT valid_key_name CHECK (key_name IS NULL OR (length(key_name) >= 1 AND length(key_name) <= 100)),
    CONSTRAINT valid_usage_limits CHECK (
        (daily_usage_limit IS NULL OR daily_usage_limit > 0) AND
        (monthly_usage_limit IS NULL OR monthly_usage_limit > 0)
    ),
    CONSTRAINT valid_verification_attempts CHECK (verification_attempts >= 0),
    CONSTRAINT valid_rotation_frequency CHECK (rotation_frequency_days IS NULL OR rotation_frequency_days BETWEEN 1 AND 365)
);

-- Real-time API key usage tracking
CREATE TABLE public.api_key_usage_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    api_key_id UUID REFERENCES public.user_api_keys(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Usage statistics
    requests_count INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    cost_usd DECIMAL(10,8) DEFAULT 0,
    
    -- Performance metrics
    avg_latency_ms INTEGER DEFAULT 0,
    max_latency_ms INTEGER DEFAULT 0,
    min_latency_ms INTEGER DEFAULT 0,
    
    -- Error tracking
    error_breakdown JSONB DEFAULT '{}', -- {error_code: count}
    rate_limit_hits INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    UNIQUE(api_key_id, date),
    CONSTRAINT valid_request_counts CHECK (
        requests_count >= 0 AND successful_requests >= 0 AND failed_requests >= 0 AND
        requests_count >= (successful_requests + failed_requests)
    ),
    CONSTRAINT valid_tokens CHECK (tokens_used >= 0),
    CONSTRAINT valid_cost CHECK (cost_usd >= 0),
    CONSTRAINT valid_latency CHECK (
        avg_latency_ms >= 0 AND 
        (max_latency_ms IS NULL OR max_latency_ms >= 0) AND
        (min_latency_ms IS NULL OR min_latency_ms >= 0)
    )
);

-- Dynamic model performance tracking and optimization
CREATE TABLE public.model_performance_stats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    model_id UUID REFERENCES public.ai_models(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Performance metrics
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    avg_latency_ms INTEGER DEFAULT 0,
    avg_tokens_per_request INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(10,8) DEFAULT 0,
    
    -- Quality metrics
    user_satisfaction_score DECIMAL(3,2),
    quality_score DECIMAL(3,2),
    cost_efficiency_score DECIMAL(3,2),
    
    -- Context-specific metrics
    use_case_performance JSONB DEFAULT '{}', -- Performance by use case
    context_window_utilization DECIMAL(3,2), -- How much of context window is used
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    UNIQUE(model_id, user_id, date),
    CONSTRAINT valid_request_counts CHECK (
        total_requests >= 0 AND successful_requests >= 0 AND failed_requests >= 0
    ),
    CONSTRAINT valid_performance_scores CHECK (
        (user_satisfaction_score IS NULL OR user_satisfaction_score BETWEEN 0 AND 1) AND
        (quality_score IS NULL OR quality_score BETWEEN 0 AND 1) AND
        (cost_efficiency_score IS NULL OR cost_efficiency_score BETWEEN 0 AND 1) AND
        (context_window_utilization IS NULL OR context_window_utilization BETWEEN 0 AND 1)
    )
);

-- Model pricing history for cost optimization
CREATE TABLE public.model_pricing_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    model_id UUID REFERENCES public.ai_models(id) ON DELETE CASCADE,
    
    -- Pricing information
    input_cost_per_1k DECIMAL(10,8) NOT NULL,
    output_cost_per_1k DECIMAL(10,8) NOT NULL,
    additional_costs JSONB DEFAULT '{}', -- image_cost, function_call_cost, etc.
    
    -- Pricing metadata
    effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
    source TEXT DEFAULT 'manual', -- manual, api, provider_update
    currency TEXT DEFAULT 'USD',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    CONSTRAINT valid_costs CHECK (input_cost_per_1k >= 0 AND output_cost_per_1k >= 0),
    CONSTRAINT valid_source CHECK (source IN ('manual', 'api', 'provider_update', 'estimated'))
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Provider indexes
CREATE INDEX idx_ai_providers_active ON public.ai_providers(is_active, name);
CREATE INDEX idx_ai_providers_health ON public.ai_providers(health_status, last_health_check);
CREATE INDEX idx_ai_providers_type ON public.ai_providers(provider_type, is_active);

-- Model indexes
CREATE INDEX idx_ai_models_provider ON public.ai_models(provider_id, is_active);
CREATE INDEX idx_ai_models_active ON public.ai_models(is_active, is_deprecated);
CREATE INDEX idx_ai_models_capabilities ON public.ai_models USING GIN(capabilities);
CREATE INDEX idx_ai_models_use_cases ON public.ai_models USING GIN(best_use_cases);
CREATE INDEX idx_ai_models_performance ON public.ai_models(default_performance_score DESC, default_cost_efficiency DESC) WHERE is_active = true;
CREATE INDEX idx_ai_models_family ON public.ai_models(model_family, model_version) WHERE is_active = true;

-- User AI provider config indexes
CREATE INDEX idx_user_ai_provider_configs_user ON public.user_ai_provider_configs(user_id, is_enabled);
CREATE INDEX idx_user_ai_provider_configs_provider ON public.user_ai_provider_configs(provider_id, is_enabled);
CREATE INDEX idx_user_ai_provider_configs_priority ON public.user_ai_provider_configs(user_priority DESC) WHERE is_enabled = true;
CREATE INDEX idx_user_ai_provider_configs_cost_optimization ON public.user_ai_provider_configs(cost_optimization_enabled) WHERE is_enabled = true;

-- API key indexes
CREATE INDEX idx_user_api_keys_user_provider ON public.user_api_keys(user_id, provider_id, is_active);
CREATE INDEX idx_user_api_keys_hash ON public.user_api_keys(key_hash);
CREATE INDEX idx_user_api_keys_expires ON public.user_api_keys(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_user_api_keys_verification ON public.user_api_keys(is_verified, last_verification_at);

-- Usage history indexes
CREATE INDEX idx_api_key_usage_key_date ON public.api_key_usage_history(api_key_id, date DESC);
CREATE INDEX idx_model_performance_model_user_date ON public.model_performance_stats(model_id, user_id, date DESC);
CREATE INDEX idx_model_performance_user_date ON public.model_performance_stats(user_id, date DESC);

-- Pricing history indexes
CREATE INDEX idx_model_pricing_history_model_date ON public.model_pricing_history(model_id, effective_date DESC);
CREATE INDEX idx_model_pricing_history_effective_date ON public.model_pricing_history(effective_date DESC);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE TRIGGER update_ai_providers_updated_at
    BEFORE UPDATE ON public.ai_providers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_models_updated_at
    BEFORE UPDATE ON public.ai_models
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_ai_provider_configs_updated_at
    BEFORE UPDATE ON public.user_ai_provider_configs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_api_keys_updated_at
    BEFORE UPDATE ON public.user_api_keys
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- INTELLIGENT AI CONFIGURATION FUNCTIONS
-- =============================================

-- Function to generate user-specific rate limits based on plan and usage
CREATE OR REPLACE FUNCTION public.calculate_user_rate_limits(
    user_uuid UUID,
    provider_uuid UUID,
    base_limits JSONB
)
RETURNS JSONB AS $$
DECLARE
    user_config RECORD;
    plan_multiplier DECIMAL := 1.0;
    usage_multiplier DECIMAL := 1.0;
    effective_limits JSONB;
BEGIN
    -- Get user configuration
    SELECT 
        uc.effective_daily_cost_limit,
        uc.effective_monthly_cost_limit,
        uc.cost_optimization_enabled,
        p.user_type,
        p.experience_level
    INTO user_config
    FROM public.user_configuration uc
    JOIN public.profiles p ON p.id = uc.user_id
    WHERE uc.user_id = user_uuid;
    
    -- Adjust based on user type and experience
    plan_multiplier := CASE user_config.user_type
        WHEN 'enterprise' THEN 3.0
        WHEN 'business' THEN 2.0
        WHEN 'developer' THEN 1.5
        ELSE 1.0
    END;
    
    usage_multiplier := CASE user_config.experience_level
        WHEN 'expert' THEN 1.5
        WHEN 'advanced' THEN 1.2
        WHEN 'intermediate' THEN 1.0
        ELSE 0.7
    END;
    
    -- Calculate effective limits
    effective_limits := jsonb_build_object(
        'requests_per_minute', 
        LEAST(
            ((base_limits->>'requests_per_minute')::INTEGER * plan_multiplier * usage_multiplier)::INTEGER,
            CASE user_config.user_type
                WHEN 'enterprise' THEN 1000
                WHEN 'business' THEN 500
                ELSE 100
            END
        ),
        'tokens_per_minute',
        LEAST(
            ((base_limits->>'tokens_per_minute')::INTEGER * plan_multiplier * usage_multiplier)::INTEGER,
            CASE user_config.user_type
                WHEN 'enterprise' THEN 500000
                WHEN 'business' THEN 200000
                ELSE 50000
            END
        ),
        'cost_per_hour',
        LEAST(
            user_config.effective_daily_cost_limit / 24,
            CASE user_config.user_type
                WHEN 'enterprise' THEN 50.0
                WHEN 'business' THEN 20.0
                ELSE 5.0
            END
        )
    );
    
    RETURN effective_limits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create intelligent AI provider configurations for new users
CREATE OR REPLACE FUNCTION public.create_intelligent_ai_provider_configs(user_uuid UUID)
RETURNS VOID AS $$
DECLARE
    provider_record RECORD;
    user_config RECORD;
    intelligent_limits JSONB;
    priority_score INTEGER;
BEGIN
    -- Get user configuration
    SELECT * INTO user_config
    FROM public.user_configuration uc
    JOIN public.profiles p ON p.id = uc.user_id
    WHERE uc.user_id = user_uuid;
    
    -- Create configurations for each active provider
    FOR provider_record IN 
        SELECT * FROM public.ai_providers WHERE is_active = true
    LOOP
        -- Calculate intelligent rate limits
        intelligent_limits := public.calculate_user_rate_limits(
            user_uuid,
            provider_record.id,
            provider_record.default_rate_limits
        );
        
        -- Calculate priority based on provider characteristics and user type
        priority_score := CASE provider_record.name
            WHEN 'openai' THEN 90     -- High quality, reliable
            WHEN 'anthropic' THEN 85  -- High quality, good for analysis
            WHEN 'google' THEN 75     -- Good for research, large context
            WHEN 'groq' THEN 70       -- Fast, cost-effective
            WHEN 'cohere' THEN 65     -- Good for specific use cases
            ELSE 50
        END;
        
        -- Adjust priority based on user preferences
        IF user_config.cost_optimization_enabled THEN
            priority_score := CASE provider_record.name
                WHEN 'groq' THEN priority_score + 20
                WHEN 'google' THEN priority_score + 10
                WHEN 'openai' THEN priority_score - 10
                ELSE priority_score
            END;
        END IF;
        
        -- Create provider configuration
        INSERT INTO public.user_ai_provider_configs (
            user_id,
            provider_id,
            custom_timeout_seconds,
            effective_rate_limits,
            reliability_score,
            performance_score,
            cost_efficiency_score,
            user_priority,
            auto_failover_enabled,
            cost_optimization_enabled,
            configuration_source
        ) VALUES (
            user_uuid,
            provider_record.id,
            COALESCE(provider_record.default_timeout_seconds, 30),
            intelligent_limits,
            CASE provider_record.name
                WHEN 'openai' THEN 0.95
                WHEN 'anthropic' THEN 0.92
                WHEN 'google' THEN 0.88
                WHEN 'groq' THEN 0.85
                ELSE 0.80
            END,
            CASE provider_record.name
                WHEN 'groq' THEN 0.98
                WHEN 'openai' THEN 0.90
                WHEN 'anthropic' THEN 0.85
                WHEN 'google' THEN 0.80
                ELSE 0.75
            END,
            CASE provider_record.name
                WHEN 'groq' THEN 0.95
                WHEN 'google' THEN 0.90
                WHEN 'anthropic' THEN 0.80
                WHEN 'openai' THEN 0.75
                ELSE 0.70
            END,
            priority_score,
            true, -- auto_failover_enabled
            user_config.cost_optimization_enabled,
            'ai_suggested'
        ) ON CONFLICT (user_id, provider_id) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to encrypt API keys
CREATE OR REPLACE FUNCTION public.encrypt_api_key(raw_key TEXT, user_uuid UUID)
RETURNS TEXT AS $$
BEGIN
    -- Use user_id as part of the encryption key for additional security
    RETURN crypt(raw_key, gen_salt('bf', 10) || user_uuid::TEXT);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate key hash for deduplication
CREATE OR REPLACE FUNCTION public.generate_key_hash(raw_key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(digest(raw_key, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify and update API key status
CREATE OR REPLACE FUNCTION public.verify_api_key(key_id UUID, is_working BOOLEAN, response_time_ms INTEGER DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    UPDATE public.user_api_keys 
    SET 
        is_verified = is_working,
        verification_attempts = verification_attempts + 1,
        last_verification_at = public.utc_now(),
        last_used_at = CASE WHEN is_working THEN public.utc_now() ELSE last_used_at END,
        updated_at = public.utc_now()
    WHERE id = key_id;
    
    -- Update provider configuration if verification fails repeatedly
    IF NOT is_working AND EXISTS (
        SELECT 1 FROM public.user_api_keys 
        WHERE id = key_id AND verification_attempts >= 3
    ) THEN
        UPDATE public.user_ai_provider_configs
        SET is_enabled = false
        WHERE provider_id = (SELECT provider_id FROM public.user_api_keys WHERE id = key_id)
        AND user_id = (SELECT user_id FROM public.user_api_keys WHERE id = key_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record API key usage with intelligent tracking
CREATE OR REPLACE FUNCTION public.record_api_key_usage(
    key_id UUID,
    tokens_count INTEGER DEFAULT 0,
    cost_amount DECIMAL DEFAULT 0,
    had_error BOOLEAN DEFAULT false,
    latency_ms INTEGER DEFAULT 0,
    request_metadata JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
    -- Update the API key record
    UPDATE public.user_api_keys
    SET 
        usage_count = usage_count + 1,
        total_cost_usd = total_cost_usd + cost_amount,
        total_tokens = total_tokens + tokens_count,
        last_used_at = public.utc_now(),
        updated_at = public.utc_now()
    WHERE id = key_id;
    
    -- Update or insert daily usage stats
    INSERT INTO public.api_key_usage_history (
        api_key_id, date, requests_count, tokens_used, cost_usd,
        successful_requests, failed_requests, avg_latency_ms
    ) VALUES (
        key_id, CURRENT_DATE, 1, tokens_count, cost_amount,
        CASE WHEN had_error THEN 0 ELSE 1 END,
        CASE WHEN had_error THEN 1 ELSE 0 END,
        latency_ms
    )
    ON CONFLICT (api_key_id, date) DO UPDATE SET
        requests_count = api_key_usage_history.requests_count + 1,
        tokens_used = api_key_usage_history.tokens_used + tokens_count,
        cost_usd = api_key_usage_history.cost_usd + cost_amount,
        successful_requests = api_key_usage_history.successful_requests + CASE WHEN had_error THEN 0 ELSE 1 END,
        failed_requests = api_key_usage_history.failed_requests + CASE WHEN had_error THEN 1 ELSE 0 END,
        avg_latency_ms = (
            api_key_usage_history.avg_latency_ms * api_key_usage_history.requests_count + latency_ms
        ) / (api_key_usage_history.requests_count + 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get optimal model for user and use case
CREATE OR REPLACE FUNCTION public.get_optimal_model(
    user_uuid UUID,
    use_case TEXT,
    cost_priority DECIMAL DEFAULT 0.5,
    performance_priority DECIMAL DEFAULT 0.5
)
RETURNS TABLE(
    model_id UUID,
    provider_name TEXT,
    model_name TEXT,
    estimated_cost DECIMAL,
    confidence_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH user_provider_configs AS (
        SELECT 
            uapc.*,
            ap.name as provider_name
        FROM public.user_ai_provider_configs uapc
        JOIN public.ai_providers ap ON ap.id = uapc.provider_id
        WHERE uapc.user_id = user_uuid AND uapc.is_enabled = true
    ),
    ranked_models AS (
        SELECT 
            am.id,
            upc.provider_name,
            am.display_name,
            ((am.pricing->>'input_cost_per_1k')::DECIMAL + (am.pricing->>'output_cost_per_1k')::DECIMAL) as avg_cost,
            (
                (upc.cost_efficiency_score * cost_priority) +
                (upc.performance_score * performance_priority) +
                (CASE WHEN use_case = ANY(am.best_use_cases) THEN 0.2 ELSE 0 END)
            ) as confidence
        FROM public.ai_models am
        JOIN user_provider_configs upc ON upc.provider_id = am.provider_id
        WHERE am.is_active = true 
        AND NOT am.is_deprecated
        ORDER BY confidence DESC, avg_cost ASC
        LIMIT 5
    )
    SELECT 
        rm.id,
        rm.provider_name,
        rm.display_name,
        rm.avg_cost,
        rm.confidence
    FROM ranked_models rm;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create AI provider configs after user configuration is created
CREATE OR REPLACE FUNCTION public.create_ai_configs_after_user_config()
RETURNS TRIGGER AS $$
BEGIN
    -- Create intelligent AI provider configurations
    PERFORM public.create_intelligent_ai_provider_configs(NEW.user_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_ai_configs_trigger
    AFTER INSERT ON public.user_configuration
    FOR EACH ROW
    EXECUTE FUNCTION public.create_ai_configs_after_user_config();

SELECT 'Dynamic AI providers and models system completed!' as status; 