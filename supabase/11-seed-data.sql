-- =============================================
-- SEED DATA
-- Initial data for AI providers, models, and templates
-- =============================================

-- =============================================
-- AI PROVIDERS SEED DATA
-- =============================================

INSERT INTO public.ai_providers (name, display_name, base_url, auth_type, default_rate_limits, health_check_url) VALUES
('openai', 'OpenAI', 'https://api.openai.com/v1', 'api_key', 
 '{"requests_per_minute": 500, "tokens_per_minute": 90000, "requests_per_day": 10000}',
 'https://status.openai.com/api/v2/status.json'),

('anthropic', 'Anthropic', 'https://api.anthropic.com', 'api_key', 
 '{"requests_per_minute": 50, "tokens_per_minute": 40000, "requests_per_day": 1000}',
 'https://status.anthropic.com/api/v2/status.json'),

('google', 'Google AI Studio', 'https://generativelanguage.googleapis.com', 'api_key', 
 '{"requests_per_minute": 60, "tokens_per_minute": 1000000, "requests_per_day": 1500}',
 'https://developers.generativeai.google/status'),

('cohere', 'Cohere', 'https://api.cohere.ai', 'api_key', 
 '{"requests_per_minute": 100, "tokens_per_minute": 10000, "requests_per_day": 2000}',
 'https://status.cohere.ai/api/v2/status.json'),

('mistral', 'Mistral AI', 'https://api.mistral.ai', 'api_key', 
 '{"requests_per_minute": 60, "tokens_per_minute": 30000, "requests_per_day": 1000}',
 'https://status.mistral.ai/api/v2/status.json'),

('groq', 'Groq', 'https://api.groq.com/openai', 'api_key', 
 '{"requests_per_minute": 30, "tokens_per_minute": 6000, "requests_per_day": 14400}',
 NULL),

('perplexity', 'Perplexity AI', 'https://api.perplexity.ai', 'api_key', 
 '{"requests_per_minute": 20, "tokens_per_minute": 10000, "requests_per_day": 500}',
 NULL)

ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    base_url = EXCLUDED.base_url,
    default_rate_limits = EXCLUDED.default_rate_limits,
    health_check_url = EXCLUDED.health_check_url,
    updated_at = public.utc_now();

-- =============================================
-- AI MODELS SEED DATA
-- =============================================

-- OpenAI Models
INSERT INTO public.ai_models (
    provider_id, model_id, display_name, description, model_family, model_version,
    capabilities, pricing, context_window, max_output_tokens, supports_streaming,
    supports_function_calling, supports_vision, default_performance_score, default_speed_score, 
    default_cost_efficiency, best_use_cases, limitations
) VALUES
-- GPT-4 Models
((SELECT id FROM public.ai_providers WHERE name = 'openai'), 'gpt-4o', 'GPT-4o', 
 'Most advanced GPT-4 model with vision capabilities', 'gpt-4', '2024-05-13',
 '["text", "vision", "function_calling", "json_mode"]', 
 '{"input_cost_per_1k": 0.005, "output_cost_per_1k": 0.015}',
 128000, 4096, true, true, true, 0.95, 0.90, 0.85,
 ARRAY['research', 'analysis', 'vision', 'general'], 
 ARRAY['High cost for simple tasks', 'Rate limits']),

((SELECT id FROM public.ai_providers WHERE name = 'openai'), 'gpt-4-turbo', 'GPT-4 Turbo', 
 'Enhanced GPT-4 with improved performance', 'gpt-4', '2024-04-09',
 '["text", "vision", "function_calling", "json_mode"]',
 '{"input_cost_per_1k": 0.01, "output_cost_per_1k": 0.03}',
 128000, 4096, true, true, true, 0.93, 0.85, 0.75,
 ARRAY['analysis', 'reasoning', 'writing', 'coding'], 
 ARRAY['Higher cost', 'Slower than GPT-3.5']),

((SELECT id FROM public.ai_providers WHERE name = 'openai'), 'gpt-3.5-turbo', 'GPT-3.5 Turbo', 
 'Fast and efficient model for most tasks', 'gpt-3.5', '0125',
 '["text", "function_calling", "json_mode"]',
 '{"input_cost_per_1k": 0.0005, "output_cost_per_1k": 0.0015}',
 16385, 4096, true, true, false, 0.85, 0.95, 0.95,
 ARRAY['writing', 'summarization', 'simple_tasks', 'chat'], 
 ARRAY['Limited reasoning', 'No vision capabilities']),

-- Anthropic Models
((SELECT id FROM public.ai_providers WHERE name = 'anthropic'), 'claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 
 'Most intelligent Claude model with enhanced capabilities', 'claude-3.5', '20241022',
 '["text", "vision", "analysis", "code"]',
 '{"input_cost_per_1k": 0.003, "output_cost_per_1k": 0.015}',
 200000, 8192, true, false, true, 0.98, 0.85, 0.80,
 ARRAY['analysis', 'reasoning', 'research', 'writing', 'coding'],
 ARRAY['No function calling', 'Higher latency']),

((SELECT id FROM public.ai_providers WHERE name = 'anthropic'), 'claude-3-haiku-20240307', 'Claude 3 Haiku', 
 'Fastest Claude model for quick tasks', 'claude-3', '20240307',
 '["text", "vision"]',
 '{"input_cost_per_1k": 0.00025, "output_cost_per_1k": 0.00125}',
 200000, 4096, true, false, true, 0.85, 0.95, 0.90,
 ARRAY['writing', 'summarization', 'quick_tasks'],
 ARRAY['Limited reasoning for complex tasks']),

-- Google Models
((SELECT id FROM public.ai_providers WHERE name = 'google'), 'gemini-1.5-pro', 'Gemini 1.5 Pro', 
 'Advanced multimodal model with large context window', 'gemini-1.5', 'latest',
 '["text", "vision", "code", "analysis", "audio"]',
 '{"input_cost_per_1k": 0.0035, "output_cost_per_1k": 0.0105}',
 1000000, 8192, true, true, true, 0.92, 0.80, 0.85,
 ARRAY['research', 'analysis', 'large_context', 'multimodal'],
 ARRAY['Complex pricing structure', 'Variable performance']),

((SELECT id FROM public.ai_providers WHERE name = 'google'), 'gemini-1.5-flash', 'Gemini 1.5 Flash', 
 'Fast and efficient Gemini model', 'gemini-1.5', 'latest',
 '["text", "vision", "code"]',
 '{"input_cost_per_1k": 0.00035, "output_cost_per_1k": 0.00105}',
 1000000, 8192, true, true, true, 0.87, 0.90, 0.95,
 ARRAY['research', 'summarization', 'quick_analysis'],
 ARRAY['Less capable than Pro version']),

-- Cohere Models
((SELECT id FROM public.ai_providers WHERE name = 'cohere'), 'command-r-plus', 'Command R+', 
 'Advanced reasoning and tool use model', 'command-r', 'plus',
 '["text", "function_calling", "reasoning"]',
 '{"input_cost_per_1k": 0.003, "output_cost_per_1k": 0.015}',
 128000, 4096, true, true, false, 0.88, 0.85, 0.80,
 ARRAY['reasoning', 'analysis', 'tool_use'],
 ARRAY['Limited model ecosystem', 'Less general knowledge']),

-- Mistral Models
((SELECT id FROM public.ai_providers WHERE name = 'mistral'), 'mistral-large-latest', 'Mistral Large', 
 'Most capable Mistral model', 'mistral-large', 'latest',
 '["text", "function_calling", "json_mode"]',
 '{"input_cost_per_1k": 0.004, "output_cost_per_1k": 0.012}',
 32000, 8192, true, true, false, 0.90, 0.85, 0.82,
 ARRAY['reasoning', 'coding', 'analysis'],
 ARRAY['Smaller context window', 'European focus']),

((SELECT id FROM public.ai_providers WHERE name = 'mistral'), 'mistral-small-latest', 'Mistral Small', 
 'Cost-effective Mistral model', 'mistral-small', 'latest',
 '["text", "function_calling"]',
 '{"input_cost_per_1k": 0.001, "output_cost_per_1k": 0.003}',
 32000, 8192, true, true, false, 0.82, 0.90, 0.88,
 ARRAY['writing', 'simple_reasoning', 'cost_effective'],
 ARRAY['Limited capabilities', 'Smaller knowledge base']),

-- Groq Models (ultra-fast inference)
((SELECT id FROM public.ai_providers WHERE name = 'groq'), 'llama-3.1-70b-versatile', 'Llama 3.1 70B', 
 'High-performance open source model', 'llama-3.1', '70b',
 '["text", "reasoning"]',
 '{"input_cost_per_1k": 0.00059, "output_cost_per_1k": 0.00079}',
 131072, 8000, true, false, false, 0.87, 0.98, 0.92,
 ARRAY['reasoning', 'coding', 'fast_inference'],
 ARRAY['No function calling', 'Limited fine-tuning']),

((SELECT id FROM public.ai_providers WHERE name = 'groq'), 'mixtral-8x7b-32768', 'Mixtral 8x7B', 
 'Mixture of experts model for efficiency', 'mixtral', '8x7b',
 '["text", "multilingual"]',
 '{"input_cost_per_1k": 0.00024, "output_cost_per_1k": 0.00024}',
 32768, 32768, true, false, false, 0.83, 0.98, 0.95,
 ARRAY['multilingual', 'cost_effective', 'fast_inference'],
 ARRAY['Lower capability than larger models']),

-- Perplexity Models
((SELECT id FROM public.ai_providers WHERE name = 'perplexity'), 'llama-3.1-sonar-large-128k-online', 'Sonar Large Online', 
 'Real-time web search and reasoning', 'sonar', 'large',
 '["text", "web_search", "real_time"]',
 '{"input_cost_per_1k": 0.001, "output_cost_per_1k": 0.001}',
 127072, 8192, true, false, false, 0.85, 0.85, 0.90,
 ARRAY['research', 'real_time_info', 'web_search'],
 ARRAY['Requires internet', 'Limited offline capabilities'])

ON CONFLICT (provider_id, model_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    capabilities = EXCLUDED.capabilities,
    pricing = EXCLUDED.pricing,
    context_window = EXCLUDED.context_window,
    max_output_tokens = EXCLUDED.max_output_tokens,
    supports_streaming = EXCLUDED.supports_streaming,
    supports_function_calling = EXCLUDED.supports_function_calling,
    supports_vision = EXCLUDED.supports_vision,
    default_performance_score = EXCLUDED.default_performance_score,
    default_speed_score = EXCLUDED.default_speed_score,
    default_cost_efficiency = EXCLUDED.default_cost_efficiency,
    best_use_cases = EXCLUDED.best_use_cases,
    limitations = EXCLUDED.limitations,
    updated_at = public.utc_now();

-- =============================================
-- WORKFLOW TEMPLATES SEED DATA
-- =============================================

-- Note: workflow_templates table doesn't have a unique constraint on name,
-- so we'll insert without ON CONFLICT to avoid errors
INSERT INTO public.workflow_templates (
    name, description, category, difficulty_level, estimated_duration_minutes,
    estimated_cost_range, is_public, template_data, tags, is_featured
) VALUES
('Deep Research Analysis', 
 'Comprehensive multi-agent research workflow that analyzes topics from multiple angles',
 'research', 'intermediate', 8, '{"min": 0.02, "max": 0.12}', true,
 '{
   "steps": [
     {
       "id": "initial_research",
       "name": "Initial Research",
       "description": "Gather comprehensive information about the topic",
       "agent_type": "researcher",
       "model_preference": "gemini-1.5-pro",
       "prompt_template": "Research {{topic}} comprehensively. Focus on recent developments, key findings, and authoritative sources. Provide citations for all claims.",
       "expected_tokens": 3000,
       "timeout_minutes": 3
     },
     {
       "id": "critical_analysis",
       "name": "Critical Analysis",
       "description": "Analyze the research critically and identify key insights",
       "agent_type": "analyzer",
       "model_preference": "claude-3-5-sonnet-20241022",
       "prompt_template": "Critically analyze the following research: {{initial_research.content}}. Identify strengths, weaknesses, gaps, and contradictions. Highlight key insights.",
       "expected_tokens": 2500,
       "timeout_minutes": 4
     },
     {
       "id": "synthesis",
       "name": "Synthesis & Recommendations",
       "description": "Synthesize findings and provide actionable recommendations",
       "agent_type": "synthesizer",
       "model_preference": "gpt-4o",
       "prompt_template": "Synthesize the research findings and critical analysis to create a comprehensive report with actionable recommendations: Research: {{initial_research.content}} Analysis: {{critical_analysis.content}}",
       "expected_tokens": 2000,
       "timeout_minutes": 3
     }
   ],
   "inputs": [
     {
       "name": "topic",
       "type": "text",
       "label": "Research Topic",
       "description": "The topic you want to research in depth",
       "required": true,
       "placeholder": "e.g., Impact of AI on healthcare"
     }
   ],
   "outputs": [
     {
       "name": "research_report",
       "type": "document",
       "description": "Comprehensive research report with analysis and recommendations"
     }
   ]
 }',
 ARRAY['research', 'analysis', 'multi-agent', 'comprehensive'], true),

('Content Creation Pipeline',
 'AI-powered content creation from idea to polished piece',
 'writing', 'beginner', 5, '{"min": 0.01, "max": 0.05}', true,
 '{
   "steps": [
     {
       "id": "brainstorm",
       "name": "Brainstorm Ideas",
       "description": "Generate creative ideas and angles for the content",
       "agent_type": "creative",
       "model_preference": "gpt-4o",
       "prompt_template": "Brainstorm creative and engaging ideas for content about {{topic}}. Consider different angles, formats, and target audiences. Topic: {{topic}}, Target audience: {{audience}}, Content type: {{content_type}}",
       "expected_tokens": 1500,
       "timeout_minutes": 2
     },
     {
       "id": "outline",
       "name": "Create Outline",
       "description": "Structure the content with a detailed outline",
       "agent_type": "writer",
       "model_preference": "claude-3-5-sonnet-20241022",
       "prompt_template": "Create a detailed outline for {{content_type}} about {{topic}}. Use the best ideas from: {{brainstorm.content}}. Structure should be logical and engaging.",
       "expected_tokens": 1000,
       "timeout_minutes": 2
     },
     {
       "id": "draft",
       "name": "Write First Draft",
       "description": "Create the initial content draft",
       "agent_type": "writer",
       "model_preference": "gpt-4o",
       "prompt_template": "Write a compelling {{content_type}} following this outline: {{outline.content}}. Target audience: {{audience}}. Make it engaging, informative, and well-structured.",
       "expected_tokens": 2500,
       "timeout_minutes": 4
     },
     {
       "id": "edit",
       "name": "Edit & Polish",
       "description": "Refine and polish the content",
       "agent_type": "editor",
       "model_preference": "claude-3-5-sonnet-20241022",
       "prompt_template": "Edit and polish this content for clarity, engagement, and flow: {{draft.content}}. Improve readability, fix any issues, and enhance the overall quality.",
       "expected_tokens": 2000,
       "timeout_minutes": 3
     }
   ],
   "inputs": [
     {
       "name": "topic",
       "type": "text",
       "label": "Content Topic",
       "required": true,
       "placeholder": "What do you want to write about?"
     },
     {
       "name": "content_type",
       "type": "select",
       "label": "Content Type",
       "options": ["blog post", "article", "social media post", "newsletter", "landing page"],
       "required": true
     },
     {
       "name": "audience",
       "type": "text",
       "label": "Target Audience",
       "required": true,
       "placeholder": "Who is your target audience?"
     }
   ]
 }',
 ARRAY['writing', 'content', 'creative', 'beginner-friendly'], true),

('Academic Paper Summarizer',
 'Extract key insights from academic papers and research',
 'research', 'beginner', 4, '{"min": 0.008, "max": 0.04}', true,
 '{
   "steps": [
     {
       "id": "extract_key_info",
       "name": "Extract Key Information",
       "description": "Extract methodology, findings, and conclusions",
       "agent_type": "academic_analyzer",
       "model_preference": "claude-3-5-sonnet-20241022",
       "prompt_template": "Extract and summarize the key information from this academic paper: {{paper_content}}. Focus on: research question, methodology, key findings, limitations, and conclusions.",
       "expected_tokens": 2000,
       "timeout_minutes": 3
     },
     {
       "id": "implications",
       "name": "Analyze Implications",
       "description": "Analyze broader implications and applications",
       "agent_type": "implications_analyst",
       "model_preference": "gpt-4o",
       "prompt_template": "Based on this paper analysis: {{extract_key_info.content}}, analyze the broader implications, real-world applications, and significance of these findings.",
       "expected_tokens": 1500,
       "timeout_minutes": 2
     },
     {
       "id": "plain_language_summary",
       "name": "Plain Language Summary",
       "description": "Create an accessible summary for general audience",
       "agent_type": "science_communicator",
       "model_preference": "gpt-4o",
       "prompt_template": "Create a plain language summary of this research that anyone can understand. Source analysis: {{extract_key_info.content}} Implications: {{implications.content}}",
       "expected_tokens": 1200,
       "timeout_minutes": 2
     }
   ],
   "inputs": [
     {
       "name": "paper_content",
       "type": "textarea",
       "label": "Paper Content",
       "description": "Paste the paper text, abstract, or upload a document",
       "required": true,
       "placeholder": "Paste the academic paper content here..."
     }
   ]
 }',
 ARRAY['research', 'academic', 'summarization', 'science-communication'], true);

-- =============================================
-- DEFAULT USER CONFIGURATION FUNCTIONS
-- =============================================

-- Function to create default configurations for new users
CREATE OR REPLACE FUNCTION public.create_default_user_configurations(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
    -- Create default AI provider configs for popular providers if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_ai_provider_configs') THEN
        INSERT INTO public.user_ai_provider_configs (
            user_id,
            provider_id,
            reliability_score,
            performance_score,
            cost_efficiency_score,
            user_priority,
            is_enabled
        ) 
        SELECT 
            user_uuid,
            id,
            CASE name
                WHEN 'openai' THEN 0.95
                WHEN 'anthropic' THEN 0.92
                WHEN 'google' THEN 0.88
                WHEN 'groq' THEN 0.85
                ELSE 0.80
            END,
            CASE name
                WHEN 'groq' THEN 0.98  -- Groq is fastest
                WHEN 'openai' THEN 0.90
                WHEN 'anthropic' THEN 0.85
                WHEN 'google' THEN 0.80
                ELSE 0.75
            END,
            CASE name
                WHEN 'groq' THEN 0.95   -- Groq is most cost-effective
                WHEN 'google' THEN 0.90
                WHEN 'anthropic' THEN 0.80
                WHEN 'openai' THEN 0.75
                ELSE 0.70
            END,
            CASE name
                WHEN 'openai' THEN 90    -- OpenAI gets highest priority by default
                WHEN 'anthropic' THEN 80
                WHEN 'google' THEN 70
                WHEN 'groq' THEN 60
                ELSE 50
            END,
            true
        FROM public.ai_providers
        WHERE name IN ('openai', 'anthropic', 'google', 'groq')
        ON CONFLICT (user_id, provider_id) DO NOTHING;
    END IF;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- MONITORING CONFIGURATION SEED DATA
-- =============================================

INSERT INTO public.monitoring_config (config_name, config_type, settings, description) VALUES
('default_alert_thresholds', 'alert_thresholds', 
 '{
   "api_response_time_warning": 2000,
   "api_response_time_critical": 5000,
   "database_connection_warning": 100,
   "database_connection_critical": 500,
   "error_rate_warning": 0.05,
   "error_rate_critical": 0.10,
   "disk_usage_warning": 0.80,
   "disk_usage_critical": 0.95,
   "memory_usage_warning": 0.85,
   "memory_usage_critical": 0.95
 }',
 'Default alert thresholds for system monitoring'),

('default_retention_settings', 'retention_settings',
 '{
   "audit_logs_retention_days": 2555,
   "error_logs_retention_days": 365,
   "performance_metrics_retention_days": 90,
   "security_events_retention_days": 2555,
   "health_checks_retention_days": 30,
   "api_usage_logs_retention_days": 365,
   "default_batch_size": 1000,
   "default_max_execution_time_minutes": 60
 }',
 'Default data retention policies and cleanup settings'),

('default_health_check_config', 'health_checks',
 '{
   "check_intervals": {
     "database": 60,
     "api": 30,
     "storage": 300,
     "external_service": 120
   },
   "timeout_seconds": {
     "database": 10,
     "api": 5,
     "storage": 30,
     "external_service": 15
   },
   "retry_attempts": 3,
   "alert_cooldown_minutes": 15
 }',
 'Default health check configuration'),

('default_audit_settings', 'audit_settings',
 '{
   "enabled_tables": [
     "user_api_keys",
     "user_usage_limits", 
     "workspace_members",
     "stripe_customers",
     "stripe_payment_methods",
     "profiles"
   ],
   "risk_levels": {
     "user_api_keys": "high",
     "stripe_customers": "high",
     "stripe_payment_methods": "high",
     "user_usage_limits": "medium",
     "workspace_members": "medium",
     "profiles": "low"
   },
   "sensitive_fields": [
     "encrypted_api_key",
     "card_last4",
     "bank_account_last4",
     "email",
     "phone"
   ]
 }',
 'Default audit logging configuration'),

('default_performance_limits', 'performance_limits',
 '{
   "max_concurrent_workflows": 10,
   "max_api_requests_per_minute": 1000,
   "max_file_upload_size_mb": 100,
   "max_document_processing_time_minutes": 30,
   "max_ai_request_timeout_seconds": 300,
   "max_embedding_batch_size": 100
 }',
 'Default performance limits and constraints')

ON CONFLICT (config_name) DO UPDATE SET
    settings = EXCLUDED.settings,
    description = EXCLUDED.description,
    updated_at = public.utc_now();

-- =============================================
-- STRIPE PRODUCTS SEED DATA (OPTIONAL)
-- =============================================

-- Insert Stripe products if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stripe_products') THEN
        INSERT INTO public.stripe_products (
            id, name, description, product_type, category, monthly_ai_credits, 
            storage_gb, max_team_members, max_workflows, max_documents,
            features, feature_highlights, is_featured
        ) VALUES
        ('prod_starter', 'Starter Plan', 'Perfect for individuals getting started with AI workflows', 
         'subscription', 'pro_plan', 5.00, 5, 1, 50, 100,
         '["basic_workflows", "email_support", "5gb_storage"]',
         ARRAY['Up to 50 workflows per month', '5GB document storage', 'Email support'],
         false),

        ('prod_professional', 'Professional Plan', 'For professionals and small teams', 
         'subscription', 'pro_plan', 25.00, 25, 5, 200, 500,
         '["advanced_workflows", "priority_support", "team_collaboration", "25gb_storage", "api_access"]',
         ARRAY['Up to 200 workflows per month', '25GB document storage', 'Team collaboration', 'Priority support', 'API access'],
         true),

        ('prod_business', 'Business Plan', 'For growing businesses and larger teams', 
         'subscription', 'enterprise_plan', 100.00, 100, 25, 1000, 2500,
         '["unlimited_workflows", "dedicated_support", "advanced_analytics", "100gb_storage", "custom_integrations", "sso"]',
         ARRAY['Unlimited workflows', '100GB document storage', 'Advanced team features', 'Dedicated support', 'Custom integrations', 'SSO'],
         true),

        ('prod_ai_credits', 'AI Credits', 'Additional AI processing credits', 
         'credits', 'ai_credits', NULL, NULL, NULL, NULL, NULL,
         '["additional_ai_usage", "flexible_pricing"]',
         ARRAY['Pay-as-you-go pricing', 'No expiration', 'Works with any plan'],
         false)

        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            monthly_ai_credits = EXCLUDED.monthly_ai_credits,
            storage_gb = EXCLUDED.storage_gb,
            max_team_members = EXCLUDED.max_team_members,
            max_workflows = EXCLUDED.max_workflows,
            max_documents = EXCLUDED.max_documents,
            features = EXCLUDED.features,
            feature_highlights = EXCLUDED.feature_highlights,
            updated_at = public.utc_now();
    END IF;
END $$;

-- =============================================
-- DATA RETENTION POLICIES
-- =============================================

INSERT INTO public.data_retention_policies (
    policy_name, table_name, description, retention_period_days, 
    schedule_expression, is_active
) VALUES
('audit_logs_retention', 'audit_logs', 'Keep audit logs for 2 years for compliance', 730, '0 2 * * *', true),
('api_usage_logs_retention', 'api_usage_logs', 'Keep detailed usage logs for 90 days', 90, '0 3 * * *', true),
('error_logs_retention', 'error_logs', 'Keep resolved error logs for 30 days', 30, '0 4 * * *', true),
('performance_metrics_retention', 'performance_metrics', 'Keep performance metrics for 6 months', 180, '0 5 * * *', true),
('health_checks_retention', 'system_health_checks', 'Keep health check data for 30 days', 30, '0 6 * * *', true)

ON CONFLICT (policy_name) DO UPDATE SET
    description = EXCLUDED.description,
    retention_period_days = EXCLUDED.retention_period_days,
    schedule_expression = EXCLUDED.schedule_expression,
    updated_at = public.utc_now();

-- =============================================
-- INITIAL SYSTEM HEALTH CHECKS
-- =============================================

-- Record initial health check to verify system is working
SELECT public.record_health_check(
    'database_connectivity',
    'database',
    'postgresql',
    'healthy',
    NULL,
    '{"connections": 1, "version": "15.0"}',
    NULL
);

-- =============================================
-- SUCCESS MESSAGE
-- =============================================

SELECT 'Seed data insertion completed successfully!' as status,
       (SELECT COUNT(*) FROM public.ai_providers) as providers_count,
       (SELECT COUNT(*) FROM public.ai_models) as models_count,
       (SELECT COUNT(*) FROM public.workflow_templates) as templates_count;

SELECT 'Basic seed data completed!' as final_status; 