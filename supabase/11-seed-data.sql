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

('Code Review & Optimization',
 'Automated code review with optimization suggestions',
 'coding', 'advanced', 6, '{"min": 0.015, "max": 0.08}', true,
 '{
   "steps": [
     {
       "id": "code_analysis",
       "name": "Code Analysis",
       "description": "Analyze code for issues, patterns, and structure",
       "agent_type": "code_analyzer",
       "model_preference": "gpt-4o",
       "prompt_template": "Analyze this code for bugs, security issues, performance problems, and code quality. Code: {{code}} Language: {{language}}",
       "expected_tokens": 2000,
       "timeout_minutes": 3
     },
     {
       "id": "optimization",
       "name": "Optimization Suggestions",
       "description": "Provide specific optimization recommendations",
       "agent_type": "optimizer",
       "model_preference": "claude-3-5-sonnet-20241022",
       "prompt_template": "Based on this code analysis: {{code_analysis.content}}, provide specific optimization suggestions for the original code: {{code}}. Include refactored examples.",
       "expected_tokens": 2500,
       "timeout_minutes": 4
     },
     {
       "id": "documentation",
       "name": "Generate Documentation",
       "description": "Create comprehensive documentation",
       "agent_type": "documenter",
       "model_preference": "gpt-4-turbo",
       "prompt_template": "Generate comprehensive documentation for this code: {{code}}. Include function descriptions, parameters, examples, and usage notes.",
       "expected_tokens": 1500,
       "timeout_minutes": 2
     }
   ],
   "inputs": [
     {
       "name": "code",
       "type": "textarea",
       "label": "Code to Review",
       "required": true,
       "placeholder": "Paste your code here..."
     },
     {
       "name": "language",
       "type": "select",
       "label": "Programming Language",
       "options": ["JavaScript", "Python", "TypeScript", "Java", "C++", "Go", "Rust", "Other"],
       "required": true
     }
   ]
 }',
 ARRAY['coding', 'review', 'optimization', 'documentation'], true),

('Market Analysis Report',
 'Comprehensive market research and competitive analysis',
 'business', 'intermediate', 10, '{"min": 0.03, "max": 0.15}', true,
 '{
   "steps": [
     {
       "id": "market_research",
       "name": "Market Research",
       "description": "Research market size, trends, and key players",
       "agent_type": "researcher",
       "model_preference": "llama-3.1-sonar-large-128k-online",
       "prompt_template": "Research the {{industry}} market. Focus on: market size, growth trends, key players, recent developments, and future outlook. Industry: {{industry}}, Geographic focus: {{region}}",
       "expected_tokens": 3500,
       "timeout_minutes": 5
     },
     {
       "id": "competitor_analysis",
       "name": "Competitor Analysis",
       "description": "Analyze main competitors and their strategies",
       "agent_type": "analyst",
       "model_preference": "claude-3-5-sonnet-20241022",
       "prompt_template": "Analyze the main competitors in {{industry}}. Based on the market research: {{market_research.content}}, identify top competitors and analyze their strengths, weaknesses, and strategies.",
       "expected_tokens": 3000,
       "timeout_minutes": 4
     },
     {
       "id": "opportunity_assessment",
       "name": "Opportunity Assessment",
       "description": "Identify market opportunities and threats",
       "agent_type": "strategist",
       "model_preference": "gpt-4o",
       "prompt_template": "Based on the market research and competitor analysis, identify key opportunities and threats. Market data: {{market_research.content}} Competitor analysis: {{competitor_analysis.content}}",
       "expected_tokens": 2500,
       "timeout_minutes": 3
     },
     {
       "id": "strategic_recommendations",
       "name": "Strategic Recommendations",
       "description": "Provide actionable strategic recommendations",
       "agent_type": "strategist",
       "model_preference": "claude-3-5-sonnet-20241022",
       "prompt_template": "Create strategic recommendations based on all previous analysis. Focus on actionable steps and competitive advantages. Include market research, competitor analysis, and opportunities identified.",
       "expected_tokens": 2000,
       "timeout_minutes": 3
     }
   ],
   "inputs": [
     {
       "name": "industry",
       "type": "text",
       "label": "Industry/Market",
       "required": true,
       "placeholder": "e.g., AI software, electric vehicles, fintech"
     },
     {
       "name": "region",
       "type": "select",
       "label": "Geographic Focus",
       "options": ["Global", "North America", "Europe", "Asia-Pacific", "Other"],
       "required": true
     }
   ]
 }',
 ARRAY['business', 'market-research', 'competitive-analysis', 'strategy'], false),

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
 ARRAY['research', 'academic', 'summarization', 'science-communication'], true)

ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    template_data = EXCLUDED.template_data,
    tags = EXCLUDED.tags,
    estimated_cost_range = EXCLUDED.estimated_cost_range,
    estimated_duration_minutes = EXCLUDED.estimated_duration_minutes,
    updated_at = public.utc_now();

-- =============================================
-- DEFAULT USER CONFIGURATION FUNCTIONS
-- =============================================

-- Function to create default configurations for new users
CREATE OR REPLACE FUNCTION public.create_default_user_configurations(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
    -- Create default user preferences if they don't exist
    INSERT INTO public.user_preferences (
        user_id,
        daily_cost_limit,
        monthly_cost_limit,
        daily_token_limit,
        monthly_token_limit,
        daily_request_limit,
        monthly_request_limit,
        conversation_retention_days,
        document_retention_days,
        analytics_retention_days,
        workflow_preferences
    ) VALUES (
        user_uuid,
        5.00,    -- Default daily cost limit
        100.00,  -- Default monthly cost limit
        50000,   -- Default daily token limit
        1000000, -- Default monthly token limit
        100,     -- Default daily request limit
        2000,    -- Default monthly request limit
        90,      -- Default conversation retention
        365,     -- Default document retention
        180,     -- Default analytics retention
        jsonb_build_object(
            'default_max_retries', 3,
            'default_timeout_minutes', 10,
            'auto_save_enabled', true,
            'parallel_execution', false
        )
    ) ON CONFLICT (user_id) DO NOTHING;
    
    -- Create default document processing config
    INSERT INTO public.document_processing_config (
        user_id,
        max_file_size_mb,
        max_processing_attempts,
        processing_timeout_minutes,
        embedding_provider,
        embedding_model,
        chunk_size,
        chunk_overlap
    ) VALUES (
        user_uuid,
        50,        -- 50MB max file size
        3,         -- 3 processing attempts
        30,        -- 30 minutes timeout
        'openai',  -- Default to OpenAI
        'text-embedding-3-small',
        1000,      -- 1000 character chunks
        200        -- 200 character overlap
    ) ON CONFLICT (user_id) DO NOTHING;
    
    -- Create default AI provider configs for popular providers
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
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to setup default workspace limits based on plan
CREATE OR REPLACE FUNCTION public.setup_default_workspace(workspace_uuid UUID, plan_type TEXT DEFAULT 'free')
RETURNS VOID AS $$
BEGIN
    -- Set workspace limits based on plan
    PERFORM public.set_workspace_limits_by_plan(workspace_uuid);
    
    -- If it's a new workspace, trigger the plan-based limit setting
    UPDATE public.workspaces 
    SET plan_type = setup_default_workspace.plan_type 
    WHERE id = workspace_uuid;
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
-- STRIPE PRODUCTS SEED DATA
-- =============================================

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

('prod_enterprise', 'Enterprise Plan', 'For large organizations with custom needs', 
 'subscription', 'enterprise_plan', 500.00, 500, 100, 5000, 10000,
 '["unlimited_everything", "white_label", "custom_deployment", "enterprise_support", "unlimited_storage", "advanced_security"]',
 ARRAY['Unlimited usage', 'White-label options', 'Custom deployment', 'Enterprise support', 'Advanced security'],
 false),

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
       (SELECT COUNT(*) FROM public.workflow_templates) as templates_count,
       (SELECT COUNT(*) FROM public.stripe_products) as products_count;

-- =============================================
-- INTELLIGENT SEED DATA
-- Production-grade seed data with dynamic configurations
-- =============================================

-- Helper function to create intelligent seed data
CREATE OR REPLACE FUNCTION public.create_intelligent_seed_data()
RETURNS TEXT AS $$
DECLARE
    openai_provider_id UUID;
    anthropic_provider_id UUID;
    google_provider_id UUID;
    groq_provider_id UUID;
    
    free_plan_id UUID;
    starter_plan_id UUID;
    pro_plan_id UUID;
    enterprise_plan_id UUID;
    
    gpt4_model_id UUID;
    claude_model_id UUID;
    gemini_model_id UUID;
    
    result_text TEXT := '';
BEGIN
    -- =============================================
    -- AI PROVIDERS WITH INTELLIGENT DEFAULTS
    -- =============================================
    
    INSERT INTO public.ai_providers (id, name, display_name, base_url, auth_type, is_active, default_rate_limits, default_timeout_seconds, health_check_url, provider_type, documentation_url, pricing_url) VALUES
    (gen_random_uuid(), 'openai', 'OpenAI', 'https://api.openai.com/v1', 'api_key', true, 
     '{"requests_per_minute": 500, "tokens_per_minute": 200000, "concurrent_requests": 10}', 
     30, 'https://status.openai.com/', 'api', 'https://platform.openai.com/docs', 'https://openai.com/pricing'),
    (gen_random_uuid(), 'anthropic', 'Anthropic', 'https://api.anthropic.com', 'api_key', true,
     '{"requests_per_minute": 300, "tokens_per_minute": 150000, "concurrent_requests": 8}',
     45, 'https://status.anthropic.com/', 'api', 'https://docs.anthropic.com/', 'https://www.anthropic.com/pricing'),
    (gen_random_uuid(), 'google', 'Google AI', 'https://generativelanguage.googleapis.com/v1', 'api_key', true,
     '{"requests_per_minute": 1000, "tokens_per_minute": 500000, "concurrent_requests": 15}',
     25, 'https://status.cloud.google.com/', 'api', 'https://ai.google.dev/docs', 'https://ai.google.dev/pricing'),
    (gen_random_uuid(), 'groq', 'Groq', 'https://api.groq.com/openai/v1', 'api_key', true,
     '{"requests_per_minute": 1500, "tokens_per_minute": 1000000, "concurrent_requests": 20}',
     15, 'https://status.groq.com/', 'api', 'https://console.groq.com/docs', 'https://groq.com/pricing/')
    RETURNING id INTO openai_provider_id;
    
    -- Get provider IDs for reference
    SELECT id INTO openai_provider_id FROM public.ai_providers WHERE name = 'openai';
    SELECT id INTO anthropic_provider_id FROM public.ai_providers WHERE name = 'anthropic';
    SELECT id INTO google_provider_id FROM public.ai_providers WHERE name = 'google';
    SELECT id INTO groq_provider_id FROM public.ai_providers WHERE name = 'groq';
    
    -- =============================================
    -- AI MODELS WITH DYNAMIC PRICING
    -- =============================================
    
    INSERT INTO public.ai_models (id, provider_id, model_id, display_name, description, model_family, model_version, capabilities, context_window, max_output_tokens, supports_streaming, supports_function_calling, supports_vision, supports_json_mode, pricing, best_use_cases, default_performance_score, default_speed_score, default_cost_efficiency, is_active) VALUES
    
    -- OpenAI Models
    (gen_random_uuid(), openai_provider_id, 'gpt-4o', 'GPT-4o', 'Most advanced multimodal model', 'gpt-4', '4o', 
     '["text", "vision", "function_calling", "json_mode"]', 128000, 4096, true, true, true, true,
     '{"input_cost_per_1k": 0.005, "output_cost_per_1k": 0.015, "vision_cost_per_image": 0.01275}',
     '["analysis", "coding", "creative", "research"]', 0.95, 0.85, 0.70, true),
    
    (gen_random_uuid(), openai_provider_id, 'gpt-4o-mini', 'GPT-4o Mini', 'Fast and efficient model', 'gpt-4', '4o-mini',
     '["text", "vision", "function_calling", "json_mode"]', 128000, 16384, true, true, true, true,
     '{"input_cost_per_1k": 0.00015, "output_cost_per_1k": 0.0006, "vision_cost_per_image": 0.002833}',
     '["general", "simple_tasks", "cost_optimization"]', 0.85, 0.95, 0.95, true),
    
    (gen_random_uuid(), openai_provider_id, 'gpt-3.5-turbo', 'GPT-3.5 Turbo', 'Fast and cost-effective', 'gpt-3.5', 'turbo',
     '["text", "function_calling", "json_mode"]', 16385, 4096, true, true, false, true,
     '{"input_cost_per_1k": 0.0005, "output_cost_per_1k": 0.0015}',
     '["chat", "simple_tasks", "prototyping"]', 0.80, 0.95, 0.90, true),
    
    -- Anthropic Models  
    (gen_random_uuid(), anthropic_provider_id, 'claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 'Most intelligent model', 'claude-3', '3.5-sonnet',
     '["text", "vision", "analysis", "coding"]', 200000, 8192, true, true, true, false,
     '{"input_cost_per_1k": 0.003, "output_cost_per_1k": 0.015}',
     '["analysis", "coding", "research", "writing"]', 0.92, 0.80, 0.75, true),
    
    (gen_random_uuid(), anthropic_provider_id, 'claude-3-haiku-20240307', 'Claude 3 Haiku', 'Fastest and most compact', 'claude-3', 'haiku',
     '["text", "vision"]', 200000, 4096, true, false, true, false,
     '{"input_cost_per_1k": 0.00025, "output_cost_per_1k": 0.00125}',
     '["simple_tasks", "quick_responses", "cost_optimization"]', 0.75, 0.95, 0.90, true),
    
    -- Google Models
    (gen_random_uuid(), google_provider_id, 'gemini-1.5-pro', 'Gemini 1.5 Pro', 'Advanced multimodal model', 'gemini', '1.5-pro',
     '["text", "vision", "audio", "code"]', 2097152, 8192, true, true, true, true,
     '{"input_cost_per_1k": 0.00125, "output_cost_per_1k": 0.005}',
     '["research", "analysis", "large_context"]', 0.88, 0.75, 0.85, true),
    
    (gen_random_uuid(), google_provider_id, 'gemini-1.5-flash', 'Gemini 1.5 Flash', 'Fast and efficient', 'gemini', '1.5-flash',
     '["text", "vision", "audio", "code"]', 1048576, 8192, true, true, true, true,
     '{"input_cost_per_1k": 0.000075, "output_cost_per_1k": 0.0003}',
     '["general", "fast_responses", "cost_optimization"]', 0.80, 0.90, 0.95, true),
    
    -- Groq Models
    (gen_random_uuid(), groq_provider_id, 'llama-3.1-70b-versatile', 'Llama 3.1 70B', 'High-performance open model', 'llama', '3.1-70b',
     '["text", "reasoning", "coding"]', 131072, 8000, true, false, false, true,
     '{"input_cost_per_1k": 0.00059, "output_cost_per_1k": 0.00079}',
     '["coding", "reasoning", "cost_optimization"]', 0.85, 0.98, 0.90, true),
    
    (gen_random_uuid(), groq_provider_id, 'llama-3.1-8b-instant', 'Llama 3.1 8B', 'Ultra-fast responses', 'llama', '3.1-8b',
     '["text", "reasoning"]', 131072, 8000, true, false, false, true,
     '{"input_cost_per_1k": 0.00005, "output_cost_per_1k": 0.00008}',
     '["simple_tasks", "speed_optimization", "cost_optimization"]', 0.75, 0.99, 0.98, true);
    
    -- =============================================
    -- DYNAMIC PLAN CONFIGURATIONS
    -- =============================================
    
    INSERT INTO public.plan_configurations (id, plan_type, display_name, description, daily_cost_limit, monthly_cost_limit, daily_request_limit, monthly_request_limit, daily_token_limit, monthly_token_limit, max_file_size_mb, max_concurrent_workflows, max_team_members, max_workspaces, storage_gb, features_enabled, advanced_features_enabled, is_active, sort_order, is_featured) VALUES
    
    (gen_random_uuid(), 'free', 'Free', 'Perfect for trying out the platform', 2.00, 10.00, 50, 1000, 25000, 500000, 10, 1, 1, 1, 1,
     '{"basic_ai": true, "document_upload": true, "memory_system": true, "workflows": false}',
     '{"priority_support": false, "advanced_models": false, "team_features": false}',
     true, 1, false),
    
    (gen_random_uuid(), 'starter', 'Starter', 'Great for individuals and small projects', 10.00, 200.00, 200, 5000, 100000, 2000000, 50, 3, 1, 3, 10,
     '{"basic_ai": true, "document_upload": true, "memory_system": true, "workflows": true, "api_access": true}',
     '{"priority_support": false, "advanced_models": true, "team_features": false}',
     true, 2, true),
    
    (gen_random_uuid(), 'pro', 'Pro', 'Ideal for professionals and growing teams', 50.00, 1000.00, 1000, 25000, 500000, 10000000, 200, 10, 5, 10, 100,
     '{"basic_ai": true, "document_upload": true, "memory_system": true, "workflows": true, "api_access": true, "team_features": true}',
     '{"priority_support": true, "advanced_models": true, "team_features": true, "analytics": true}',
     true, 3, true),
    
    (gen_random_uuid(), 'enterprise', 'Enterprise', 'Scalable solution for organizations', 200.00, 5000.00, 5000, 150000, 2500000, 50000000, 1000, 50, 50, 100, 1000,
     '{"basic_ai": true, "document_upload": true, "memory_system": true, "workflows": true, "api_access": true, "team_features": true, "sso": true}',
     '{"priority_support": true, "advanced_models": true, "team_features": true, "analytics": true, "custom_models": true, "dedicated_support": true}',
     true, 4, false);
    
    -- =============================================
    -- DYNAMIC SUBSCRIPTION PLANS
    -- =============================================
    
    INSERT INTO public.subscription_plans (id, stripe_price_id, stripe_product_id, plan_name, plan_description, plan_type, billing_interval, unit_amount, currency, features, feature_limits, is_active, is_featured, target_audience, trial_period_days, sort_order) VALUES
    
    (gen_random_uuid(), 'price_free_plan', 'prod_free', 'Free Plan', 'Try our platform with basic features', 'free', 'month', 0, 'usd',
     '{"ai_chat": true, "document_upload": true, "basic_workflows": true, "community_support": true}',
     '{"daily_cost_limit": 2.00, "monthly_cost_limit": 10.00, "daily_requests": 50, "monthly_requests": 1000, "storage_gb": 1, "file_size_mb": 10}',
     true, false, '["individual", "student", "trial"]', 0, 1),
    
    (gen_random_uuid(), 'price_starter_monthly', 'prod_starter', 'Starter Plan', 'Perfect for individuals', 'starter', 'month', 1900, 'usd',
     '{"ai_chat": true, "document_upload": true, "workflows": true, "api_access": true, "email_support": true}',
     '{"daily_cost_limit": 10.00, "monthly_cost_limit": 200.00, "daily_requests": 200, "monthly_requests": 5000, "storage_gb": 10, "file_size_mb": 50}',
     true, true, '["individual", "freelancer", "small_business"]', 14, 2),
    
    (gen_random_uuid(), 'price_pro_monthly', 'prod_pro', 'Pro Plan', 'For professionals and teams', 'pro', 'month', 4900, 'usd',
     '{"ai_chat": true, "document_upload": true, "workflows": true, "api_access": true, "team_features": true, "priority_support": true, "analytics": true}',
     '{"daily_cost_limit": 50.00, "monthly_cost_limit": 1000.00, "daily_requests": 1000, "monthly_requests": 25000, "storage_gb": 100, "file_size_mb": 200}',
     true, true, '["business", "team", "professional"]', 14, 3),
    
    (gen_random_uuid(), 'price_enterprise_monthly', 'prod_enterprise', 'Enterprise Plan', 'Scalable for organizations', 'enterprise', 'month', 19900, 'usd',
     '{"ai_chat": true, "document_upload": true, "workflows": true, "api_access": true, "team_features": true, "priority_support": true, "analytics": true, "sso": true, "custom_models": true}',
     '{"daily_cost_limit": 200.00, "monthly_cost_limit": 5000.00, "daily_requests": 5000, "monthly_requests": 150000, "storage_gb": 1000, "file_size_mb": 1000}',
     true, false, '["enterprise", "organization"]', 30, 4);
    
    -- =============================================
    -- INTELLIGENT DEFAULT SYSTEM SETTINGS
    -- =============================================
    
    -- Create system configuration table for global defaults
    CREATE TABLE IF NOT EXISTS public.system_configuration (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        config_key TEXT UNIQUE NOT NULL,
        config_value JSONB NOT NULL,
        config_type TEXT NOT NULL, -- user_defaults, system_limits, feature_flags, pricing
        description TEXT,
        is_user_configurable BOOLEAN DEFAULT false,
        requires_restart BOOLEAN DEFAULT false,
        last_updated_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL
    );
    
    -- Insert intelligent system defaults
    INSERT INTO public.system_configuration (config_key, config_value, config_type, description, is_user_configurable) VALUES
    
    -- User Experience Defaults
    ('default_user_preferences', '{
        "theme": "system",
        "ui_density": "comfortable", 
        "animations_enabled": true,
        "keyboard_shortcuts_enabled": true,
        "auto_save_enabled": true,
        "sidebar_collapsed": false
    }', 'user_defaults', 'Default UI preferences for new users', true),
    
    -- AI & Processing Defaults
    ('default_ai_preferences', '{
        "model_selection_strategy": "auto",
        "auto_fallback_enabled": true,
        "cost_optimization_enabled": false,
        "auto_retry_enabled": true,
        "max_retry_attempts": 3,
        "workflow_timeout_minutes": 60
    }', 'user_defaults', 'Default AI processing preferences', true),
    
    -- Document Processing Defaults  
    ('default_document_preferences', '{
        "chunk_size": 1000,
        "chunk_overlap_percentage": 0.20,
        "chunk_strategy": "semantic",
        "auto_extract_entities": true,
        "auto_generate_summaries": true,
        "auto_generate_tags": true,
        "quality_threshold": 0.70
    }', 'user_defaults', 'Default document processing settings', true),
    
    -- Privacy & Security Defaults
    ('default_privacy_settings', '{
        "data_sharing_consent": false,
        "analytics_consent": true,
        "marketing_consent": false,
        "session_timeout_minutes": 480,
        "require_2fa": false
    }', 'user_defaults', 'Default privacy and security settings', true),
    
    -- Alert & Notification Defaults
    ('default_alert_settings', '{
        "email_alerts": true,
        "push_alerts": true,
        "webhook_alerts": false,
        "alert_frequency": "smart",
        "cost_alert_thresholds": [0.50, 0.80, 0.95],
        "usage_alert_thresholds": [0.75, 0.90]
    }', 'user_defaults', 'Default alert and notification settings', true),
    
    -- System Limits (Non-configurable)
    ('system_limits', '{
        "max_file_size_absolute_mb": 10000,
        "max_concurrent_workflows_absolute": 50,
        "max_api_key_age_days": 365,
        "max_session_duration_hours": 24,
        "max_retry_attempts_absolute": 10,
        "rate_limit_window_seconds": 60
    }', 'system_limits', 'Absolute system limits that cannot be exceeded', false),
    
    -- Feature Flags
    ('feature_flags', '{
        "ai_models_auto_update": true,
        "dynamic_pricing_enabled": true,
        "usage_based_billing": true,
        "smart_recommendations": true,
        "beta_features_enabled": false,
        "advanced_analytics": true,
        "team_collaboration": true
    }', 'feature_flags', 'Global feature flags', false),
    
    -- Intelligent Recommendations
    ('ai_recommendation_settings', '{
        "model_recommendation_enabled": true,
        "cost_optimization_suggestions": true,
        "workflow_optimization": true,
        "usage_pattern_analysis": true,
        "predictive_scaling": true,
        "learning_mode_enabled": true
    }', 'user_defaults', 'AI-powered recommendation settings', true);
    
    -- Create triggers for system configuration
    CREATE TRIGGER update_system_configuration_updated_at
        BEFORE UPDATE ON public.system_configuration
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    
    result_text := result_text || 'AI Providers: ' || (SELECT COUNT(*) FROM public.ai_providers) || E'\n';
    result_text := result_text || 'AI Models: ' || (SELECT COUNT(*) FROM public.ai_models) || E'\n';
    result_text := result_text || 'Plan Configurations: ' || (SELECT COUNT(*) FROM public.plan_configurations) || E'\n';
    result_text := result_text || 'Subscription Plans: ' || (SELECT COUNT(*) FROM public.subscription_plans) || E'\n';
    result_text := result_text || 'System Configurations: ' || (SELECT COUNT(*) FROM public.system_configuration) || E'\n';
    
    RETURN result_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the seed data creation
SELECT public.create_intelligent_seed_data() as seed_data_summary;

-- =============================================
-- HELPER FUNCTIONS FOR PRODUCTION DEPLOYMENT
-- =============================================

-- Function to validate system configuration
CREATE OR REPLACE FUNCTION public.validate_system_configuration()
RETURNS TABLE(check_name TEXT, status TEXT, details TEXT) AS $$
BEGIN
    -- Check AI providers
    RETURN QUERY
    SELECT 'AI Providers'::TEXT, 
           CASE WHEN COUNT(*) >= 3 THEN 'PASS' ELSE 'FAIL' END,
           'Found ' || COUNT(*) || ' AI providers (minimum 3 required)'
    FROM public.ai_providers WHERE is_active = true;
    
    -- Check subscription plans
    RETURN QUERY  
    SELECT 'Subscription Plans'::TEXT,
           CASE WHEN COUNT(*) >= 3 THEN 'PASS' ELSE 'FAIL' END,
           'Found ' || COUNT(*) || ' subscription plans (minimum 3 required)'
    FROM public.subscription_plans WHERE is_active = true;
    
    -- Check plan configurations
    RETURN QUERY
    SELECT 'Plan Configurations'::TEXT,
           CASE WHEN COUNT(*) >= 3 THEN 'PASS' ELSE 'FAIL' END,
           'Found ' || COUNT(*) || ' plan configurations (minimum 3 required)'
    FROM public.plan_configurations WHERE is_active = true;
    
    -- Check system configuration
    RETURN QUERY
    SELECT 'System Configuration'::TEXT,
           CASE WHEN COUNT(*) >= 5 THEN 'PASS' ELSE 'FAIL' END,
           'Found ' || COUNT(*) || ' system configurations (minimum 5 required)'
    FROM public.system_configuration;
    
    -- Check indexes
    RETURN QUERY
    SELECT 'Database Indexes'::TEXT,
           CASE WHEN COUNT(*) >= 50 THEN 'PASS' ELSE 'WARN' END,
           'Found ' || COUNT(*) || ' indexes (recommended 50+)'
    FROM pg_indexes WHERE schemaname = 'public';
    
    -- Check functions
    RETURN QUERY
    SELECT 'Database Functions'::TEXT,
           CASE WHEN COUNT(*) >= 15 THEN 'PASS' ELSE 'WARN' END,
           'Found ' || COUNT(*) || ' functions (recommended 15+)'
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to optimize system for production
CREATE OR REPLACE FUNCTION public.optimize_for_production()
RETURNS TEXT AS $$
DECLARE
    result_text TEXT := '';
BEGIN
    -- Update statistics for query optimization
    ANALYZE;
    result_text := result_text || 'Database statistics updated' || E'\n';
    
    -- Set optimal configuration for production
    PERFORM set_config('work_mem', '256MB', false);
    PERFORM set_config('shared_buffers', '512MB', false); 
    PERFORM set_config('effective_cache_size', '2GB', false);
    result_text := result_text || 'Memory settings optimized' || E'\n';
    
    -- Enable logging for monitoring
    PERFORM set_config('log_statement', 'mod', false);
    PERFORM set_config('log_min_duration_statement', '1000', false);
    result_text := result_text || 'Logging configured for production' || E'\n';
    
    RETURN result_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- FINAL PRODUCTION VALIDATION
-- =============================================

-- Run system validation
SELECT * FROM public.validate_system_configuration();

-- Display summary
SELECT 
    'Production-Ready Database Initialized!' as status,
    (SELECT COUNT(*) FROM public.ai_providers WHERE is_active = true) as active_providers,
    (SELECT COUNT(*) FROM public.ai_models WHERE is_active = true) as available_models,
    (SELECT COUNT(*) FROM public.subscription_plans WHERE is_active = true) as subscription_plans,
    (SELECT COUNT(*) FROM public.plan_configurations WHERE is_active = true) as plan_configurations,
    (SELECT COUNT(*) FROM public.system_configuration) as system_configs;

SELECT 'Intelligent seed data and production optimization completed!' as final_status; 