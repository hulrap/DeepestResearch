-- =============================================
-- WORKFLOW TEMPLATES & EXECUTION
-- Enhanced workflow management with validation and state tracking
-- =============================================

-- Workflow templates (Monica.im style)
CREATE TABLE public.workflow_templates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- research, analysis, writing, coding, business
    difficulty_level TEXT DEFAULT 'intermediate',
    estimated_duration_minutes INTEGER,
    estimated_cost_range JSONB NOT NULL DEFAULT '{}', -- {min: 0.01, max: 0.1}
    is_public BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    created_by UUID REFERENCES public.profiles(id),
    template_data JSONB NOT NULL, -- Full workflow definition
    tags TEXT[] DEFAULT '{}',
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    changelog TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_difficulty CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    CONSTRAINT valid_category CHECK (category IN ('research', 'analysis', 'writing', 'coding', 'business', 'creative', 'data', 'other')),
    CONSTRAINT valid_duration CHECK (estimated_duration_minutes IS NULL OR estimated_duration_minutes > 0),
    CONSTRAINT valid_rating CHECK (rating >= 0 AND rating <= 5),
    CONSTRAINT valid_review_count CHECK (review_count >= 0),
    CONSTRAINT valid_usage_count CHECK (usage_count >= 0),
    CONSTRAINT valid_version CHECK (version > 0),
    CONSTRAINT valid_cost_range CHECK (jsonb_typeof(estimated_cost_range) = 'object'),
    CONSTRAINT valid_template_data CHECK (jsonb_typeof(template_data) = 'object')
);

-- Active workflow sessions
CREATE TABLE public.workflow_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.workflow_templates(id),
    title TEXT NOT NULL,
    description TEXT,
    status public.workflow_status DEFAULT 'pending',
    priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5), -- 1=highest, 5=lowest
    current_step INTEGER DEFAULT 0,
    total_steps INTEGER,
    progress_percentage DECIMAL(5,2) DEFAULT 0,
    
    -- Execution state
    execution_state JSONB DEFAULT '{}', -- Current workflow state
    step_results JSONB DEFAULT '{}', -- Results from completed steps
    error_state JSONB, -- Error information if failed
    context_data JSONB DEFAULT '{}', -- User inputs and context
    
    -- Cost tracking
    estimated_total_cost DECIMAL(10,8),
    actual_total_cost DECIMAL(10,8) DEFAULT 0,
    cost_breakdown JSONB DEFAULT '{}', -- Cost per step/provider
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now(),
    timeout_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}', -- User preferences, custom settings
    workspace_id UUID, -- Reference to workspace if applicable
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_progress CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    CONSTRAINT valid_current_step CHECK (current_step >= 0),
    CONSTRAINT valid_total_steps CHECK (total_steps IS NULL OR total_steps > 0),
    CONSTRAINT valid_costs CHECK (
        (estimated_total_cost IS NULL OR estimated_total_cost >= 0) AND
        actual_total_cost >= 0
    )
);

-- Individual step executions within workflows
CREATE TABLE public.workflow_step_executions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.workflow_sessions(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_name TEXT NOT NULL,
    step_type TEXT DEFAULT 'ai_generation', -- ai_generation, human_input, api_call, data_processing
    agent_type TEXT, -- researcher, analyzer, writer, critic
    model_used TEXT,
    provider_used TEXT,
    
    -- Execution details
    status public.step_status DEFAULT 'pending',
    input_data JSONB DEFAULT '{}',
    output_data JSONB DEFAULT '{}',
    error_message TEXT,
    error_code TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER, -- Set from user preferences or template config
    
    -- Quality metrics
    confidence_score DECIMAL(3,2) CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
    quality_score DECIMAL(3,2) CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 1)),
    human_feedback TEXT,
    human_rating INTEGER CHECK (human_rating IS NULL OR (human_rating >= 1 AND human_rating <= 5)),
    
    -- Performance metrics
    tokens_used JSONB DEFAULT '{}', -- {input: 100, output: 200}
    cost_usd DECIMAL(10,8) DEFAULT 0,
    latency_ms INTEGER,
    processing_time_ms INTEGER,
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    timeout_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_step_number CHECK (step_number >= 0),
    CONSTRAINT valid_retry_count CHECK (retry_count >= 0 AND retry_count <= max_retries),
    CONSTRAINT valid_max_retries CHECK (max_retries >= 0),
    CONSTRAINT valid_cost CHECK (cost_usd >= 0),
    CONSTRAINT valid_latency CHECK (latency_ms IS NULL OR latency_ms >= 0),
    CONSTRAINT valid_processing_time CHECK (processing_time_ms IS NULL OR processing_time_ms >= 0),
    CONSTRAINT unique_session_step UNIQUE(session_id, step_number)
);

-- Template reviews and ratings
CREATE TABLE public.workflow_template_reviews (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    template_id UUID REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.workflow_sessions(id), -- Optional reference to specific execution
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    content TEXT,
    pros TEXT[],
    cons TEXT[],
    tags TEXT[],
    is_verified_purchase BOOLEAN DEFAULT false, -- If user actually ran the workflow
    helpful_votes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    UNIQUE(template_id, user_id) -- One review per user per template
);

-- Workflow favorites/bookmarks
CREATE TABLE public.workflow_favorites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    UNIQUE(user_id, template_id)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Template indexes
CREATE INDEX idx_workflow_templates_public ON public.workflow_templates(is_public, category, rating DESC) WHERE is_active = true;
CREATE INDEX idx_workflow_templates_user ON public.workflow_templates(created_by, created_at DESC);
CREATE INDEX idx_workflow_templates_category ON public.workflow_templates(category, is_featured DESC, usage_count DESC);
CREATE INDEX idx_workflow_templates_tags ON public.workflow_templates USING GIN(tags);
CREATE INDEX idx_workflow_templates_search ON public.workflow_templates USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Session indexes
CREATE INDEX idx_workflow_sessions_user ON public.workflow_sessions(user_id, created_at DESC);
CREATE INDEX idx_workflow_sessions_status ON public.workflow_sessions(status, last_activity_at DESC);
CREATE INDEX idx_workflow_sessions_template ON public.workflow_sessions(template_id, status);
CREATE INDEX idx_workflow_sessions_active ON public.workflow_sessions(last_activity_at DESC) WHERE status IN ('running', 'paused');

-- Step execution indexes
CREATE INDEX idx_step_executions_session ON public.workflow_step_executions(session_id, step_number);
CREATE INDEX idx_step_executions_status ON public.workflow_step_executions(status, created_at DESC);
CREATE INDEX idx_step_executions_model ON public.workflow_step_executions(model_used, provider_used, status);

-- Review indexes
CREATE INDEX idx_template_reviews_template ON public.workflow_template_reviews(template_id, rating DESC);
CREATE INDEX idx_template_reviews_user ON public.workflow_template_reviews(user_id, created_at DESC);

-- Favorite indexes
CREATE INDEX idx_workflow_favorites_user ON public.workflow_favorites(user_id, created_at DESC);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE TRIGGER update_workflow_templates_updated_at
    BEFORE UPDATE ON public.workflow_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workflow_sessions_updated_at
    BEFORE UPDATE ON public.workflow_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_template_reviews_updated_at
    BEFORE UPDATE ON public.workflow_template_reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FUNCTIONS FOR WORKFLOW MANAGEMENT
-- =============================================

-- Function to update template usage count
CREATE OR REPLACE FUNCTION public.increment_template_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.workflow_templates
    SET usage_count = usage_count + 1,
        updated_at = public.utc_now()
    WHERE id = NEW.template_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to increment template usage
CREATE TRIGGER increment_template_usage_trigger
    AFTER INSERT ON public.workflow_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.increment_template_usage();

-- Function to update template rating
CREATE OR REPLACE FUNCTION public.update_template_rating()
RETURNS TRIGGER AS $$
DECLARE
    avg_rating DECIMAL(3,2);
    total_reviews INTEGER;
BEGIN
    -- Calculate new average rating
    SELECT AVG(rating)::DECIMAL(3,2), COUNT(*)
    INTO avg_rating, total_reviews
    FROM public.workflow_template_reviews
    WHERE template_id = COALESCE(NEW.template_id, OLD.template_id);
    
    -- Update template
    UPDATE public.workflow_templates
    SET 
        rating = COALESCE(avg_rating, 0),
        review_count = total_reviews,
        updated_at = public.utc_now()
    WHERE id = COALESCE(NEW.template_id, OLD.template_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for template rating updates
CREATE TRIGGER update_template_rating_on_insert
    AFTER INSERT ON public.workflow_template_reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.update_template_rating();

CREATE TRIGGER update_template_rating_on_update
    AFTER UPDATE ON public.workflow_template_reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.update_template_rating();

CREATE TRIGGER update_template_rating_on_delete
    AFTER DELETE ON public.workflow_template_reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.update_template_rating();

-- Function to set default step execution settings from user preferences
CREATE OR REPLACE FUNCTION public.set_default_step_settings()
RETURNS TRIGGER AS $$
DECLARE
    user_prefs RECORD;
    template_config JSONB;
BEGIN
    -- Get user preferences for workflow settings
    SELECT 
        workflow_preferences,
        COALESCE((workflow_preferences->>'default_max_retries')::INTEGER, 3) as max_retries_default,
        COALESCE((workflow_preferences->>'default_timeout_minutes')::INTEGER, 10) as timeout_default
    INTO user_prefs
    FROM public.user_preferences 
    WHERE user_id = (
        SELECT user_id FROM public.workflow_sessions WHERE id = NEW.session_id
    );
    
    -- Set max_retries if not provided
    IF NEW.max_retries IS NULL THEN
        NEW.max_retries := COALESCE(user_prefs.max_retries_default, 3);
    END IF;
    
    -- Set timeout if not provided (convert minutes to timestamp)
    IF NEW.timeout_at IS NULL AND NEW.started_at IS NOT NULL THEN
        NEW.timeout_at := NEW.started_at + (COALESCE(user_prefs.timeout_default, 10) || ' minutes')::INTERVAL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to set default step settings
CREATE TRIGGER set_default_step_settings_trigger
    BEFORE INSERT ON public.workflow_step_executions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_default_step_settings();

-- Function to validate workflow session state
CREATE OR REPLACE FUNCTION public.validate_workflow_session_state()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate status transitions
    IF OLD.status IS NOT NULL AND NEW.status != OLD.status THEN
        -- Only allow valid state transitions
        CASE OLD.status
            WHEN 'pending' THEN
                IF NEW.status NOT IN ('running', 'cancelled') THEN
                    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
                END IF;
            WHEN 'running' THEN
                IF NEW.status NOT IN ('paused', 'completed', 'failed', 'cancelled') THEN
                    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
                END IF;
            WHEN 'paused' THEN
                IF NEW.status NOT IN ('running', 'cancelled') THEN
                    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
                END IF;
            WHEN 'completed', 'failed', 'cancelled' THEN
                RAISE EXCEPTION 'Cannot change status from final state %', OLD.status;
        END CASE;
    END IF;
    
    -- Set timestamps based on status
    CASE NEW.status
        WHEN 'running' THEN
            IF NEW.started_at IS NULL THEN
                NEW.started_at = public.utc_now();
            END IF;
        WHEN 'completed', 'failed', 'cancelled' THEN
            IF NEW.completed_at IS NULL THEN
                NEW.completed_at = public.utc_now();
            END IF;
    END CASE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_workflow_session_state_trigger
    BEFORE UPDATE ON public.workflow_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_workflow_session_state();

SELECT 'Workflows and templates setup completed!' as status; 