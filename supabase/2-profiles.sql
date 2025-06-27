-- =============================================
-- USER PROFILES & AUTHENTICATION
-- Production-grade user profile management with intelligent configuration
-- =============================================

-- User profiles table with comprehensive validation
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    email TEXT, -- Synced from auth.users.email
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    
    -- User location and preferences (for intelligent defaults)
    country_code TEXT, -- ISO 3166-1 alpha-2
    timezone TEXT, -- IANA timezone
    locale TEXT, -- IETF language tag
    date_format TEXT,
    time_format TEXT,
    currency TEXT, -- ISO 4217 currency code
    
    -- User type and experience level (for intelligent defaults)
    user_type TEXT, -- individual, business, enterprise, developer
    experience_level TEXT, -- beginner, intermediate, advanced, expert
    primary_use_cases TEXT[], -- research, writing, coding, analysis, creative
    
    -- Account status and lifecycle
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    onboarding_completed BOOLEAN DEFAULT false,
    onboarding_step INTEGER DEFAULT 0,
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_email CHECK (email IS NULL OR public.is_valid_email(email)),
    CONSTRAINT valid_username CHECK (username IS NULL OR (length(username) >= 3 AND length(username) <= 50 AND username ~ '^[a-zA-Z0-9_-]+$')),
    CONSTRAINT valid_first_name CHECK (first_name IS NULL OR length(first_name) <= 100),
    CONSTRAINT valid_last_name CHECK (last_name IS NULL OR length(last_name) <= 100),
    CONSTRAINT valid_bio CHECK (bio IS NULL OR length(bio) <= 1000),
    CONSTRAINT valid_country_code CHECK (country_code IS NULL OR length(country_code) = 2),
    CONSTRAINT valid_locale CHECK (locale IS NULL OR length(locale) <= 10),
    CONSTRAINT valid_user_type CHECK (user_type IN ('individual', 'business', 'enterprise', 'developer')),
    CONSTRAINT valid_experience_level CHECK (experience_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    CONSTRAINT valid_date_format CHECK (date_format IN ('YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'DD-MM-YYYY')),
    CONSTRAINT valid_time_format CHECK (time_format IN ('12h', '24h')),
    CONSTRAINT valid_onboarding_step CHECK (onboarding_step >= 0 AND onboarding_step <= 10)
);

-- Comprehensive user configuration system
CREATE TABLE public.user_configuration (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
    
    -- === USAGE LIMITS (USER CONFIGURABLE) ===
    -- User-preferred limits (can be lower than plan limits)
    preferred_daily_cost_limit DECIMAL(10,6),
    preferred_monthly_cost_limit DECIMAL(10,6),
    preferred_daily_request_limit INTEGER,
    preferred_monthly_request_limit INTEGER,
    preferred_daily_token_limit INTEGER,
    preferred_monthly_token_limit INTEGER,
    
    -- Plan-enforced limits (set by subscription/billing)
    plan_daily_cost_limit DECIMAL(10,6) NOT NULL,
    plan_monthly_cost_limit DECIMAL(10,6) NOT NULL,
    plan_daily_request_limit INTEGER NOT NULL,
    plan_monthly_request_limit INTEGER NOT NULL,
    plan_daily_token_limit INTEGER NOT NULL,
    plan_monthly_token_limit INTEGER NOT NULL,
    
    -- Effective limits (computed as minimum of preferred and plan limits)
    effective_daily_cost_limit DECIMAL(10,6) GENERATED ALWAYS AS (
        LEAST(COALESCE(preferred_daily_cost_limit, plan_daily_cost_limit), plan_daily_cost_limit)
    ) STORED,
    effective_monthly_cost_limit DECIMAL(10,6) GENERATED ALWAYS AS (
        LEAST(COALESCE(preferred_monthly_cost_limit, plan_monthly_cost_limit), plan_monthly_cost_limit)
    ) STORED,
    effective_daily_request_limit INTEGER GENERATED ALWAYS AS (
        LEAST(COALESCE(preferred_daily_request_limit, plan_daily_request_limit), plan_daily_request_limit)
    ) STORED,
    effective_monthly_request_limit INTEGER GENERATED ALWAYS AS (
        LEAST(COALESCE(preferred_monthly_request_limit, plan_monthly_request_limit), plan_monthly_request_limit)
    ) STORED,
    effective_daily_token_limit INTEGER GENERATED ALWAYS AS (
        LEAST(COALESCE(preferred_daily_token_limit, plan_daily_token_limit), plan_daily_token_limit)
    ) STORED,
    effective_monthly_token_limit INTEGER GENERATED ALWAYS AS (
        LEAST(COALESCE(preferred_monthly_token_limit, plan_monthly_token_limit), plan_monthly_token_limit)
    ) STORED,
    
    -- === ALERT & NOTIFICATION SETTINGS ===
    cost_alert_thresholds DECIMAL[] DEFAULT ARRAY[0.50, 0.80, 0.95], -- 50%, 80%, 95%
    usage_alert_thresholds DECIMAL[] DEFAULT ARRAY[0.75, 0.90], -- 75%, 90%
    alert_methods JSONB DEFAULT '{"email": true, "push": true, "webhook": false}',
    webhook_url TEXT,
    alert_frequency TEXT DEFAULT 'smart', -- instant, hourly, daily, smart
    
    -- === DATA RETENTION PREFERENCES ===
    conversation_retention_days INTEGER,
    document_retention_days INTEGER,
    analytics_retention_days INTEGER,
    auto_cleanup_enabled BOOLEAN DEFAULT true,
    
    -- === AI & PROCESSING PREFERENCES ===
    -- Model preferences (user configurable)
    preferred_ai_providers TEXT[], -- Ordered list of preferred providers
    model_selection_strategy TEXT DEFAULT 'auto', -- auto, cost_optimized, performance_optimized, user_choice
    auto_fallback_enabled BOOLEAN DEFAULT true,
    cost_optimization_enabled BOOLEAN DEFAULT false,
    
    -- Processing preferences
    max_concurrent_workflows INTEGER,
    workflow_timeout_minutes INTEGER,
    auto_retry_enabled BOOLEAN DEFAULT true,
    max_retry_attempts INTEGER DEFAULT 3,
    
    -- Document processing preferences
    max_file_size_mb INTEGER,
    preferred_chunk_size INTEGER,
    chunk_overlap_percentage DECIMAL(3,2) DEFAULT 0.20, -- 20% overlap
    auto_extract_entities BOOLEAN DEFAULT true,
    auto_generate_summaries BOOLEAN DEFAULT true,
    
    -- === UI/UX PREFERENCES ===
    theme TEXT DEFAULT 'system',
    ui_density TEXT DEFAULT 'comfortable',
    sidebar_collapsed BOOLEAN DEFAULT false,
    auto_save_enabled BOOLEAN DEFAULT true,
    keyboard_shortcuts_enabled BOOLEAN DEFAULT true,
    animations_enabled BOOLEAN DEFAULT true,
    
    -- === PRIVACY & SECURITY SETTINGS ===
    data_sharing_consent BOOLEAN DEFAULT false,
    analytics_consent BOOLEAN DEFAULT true,
    marketing_consent BOOLEAN DEFAULT false,
    session_timeout_minutes INTEGER DEFAULT 480, -- 8 hours
    require_2fa BOOLEAN DEFAULT false,
    
    -- === INTELLIGENT FEATURES ===
    smart_suggestions_enabled BOOLEAN DEFAULT true,
    auto_optimization_enabled BOOLEAN DEFAULT false,
    learning_mode_enabled BOOLEAN DEFAULT true,
    personalization_enabled BOOLEAN DEFAULT true,
    
    -- Configuration metadata
    configuration_source TEXT DEFAULT 'user', -- user, system, ai_suggested, imported
    last_optimization_at TIMESTAMP WITH TIME ZONE,
    configuration_version INTEGER DEFAULT 1,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    -- Constraints for data integrity
    CONSTRAINT valid_cost_limits CHECK (
        plan_daily_cost_limit > 0 AND plan_monthly_cost_limit > 0 AND
        plan_monthly_cost_limit >= plan_daily_cost_limit * 30 AND
        (preferred_daily_cost_limit IS NULL OR preferred_daily_cost_limit > 0) AND
        (preferred_monthly_cost_limit IS NULL OR preferred_monthly_cost_limit > 0)
    ),
    CONSTRAINT valid_request_limits CHECK (
        plan_daily_request_limit > 0 AND plan_monthly_request_limit > 0 AND
        plan_monthly_request_limit >= plan_daily_request_limit * 30 AND
        (preferred_daily_request_limit IS NULL OR preferred_daily_request_limit > 0) AND
        (preferred_monthly_request_limit IS NULL OR preferred_monthly_request_limit > 0)
    ),
    CONSTRAINT valid_token_limits CHECK (
        plan_daily_token_limit > 0 AND plan_monthly_token_limit > 0 AND
        plan_monthly_token_limit >= plan_daily_token_limit * 30 AND
        (preferred_daily_token_limit IS NULL OR preferred_daily_token_limit > 0) AND
        (preferred_monthly_token_limit IS NULL OR preferred_monthly_token_limit > 0)
    ),
    CONSTRAINT valid_alert_thresholds CHECK (
        array_length(cost_alert_thresholds, 1) BETWEEN 1 AND 5 AND
        array_length(usage_alert_thresholds, 1) BETWEEN 1 AND 5
    ),
    CONSTRAINT valid_retention_days CHECK (
        (conversation_retention_days IS NULL OR conversation_retention_days >= 1) AND
        (document_retention_days IS NULL OR document_retention_days >= 1) AND
        (analytics_retention_days IS NULL OR analytics_retention_days >= 1)
    ),
    CONSTRAINT valid_model_strategy CHECK (model_selection_strategy IN ('auto', 'cost_optimized', 'performance_optimized', 'user_choice')),
    CONSTRAINT valid_theme CHECK (theme IN ('light', 'dark', 'system', 'auto')),
    CONSTRAINT valid_ui_density CHECK (ui_density IN ('compact', 'comfortable', 'spacious')),
    CONSTRAINT valid_alert_frequency CHECK (alert_frequency IN ('instant', 'hourly', 'daily', 'smart')),
    CONSTRAINT valid_configuration_source CHECK (configuration_source IN ('user', 'system', 'ai_suggested', 'imported', 'onboarding')),
    CONSTRAINT valid_chunk_overlap CHECK (chunk_overlap_percentage BETWEEN 0.0 AND 0.5),
    CONSTRAINT valid_session_timeout CHECK (session_timeout_minutes BETWEEN 30 AND 10080), -- 30 minutes to 7 days
    CONSTRAINT valid_workflow_settings CHECK (
        (max_concurrent_workflows IS NULL OR max_concurrent_workflows BETWEEN 1 AND 50) AND
        (workflow_timeout_minutes IS NULL OR workflow_timeout_minutes BETWEEN 5 AND 120) AND
        (max_retry_attempts BETWEEN 0 AND 10)
    )
);

-- Dynamic plan configurations (replaces hardcoded limits)
CREATE TABLE public.plan_configurations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    plan_type TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    
    -- Base limits for this plan
    daily_cost_limit DECIMAL(10,6) NOT NULL,
    monthly_cost_limit DECIMAL(10,6) NOT NULL,
    daily_request_limit INTEGER NOT NULL,
    monthly_request_limit INTEGER NOT NULL,
    daily_token_limit INTEGER NOT NULL,
    monthly_token_limit INTEGER NOT NULL,
    
    -- Feature limits
    max_file_size_mb INTEGER NOT NULL,
    max_concurrent_workflows INTEGER NOT NULL,
    max_team_members INTEGER NOT NULL,
    max_workspaces INTEGER NOT NULL,
    storage_gb INTEGER NOT NULL,
    
    -- Feature availability
    features_enabled JSONB NOT NULL DEFAULT '{}',
    advanced_features_enabled JSONB NOT NULL DEFAULT '{}',
    
    -- Plan metadata
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    CONSTRAINT valid_plan_limits CHECK (
        daily_cost_limit > 0 AND monthly_cost_limit > 0 AND
        daily_request_limit > 0 AND monthly_request_limit > 0 AND
        daily_token_limit > 0 AND monthly_token_limit > 0 AND
        max_file_size_mb > 0 AND max_concurrent_workflows > 0 AND
        max_team_members > 0 AND max_workspaces > 0 AND storage_gb > 0
    )
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Profile indexes
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_username ON public.profiles(username) WHERE username IS NOT NULL;
CREATE INDEX idx_profiles_active ON public.profiles(is_active, created_at DESC);
CREATE INDEX idx_profiles_onboarding ON public.profiles(onboarding_completed, onboarding_step);
CREATE INDEX idx_profiles_user_type ON public.profiles(user_type, experience_level);
CREATE INDEX idx_profiles_location ON public.profiles(country_code, timezone);

-- Configuration indexes
CREATE INDEX idx_user_configuration_user ON public.user_configuration(user_id);
CREATE INDEX idx_user_configuration_limits ON public.user_configuration(effective_daily_cost_limit, effective_monthly_cost_limit);
CREATE INDEX idx_user_configuration_source ON public.user_configuration(configuration_source, updated_at);

-- Plan configuration indexes
CREATE INDEX idx_plan_configurations_type ON public.plan_configurations(plan_type, is_active);
CREATE INDEX idx_plan_configurations_active ON public.plan_configurations(is_active, sort_order);

-- =============================================
-- UTILITY FUNCTIONS
-- =============================================

-- Function to automatically update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = public.utc_now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_configuration_updated_at
    BEFORE UPDATE ON public.user_configuration
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plan_configurations_updated_at
    BEFORE UPDATE ON public.plan_configurations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- INTELLIGENT CONFIGURATION FUNCTIONS
-- =============================================

-- Function to generate intelligent defaults based on user profile
CREATE OR REPLACE FUNCTION public.generate_intelligent_defaults(
    user_uuid UUID,
    user_profile JSONB DEFAULT '{}'
)
RETURNS JSONB AS $$
DECLARE
    defaults JSONB := '{}';
    profile_data RECORD;
    base_plan RECORD;
    country_defaults JSONB;
    experience_multiplier DECIMAL := 1.0;
BEGIN
    -- Get user profile data
    SELECT 
        user_type, experience_level, primary_use_cases, 
        country_code, timezone, locale
    INTO profile_data
    FROM public.profiles WHERE id = user_uuid;
    
    -- Get base plan (default to 'free' if no subscription)
    SELECT * INTO base_plan 
    FROM public.plan_configurations 
    WHERE plan_type = 'free' AND is_active = true
    LIMIT 1;
    
    -- Adjust based on experience level
    experience_multiplier := CASE profile_data.experience_level
        WHEN 'beginner' THEN 0.5
        WHEN 'intermediate' THEN 1.0
        WHEN 'advanced' THEN 1.5
        WHEN 'expert' THEN 2.0
        ELSE 1.0
    END;
    
    -- Country-specific defaults
    country_defaults := CASE profile_data.country_code
        WHEN 'US' THEN '{"currency": "USD", "date_format": "MM/DD/YYYY"}'
        WHEN 'GB' THEN '{"currency": "GBP", "date_format": "DD/MM/YYYY"}'
        WHEN 'DE' THEN '{"currency": "EUR", "date_format": "DD.MM.YYYY"}'
        WHEN 'FR' THEN '{"currency": "EUR", "date_format": "DD/MM/YYYY"}'
        WHEN 'JP' THEN '{"currency": "JPY", "date_format": "YYYY/MM/DD"}'
        ELSE '{"currency": "USD", "date_format": "YYYY-MM-DD"}'
    END;
    
    -- Build intelligent defaults
    defaults := jsonb_build_object(
        -- Plan-based limits
        'plan_daily_cost_limit', base_plan.daily_cost_limit,
        'plan_monthly_cost_limit', base_plan.monthly_cost_limit,
        'plan_daily_request_limit', base_plan.daily_request_limit,
        'plan_monthly_request_limit', base_plan.monthly_request_limit,
        'plan_daily_token_limit', base_plan.daily_token_limit,
        'plan_monthly_token_limit', base_plan.monthly_token_limit,
        
        -- User preferences based on experience
        'preferred_daily_cost_limit', (base_plan.daily_cost_limit * experience_multiplier)::DECIMAL(10,6),
        'max_concurrent_workflows', GREATEST(1, (base_plan.max_concurrent_workflows * experience_multiplier)::INTEGER),
        'workflow_timeout_minutes', CASE profile_data.experience_level
            WHEN 'beginner' THEN 30
            WHEN 'intermediate' THEN 60
            ELSE 120
        END,
        
        -- Processing preferences based on use cases
        'auto_extract_entities', CASE 
            WHEN 'research' = ANY(profile_data.primary_use_cases) THEN true
            ELSE false
        END,
        'cost_optimization_enabled', CASE profile_data.user_type
            WHEN 'individual' THEN true
            ELSE false
        END,
        
        -- UI preferences based on experience
        'ui_density', CASE profile_data.experience_level
            WHEN 'beginner' THEN 'comfortable'
            WHEN 'expert' THEN 'compact'
            ELSE 'comfortable'
        END,
        
        -- Retention based on user type
        'conversation_retention_days', CASE profile_data.user_type
            WHEN 'business' THEN 365
            WHEN 'enterprise' THEN 2555  -- 7 years
            ELSE 90
        END,
        'document_retention_days', CASE profile_data.user_type
            WHEN 'business' THEN 730  -- 2 years
            WHEN 'enterprise' THEN 2555  -- 7 years
            ELSE 365
        END
    ) || country_defaults;
    
    RETURN defaults;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create intelligent user configuration
CREATE OR REPLACE FUNCTION public.create_intelligent_user_configuration(user_uuid UUID)
RETURNS UUID AS $$
DECLARE
    config_id UUID;
    intelligent_defaults JSONB;
    profile_data RECORD;
BEGIN
    -- Get user profile
    SELECT * INTO profile_data FROM public.profiles WHERE id = user_uuid;
    
    -- Generate intelligent defaults
    intelligent_defaults := public.generate_intelligent_defaults(
        user_uuid,
        to_jsonb(profile_data)
    );
    
    -- Create configuration with intelligent defaults
    INSERT INTO public.user_configuration (
        user_id,
        plan_daily_cost_limit,
        plan_monthly_cost_limit,
        plan_daily_request_limit,
        plan_monthly_request_limit,
        plan_daily_token_limit,
        plan_monthly_token_limit,
        preferred_daily_cost_limit,
        max_concurrent_workflows,
        workflow_timeout_minutes,
        auto_extract_entities,
        cost_optimization_enabled,
        ui_density,
        conversation_retention_days,
        document_retention_days,
        configuration_source
    ) VALUES (
        user_uuid,
        (intelligent_defaults->>'plan_daily_cost_limit')::DECIMAL(10,6),
        (intelligent_defaults->>'plan_monthly_cost_limit')::DECIMAL(10,6),
        (intelligent_defaults->>'plan_daily_request_limit')::INTEGER,
        (intelligent_defaults->>'plan_monthly_request_limit')::INTEGER,
        (intelligent_defaults->>'plan_daily_token_limit')::INTEGER,
        (intelligent_defaults->>'plan_monthly_token_limit')::INTEGER,
        (intelligent_defaults->>'preferred_daily_cost_limit')::DECIMAL(10,6),
        (intelligent_defaults->>'max_concurrent_workflows')::INTEGER,
        (intelligent_defaults->>'workflow_timeout_minutes')::INTEGER,
        (intelligent_defaults->>'auto_extract_entities')::BOOLEAN,
        (intelligent_defaults->>'cost_optimization_enabled')::BOOLEAN,
        intelligent_defaults->>'ui_density',
        (intelligent_defaults->>'conversation_retention_days')::INTEGER,
        (intelligent_defaults->>'document_retention_days')::INTEGER,
        'ai_suggested'
    ) RETURNING id INTO config_id;
    
    RETURN config_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically create profile for new auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    detected_country TEXT;
    detected_locale TEXT;
BEGIN
    -- Detect country and locale from metadata or defaults
    detected_country := COALESCE(NEW.raw_user_meta_data->>'country', 'US');
    detected_locale := COALESCE(NEW.raw_user_meta_data->>'locale', 'en');
    
    INSERT INTO public.profiles (
        id, email, email_verified, first_name, last_name,
        country_code, locale, user_type, experience_level
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        detected_country,
        detected_locale,
        COALESCE(NEW.raw_user_meta_data->>'user_type', 'individual'),
        COALESCE(NEW.raw_user_meta_data->>'experience_level', 'intermediate')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = NEW.email,
        email_verified = COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
        updated_at = public.utc_now();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Function to create configuration after profile creation
CREATE OR REPLACE FUNCTION public.create_user_configuration_after_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Create intelligent configuration
    PERFORM public.create_intelligent_user_configuration(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create configuration after profile
CREATE TRIGGER create_user_configuration_trigger
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.create_user_configuration_after_profile();

-- Function to sync profile changes back to auth metadata
CREATE OR REPLACE FUNCTION public.sync_profile_to_auth()
RETURNS TRIGGER AS $$
BEGIN
    -- Update auth.users metadata when profile changes
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
        jsonb_build_object(
            'first_name', NEW.first_name,
            'last_name', NEW.last_name,
            'username', NEW.username,
            'user_type', NEW.user_type,
            'experience_level', NEW.experience_level,
            'country', NEW.country_code
        )
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync profile changes to auth
CREATE TRIGGER sync_profile_to_auth_trigger
    AFTER UPDATE OF first_name, last_name, username, user_type, experience_level, country_code ON public.profiles
    FOR EACH ROW
    WHEN (OLD.first_name IS DISTINCT FROM NEW.first_name OR 
          OLD.last_name IS DISTINCT FROM NEW.last_name OR 
          OLD.username IS DISTINCT FROM NEW.username OR
          OLD.user_type IS DISTINCT FROM NEW.user_type OR
          OLD.experience_level IS DISTINCT FROM NEW.experience_level OR
          OLD.country_code IS DISTINCT FROM NEW.country_code)
    EXECUTE FUNCTION public.sync_profile_to_auth();

SELECT 'Enhanced user profiles and configuration system completed!' as status; 