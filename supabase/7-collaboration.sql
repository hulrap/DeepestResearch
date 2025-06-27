-- =============================================
-- COLLABORATION & SHARING
-- Team workspaces, sharing, and collaboration features
-- =============================================

-- Team workspaces
CREATE TABLE public.workspaces (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT UNIQUE, -- URL-friendly identifier
    
    -- Ownership and management
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.profiles(id),
    
    -- Workspace settings
    settings JSONB DEFAULT '{}', -- Workspace preferences and configurations
    billing_settings JSONB DEFAULT '{}', -- Billing and subscription info
    
    -- Appearance and branding
    avatar_url TEXT,
    cover_image_url TEXT,
    color_scheme TEXT DEFAULT 'default',
    
    -- Access control
    visibility TEXT DEFAULT 'private', -- private, public, invite_only
    invite_code TEXT, -- Optional invite code for easy joining
    invite_code_expires_at TIMESTAMP WITH TIME ZONE,
    max_members INTEGER, -- Set based on subscription plan
    
    -- Subscription and limits (now configurable)
    plan_type TEXT DEFAULT 'free', -- free, pro, enterprise
    subscription_id TEXT, -- Stripe subscription ID
    monthly_usage_limit DECIMAL(10,6), -- Set based on plan
    storage_limit_gb INTEGER, -- Set based on plan
    
    -- Status and lifecycle
    is_active BOOLEAN DEFAULT true,
    is_suspended BOOLEAN DEFAULT false,
    suspension_reason TEXT,
    suspended_at TIMESTAMP WITH TIME ZONE,
    
    -- Statistics
    member_count INTEGER DEFAULT 1,
    workflow_count INTEGER DEFAULT 0,
    document_count INTEGER DEFAULT 0,
    total_usage_cost DECIMAL(10,8) DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_workspace_name CHECK (length(trim(name)) >= 1 AND length(trim(name)) <= 100),
    CONSTRAINT valid_slug CHECK (slug IS NULL OR (length(slug) >= 3 AND length(slug) <= 50 AND slug ~ '^[a-z0-9-]+$')),
    CONSTRAINT valid_visibility CHECK (visibility IN ('private', 'public', 'invite_only')),
    CONSTRAINT valid_plan_type CHECK (plan_type IN ('free', 'pro', 'enterprise', 'custom')),
    CONSTRAINT valid_max_members CHECK (max_members IS NULL OR (max_members > 0 AND max_members <= 1000)),
    CONSTRAINT valid_storage_limit CHECK (storage_limit_gb IS NULL OR storage_limit_gb > 0),
    CONSTRAINT valid_member_count CHECK (member_count >= 0),
    CONSTRAINT valid_counts CHECK (workflow_count >= 0 AND document_count >= 0),
    CONSTRAINT valid_usage_cost CHECK (total_usage_cost >= 0)
);

-- Workspace members with enhanced role management
CREATE TABLE public.workspace_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Role and permissions
    role TEXT DEFAULT 'member', -- owner, admin, member, viewer, guest
    custom_permissions JSONB DEFAULT '{}', -- Granular permissions override
    
    -- Invitation and joining
    invited_by UUID REFERENCES public.profiles(id),
    invitation_token TEXT, -- For pending invitations
    invitation_sent_at TIMESTAMP WITH TIME ZONE,
    invitation_expires_at TIMESTAMP WITH TIME ZONE,
    invitation_accepted_at TIMESTAMP WITH TIME ZONE,
    
    -- Member status
    is_active BOOLEAN DEFAULT true,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now(),
    total_activity_time_minutes INTEGER DEFAULT 0,
    
    -- Member preferences
    notification_settings JSONB DEFAULT '{}',
    workspace_preferences JSONB DEFAULT '{}',
    
    -- Billing (for per-seat billing)
    is_billable BOOLEAN DEFAULT true,
    billing_tier TEXT DEFAULT 'standard',
    
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    UNIQUE(workspace_id, user_id),
    
    -- Constraints
    CONSTRAINT valid_role CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'guest')),
    CONSTRAINT valid_billing_tier CHECK (billing_tier IN ('standard', 'premium', 'enterprise')),
    CONSTRAINT valid_activity_time CHECK (total_activity_time_minutes >= 0)
);

-- Shared workflows and resources
CREATE TABLE public.shared_workflows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.workflow_sessions(id) ON DELETE CASCADE,
    shared_by UUID REFERENCES public.profiles(id),
    workspace_id UUID REFERENCES public.workspaces(id),
    
    -- Sharing configuration
    share_type TEXT DEFAULT 'view', -- view, edit, comment, execute
    access_level TEXT DEFAULT 'workspace', -- public, workspace, specific_users, link_access
    
    -- Link sharing
    public_link TEXT, -- Unique public link
    public_link_password TEXT, -- Optional password protection
    requires_signin BOOLEAN DEFAULT true,
    
    -- Permissions and restrictions
    allowed_actions TEXT[] DEFAULT '{}', -- clone, download, print, share
    usage_restrictions JSONB DEFAULT '{}', -- Rate limits, time restrictions, etc.
    
    -- Lifecycle
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_share_type CHECK (share_type IN ('view', 'edit', 'comment', 'execute', 'admin')),
    CONSTRAINT valid_access_level CHECK (access_level IN ('public', 'workspace', 'specific_users', 'link_access')),
    CONSTRAINT valid_access_count CHECK (access_count >= 0)
);

-- Workspace invitations (separate from members for pending invites)
CREATE TABLE public.workspace_invitations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    invited_by UUID REFERENCES public.profiles(id),
    
    -- Invitee information
    email TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id), -- Set if user already exists
    
    -- Invitation details
    role TEXT DEFAULT 'member',
    personal_message TEXT,
    invitation_token TEXT UNIQUE NOT NULL DEFAULT public.generate_secure_token(),
    
    -- Status and lifecycle
    status TEXT DEFAULT 'pending', -- pending, accepted, rejected, expired, cancelled
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (public.utc_now() + INTERVAL '7 days'),
    accepted_at TIMESTAMP WITH TIME ZONE,
    
    -- Tracking
    email_sent BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMP WITH TIME ZONE,
    reminder_count INTEGER DEFAULT 0,
    last_reminder_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_invitation_role CHECK (role IN ('admin', 'member', 'viewer', 'guest')),
    CONSTRAINT valid_invitation_status CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
    CONSTRAINT valid_email CHECK (public.is_valid_email(email)),
    CONSTRAINT valid_reminder_count CHECK (reminder_count >= 0)
);

-- Real-time session activities for collaboration
CREATE TABLE public.session_activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.workflow_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id),
    workspace_id UUID REFERENCES public.workspaces(id),
    
    -- Activity details
    activity_type TEXT NOT NULL, -- join, leave, edit, comment, step_complete, share, clone
    activity_description TEXT,
    activity_data JSONB DEFAULT '{}', -- Activity-specific data
    
    -- Context
    step_number INTEGER, -- If related to a specific step
    previous_value JSONB, -- For edit activities
    new_value JSONB, -- For edit activities
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_activity_type CHECK (activity_type IN (
        'join', 'leave', 'edit', 'comment', 'step_complete', 'share', 'clone',
        'upload', 'download', 'invite', 'remove_member', 'change_permissions'
    )),
    CONSTRAINT valid_step_number CHECK (step_number IS NULL OR step_number >= 0)
);

-- Comments and annotations on workflows
CREATE TABLE public.session_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.workflow_sessions(id) ON DELETE CASCADE,
    step_execution_id UUID REFERENCES public.workflow_step_executions(id),
    user_id UUID REFERENCES public.profiles(id),
    
    -- Comment content
    content TEXT NOT NULL,
    comment_type TEXT DEFAULT 'general', -- general, feedback, suggestion, issue, approval, question
    
    -- Threading and replies
    parent_comment_id UUID REFERENCES public.session_comments(id),
    thread_depth INTEGER DEFAULT 0,
    
    -- Reactions and interactions
    reactions JSONB DEFAULT '{}', -- {emoji: count} format
    is_resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES public.profiles(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Visibility and permissions
    is_private BOOLEAN DEFAULT false, -- Private comments only visible to workspace admins
    mentioned_users UUID[], -- @mentioned users
    
    -- Content metadata
    attachments JSONB DEFAULT '[]', -- File attachments
    formatting JSONB DEFAULT '{}', -- Rich text formatting
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_comment_type CHECK (comment_type IN ('general', 'feedback', 'suggestion', 'issue', 'approval', 'question', 'announcement')),
    CONSTRAINT valid_thread_depth CHECK (thread_depth >= 0 AND thread_depth <= 10),
    CONSTRAINT non_empty_content CHECK (length(trim(content)) > 0)
);

-- Team templates and shared resources
CREATE TABLE public.team_templates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.profiles(id),
    
    -- Template information (inherits from workflow_templates)
    base_template_id UUID REFERENCES public.workflow_templates(id),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    
    -- Team-specific customizations
    team_customizations JSONB DEFAULT '{}',
    access_permissions JSONB DEFAULT '{}',
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    CONSTRAINT valid_team_template_name CHECK (length(trim(name)) > 0),
    CONSTRAINT valid_usage_count CHECK (usage_count >= 0)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Workspace indexes
CREATE INDEX idx_workspaces_owner ON public.workspaces(owner_id, created_at DESC);
CREATE INDEX idx_workspaces_slug ON public.workspaces(slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_workspaces_visibility ON public.workspaces(visibility, is_active);
CREATE INDEX idx_workspaces_plan ON public.workspaces(plan_type, is_active);
CREATE INDEX idx_workspaces_active ON public.workspaces(is_active, member_count DESC);

-- Workspace member indexes
CREATE INDEX idx_workspace_members_user ON public.workspace_members(user_id, is_active);
CREATE INDEX idx_workspace_members_workspace ON public.workspace_members(workspace_id, role, is_active);
CREATE INDEX idx_workspace_members_invitation_token ON public.workspace_members(invitation_token) WHERE invitation_token IS NOT NULL;
CREATE INDEX idx_workspace_members_activity ON public.workspace_members(last_activity_at DESC) WHERE is_active = true;

-- Shared workflow indexes
CREATE INDEX idx_shared_workflows_session ON public.shared_workflows(session_id, is_active);
CREATE INDEX idx_shared_workflows_workspace ON public.shared_workflows(workspace_id, created_at DESC);
CREATE INDEX idx_shared_workflows_public_link ON public.shared_workflows(public_link) WHERE public_link IS NOT NULL;
CREATE INDEX idx_shared_workflows_shared_by ON public.shared_workflows(shared_by, created_at DESC);

-- Invitation indexes
CREATE INDEX idx_workspace_invitations_workspace ON public.workspace_invitations(workspace_id, status);
CREATE INDEX idx_workspace_invitations_email ON public.workspace_invitations(email, status);
CREATE INDEX idx_workspace_invitations_token ON public.workspace_invitations(invitation_token);
CREATE INDEX idx_workspace_invitations_expires ON public.workspace_invitations(expires_at) WHERE status = 'pending';

-- Activity indexes
CREATE INDEX idx_session_activities_session ON public.session_activities(session_id, created_at DESC);
CREATE INDEX idx_session_activities_user ON public.session_activities(user_id, created_at DESC);
CREATE INDEX idx_session_activities_workspace ON public.session_activities(workspace_id, created_at DESC);
CREATE INDEX idx_session_activities_type ON public.session_activities(activity_type, created_at DESC);

-- Comment indexes
CREATE INDEX idx_session_comments_session ON public.session_comments(session_id, created_at DESC);
CREATE INDEX idx_session_comments_user ON public.session_comments(user_id, created_at DESC);
CREATE INDEX idx_session_comments_parent ON public.session_comments(parent_comment_id, created_at) WHERE parent_comment_id IS NOT NULL;
CREATE INDEX idx_session_comments_resolved ON public.session_comments(is_resolved, created_at DESC);

-- Team template indexes
CREATE INDEX idx_team_templates_workspace ON public.team_templates(workspace_id, is_active);
CREATE INDEX idx_team_templates_base ON public.team_templates(base_template_id);
CREATE INDEX idx_team_templates_usage ON public.team_templates(usage_count DESC, last_used_at DESC);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE TRIGGER update_workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workspace_members_updated_at
    BEFORE UPDATE ON public.workspace_members
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shared_workflows_updated_at
    BEFORE UPDATE ON public.shared_workflows
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workspace_invitations_updated_at
    BEFORE UPDATE ON public.workspace_invitations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_session_comments_updated_at
    BEFORE UPDATE ON public.session_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_templates_updated_at
    BEFORE UPDATE ON public.team_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FUNCTIONS FOR COLLABORATION
-- =============================================

-- Function to update workspace member count
CREATE OR REPLACE FUNCTION public.update_workspace_member_count()
RETURNS TRIGGER AS $$
DECLARE
    workspace_uuid UUID;
BEGIN
    workspace_uuid := COALESCE(NEW.workspace_id, OLD.workspace_id);
    
    UPDATE public.workspaces
    SET 
        member_count = (
            SELECT COUNT(*) 
            FROM public.workspace_members 
            WHERE workspace_id = workspace_uuid AND is_active = true
        ),
        updated_at = public.utc_now()
    WHERE id = workspace_uuid;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for workspace member count
CREATE TRIGGER update_workspace_member_count_on_insert
    AFTER INSERT ON public.workspace_members
    FOR EACH ROW
    EXECUTE FUNCTION public.update_workspace_member_count();

CREATE TRIGGER update_workspace_member_count_on_update
    AFTER UPDATE ON public.workspace_members
    FOR EACH ROW
    WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
    EXECUTE FUNCTION public.update_workspace_member_count();

CREATE TRIGGER update_workspace_member_count_on_delete
    AFTER DELETE ON public.workspace_members
    FOR EACH ROW
    EXECUTE FUNCTION public.update_workspace_member_count();

-- Function to create workspace slug
CREATE OR REPLACE FUNCTION public.generate_workspace_slug(workspace_name TEXT)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Convert name to URL-friendly slug
    base_slug := lower(trim(workspace_name));
    base_slug := regexp_replace(base_slug, '[^a-z0-9\s-]', '', 'g');
    base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
    base_slug := regexp_replace(base_slug, '-+', '-', 'g');
    base_slug := trim(base_slug, '-');
    
    -- Ensure minimum length
    IF length(base_slug) < 3 THEN
        base_slug := base_slug || '-workspace';
    END IF;
    
    -- Ensure maximum length
    IF length(base_slug) > 50 THEN
        base_slug := left(base_slug, 50);
    END IF;
    
    final_slug := base_slug;
    
    -- Check for uniqueness and append counter if needed
    WHILE EXISTS (SELECT 1 FROM public.workspaces WHERE slug = final_slug) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-generate slug on workspace creation
CREATE OR REPLACE FUNCTION public.auto_generate_workspace_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := public.generate_workspace_slug(NEW.name);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_generate_workspace_slug_trigger
    BEFORE INSERT ON public.workspaces
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_generate_workspace_slug();

-- Function to set workspace limits based on plan
CREATE OR REPLACE FUNCTION public.set_workspace_limits_by_plan(workspace_uuid UUID)
RETURNS VOID AS $$
DECLARE
    workspace_plan TEXT;
    new_max_members INTEGER;
    new_storage_limit INTEGER;
    new_monthly_limit DECIMAL(10,6);
BEGIN
    -- Get the workspace plan
    SELECT plan_type INTO workspace_plan
    FROM public.workspaces
    WHERE id = workspace_uuid;
    
    -- Set limits based on plan type
    CASE workspace_plan
        WHEN 'free' THEN
            new_max_members := 5;
            new_storage_limit := 1;
            new_monthly_limit := 10.00;
        WHEN 'pro' THEN  
            new_max_members := 25;
            new_storage_limit := 10;
            new_monthly_limit := 100.00;
        WHEN 'enterprise' THEN
            new_max_members := 100;
            new_storage_limit := 100;
            new_monthly_limit := 1000.00;
        WHEN 'custom' THEN
            -- For custom plans, don't override - let admin set manually
            RETURN;
        ELSE
            -- Default to free plan limits
            new_max_members := 5;
            new_storage_limit := 1;
            new_monthly_limit := 10.00;
    END CASE;
    
    -- Update the workspace with new limits
    UPDATE public.workspaces
    SET 
        max_members = COALESCE(max_members, new_max_members),
        storage_limit_gb = COALESCE(storage_limit_gb, new_storage_limit),
        monthly_usage_limit = COALESCE(monthly_usage_limit, new_monthly_limit),
        updated_at = public.utc_now()
    WHERE id = workspace_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to set limits when plan changes
CREATE OR REPLACE FUNCTION public.update_workspace_limits_on_plan_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.plan_type IS DISTINCT FROM NEW.plan_type THEN
        PERFORM public.set_workspace_limits_by_plan(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workspace_limits_on_plan_change_trigger
    AFTER UPDATE OF plan_type ON public.workspaces
    FOR EACH ROW
    EXECUTE FUNCTION public.update_workspace_limits_on_plan_change();

-- Function to validate workspace permissions
CREATE OR REPLACE FUNCTION public.check_workspace_permission(
    workspace_uuid UUID,
    user_uuid UUID,
    required_permission TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    workspace_owner UUID;
BEGIN
    -- Get workspace owner
    SELECT owner_id INTO workspace_owner 
    FROM public.workspaces 
    WHERE id = workspace_uuid;
    
    -- Owner has all permissions
    IF workspace_owner = user_uuid THEN
        RETURN true;
    END IF;
    
    -- Get user's role in workspace
    SELECT role INTO user_role
    FROM public.workspace_members
    WHERE workspace_id = workspace_uuid 
    AND user_id = user_uuid 
    AND is_active = true;
    
    -- Check permission based on role
    CASE required_permission
        WHEN 'view' THEN
            RETURN user_role IN ('owner', 'admin', 'member', 'viewer', 'guest');
        WHEN 'edit' THEN
            RETURN user_role IN ('owner', 'admin', 'member');
        WHEN 'admin' THEN
            RETURN user_role IN ('owner', 'admin');
        WHEN 'owner' THEN
            RETURN user_role = 'owner';
        ELSE
            RETURN false;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record activity
CREATE OR REPLACE FUNCTION public.record_workspace_activity(
    session_uuid UUID,
    user_uuid UUID,
    activity_type_param TEXT,
    activity_data_param JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
DECLARE
    workspace_uuid UUID;
BEGIN
    -- Get workspace from session
    SELECT w.id INTO workspace_uuid
    FROM public.workflow_sessions s
    JOIN public.workspaces w ON w.id = s.workspace_id
    WHERE s.id = session_uuid;
    
    -- Record activity
    INSERT INTO public.session_activities (
        session_id, user_id, workspace_id, activity_type, activity_data
    ) VALUES (
        session_uuid, user_uuid, workspace_uuid, activity_type_param, activity_data_param
    );
    
    -- Update member's last activity
    UPDATE public.workspace_members
    SET 
        last_activity_at = public.utc_now(),
        updated_at = public.utc_now()
    WHERE workspace_id = workspace_uuid AND user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Collaboration and sharing system setup completed!' as status; 