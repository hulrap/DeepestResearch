-- =============================================
-- AI Agent Platform Database Schema - Extended
-- Complete replacement with advanced features
-- =============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector"; -- For AI embeddings/memory

-- Drop existing tables if they exist (except auth which is managed by Supabase)
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.stripe_customers CASCADE;
DROP TABLE IF EXISTS public.stripe_products CASCADE;
DROP TABLE IF EXISTS public.stripe_prices CASCADE;
DROP TABLE IF EXISTS public.stripe_subscriptions CASCADE;
DROP TABLE IF EXISTS public.stripe_payments CASCADE;

-- =============================================
-- CORE USER MANAGEMENT
-- =============================================

-- User profiles (simplified)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =============================================
-- AI PROVIDER & MODEL MANAGEMENT
-- =============================================

-- Supported AI providers
CREATE TABLE public.ai_providers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    auth_type TEXT NOT NULL DEFAULT 'api_key',
    is_active BOOLEAN DEFAULT true,
    rate_limits JSONB, -- {requests_per_minute: 60, tokens_per_minute: 90000}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Available AI models with enhanced metadata
CREATE TABLE public.ai_models (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    provider_id UUID REFERENCES public.ai_providers(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    capabilities JSONB, -- ['text', 'vision', 'code', 'function_calling', 'json_mode']
    pricing JSONB, -- {input_cost_per_1k: 0.01, output_cost_per_1k: 0.03}
    context_window INTEGER,
    max_output_tokens INTEGER,
    is_active BOOLEAN DEFAULT true,
    performance_score DECIMAL(3,2) DEFAULT 0.8, -- Quality rating 0-1
    speed_score DECIMAL(3,2) DEFAULT 0.8, -- Speed rating 0-1
    cost_efficiency DECIMAL(3,2) DEFAULT 0.8, -- Cost efficiency 0-1
    best_use_cases TEXT[], -- ['research', 'analysis', 'writing', 'coding', 'reasoning']
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(provider_id, model_id)
);

-- User's API keys
CREATE TABLE public.user_api_keys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES public.ai_providers(id) ON DELETE CASCADE,
    encrypted_api_key TEXT NOT NULL,
    key_name TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, provider_id, key_name)
);

-- =============================================
-- WORKFLOW TEMPLATES & DEFINITIONS
-- =============================================

-- Workflow templates (Monica.im style)
CREATE TABLE public.workflow_templates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT, -- 'research', 'analysis', 'writing', 'coding', 'business'
    difficulty_level TEXT DEFAULT 'intermediate', -- 'beginner', 'intermediate', 'advanced'
    estimated_duration_minutes INTEGER,
    estimated_cost_range JSONB, -- {min: 0.01, max: 0.1}
    is_public BOOLEAN DEFAULT false,
    created_by UUID REFERENCES public.profiles(id),
    template_data JSONB NOT NULL, -- Full workflow definition
    tags TEXT[],
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =============================================
-- WORKFLOW EXECUTION & STATE MANAGEMENT
-- =============================================

-- Active workflow sessions
CREATE TABLE public.workflow_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.workflow_templates(id),
    title TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'running', 'paused', 'completed', 'failed', 'cancelled'
    current_step INTEGER DEFAULT 0,
    total_steps INTEGER,
    progress_percentage DECIMAL(5,2) DEFAULT 0,
    
    -- Execution state
    execution_state JSONB, -- Current workflow state
    step_results JSONB, -- Results from completed steps
    error_state JSONB, -- Error information if failed
    
    -- Cost tracking
    estimated_total_cost DECIMAL(10,8),
    actual_total_cost DECIMAL(10,8) DEFAULT 0,
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadata
    metadata JSONB, -- User preferences, custom settings
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Individual step executions within workflows
CREATE TABLE public.workflow_step_executions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.workflow_sessions(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_name TEXT NOT NULL,
    agent_type TEXT, -- 'researcher', 'analyzer', 'writer', 'critic'
    model_used TEXT,
    provider_used TEXT,
    
    -- Execution details
    status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'skipped'
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    
    -- Quality metrics
    confidence_score DECIMAL(3,2), -- AI's confidence in result
    quality_score DECIMAL(3,2), -- Validated quality score
    human_feedback TEXT, -- Human review/feedback
    
    -- Performance metrics
    tokens_used JSONB, -- {input: 100, output: 200}
    cost_usd DECIMAL(10,8),
    latency_ms INTEGER,
    retry_count INTEGER DEFAULT 0,
    
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =============================================
-- MEMORY & CONTEXT SYSTEM
-- =============================================

-- User memory storage (for AI agents to remember context)
CREATE TABLE public.user_memory (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    memory_type TEXT NOT NULL, -- 'conversation', 'preference', 'fact', 'pattern'
    content TEXT NOT NULL,
    embedding VECTOR(1536), -- OpenAI embedding dimension
    importance_score DECIMAL(3,2) DEFAULT 0.5, -- How important this memory is
    context_tags TEXT[], -- Tags for categorization
    source_session_id UUID REFERENCES public.workflow_sessions(id),
    expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document storage and processing
CREATE TABLE public.user_documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'pdf', 'docx', 'txt', 'image', 'url'
    file_size INTEGER,
    storage_path TEXT, -- Path to file in storage
    processing_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    
    -- Extracted content
    extracted_text TEXT,
    extracted_metadata JSONB,
    text_embeddings VECTOR(1536),
    
    -- Processing results
    summary TEXT,
    key_points TEXT[],
    citations JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =============================================
-- COLLABORATION & SHARING
-- =============================================

-- Team workspaces
CREATE TABLE public.workspaces (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    settings JSONB, -- Workspace preferences
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Workspace members
CREATE TABLE public.workspace_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member', -- 'owner', 'admin', 'member', 'viewer'
    permissions JSONB, -- Specific permissions
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(workspace_id, user_id)
);

-- Shared workflows
CREATE TABLE public.shared_workflows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.workflow_sessions(id) ON DELETE CASCADE,
    shared_by UUID REFERENCES public.profiles(id),
    workspace_id UUID REFERENCES public.workspaces(id),
    share_type TEXT DEFAULT 'view', -- 'view', 'edit', 'comment'
    access_level TEXT DEFAULT 'workspace', -- 'public', 'workspace', 'specific_users'
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =============================================
-- USAGE TRACKING & COST MANAGEMENT
-- =============================================

-- User spending limits
CREATE TABLE public.user_usage_limits (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    daily_limit_usd DECIMAL(10,6) DEFAULT 10.00,
    monthly_limit_usd DECIMAL(10,6) DEFAULT 100.00,
    hard_stop_enabled BOOLEAN DEFAULT true,
    warning_threshold DECIMAL(3,2) DEFAULT 0.80,
    reset_day INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enhanced API usage tracking
CREATE TABLE public.api_usage_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES public.ai_providers(id),
    model_id UUID REFERENCES public.ai_models(id),
    session_id UUID REFERENCES public.workflow_sessions(id),
    step_execution_id UUID REFERENCES public.workflow_step_executions(id),
    
    -- Token usage
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
    
    -- Cost calculation
    input_cost_usd DECIMAL(10,8) DEFAULT 0,
    output_cost_usd DECIMAL(10,8) DEFAULT 0,
    total_cost_usd DECIMAL(10,8) GENERATED ALWAYS AS (input_cost_usd + output_cost_usd) STORED,
    
    -- Performance metrics
    latency_ms INTEGER,
    status TEXT DEFAULT 'success',
    error_message TEXT,
    
    -- Request/response data
    request_data JSONB,
    response_data JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Daily usage summaries
CREATE TABLE public.daily_usage_summaries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_requests INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost_usd DECIMAL(10,8) DEFAULT 0,
    provider_breakdown JSONB,
    model_breakdown JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, date)
);

-- =============================================
-- REAL-TIME COLLABORATION
-- =============================================

-- Real-time session activities
CREATE TABLE public.session_activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.workflow_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id),
    activity_type TEXT NOT NULL, -- 'join', 'leave', 'edit', 'comment', 'step_complete'
    activity_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Comments and annotations
CREATE TABLE public.session_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.workflow_sessions(id) ON DELETE CASCADE,
    step_execution_id UUID REFERENCES public.workflow_step_executions(id),
    user_id UUID REFERENCES public.profiles(id),
    content TEXT NOT NULL,
    comment_type TEXT DEFAULT 'general', -- 'general', 'feedback', 'suggestion', 'issue'
    parent_comment_id UUID REFERENCES public.session_comments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW') NOT NULL
);

-- =============================================
-- INTEGRATIONS & EXPORTS
-- =============================================

-- Integration configurations
CREATE TABLE public.user_integrations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    integration_type TEXT NOT NULL, -- 'notion', 'google_docs', 'slack', 'zapier'
    configuration JSONB NOT NULL, -- Integration-specific config
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW') NOT NULL
);

-- Export history
CREATE TABLE public.export_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.workflow_sessions(id),
    export_type TEXT NOT NULL, -- 'pdf', 'docx', 'markdown', 'html', 'json'
    export_status TEXT DEFAULT 'processing', -- 'processing', 'completed', 'failed'
    file_path TEXT,
    file_size INTEGER,
    download_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =============================================
-- STRIPE INTEGRATION (PRESERVED)
-- =============================================

CREATE TABLE public.stripe_customers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    stripe_customer_id TEXT UNIQUE NOT NULL,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE public.stripe_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE public.stripe_prices (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES public.stripe_products(id) ON DELETE CASCADE,
    unit_amount INTEGER,
    currency TEXT DEFAULT 'usd',
    recurring_interval TEXT,
    type TEXT DEFAULT 'recurring',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW') NOT NULL
);

CREATE TABLE public.stripe_subscriptions (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES public.stripe_customers(stripe_customer_id),
    price_id TEXT REFERENCES public.stripe_prices(id),
    status TEXT NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE public.stripe_payments (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES public.stripe_customers(stripe_customer_id),
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'usd',
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Usage tracking indexes
CREATE INDEX idx_api_usage_logs_user_date ON public.api_usage_logs(user_id, created_at DESC);
CREATE INDEX idx_api_usage_logs_session ON public.api_usage_logs(session_id);
CREATE INDEX idx_daily_usage_user_date ON public.daily_usage_summaries(user_id, date DESC);

-- Workflow indexes
CREATE INDEX idx_workflow_sessions_user ON public.workflow_sessions(user_id, created_at DESC);
CREATE INDEX idx_workflow_sessions_status ON public.workflow_sessions(status, last_activity_at DESC);
CREATE INDEX idx_step_executions_session ON public.workflow_step_executions(session_id, step_number);

-- Memory and search indexes
CREATE INDEX idx_user_memory_embedding ON public.user_memory USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_user_memory_user_type ON public.user_memory(user_id, memory_type);
CREATE INDEX idx_documents_user ON public.user_documents(user_id, created_at DESC);

-- Collaboration indexes
CREATE INDEX idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX idx_workspace_members_workspace ON public.workspace_members(workspace_id);
CREATE INDEX idx_session_activities_session ON public.session_activities(session_id, created_at DESC);

-- Template indexes
CREATE INDEX idx_workflow_templates_public ON public.workflow_templates(is_public, category, rating DESC);
CREATE INDEX idx_workflow_templates_user ON public.workflow_templates(created_by, created_at DESC);

-- API key indexes
CREATE INDEX idx_user_api_keys_user_provider ON public.user_api_keys(user_id, provider_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_usage_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_usage_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_step_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_history ENABLE ROW LEVEL SECURITY;

-- Basic user policies
CREATE POLICY "Users can manage own data" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can manage own API keys" ON public.user_api_keys FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own limits" ON public.user_usage_limits FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own usage" ON public.api_usage_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own summaries" ON public.daily_usage_summaries FOR SELECT USING (auth.uid() = user_id);

-- Workflow policies
CREATE POLICY "Users can manage own workflows" ON public.workflow_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own step executions" ON public.workflow_step_executions 
  FOR SELECT USING (auth.uid() = (SELECT user_id FROM public.workflow_sessions WHERE id = session_id));

-- Memory and document policies
CREATE POLICY "Users can manage own memory" ON public.user_memory FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own documents" ON public.user_documents FOR ALL USING (auth.uid() = user_id);

-- Workspace policies
CREATE POLICY "Users can view workspaces they're members of" ON public.workspaces 
  FOR SELECT USING (auth.uid() IN (
    SELECT user_id FROM public.workspace_members WHERE workspace_id = id
  ));

CREATE POLICY "Workspace members can view membership" ON public.workspace_members 
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() IN (
    SELECT user_id FROM public.workspace_members wm2 WHERE wm2.workspace_id = workspace_id
  ));

-- Public read access for reference tables
CREATE POLICY "Anyone can view AI providers" ON public.ai_providers FOR SELECT USING (true);
CREATE POLICY "Anyone can view AI models" ON public.ai_models FOR SELECT USING (true);
CREATE POLICY "Anyone can view public templates" ON public.workflow_templates FOR SELECT USING (is_public = true);

-- =============================================
-- FUNCTIONS FOR WORKFLOW MANAGEMENT
-- =============================================

-- Function to update workflow session status
CREATE OR REPLACE FUNCTION public.update_workflow_session_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- Update parent session when step execution completes
    IF NEW.status = 'completed' THEN
        UPDATE public.workflow_sessions 
        SET 
            progress_percentage = (
                SELECT (COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL / COUNT(*)) * 100
                FROM public.workflow_step_executions 
                WHERE session_id = NEW.session_id
            ),
            actual_total_cost = (
                SELECT COALESCE(SUM(cost_usd), 0)
                FROM public.workflow_step_executions 
                WHERE session_id = NEW.session_id
            ),
            last_activity_at = NOW()
        WHERE id = NEW.session_id;
        
        -- Check if all steps are completed
        IF NOT EXISTS (
            SELECT 1 FROM public.workflow_step_executions 
            WHERE session_id = NEW.session_id AND status NOT IN ('completed', 'skipped')
        ) THEN
            UPDATE public.workflow_sessions 
            SET status = 'completed', completed_at = NOW()
            WHERE id = NEW.session_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for workflow progress updates
CREATE TRIGGER update_workflow_progress_trigger
    AFTER UPDATE ON public.workflow_step_executions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_workflow_session_progress();

-- Function to check spending limits
CREATE OR REPLACE FUNCTION public.check_spending_limit(user_uuid UUID, estimated_cost DECIMAL)
RETURNS BOOLEAN AS $$
DECLARE
    daily_spent DECIMAL;
    monthly_spent DECIMAL;
    limits RECORD;
BEGIN
    -- Get user's limits
    SELECT * INTO limits FROM public.user_usage_limits WHERE user_id = user_uuid;
    
    IF NOT FOUND THEN
        -- Use default limits if none set
        limits.daily_limit_usd := 10.00;
        limits.monthly_limit_usd := 100.00;
        limits.hard_stop_enabled := true;
    END IF;
    
    -- Calculate daily spending
    SELECT COALESCE(SUM(total_cost_usd), 0) INTO daily_spent
    FROM public.api_usage_logs 
    WHERE user_id = user_uuid 
    AND created_at >= CURRENT_DATE;
    
    -- Calculate monthly spending
    SELECT COALESCE(SUM(total_cost_usd), 0) INTO monthly_spent
    FROM public.api_usage_logs 
    WHERE user_id = user_uuid 
    AND created_at >= date_trunc('month', CURRENT_DATE);
    
    -- Check limits
    IF limits.hard_stop_enabled THEN
        IF (daily_spent + estimated_cost) > limits.daily_limit_usd THEN
            RETURN FALSE;
        END IF;
        
        IF (monthly_spent + estimated_cost) > limits.monthly_limit_usd THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- SEED DATA
-- =============================================

-- Insert popular AI providers with rate limits
INSERT INTO public.ai_providers (name, display_name, base_url, auth_type, rate_limits) VALUES
('openai', 'OpenAI', 'https://api.openai.com/v1', 'api_key', '{"requests_per_minute": 500, "tokens_per_minute": 90000}'),
('anthropic', 'Anthropic', 'https://api.anthropic.com', 'api_key', '{"requests_per_minute": 50, "tokens_per_minute": 40000}'),
('google', 'Google AI', 'https://generativelanguage.googleapis.com', 'api_key', '{"requests_per_minute": 60, "tokens_per_minute": 1000000}'),
('cohere', 'Cohere', 'https://api.cohere.ai', 'api_key', '{"requests_per_minute": 100, "tokens_per_minute": 10000}'),
('mistral', 'Mistral AI', 'https://api.mistral.ai', 'api_key', '{"requests_per_minute": 60, "tokens_per_minute": 30000}');

-- Insert AI models with enhanced metadata
INSERT INTO public.ai_models (provider_id, model_id, display_name, pricing, context_window, capabilities, performance_score, speed_score, cost_efficiency, best_use_cases) VALUES
-- OpenAI models
((SELECT id FROM public.ai_providers WHERE name = 'openai'), 'gpt-4-turbo', 'GPT-4 Turbo', '{"input_cost_per_1k": 0.01, "output_cost_per_1k": 0.03}', 128000, '["text", "vision", "function_calling", "json_mode"]', 0.95, 0.8, 0.7, '["analysis", "reasoning", "writing", "coding"]'),
((SELECT id FROM public.ai_providers WHERE name = 'openai'), 'gpt-4o', 'GPT-4o', '{"input_cost_per_1k": 0.005, "output_cost_per_1k": 0.015}', 128000, '["text", "vision", "function_calling", "json_mode"]', 0.9, 0.9, 0.85, '["research", "analysis", "vision", "general"]'),
((SELECT id FROM public.ai_providers WHERE name = 'openai'), 'gpt-3.5-turbo', 'GPT-3.5 Turbo', '{"input_cost_per_1k": 0.0015, "output_cost_per_1k": 0.002}', 16385, '["text", "function_calling", "json_mode"]', 0.8, 0.95, 0.95, '["writing", "summarization", "simple_tasks"]'),

-- Anthropic models
((SELECT id FROM public.ai_providers WHERE name = 'anthropic'), 'claude-3-opus-20240229', 'Claude 3 Opus', '{"input_cost_per_1k": 0.015, "output_cost_per_1k": 0.075}', 200000, '["text", "vision", "analysis"]', 0.98, 0.7, 0.6, '["analysis", "reasoning", "research", "writing"]'),
((SELECT id FROM public.ai_providers WHERE name = 'anthropic'), 'claude-3-sonnet-20240229', 'Claude 3 Sonnet', '{"input_cost_per_1k": 0.003, "output_cost_per_1k": 0.015}', 200000, '["text", "vision", "analysis"]', 0.9, 0.85, 0.8, '["research", "analysis", "writing"]'),
((SELECT id FROM public.ai_providers WHERE name = 'anthropic'), 'claude-3-haiku-20240307', 'Claude 3 Haiku', '{"input_cost_per_1k": 0.00025, "output_cost_per_1k": 0.00125}', 200000, '["text", "vision"]', 0.85, 0.95, 0.9, '["writing", "summarization", "quick_tasks"]'),

-- Google models
((SELECT id FROM public.ai_providers WHERE name = 'google'), 'gemini-1.5-pro', 'Gemini 1.5 Pro', '{"input_cost_per_1k": 0.0035, "output_cost_per_1k": 0.0105}', 1000000, '["text", "vision", "code", "analysis"]', 0.9, 0.8, 0.8, '["research", "analysis", "large_context"]'),
((SELECT id FROM public.ai_providers WHERE name = 'google'), 'gemini-1.5-flash', 'Gemini 1.5 Flash', '{"input_cost_per_1k": 0.00035, "output_cost_per_1k": 0.00105}', 1000000, '["text", "vision", "code"]', 0.85, 0.9, 0.95, '["research", "summarization", "quick_analysis"]');

-- Sample workflow templates
INSERT INTO public.workflow_templates (name, description, category, difficulty_level, estimated_duration_minutes, estimated_cost_range, is_public, template_data, tags) VALUES
('Deep Research Analysis', 'Comprehensive multi-agent research workflow', 'research', 'intermediate', 5, '{"min": 0.01, "max": 0.08}', true, 
'{"steps": [
  {"id": "research", "name": "Initial Research", "agent_type": "researcher", "model_preference": "gemini-1.5-pro", "prompt_template": "Research {{topic}} comprehensively"},
  {"id": "analysis", "name": "Critical Analysis", "agent_type": "analyzer", "model_preference": "claude-3-opus-20240229", "prompt_template": "Analyze {{research.content}} critically"},
  {"id": "synthesis", "name": "Synthesis", "agent_type": "synthesizer", "model_preference": "gpt-4-turbo", "prompt_template": "Synthesize findings from {{research.content}} and {{analysis.content}}"}
]}', 
'["research", "analysis", "multi-agent"]'),

('Quick Content Generation', 'Fast content creation workflow', 'writing', 'beginner', 2, '{"min": 0.005, "max": 0.02}', true,
'{"steps": [
  {"id": "outline", "name": "Create Outline", "agent_type": "writer", "model_preference": "gpt-3.5-turbo", "prompt_template": "Create an outline for {{topic}}"},
  {"id": "content", "name": "Generate Content", "agent_type": "writer", "model_preference": "claude-3-haiku-20240307", "prompt_template": "Write content based on {{outline.content}}"}
]}',
'["writing", "content", "quick"]'); 