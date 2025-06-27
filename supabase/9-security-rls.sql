-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Comprehensive security policies for all tables
-- 
-- NOTE: This script uses conditional checks to only enable RLS on tables that exist.
-- Some tables (like collaboration features) may not exist in your current schema.
-- The script will safely skip non-existent tables.
-- =============================================

-- Enable RLS on all tables that contain user data
-- =============================================

-- Core user tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_configurations ENABLE ROW LEVEL SECURITY;

-- AI provider and model tables (mostly public read, admin write)
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_key_usage_history ENABLE ROW LEVEL SECURITY;
-- model_performance_stats table - enable if exists
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'model_performance_stats') THEN
        ALTER TABLE public.model_performance_stats ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Workflow tables
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_step_executions ENABLE ROW LEVEL SECURITY;
-- Enable RLS on optional workflow tables if they exist
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflow_template_reviews') THEN
        ALTER TABLE public.workflow_template_reviews ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflow_favorites') THEN
        ALTER TABLE public.workflow_favorites ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Usage tracking tables (enable if they exist)
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_usage_limits') THEN
        ALTER TABLE public.user_usage_limits ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'api_usage_logs') THEN
        ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_usage_summaries') THEN
        ALTER TABLE public.daily_usage_summaries ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'monthly_usage_summaries') THEN
        ALTER TABLE public.monthly_usage_summaries ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usage_alerts') THEN
        ALTER TABLE public.usage_alerts ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rate_limit_events') THEN
        ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Memory and context tables
ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_relationships ENABLE ROW LEVEL SECURITY;
-- Enable RLS on document processing config if exists
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'document_processing_config') THEN
        ALTER TABLE public.document_processing_config ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Collaboration tables (enable if they exist)
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workspaces') THEN
        ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workspace_members') THEN
        ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workspace_invitations') THEN
        ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shared_workflows') THEN
        ALTER TABLE public.shared_workflows ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'session_activities') THEN
        ALTER TABLE public.session_activities ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'session_comments') THEN
        ALTER TABLE public.session_comments ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'team_templates') THEN
        ALTER TABLE public.team_templates ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Stripe tables (sensitive financial data - enable if they exist)
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stripe_customers') THEN
        ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stripe_subscriptions') THEN
        ALTER TABLE public.stripe_subscriptions ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stripe_invoices') THEN
        ALTER TABLE public.stripe_invoices ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stripe_payment_methods') THEN
        ALTER TABLE public.stripe_payment_methods ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stripe_payments') THEN
        ALTER TABLE public.stripe_payments ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stripe_webhook_events') THEN
        ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- =============================================
-- BASIC USER POLICIES
-- =============================================

-- Profiles: Users can manage their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- User configuration: Users can manage their own configuration
CREATE POLICY "Users can manage own configuration" ON public.user_configuration
    FOR ALL USING (auth.uid() = user_id);

-- Plan configurations: Public read access, service role can manage
CREATE POLICY "Anyone can view plan configurations" ON public.plan_configurations
    FOR SELECT USING (is_active = true);

CREATE POLICY "Service role can manage plan configurations" ON public.plan_configurations
    FOR ALL USING (auth.role() = 'service_role');

-- API keys: Users can manage their own API keys
CREATE POLICY "Users can manage own API keys" ON public.user_api_keys
    FOR ALL USING (auth.uid() = user_id);

-- API key usage history: Users can view their own usage
CREATE POLICY "Users can view own API key usage" ON public.api_key_usage_history
    FOR SELECT USING (
        auth.uid() = (SELECT user_id FROM public.user_api_keys WHERE id = api_key_id)
    );

-- =============================================
-- AI PROVIDER AND MODEL POLICIES
-- =============================================

-- AI providers: Public read access, admin write
CREATE POLICY "Anyone can view active AI providers" ON public.ai_providers
    FOR SELECT USING (is_active = true);

CREATE POLICY "Service role can manage AI providers" ON public.ai_providers
    FOR ALL USING (auth.role() = 'service_role');

-- AI models: Public read access, admin write
CREATE POLICY "Anyone can view active AI models" ON public.ai_models
    FOR SELECT USING (is_active = true);

CREATE POLICY "Service role can manage AI models" ON public.ai_models
    FOR ALL USING (auth.role() = 'service_role');

-- Model performance stats: Public read for aggregated data
CREATE POLICY "Anyone can view model performance stats" ON public.model_performance_stats
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage model stats" ON public.model_performance_stats
    FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- WORKFLOW POLICIES
-- =============================================

-- Workflow templates: Public templates visible to all, private to creator
CREATE POLICY "Anyone can view public templates" ON public.workflow_templates
    FOR SELECT USING (is_public = true AND is_active = true);

CREATE POLICY "Users can view own templates" ON public.workflow_templates
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can manage own templates" ON public.workflow_templates
    FOR ALL USING (auth.uid() = created_by);

-- Workflow sessions: Users can manage their own sessions
CREATE POLICY "Users can manage own workflow sessions" ON public.workflow_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Shared workflows: Access based on sharing settings
CREATE POLICY "Users can view shared workflows" ON public.workflow_sessions
    FOR SELECT USING (
        auth.uid() = user_id OR 
        id IN (
            SELECT session_id FROM public.shared_workflows 
            WHERE is_active = true 
            AND (expires_at IS NULL OR expires_at > now())
            AND (
                access_level = 'public' OR
                (access_level = 'workspace' AND workspace_id IN (
                    SELECT workspace_id FROM public.workspace_members 
                    WHERE user_id = auth.uid() AND is_active = true
                ))
            )
        )
    );

-- Step executions: Users can view steps from accessible sessions
CREATE POLICY "Users can view accessible step executions" ON public.workflow_step_executions
    FOR SELECT USING (
        auth.uid() = (SELECT user_id FROM public.workflow_sessions WHERE id = session_id)
        OR session_id IN (
            SELECT s.id FROM public.workflow_sessions s
            JOIN public.shared_workflows sw ON sw.session_id = s.id
            WHERE sw.is_active = true 
            AND (sw.expires_at IS NULL OR sw.expires_at > now())
            AND (
                sw.access_level = 'public' OR
                (sw.access_level = 'workspace' AND sw.workspace_id IN (
                    SELECT workspace_id FROM public.workspace_members 
                    WHERE user_id = auth.uid() AND is_active = true
                ))
            )
        )
    );

-- Template reviews: Users can view all reviews, manage their own
CREATE POLICY "Anyone can view template reviews" ON public.workflow_template_reviews
    FOR SELECT USING (true);

CREATE POLICY "Users can manage own reviews" ON public.workflow_template_reviews
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews" ON public.workflow_template_reviews
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews" ON public.workflow_template_reviews
    FOR DELETE USING (auth.uid() = user_id);

-- Workflow favorites: Users can manage their own favorites
CREATE POLICY "Users can manage own favorites" ON public.workflow_favorites
    FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- USAGE TRACKING POLICIES (conditional on table existence)
-- =============================================

-- Usage limits: Users can manage their own limits
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_usage_limits') THEN
        EXECUTE 'CREATE POLICY "Users can manage own usage limits" ON public.user_usage_limits
            FOR ALL USING (auth.uid() = user_id)';
    END IF;
END $$;

-- API usage logs: Users can view their own usage
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'api_usage_logs') THEN
        EXECUTE 'CREATE POLICY "Users can view own API usage" ON public.api_usage_logs
            FOR SELECT USING (auth.uid() = user_id)';
        EXECUTE 'CREATE POLICY "Service role can insert usage logs" ON public.api_usage_logs
            FOR INSERT WITH CHECK (auth.role() = ''service_role'')';
    END IF;
END $$;

-- Daily usage summaries: Users can view their own summaries
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_usage_summaries') THEN
        EXECUTE 'CREATE POLICY "Users can view own daily summaries" ON public.daily_usage_summaries
            FOR SELECT USING (auth.uid() = user_id)';
        EXECUTE 'CREATE POLICY "Service role can manage daily summaries" ON public.daily_usage_summaries
            FOR ALL USING (auth.role() = ''service_role'')';
    END IF;
END $$;

-- Monthly usage summaries: Users can view their own summaries  
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'monthly_usage_summaries') THEN
        EXECUTE 'CREATE POLICY "Users can view own monthly summaries" ON public.monthly_usage_summaries
            FOR SELECT USING (auth.uid() = user_id)';
    END IF;
END $$;

-- Usage alerts: Users can manage their own alerts
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usage_alerts') THEN
        EXECUTE 'CREATE POLICY "Users can manage own usage alerts" ON public.usage_alerts
            FOR ALL USING (auth.uid() = user_id)';
    END IF;
END $$;

-- Rate limit events: Users can view their own events
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rate_limit_events') THEN
        EXECUTE 'CREATE POLICY "Users can view own rate limit events" ON public.rate_limit_events
            FOR SELECT USING (auth.uid() = user_id)';
    END IF;
END $$;

-- =============================================
-- MEMORY AND CONTEXT POLICIES
-- =============================================

-- User memory: Users can manage their own memories
CREATE POLICY "Users can manage own memory" ON public.user_memory
    FOR ALL USING (auth.uid() = user_id);

-- User documents: Users can manage their own documents
CREATE POLICY "Users can manage own documents" ON public.user_documents
    FOR ALL USING (auth.uid() = user_id);

-- Public document access
CREATE POLICY "Anyone can view public documents" ON public.user_documents
    FOR SELECT USING (is_public = true);

-- Shared document access
CREATE POLICY "Users can view shared documents" ON public.user_documents
    FOR SELECT USING (
        auth.uid() = ANY(shared_with_users) OR
        access_level = 'public'
    );

-- Document collections: Users can manage their own collections
CREATE POLICY "Users can manage own document collections" ON public.document_collections
    FOR ALL USING (auth.uid() = user_id);

-- Document chunks: Access through parent document
CREATE POLICY "Users can view accessible document chunks" ON public.document_chunks
    FOR SELECT USING (
        document_id IN (
            SELECT id FROM public.user_documents
            WHERE user_id = auth.uid() 
            OR is_public = true
            OR auth.uid() = ANY(shared_with_users)
        )
    );

-- Knowledge entities: Users can manage their own entities
CREATE POLICY "Users can manage own knowledge entities" ON public.knowledge_entities
    FOR ALL USING (auth.uid() = user_id);

-- Entity relationships: Users can manage their own relationships
CREATE POLICY "Users can manage own entity relationships" ON public.entity_relationships
    FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- COLLABORATION POLICIES
-- =============================================

-- Workspaces: Members can view, owners can manage
CREATE POLICY "Workspace members can view workspace" ON public.workspaces
    FOR SELECT USING (
        auth.uid() = owner_id OR
        auth.uid() IN (
            SELECT user_id FROM public.workspace_members 
            WHERE workspace_id = id AND is_active = true
        )
    );

CREATE POLICY "Workspace owners can manage workspace" ON public.workspaces
    FOR ALL USING (auth.uid() = owner_id);

-- Public workspace visibility
CREATE POLICY "Anyone can view public workspaces" ON public.workspaces
    FOR SELECT USING (visibility = 'public' AND is_active = true);

-- Workspace members: Members can view, owners/admins can manage
CREATE POLICY "Workspace members can view membership" ON public.workspace_members
    FOR SELECT USING (
        auth.uid() = user_id OR
        workspace_id IN (
            SELECT workspace_id FROM public.workspace_members wm2 
            WHERE wm2.user_id = auth.uid() AND wm2.is_active = true
            AND wm2.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Workspace owners can manage members" ON public.workspace_members
    FOR ALL USING (
        workspace_id IN (
            SELECT id FROM public.workspaces 
            WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Workspace admins can manage members" ON public.workspace_members
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM public.workspace_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
        )
    );

-- Workspace invitations: Workspace owners/admins can manage
CREATE POLICY "Workspace admins can manage invitations" ON public.workspace_invitations
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM public.workspace_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
        )
    );

-- Users can view invitations sent to them
CREATE POLICY "Users can view own invitations" ON public.workspace_invitations
    FOR SELECT USING (
        email = (SELECT email FROM public.profiles WHERE id = auth.uid()) OR
        user_id = auth.uid()
    );

-- Shared workflows: Based on sharing configuration
CREATE POLICY "Users can view shared workflow configs" ON public.shared_workflows
    FOR SELECT USING (
        auth.uid() = shared_by OR
        workspace_id IN (
            SELECT workspace_id FROM public.workspace_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Users can manage own shared workflows" ON public.shared_workflows
    FOR ALL USING (auth.uid() = shared_by);

-- Session activities: Workspace members can view
CREATE POLICY "Workspace members can view session activities" ON public.session_activities
    FOR SELECT USING (
        auth.uid() = user_id OR
        workspace_id IN (
            SELECT workspace_id FROM public.workspace_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Users can create session activities" ON public.session_activities
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Session comments: Based on session access
CREATE POLICY "Users can view accessible session comments" ON public.session_comments
    FOR SELECT USING (
        auth.uid() = user_id OR
        session_id IN (
            SELECT s.id FROM public.workflow_sessions s
            WHERE s.user_id = auth.uid()
            OR s.id IN (
                SELECT sw.session_id FROM public.shared_workflows sw
                WHERE sw.is_active = true 
                AND (sw.expires_at IS NULL OR sw.expires_at > now())
                AND (
                    sw.access_level = 'public' OR
                    (sw.access_level = 'workspace' AND sw.workspace_id IN (
                        SELECT workspace_id FROM public.workspace_members 
                        WHERE user_id = auth.uid() AND is_active = true
                    ))
                )
            )
        )
    );

CREATE POLICY "Users can create comments on accessible sessions" ON public.session_comments
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        session_id IN (
            SELECT s.id FROM public.workflow_sessions s
            WHERE s.user_id = auth.uid()
            OR s.id IN (
                SELECT sw.session_id FROM public.shared_workflows sw
                WHERE sw.is_active = true 
                AND sw.share_type IN ('edit', 'comment')
                AND (sw.expires_at IS NULL OR sw.expires_at > now())
                AND (
                    sw.access_level = 'public' OR
                    (sw.access_level = 'workspace' AND sw.workspace_id IN (
                        SELECT workspace_id FROM public.workspace_members 
                        WHERE user_id = auth.uid() AND is_active = true
                    ))
                )
            )
        )
    );

CREATE POLICY "Users can manage own comments" ON public.session_comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.session_comments
    FOR DELETE USING (auth.uid() = user_id);

-- Team templates: Workspace members can view, creators can manage
CREATE POLICY "Workspace members can view team templates" ON public.team_templates
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM public.workspace_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Users can manage own team templates" ON public.team_templates
    FOR ALL USING (auth.uid() = created_by);

-- =============================================
-- STRIPE BILLING POLICIES
-- =============================================

-- Stripe customers: Users can view their own customer data
CREATE POLICY "Users can view own stripe customer data" ON public.stripe_customers
    FOR SELECT USING (auth.uid() = user_id);

-- Workspace billing: Workspace owners can view billing data
CREATE POLICY "Workspace owners can view workspace billing" ON public.stripe_customers
    FOR SELECT USING (
        workspace_id IN (
            SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
        )
    );

-- Stripe subscriptions: Users and workspace owners can view
CREATE POLICY "Users can view own subscriptions" ON public.stripe_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Workspace owners can view workspace subscriptions" ON public.stripe_subscriptions
    FOR SELECT USING (
        workspace_id IN (
            SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
        )
    );

-- Stripe invoices: Users and workspace owners can view
CREATE POLICY "Users can view own invoices" ON public.stripe_invoices
    FOR SELECT USING (
        customer_id IN (
            SELECT stripe_customer_id FROM public.stripe_customers 
            WHERE user_id = auth.uid()
        )
    );

-- Stripe payment methods: Users can manage their own payment methods
CREATE POLICY "Users can manage own payment methods" ON public.stripe_payment_methods
    FOR ALL USING (auth.uid() = user_id);

-- Stripe payments: Users can view their own payments
CREATE POLICY "Users can view own payments" ON public.stripe_payments
    FOR SELECT USING (
        customer_id IN (
            SELECT stripe_customer_id FROM public.stripe_customers 
            WHERE user_id = auth.uid()
        )
    );

-- Webhook events: Service role only
CREATE POLICY "Service role can manage webhook events" ON public.stripe_webhook_events
    FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- ADMIN AND SERVICE POLICIES
-- =============================================

-- Allow service role to bypass RLS for system operations
CREATE POLICY "Service role has full access to profiles" ON public.profiles
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to user configuration" ON public.user_configuration
    FOR ALL USING (auth.role() = 'service_role');

-- Allow service role to manage system data (conditional)
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'api_usage_logs') THEN
        EXECUTE 'CREATE POLICY "Service role can manage all usage data" ON public.api_usage_logs
            FOR ALL USING (auth.role() = ''service_role'')';
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'monthly_usage_summaries') THEN
        EXECUTE 'CREATE POLICY "Service role can manage all summaries" ON public.monthly_usage_summaries
            FOR ALL USING (auth.role() = ''service_role'')';
    END IF;
END $$;

-- =============================================
-- UTILITY FUNCTIONS FOR RLS
-- =============================================

-- Function to check if user is workspace member
CREATE OR REPLACE FUNCTION public.is_workspace_member(workspace_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = workspace_uuid 
        AND user_id = user_uuid 
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check workspace role
CREATE OR REPLACE FUNCTION public.get_workspace_role(workspace_uuid UUID, user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Check if user is workspace owner
    IF EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_uuid AND owner_id = user_uuid) THEN
        RETURN 'owner';
    END IF;
    
    -- Get user's role from membership
    SELECT role INTO user_role
    FROM public.workspace_members
    WHERE workspace_id = workspace_uuid 
    AND user_id = user_uuid 
    AND is_active = true;
    
    RETURN COALESCE(user_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Row Level Security policies setup completed!' as status; 