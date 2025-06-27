-- =============================================
-- AUDIT LOGGING & SYSTEM MONITORING
-- Comprehensive audit trails and system health monitoring
-- =============================================

-- System monitoring configuration
CREATE TABLE public.monitoring_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    config_name TEXT NOT NULL UNIQUE,
    config_type TEXT NOT NULL, -- alert_thresholds, retention_settings, health_checks, audit_settings
    
    -- Configuration values
    settings JSONB NOT NULL DEFAULT '{}',
    
    -- Metadata
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    environment TEXT DEFAULT 'production',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    CONSTRAINT valid_config_type CHECK (config_type IN ('alert_thresholds', 'retention_settings', 'health_checks', 'audit_settings', 'performance_limits'))
);

-- Audit logs for tracking all changes to sensitive data
CREATE TABLE public.audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- What was changed
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL, -- Can be UUID or other ID types
    operation public.audit_operation NOT NULL,
    
    -- Who made the change
    user_id UUID REFERENCES public.profiles(id),
    session_id TEXT, -- Session identifier for API calls
    ip_address INET,
    user_agent TEXT,
    
    -- When the change happened
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    -- What changed
    old_values JSONB, -- Previous values (for UPDATE/DELETE)
    new_values JSONB, -- New values (for INSERT/UPDATE)
    changed_fields TEXT[], -- List of fields that changed
    
    -- Context and metadata
    context JSONB DEFAULT '{}', -- Additional context (API endpoint, workflow, etc.)
    reason TEXT, -- Reason for the change if provided
    correlation_id UUID, -- To group related changes
    
    -- Risk and compliance
    risk_level TEXT DEFAULT 'low', -- low, medium, high, critical
    compliance_notes TEXT, -- Notes for compliance auditing
    
    -- System information
    application_version TEXT,
    database_version TEXT,
    
    CONSTRAINT valid_operation CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    CONSTRAINT valid_risk_level CHECK (risk_level IN ('low', 'medium', 'high', 'critical'))
);

-- System health checks and monitoring
CREATE TABLE public.system_health_checks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Check identification
    check_name TEXT NOT NULL,
    check_type TEXT NOT NULL, -- database, api, storage, external_service, performance
    component TEXT NOT NULL, -- Specific component being checked
    
    -- Check results
    status TEXT NOT NULL, -- healthy, degraded, unhealthy, unknown
    response_time_ms INTEGER,
    success_rate DECIMAL(5,2), -- Success rate percentage
    
    -- Metrics and details
    metrics JSONB DEFAULT '{}', -- Detailed metrics from the check
    error_message TEXT,
    error_details JSONB,
    
    -- Thresholds and alerting (configurable via monitoring_config)
    warning_threshold DECIMAL(10,4), -- From config or component defaults
    critical_threshold DECIMAL(10,4), -- From config or component defaults
    alert_sent BOOLEAN DEFAULT false,
    alert_sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    check_duration_ms INTEGER,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    CONSTRAINT valid_check_type CHECK (check_type IN ('database', 'api', 'storage', 'external_service', 'performance')),
    CONSTRAINT valid_status CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
    CONSTRAINT valid_success_rate CHECK (success_rate IS NULL OR (success_rate >= 0 AND success_rate <= 100)),
    CONSTRAINT valid_response_time CHECK (response_time_ms IS NULL OR response_time_ms >= 0),
    CONSTRAINT valid_duration CHECK (check_duration_ms IS NULL OR check_duration_ms >= 0)
);

-- Error tracking and monitoring
CREATE TABLE public.error_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Error identification
    error_code TEXT,
    error_type TEXT NOT NULL, -- application, database, api, validation, security
    severity TEXT DEFAULT 'error', -- info, warning, error, critical
    
    -- Error details
    message TEXT NOT NULL,
    stack_trace TEXT,
    context JSONB DEFAULT '{}',
    
    -- User and session information
    user_id UUID REFERENCES public.profiles(id),
    session_id TEXT,
    request_id TEXT,
    correlation_id UUID,
    
    -- Request information
    http_method TEXT,
    endpoint TEXT,
    request_data JSONB,
    response_status INTEGER,
    
    -- Environment and system
    environment TEXT DEFAULT 'production', -- development, staging, production
    application_version TEXT,
    ip_address INET,
    user_agent TEXT,
    
    -- Resolution tracking
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES public.profiles(id),
    resolution_notes TEXT,
    
    -- Occurrence tracking
    occurrence_count INTEGER DEFAULT 1,
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now(),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    CONSTRAINT valid_error_type CHECK (error_type IN ('application', 'database', 'api', 'validation', 'security', 'billing')),
    CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    CONSTRAINT valid_occurrence_count CHECK (occurrence_count > 0)
);

-- Performance monitoring and metrics
CREATE TABLE public.performance_metrics (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Metric identification
    metric_name TEXT NOT NULL,
    metric_type TEXT NOT NULL, -- counter, gauge, histogram, summary
    category TEXT NOT NULL, -- api, database, workflow, ai_usage, user_activity
    
    -- Metric values
    value DECIMAL(15,6) NOT NULL,
    unit TEXT, -- seconds, milliseconds, bytes, requests, percentage
    
    -- Dimensions and labels
    dimensions JSONB DEFAULT '{}', -- Key-value pairs for filtering/grouping
    tags TEXT[] DEFAULT '{}',
    
    -- Aggregation period
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    aggregation_type TEXT DEFAULT 'instant', -- instant, sum, avg, min, max, count
    
    -- Context
    environment TEXT DEFAULT 'production',
    region TEXT,
    
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    CONSTRAINT valid_metric_type CHECK (metric_type IN ('counter', 'gauge', 'histogram', 'summary')),
    CONSTRAINT valid_category CHECK (category IN ('api', 'database', 'workflow', 'ai_usage', 'user_activity', 'billing', 'system')),
    CONSTRAINT valid_aggregation_type CHECK (aggregation_type IN ('instant', 'sum', 'avg', 'min', 'max', 'count')),
    CONSTRAINT valid_period CHECK (period_end >= period_start)
);

-- Security events and incidents
CREATE TABLE public.security_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Event identification
    event_type TEXT NOT NULL, -- login_failure, suspicious_activity, data_breach, unauthorized_access
    severity TEXT DEFAULT 'medium', -- low, medium, high, critical
    category TEXT NOT NULL, -- authentication, authorization, data_access, api_abuse
    
    -- Event details
    description TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    affected_resources TEXT[],
    
    -- User and session information
    user_id UUID REFERENCES public.profiles(id),
    target_user_id UUID REFERENCES public.profiles(id), -- If event affects another user
    session_id TEXT,
    ip_address INET,
    user_agent TEXT,
    location JSONB, -- Geolocation data
    
    -- Risk assessment
    risk_score INTEGER, -- 1-100 risk score
    automated_response TEXT, -- Actions taken automatically
    requires_manual_review BOOLEAN DEFAULT false,
    
    -- Incident tracking
    incident_id UUID, -- Groups related security events
    is_false_positive BOOLEAN DEFAULT false,
    investigation_status TEXT DEFAULT 'open', -- open, investigating, resolved, closed
    
    -- Response and resolution
    response_actions TEXT[],
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    CONSTRAINT valid_event_type CHECK (event_type IN ('login_failure', 'suspicious_activity', 'data_breach', 'unauthorized_access', 'rate_limit_exceeded', 'api_abuse')),
    CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT valid_category CHECK (category IN ('authentication', 'authorization', 'data_access', 'api_abuse', 'system_integrity')),
    CONSTRAINT valid_risk_score CHECK (risk_score IS NULL OR (risk_score >= 1 AND risk_score <= 100)),
    CONSTRAINT valid_investigation_status CHECK (investigation_status IN ('open', 'investigating', 'resolved', 'closed'))
);

-- Data retention and cleanup policies
CREATE TABLE public.data_retention_policies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Policy identification
    policy_name TEXT NOT NULL UNIQUE,
    table_name TEXT NOT NULL,
    description TEXT,
    
    -- Retention rules
    retention_period_days INTEGER NOT NULL,
    archive_before_delete BOOLEAN DEFAULT true,
    archive_location TEXT, -- S3 bucket, external storage location
    
    -- Execution settings (configurable via monitoring_config)
    is_active BOOLEAN DEFAULT true,
    batch_size INTEGER, -- Set from monitoring config or default 1000
    max_execution_time_minutes INTEGER, -- Set from monitoring config or default 60
    
    -- Scheduling
    schedule_expression TEXT, -- Cron expression
    last_executed_at TIMESTAMP WITH TIME ZONE,
    next_execution_at TIMESTAMP WITH TIME ZONE,
    
    -- Monitoring
    records_processed INTEGER DEFAULT 0,
    records_deleted INTEGER DEFAULT 0,
    records_archived INTEGER DEFAULT 0,
    last_error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    CONSTRAINT valid_retention_period CHECK (retention_period_days > 0),
    CONSTRAINT valid_batch_size CHECK (batch_size > 0),
    CONSTRAINT valid_execution_time CHECK (max_execution_time_minutes > 0)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Audit log indexes
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_user_timestamp ON public.audit_logs(user_id, timestamp DESC);
CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_operation ON public.audit_logs(operation, timestamp DESC);
CREATE INDEX idx_audit_logs_risk_level ON public.audit_logs(risk_level, timestamp DESC) WHERE risk_level IN ('high', 'critical');
CREATE INDEX idx_audit_logs_correlation ON public.audit_logs(correlation_id) WHERE correlation_id IS NOT NULL;

-- Health check indexes
CREATE INDEX idx_system_health_checks_component ON public.system_health_checks(component, checked_at DESC);
CREATE INDEX idx_system_health_checks_status ON public.system_health_checks(status, checked_at DESC);
CREATE INDEX idx_system_health_checks_type ON public.system_health_checks(check_type, status);
CREATE INDEX idx_system_health_checks_alerts ON public.system_health_checks(alert_sent, checked_at) WHERE status IN ('degraded', 'unhealthy');

-- Error log indexes
CREATE INDEX idx_error_logs_type_severity ON public.error_logs(error_type, severity, created_at DESC);
CREATE INDEX idx_error_logs_user ON public.error_logs(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_error_logs_unresolved ON public.error_logs(created_at DESC) WHERE is_resolved = false;
CREATE INDEX idx_error_logs_correlation ON public.error_logs(correlation_id) WHERE correlation_id IS NOT NULL;

-- Performance metrics indexes
CREATE INDEX idx_performance_metrics_name_time ON public.performance_metrics(metric_name, recorded_at DESC);
CREATE INDEX idx_performance_metrics_category ON public.performance_metrics(category, recorded_at DESC);
CREATE INDEX idx_performance_metrics_period ON public.performance_metrics(period_start, period_end);

-- Security event indexes
CREATE INDEX idx_security_events_type_severity ON public.security_events(event_type, severity, created_at DESC);
CREATE INDEX idx_security_events_user ON public.security_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_security_events_ip ON public.security_events(ip_address, created_at DESC) WHERE ip_address IS NOT NULL;
CREATE INDEX idx_security_events_unresolved ON public.security_events(created_at DESC) WHERE investigation_status IN ('open', 'investigating');
CREATE INDEX idx_security_events_incident ON public.security_events(incident_id) WHERE incident_id IS NOT NULL;

-- Data retention policy indexes
CREATE INDEX idx_data_retention_policies_active ON public.data_retention_policies(is_active, next_execution_at);
CREATE INDEX idx_data_retention_policies_table ON public.data_retention_policies(table_name, is_active);

-- Monitoring config indexes
CREATE INDEX idx_monitoring_config_type ON public.monitoring_config(config_type, is_active);
CREATE INDEX idx_monitoring_config_name ON public.monitoring_config(config_name) WHERE is_active = true;

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE TRIGGER update_error_logs_updated_at
    BEFORE UPDATE ON public.error_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_security_events_updated_at
    BEFORE UPDATE ON public.security_events
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_data_retention_policies_updated_at
    BEFORE UPDATE ON public.data_retention_policies
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monitoring_config_updated_at
    BEFORE UPDATE ON public.monitoring_config
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- AUDIT TRIGGER FUNCTIONS
-- =============================================

-- Function to create audit logs for sensitive table changes
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    audit_operation public.audit_operation;
    old_vals JSONB;
    new_vals JSONB;
    changed_fields TEXT[] := '{}';
    field_name TEXT;
    risk_level TEXT := 'low';
BEGIN
    -- Determine operation type
    IF TG_OP = 'DELETE' THEN
        audit_operation := 'DELETE';
        old_vals := to_jsonb(OLD);
        new_vals := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
        audit_operation := 'UPDATE';
        old_vals := to_jsonb(OLD);
        new_vals := to_jsonb(NEW);
        
        -- Find changed fields
        FOR field_name IN SELECT jsonb_object_keys(new_vals) LOOP
            IF old_vals->>field_name IS DISTINCT FROM new_vals->>field_name THEN
                changed_fields := array_append(changed_fields, field_name);
            END IF;
        END LOOP;
    ELSIF TG_OP = 'INSERT' THEN
        audit_operation := 'INSERT';
        old_vals := NULL;
        new_vals := to_jsonb(NEW);
    END IF;
    
    -- Determine risk level from configuration or defaults
    SELECT COALESCE(
        (settings->'risk_levels'->TG_TABLE_NAME)::TEXT,
        'low'
    ) INTO risk_level
    FROM public.monitoring_config 
    WHERE config_name = 'default_audit_settings' 
    AND is_active = true
    LIMIT 1;
    
    -- Remove quotes from JSON string
    risk_level := trim(risk_level, '"');
    
    -- Insert audit record
    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        operation,
        user_id,
        timestamp,
        old_values,
        new_values,
        changed_fields,
        risk_level
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id::TEXT, OLD.id::TEXT),
        audit_operation,
        auth.uid(),
        public.utc_now(),
        old_vals,
        new_vals,
        changed_fields,
        risk_level
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_user_api_keys_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.user_api_keys
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_user_usage_limits_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.user_usage_limits
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_workspace_members_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.workspace_members
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_stripe_customers_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.stripe_customers
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_stripe_payment_methods_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.stripe_payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_trigger_function();

-- =============================================
-- MONITORING FUNCTIONS
-- =============================================

-- Function to record system health check
CREATE OR REPLACE FUNCTION public.record_health_check(
    check_name_param TEXT,
    check_type_param TEXT,
    component_param TEXT,
    status_param TEXT,
    response_time_param INTEGER DEFAULT NULL,
    metrics_param JSONB DEFAULT '{}',
    error_message_param TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    check_id UUID;
BEGIN
    INSERT INTO public.system_health_checks (
        check_name,
        check_type,
        component,
        status,
        response_time_ms,
        metrics,
        error_message
    ) VALUES (
        check_name_param,
        check_type_param,
        component_param,
        status_param,
        response_time_param,
        metrics_param,
        error_message_param
    ) RETURNING id INTO check_id;
    
    RETURN check_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record performance metric
CREATE OR REPLACE FUNCTION public.record_performance_metric(
    metric_name_param TEXT,
    metric_type_param TEXT,
    category_param TEXT,
    value_param DECIMAL,
    unit_param TEXT DEFAULT NULL,
    dimensions_param JSONB DEFAULT '{}',
    period_start_param TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    period_end_param TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    metric_id UUID;
    start_time TIMESTAMP WITH TIME ZONE;
    end_time TIMESTAMP WITH TIME ZONE;
BEGIN
    start_time := COALESCE(period_start_param, public.utc_now());
    end_time := COALESCE(period_end_param, public.utc_now());
    
    INSERT INTO public.performance_metrics (
        metric_name,
        metric_type,
        category,
        value,
        unit,
        dimensions,
        period_start,
        period_end
    ) VALUES (
        metric_name_param,
        metric_type_param,
        category_param,
        value_param,
        unit_param,
        dimensions_param,
        start_time,
        end_time
    ) RETURNING id INTO metric_id;
    
    RETURN metric_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record security event
CREATE OR REPLACE FUNCTION public.record_security_event(
    event_type_param TEXT,
    severity_param TEXT,
    category_param TEXT,
    description_param TEXT,
    details_param JSONB DEFAULT '{}',
    user_id_param UUID DEFAULT NULL,
    ip_address_param INET DEFAULT NULL,
    risk_score_param INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    event_id UUID;
BEGIN
    INSERT INTO public.security_events (
        event_type,
        severity,
        category,
        description,
        details,
        user_id,
        ip_address,
        risk_score
    ) VALUES (
        event_type_param,
        severity_param,
        category_param,
        description_param,
        details_param,
        user_id_param,
        ip_address_param,
        risk_score_param
    ) RETURNING id INTO event_id;
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old records based on retention policies
CREATE OR REPLACE FUNCTION public.cleanup_old_records()
RETURNS TABLE(
    table_name TEXT,
    records_deleted INTEGER,
    records_archived INTEGER
) AS $$
DECLARE
    policy RECORD;
    deleted_count INTEGER;
    archived_count INTEGER;
    cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
    FOR policy IN 
        SELECT * FROM public.data_retention_policies 
        WHERE is_active = true 
        AND (next_execution_at IS NULL OR next_execution_at <= public.utc_now())
    LOOP
        cutoff_date := public.utc_now() - (policy.retention_period_days || ' days')::INTERVAL;
        deleted_count := 0;
        archived_count := 0;
        
        -- Execute cleanup based on table
        CASE policy.table_name
            WHEN 'audit_logs' THEN
                DELETE FROM public.audit_logs 
                WHERE timestamp < cutoff_date;
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
                
            WHEN 'system_health_checks' THEN
                DELETE FROM public.system_health_checks 
                WHERE checked_at < cutoff_date;
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
                
            WHEN 'error_logs' THEN
                DELETE FROM public.error_logs 
                WHERE created_at < cutoff_date AND is_resolved = true;
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
                
            WHEN 'performance_metrics' THEN
                DELETE FROM public.performance_metrics 
                WHERE recorded_at < cutoff_date;
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
                
            WHEN 'api_usage_logs' THEN
                DELETE FROM public.api_usage_logs 
                WHERE created_at < cutoff_date;
                GET DIAGNOSTICS deleted_count = ROW_COUNT;
        END CASE;
        
        -- Update policy execution tracking
        UPDATE public.data_retention_policies
        SET 
            last_executed_at = public.utc_now(),
            next_execution_at = public.utc_now() + INTERVAL '1 day',
            records_deleted = records_deleted + deleted_count,
            records_archived = records_archived + archived_count,
            updated_at = public.utc_now()
        WHERE id = policy.id;
        
        -- Return results
        RETURN QUERY SELECT policy.table_name, deleted_count, archived_count;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Audit logging and monitoring setup completed!' as status; 