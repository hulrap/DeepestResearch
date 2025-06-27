-- =============================================
-- MEMORY & CONTEXT SYSTEM
-- Dynamic AI memory, document processing, and knowledge management
-- =============================================

-- User memory storage with dynamic configuration
CREATE TABLE public.user_memory (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    memory_type TEXT NOT NULL,
    content TEXT NOT NULL,
    
    -- Dynamic embedding configuration (no hardcoded dimensions)
    embedding VECTOR, -- Dimension set dynamically based on user's embedding model choice
    embedding_model TEXT, -- Track which model generated this embedding
    embedding_dimensions INTEGER, -- Track the actual dimensions used
    
    -- Memory metadata with intelligent scoring
    importance_score DECIMAL(3,2) DEFAULT 0.5,
    confidence_score DECIMAL(3,2) DEFAULT 1.0,
    access_frequency INTEGER DEFAULT 0,
    recency_score DECIMAL(3,2), -- Computed based on age and access patterns
    relevance_score DECIMAL(3,2), -- Computed based on user's current context
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now(),
    
    -- Dynamic categorization and tagging
    context_tags TEXT[] DEFAULT '{}',
    category TEXT,
    subcategory TEXT,
    auto_generated_tags TEXT[], -- AI-generated tags
    user_defined_tags TEXT[], -- User-defined tags
    
    -- Source tracking and attribution
    source_type TEXT,
    source_session_id UUID REFERENCES public.workflow_sessions(id),
    source_document_id UUID, -- Will reference user_documents table
    source_url TEXT,
    source_metadata JSONB DEFAULT '{}',
    
    -- Memory lifecycle and management
    expires_at TIMESTAMP WITH TIME ZONE,
    is_archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMP WITH TIME ZONE,
    archived_reason TEXT,
    auto_archive_enabled BOOLEAN DEFAULT true,
    
    -- Quality and validation
    is_validated BOOLEAN DEFAULT false,
    validation_source TEXT,
    validation_date TIMESTAMP WITH TIME ZONE,
    validation_confidence DECIMAL(3,2),
    
    -- Memory relationships and connections
    related_memories UUID[],
    parent_memory_id UUID REFERENCES public.user_memory(id),
    memory_cluster_id UUID, -- For grouping related memories
    
    -- Privacy and sharing
    is_private BOOLEAN DEFAULT true,
    sharing_level TEXT DEFAULT 'private', -- private, workspace, public
    shared_with_users UUID[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_memory_type CHECK (memory_type IN ('conversation', 'preference', 'fact', 'pattern', 'skill', 'insight', 'reminder', 'note', 'learning')),
    CONSTRAINT valid_importance CHECK (importance_score >= 0 AND importance_score <= 1),
    CONSTRAINT valid_confidence CHECK (confidence_score >= 0 AND confidence_score <= 1),
    CONSTRAINT valid_access_frequency CHECK (access_frequency >= 0),
    CONSTRAINT valid_scores CHECK (
        (recency_score IS NULL OR (recency_score >= 0 AND recency_score <= 1)) AND
        (relevance_score IS NULL OR (relevance_score >= 0 AND relevance_score <= 1)) AND
        (validation_confidence IS NULL OR (validation_confidence >= 0 AND validation_confidence <= 1))
    ),
    CONSTRAINT valid_source_type CHECK (source_type IN ('workflow', 'chat', 'document', 'manual', 'imported', 'system', 'api', 'web')),
    CONSTRAINT valid_sharing_level CHECK (sharing_level IN ('private', 'team', 'workspace', 'public')),
    CONSTRAINT non_empty_content CHECK (length(trim(content)) > 0),
    CONSTRAINT valid_embedding_dimensions CHECK (embedding_dimensions IS NULL OR embedding_dimensions > 0)
);

-- Dynamic document processing configuration (user-configurable)
CREATE TABLE public.document_processing_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    
    -- Processing limits (from user configuration and plan)
    max_file_size_mb INTEGER, -- Set from user plan and preferences
    max_processing_attempts INTEGER DEFAULT 3,
    processing_timeout_minutes INTEGER, -- From user configuration
    concurrent_processing_limit INTEGER DEFAULT 3,
    
    -- Embedding configuration (user-configurable)
    embedding_provider TEXT, -- From user's AI provider preferences
    embedding_model TEXT, -- From user's model preferences
    embedding_dimensions INTEGER, -- Detected from model or user choice
    embedding_batch_size INTEGER DEFAULT 100,
    
    -- Content processing preferences (user-configurable)
    chunk_size INTEGER, -- From user configuration
    chunk_overlap_percentage DECIMAL(3,2) DEFAULT 0.20,
    chunk_strategy TEXT DEFAULT 'semantic', -- sentence, paragraph, semantic, fixed_size
    
    -- Content limits (from user plan)
    max_documents_per_collection INTEGER,
    max_collections INTEGER,
    max_total_documents INTEGER,
    storage_limit_gb INTEGER, -- From user plan
    
    -- Processing preferences (user-configurable)
    auto_extract_entities BOOLEAN DEFAULT true,
    auto_generate_summary BOOLEAN DEFAULT true,
    auto_detect_language BOOLEAN DEFAULT true,
    auto_generate_tags BOOLEAN DEFAULT true,
    quality_threshold DECIMAL(3,2) DEFAULT 0.70,
    
    -- Advanced processing options
    enable_ocr BOOLEAN DEFAULT true,
    enable_table_extraction BOOLEAN DEFAULT true,
    enable_image_analysis BOOLEAN DEFAULT false, -- Requires vision models
    preserve_formatting BOOLEAN DEFAULT true,
    extract_metadata BOOLEAN DEFAULT true,
    
    -- Processing optimization
    enable_caching BOOLEAN DEFAULT true,
    cache_duration_hours INTEGER DEFAULT 24,
    enable_compression BOOLEAN DEFAULT true,
    enable_deduplication BOOLEAN DEFAULT true,
    
    -- Content analysis settings
    extract_key_phrases BOOLEAN DEFAULT true,
    extract_sentiment BOOLEAN DEFAULT false,
    extract_topics BOOLEAN DEFAULT true,
    generate_embeddings BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_file_size CHECK (max_file_size_mb IS NULL OR (max_file_size_mb > 0 AND max_file_size_mb <= 10000)),
    CONSTRAINT valid_processing_attempts CHECK (max_processing_attempts > 0 AND max_processing_attempts <= 10),
    CONSTRAINT valid_timeout CHECK (processing_timeout_minutes IS NULL OR (processing_timeout_minutes > 0 AND processing_timeout_minutes <= 180)),
    CONSTRAINT valid_concurrent_limit CHECK (concurrent_processing_limit BETWEEN 1 AND 20),
    CONSTRAINT valid_embedding_dims CHECK (embedding_dimensions IS NULL OR embedding_dimensions > 0),
    CONSTRAINT valid_batch_size CHECK (embedding_batch_size BETWEEN 1 AND 1000),
    CONSTRAINT valid_chunk_settings CHECK (
        (chunk_size IS NULL OR chunk_size > 0) AND 
        chunk_overlap_percentage BETWEEN 0.0 AND 0.5
    ),
    CONSTRAINT valid_chunk_strategy CHECK (chunk_strategy IN ('sentence', 'paragraph', 'semantic', 'fixed_size', 'adaptive')),
    CONSTRAINT valid_limits CHECK (
        (max_documents_per_collection IS NULL OR max_documents_per_collection > 0) AND 
        (max_collections IS NULL OR max_collections > 0) AND
        (max_total_documents IS NULL OR max_total_documents > 0) AND
        (storage_limit_gb IS NULL OR storage_limit_gb > 0)
    ),
    CONSTRAINT valid_quality_threshold CHECK (quality_threshold BETWEEN 0.0 AND 1.0),
    CONSTRAINT valid_cache_duration CHECK (cache_duration_hours BETWEEN 1 AND 8760) -- 1 hour to 1 year
);

-- Enhanced document storage with dynamic processing
CREATE TABLE public.user_documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- File information
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    file_hash TEXT,
    storage_path TEXT,
    storage_provider TEXT DEFAULT 'supabase', -- supabase, s3, gcs, azure
    
    -- Processing status and configuration
    processing_status TEXT DEFAULT 'pending',
    processing_config_snapshot JSONB, -- Snapshot of config used for processing
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    processing_error TEXT,
    processing_attempts INTEGER DEFAULT 0,
    max_processing_attempts INTEGER, -- From user config at time of upload
    
    -- Extracted content and analysis
    extracted_text TEXT,
    extracted_metadata JSONB DEFAULT '{}',
    text_embeddings VECTOR, -- Dynamically sized based on user's embedding model
    embedding_model_used TEXT, -- Track which model was used
    
    -- Content analysis results
    word_count INTEGER,
    character_count INTEGER,
    page_count INTEGER,
    language TEXT DEFAULT 'en',
    detected_topics TEXT[],
    content_type TEXT,
    content_structure JSONB DEFAULT '{}', -- Document structure analysis
    
    -- AI-generated content
    ai_summary TEXT,
    ai_key_points TEXT[],
    ai_entities JSONB DEFAULT '{}',
    ai_tags TEXT[],
    ai_sentiment JSONB DEFAULT '{}',
    
    -- Citations and references
    citations JSONB DEFAULT '{}',
    references JSONB DEFAULT '{}',
    external_links TEXT[],
    
    -- Access and sharing
    is_public BOOLEAN DEFAULT false,
    access_level TEXT DEFAULT 'private',
    shared_with_users UUID[],
    sharing_permissions JSONB DEFAULT '{}',
    
    -- Organization and categorization
    user_tags TEXT[] DEFAULT '{}',
    category TEXT,
    collection_id UUID,
    folder_path TEXT,
    
    -- Quality and relevance metrics
    relevance_score DECIMAL(3,2),
    quality_score DECIMAL(3,2),
    readability_score DECIMAL(3,2),
    usefulness_score DECIMAL(3,2), -- User-provided rating
    
    -- Document lifecycle
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    access_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    auto_delete_after_days INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_file_type CHECK (file_type IN ('pdf', 'docx', 'txt', 'md', 'html', 'rtf', 'csv', 'xlsx', 'pptx', 'image', 'url', 'epub')),
    CONSTRAINT valid_processing_status CHECK (processing_status IN ('pending', 'queued', 'processing', 'completed', 'failed', 'cancelled', 'archived')),
    CONSTRAINT valid_file_size CHECK (file_size IS NULL OR file_size > 0),
    CONSTRAINT valid_processing_attempts CHECK (processing_attempts >= 0),
    CONSTRAINT valid_access_level CHECK (access_level IN ('private', 'shared', 'team', 'workspace', 'public')),
    CONSTRAINT valid_storage_provider CHECK (storage_provider IN ('supabase', 's3', 'gcs', 'azure', 'local')),
    CONSTRAINT valid_scores CHECK (
        (relevance_score IS NULL OR (relevance_score >= 0 AND relevance_score <= 1)) AND
        (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 1)) AND
        (readability_score IS NULL OR (readability_score >= 0 AND readability_score <= 1)) AND
        (usefulness_score IS NULL OR (usefulness_score >= 0 AND usefulness_score <= 1))
    ),
    CONSTRAINT valid_counts CHECK (
        (word_count IS NULL OR word_count >= 0) AND
        (character_count IS NULL OR character_count >= 0) AND
        (page_count IS NULL OR page_count >= 0) AND
        (access_count >= 0) AND
        (download_count >= 0)
    ),
    CONSTRAINT valid_auto_delete CHECK (auto_delete_after_days IS NULL OR auto_delete_after_days > 0)
);

-- Dynamic document collections with user-configurable organization
CREATE TABLE public.document_collections (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6B7280',
    icon TEXT DEFAULT 'folder',
    
    -- Collection configuration (user-configurable)
    collection_type TEXT DEFAULT 'manual', -- manual, smart, auto_generated
    smart_rules JSONB DEFAULT '{}',
    auto_update_enabled BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    
    -- Access and sharing
    is_shared BOOLEAN DEFAULT false,
    sharing_level TEXT DEFAULT 'private',
    shared_with_users UUID[],
    sharing_permissions JSONB DEFAULT '{}',
    
    -- Collection limits (from user plan)
    max_documents INTEGER, -- From user configuration
    max_size_gb DECIMAL(8,3), -- From user configuration
    
    -- Statistics and metrics
    document_count INTEGER DEFAULT 0,
    total_size_bytes BIGINT DEFAULT 0,
    last_document_added_at TIMESTAMP WITH TIME ZONE,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    access_count INTEGER DEFAULT 0,
    
    -- Collection intelligence
    auto_generated_tags TEXT[],
    dominant_topics TEXT[],
    avg_quality_score DECIMAL(3,2),
    content_summary TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    CONSTRAINT valid_collection_name CHECK (length(trim(name)) > 0),
    CONSTRAINT valid_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT valid_collection_type CHECK (collection_type IN ('manual', 'smart', 'auto_generated', 'template')),
    CONSTRAINT valid_sharing_level CHECK (sharing_level IN ('private', 'team', 'workspace', 'public')),
    CONSTRAINT valid_limits CHECK (
        (max_documents IS NULL OR max_documents > 0) AND
        (max_size_gb IS NULL OR max_size_gb > 0)
    ),
    CONSTRAINT valid_counts CHECK (
        document_count >= 0 AND 
        total_size_bytes >= 0 AND 
        access_count >= 0
    ),
    CONSTRAINT valid_avg_quality CHECK (avg_quality_score IS NULL OR (avg_quality_score >= 0 AND avg_quality_score <= 1))
);

-- Dynamic document chunks with intelligent processing
CREATE TABLE public.document_chunks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    document_id UUID REFERENCES public.user_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    
    -- Chunk content and metadata
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'text',
    word_count INTEGER DEFAULT 0,
    character_count INTEGER DEFAULT 0,
    
    -- Chunk positioning and context
    start_position INTEGER,
    end_position INTEGER,
    heading TEXT,
    page_number INTEGER,
    section_path TEXT[],
    context_before TEXT,
    context_after TEXT,
    
    -- Dynamic embeddings (sized based on user's model choice)
    embedding VECTOR,
    embedding_model TEXT,
    embedding_quality_score DECIMAL(3,2),
    
    -- Chunk intelligence
    keywords TEXT[],
    entities JSONB DEFAULT '{}',
    sentiment JSONB DEFAULT '{}',
    topics TEXT[],
    
    -- Chunk relationships
    parent_chunk_id UUID REFERENCES public.document_chunks(id),
    child_chunks UUID[],
    related_chunks UUID[],
    
    -- Quality and relevance
    content_quality_score DECIMAL(3,2),
    information_density_score DECIMAL(3,2),
    uniqueness_score DECIMAL(3,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    UNIQUE(document_id, chunk_index),
    CONSTRAINT valid_chunk_index CHECK (chunk_index >= 0),
    CONSTRAINT valid_content_type CHECK (content_type IN ('text', 'table', 'image_caption', 'header', 'footer', 'code', 'list', 'quote')),
    CONSTRAINT valid_counts CHECK (word_count >= 0 AND character_count >= 0),
    CONSTRAINT valid_positions CHECK (
        (start_position IS NULL OR start_position >= 0) AND
        (end_position IS NULL OR end_position >= 0) AND
        (start_position IS NULL OR end_position IS NULL OR end_position >= start_position)
    ),
    CONSTRAINT valid_quality_scores CHECK (
        (content_quality_score IS NULL OR (content_quality_score >= 0 AND content_quality_score <= 1)) AND
        (information_density_score IS NULL OR (information_density_score >= 0 AND information_density_score <= 1)) AND
        (uniqueness_score IS NULL OR (uniqueness_score >= 0 AND uniqueness_score <= 1)) AND
        (embedding_quality_score IS NULL OR (embedding_quality_score >= 0 AND embedding_quality_score <= 1))
    ),
    CONSTRAINT non_empty_content CHECK (length(trim(content)) > 0)
);

-- Knowledge graph with dynamic entity recognition
CREATE TABLE public.knowledge_entities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Entity information
    name TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    description TEXT,
    aliases TEXT[] DEFAULT '{}',
    canonical_name TEXT,
    
    -- Entity metadata and intelligence
    confidence_score DECIMAL(3,2) DEFAULT 1.0,
    source_count INTEGER DEFAULT 0,
    mention_count INTEGER DEFAULT 0,
    last_mentioned_at TIMESTAMP WITH TIME ZONE,
    importance_score DECIMAL(3,2),
    
    -- Entity attributes and properties
    attributes JSONB DEFAULT '{}',
    properties JSONB DEFAULT '{}',
    categories TEXT[],
    
    -- External references and linking
    external_ids JSONB DEFAULT '{}',
    wiki_url TEXT,
    web_references TEXT[],
    
    -- Entity relationships metadata
    relationship_count INTEGER DEFAULT 0,
    centrality_score DECIMAL(3,2), -- How central this entity is in the knowledge graph
    
    -- Entity lifecycle
    is_validated BOOLEAN DEFAULT false,
    validation_source TEXT,
    auto_generated BOOLEAN DEFAULT false,
    user_verified BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    UNIQUE(user_id, canonical_name, entity_type),
    CONSTRAINT valid_entity_type CHECK (entity_type IN ('person', 'organization', 'concept', 'location', 'event', 'skill', 'tool', 'method', 'product', 'technology')),
    CONSTRAINT valid_confidence CHECK (confidence_score >= 0 AND confidence_score <= 1),
    CONSTRAINT valid_counts CHECK (
        source_count >= 0 AND 
        mention_count >= 0 AND 
        relationship_count >= 0
    ),
    CONSTRAINT valid_scores CHECK (
        (importance_score IS NULL OR (importance_score >= 0 AND importance_score <= 1)) AND
        (centrality_score IS NULL OR (centrality_score >= 0 AND centrality_score <= 1))
    ),
    CONSTRAINT non_empty_name CHECK (length(trim(name)) > 0)
);

-- Entity relationships with weighted connections
CREATE TABLE public.entity_relationships (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    entity_a_id UUID REFERENCES public.knowledge_entities(id) ON DELETE CASCADE,
    entity_b_id UUID REFERENCES public.knowledge_entities(id) ON DELETE CASCADE,
    
    -- Relationship information
    relationship_type TEXT NOT NULL,
    relationship_label TEXT, -- Human-readable label
    strength DECIMAL(3,2) DEFAULT 0.5,
    confidence DECIMAL(3,2) DEFAULT 1.0,
    context TEXT,
    
    -- Relationship directionality and properties
    is_bidirectional BOOLEAN DEFAULT true,
    direction TEXT DEFAULT 'both', -- a_to_b, b_to_a, both
    properties JSONB DEFAULT '{}',
    
    -- Source tracking and evidence
    source_documents UUID[],
    source_memories UUID[],
    source_conversations UUID[],
    evidence_count INTEGER DEFAULT 0,
    evidence_quality DECIMAL(3,2),
    
    -- Relationship lifecycle
    first_observed_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now(),
    last_observed_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now(),
    observation_count INTEGER DEFAULT 1,
    
    -- Validation and verification
    is_validated BOOLEAN DEFAULT false,
    validation_method TEXT,
    user_confirmed BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    UNIQUE(entity_a_id, entity_b_id, relationship_type),
    CONSTRAINT valid_relationship_type CHECK (relationship_type IN ('works_at', 'located_in', 'related_to', 'uses', 'mentions', 'collaborates_with', 'depends_on', 'part_of', 'similar_to')),
    CONSTRAINT valid_direction CHECK (direction IN ('a_to_b', 'b_to_a', 'both')),
    CONSTRAINT valid_strength CHECK (strength >= 0 AND strength <= 1),
    CONSTRAINT valid_confidence CHECK (confidence >= 0 AND confidence <= 1),
    CONSTRAINT valid_evidence CHECK (
        evidence_count >= 0 AND
        (evidence_quality IS NULL OR (evidence_quality >= 0 AND evidence_quality <= 1))
    ),
    CONSTRAINT valid_observation_count CHECK (observation_count > 0),
    CONSTRAINT different_entities CHECK (entity_a_id != entity_b_id)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Memory indexes
CREATE INDEX idx_user_memory_user_type ON public.user_memory(user_id, memory_type, created_at DESC);
CREATE INDEX idx_user_memory_importance ON public.user_memory(importance_score DESC, last_accessed_at DESC);
CREATE INDEX idx_user_memory_embedding ON public.user_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 1000);
CREATE INDEX idx_user_memory_tags ON public.user_memory USING GIN(context_tags);
CREATE INDEX idx_user_memory_category ON public.user_memory(category, subcategory);
CREATE INDEX idx_user_memory_source ON public.user_memory(source_type, source_session_id) WHERE source_session_id IS NOT NULL;
CREATE INDEX idx_user_memory_active ON public.user_memory(user_id, created_at DESC) WHERE is_archived = false AND (expires_at IS NULL OR expires_at > now());
CREATE INDEX idx_user_memory_sharing ON public.user_memory(sharing_level, is_private) WHERE sharing_level != 'private';
CREATE INDEX idx_user_memory_cluster ON public.user_memory(memory_cluster_id) WHERE memory_cluster_id IS NOT NULL;

-- Document indexes
CREATE INDEX idx_user_documents_user ON public.user_documents(user_id, created_at DESC);
CREATE INDEX idx_user_documents_status ON public.user_documents(processing_status, processing_started_at);
CREATE INDEX idx_user_documents_type ON public.user_documents(file_type, content_type);
CREATE INDEX idx_user_documents_hash ON public.user_documents(file_hash) WHERE file_hash IS NOT NULL;
CREATE INDEX idx_user_documents_embedding ON public.user_documents USING ivfflat (text_embeddings vector_cosine_ops) WITH (lists = 500);
CREATE INDEX idx_user_documents_tags ON public.user_documents USING GIN(user_tags);
CREATE INDEX idx_user_documents_ai_tags ON public.user_documents USING GIN(ai_tags);
CREATE INDEX idx_user_documents_collection ON public.user_documents(collection_id, created_at DESC);
CREATE INDEX idx_user_documents_public ON public.user_documents(is_public, access_level) WHERE is_public = true;
CREATE INDEX idx_user_documents_quality ON public.user_documents(quality_score DESC, relevance_score DESC) WHERE quality_score IS NOT NULL;
CREATE INDEX idx_user_documents_access ON public.user_documents(last_accessed_at DESC, access_count DESC);

-- Document chunks indexes
CREATE INDEX idx_document_chunks_document ON public.document_chunks(document_id, chunk_index);
CREATE INDEX idx_document_chunks_embedding ON public.document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 2000);
CREATE INDEX idx_document_chunks_content_type ON public.document_chunks(content_type, page_number);
CREATE INDEX idx_document_chunks_quality ON public.document_chunks(content_quality_score DESC, information_density_score DESC);

-- Collection indexes
CREATE INDEX idx_document_collections_user ON public.document_collections(user_id, sort_order);
CREATE INDEX idx_document_collections_smart ON public.document_collections(collection_type, auto_update_enabled);
CREATE INDEX idx_document_collections_shared ON public.document_collections(is_shared, sharing_level);

-- Document processing config indexes
CREATE INDEX idx_document_processing_config_user ON public.document_processing_config(user_id);

-- Knowledge entity indexes
CREATE INDEX idx_knowledge_entities_user_type ON public.knowledge_entities(user_id, entity_type);
CREATE INDEX idx_knowledge_entities_name ON public.knowledge_entities(canonical_name, entity_type);
CREATE INDEX idx_knowledge_entities_confidence ON public.knowledge_entities(confidence_score DESC, importance_score DESC);
CREATE INDEX idx_knowledge_entities_mentions ON public.knowledge_entities(mention_count DESC, last_mentioned_at DESC);

-- Entity relationship indexes
CREATE INDEX idx_entity_relationships_entity_a ON public.entity_relationships(entity_a_id, relationship_type);
CREATE INDEX idx_entity_relationships_entity_b ON public.entity_relationships(entity_b_id, relationship_type);
CREATE INDEX idx_entity_relationships_strength ON public.entity_relationships(strength DESC, confidence DESC);
CREATE INDEX idx_entity_relationships_evidence ON public.entity_relationships(evidence_count DESC, evidence_quality DESC);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE TRIGGER update_user_memory_updated_at
    BEFORE UPDATE ON public.user_memory
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_documents_updated_at
    BEFORE UPDATE ON public.user_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_processing_config_updated_at
    BEFORE UPDATE ON public.document_processing_config
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_document_collections_updated_at
    BEFORE UPDATE ON public.document_collections
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_knowledge_entities_updated_at
    BEFORE UPDATE ON public.knowledge_entities
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_entity_relationships_updated_at
    BEFORE UPDATE ON public.entity_relationships
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- DYNAMIC MEMORY AND DOCUMENT FUNCTIONS
-- =============================================

-- Function to create document processing config from user configuration
CREATE OR REPLACE FUNCTION public.create_document_processing_config_from_user_config(user_uuid UUID)
RETURNS UUID AS $$
DECLARE
    config_record RECORD;
    plan_config RECORD;
    config_id UUID;
BEGIN
    -- Get user configuration and plan
    SELECT 
        uc.*,
        p.user_type,
        p.experience_level,
        pc.max_file_size_mb as plan_max_file_size,
        pc.storage_gb as plan_storage_gb
    INTO config_record
    FROM public.user_configuration uc
    JOIN public.profiles p ON p.id = uc.user_id
    LEFT JOIN public.plan_configurations pc ON pc.plan_type = (
        SELECT plan_type FROM public.stripe_subscriptions s 
        WHERE s.user_id = uc.user_id AND s.status = 'active'
        ORDER BY s.created_at DESC LIMIT 1
    )
    WHERE uc.user_id = user_uuid;
    
    -- Create processing config with intelligent defaults
    INSERT INTO public.document_processing_config (
        user_id,
        max_file_size_mb,
        processing_timeout_minutes,
        embedding_provider,
        embedding_model,
        embedding_dimensions,
        chunk_size,
        chunk_overlap_percentage,
        max_documents_per_collection,
        max_collections,
        storage_limit_gb,
        auto_extract_entities,
        auto_generate_summary,
        auto_generate_tags,
        enable_ocr,
        enable_table_extraction,
        enable_image_analysis,
        extract_key_phrases,
        extract_topics
    ) VALUES (
        user_uuid,
        COALESCE(config_record.max_file_size_mb, config_record.plan_max_file_size, 50),
        COALESCE(config_record.workflow_timeout_minutes, 30),
        COALESCE(
            (config_record.preferred_ai_providers::TEXT[])[1],
            'openai'
        ),
        CASE config_record.user_type
            WHEN 'enterprise' THEN 'text-embedding-3-large'
            WHEN 'business' THEN 'text-embedding-3-small'
            ELSE 'text-embedding-3-small'
        END,
        CASE config_record.user_type
            WHEN 'enterprise' THEN 3072
            WHEN 'business' THEN 1536
            ELSE 1536
        END,
        COALESCE(config_record.preferred_chunk_size, 1000),
        config_record.chunk_overlap_percentage,
        CASE config_record.user_type
            WHEN 'enterprise' THEN 10000
            WHEN 'business' THEN 5000
            ELSE 1000
        END,
        CASE config_record.user_type
            WHEN 'enterprise' THEN 1000
            WHEN 'business' THEN 500
            ELSE 100
        END,
        COALESCE(config_record.plan_storage_gb, 5),
        config_record.auto_extract_entities,
        config_record.auto_generate_summaries,
        true, -- auto_generate_tags
        true, -- enable_ocr
        CASE config_record.user_type 
            WHEN 'enterprise' THEN true 
            WHEN 'business' THEN true 
            ELSE false 
        END, -- enable_table_extraction
        CASE config_record.user_type 
            WHEN 'enterprise' THEN true 
            ELSE false 
        END, -- enable_image_analysis
        true, -- extract_key_phrases
        true  -- extract_topics
    ) RETURNING id INTO config_id;
    
    RETURN config_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update memory access frequency and recency
CREATE OR REPLACE FUNCTION public.record_memory_access(memory_id UUID)
RETURNS VOID AS $$
DECLARE
    age_days INTEGER;
    new_recency_score DECIMAL(3,2);
BEGIN
    -- Calculate age in days
    SELECT EXTRACT(days FROM public.utc_now() - created_at)::INTEGER
    INTO age_days
    FROM public.user_memory
    WHERE id = memory_id;
    
    -- Calculate new recency score (exponential decay)
    new_recency_score := GREATEST(0.1, EXP(-age_days / 30.0))::DECIMAL(3,2);
    
    UPDATE public.user_memory
    SET 
        access_frequency = access_frequency + 1,
        last_accessed_at = public.utc_now(),
        recency_score = new_recency_score,
        updated_at = public.utc_now()
    WHERE id = memory_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to find similar memories using dynamic embeddings
CREATE OR REPLACE FUNCTION public.find_similar_memories(
    user_uuid UUID,
    query_embedding VECTOR,
    similarity_threshold DECIMAL DEFAULT 0.8,
    max_results INTEGER DEFAULT 10,
    memory_types TEXT[] DEFAULT NULL
)
RETURNS TABLE(
    memory_id UUID,
    content TEXT,
    memory_type TEXT,
    similarity_score DECIMAL,
    importance_score DECIMAL,
    recency_score DECIMAL,
    combined_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.content,
        m.memory_type,
        (1 - (m.embedding <=> query_embedding))::DECIMAL(5,4) as similarity,
        m.importance_score,
        COALESCE(m.recency_score, 0.5),
        (
            (1 - (m.embedding <=> query_embedding)) * 0.4 +
            m.importance_score * 0.3 +
            COALESCE(m.recency_score, 0.5) * 0.2 +
            (m.access_frequency::DECIMAL / 100.0) * 0.1
        )::DECIMAL(5,4) as combined
    FROM public.user_memory m
    WHERE m.user_id = user_uuid
    AND m.is_archived = false
    AND (m.expires_at IS NULL OR m.expires_at > public.utc_now())
    AND m.embedding IS NOT NULL
    AND (memory_types IS NULL OR m.memory_type = ANY(memory_types))
    AND (1 - (m.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY combined DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update collection statistics intelligently
CREATE OR REPLACE FUNCTION public.update_collection_stats()
RETURNS TRIGGER AS $$
DECLARE
    collection_uuid UUID;
    stats_record RECORD;
BEGIN
    -- Determine which collection to update
    collection_uuid := COALESCE(NEW.collection_id, OLD.collection_id);
    
    IF collection_uuid IS NOT NULL THEN
        -- Calculate comprehensive statistics
        SELECT 
            COUNT(*) as doc_count,
            COALESCE(SUM(file_size), 0) as total_size,
            AVG(quality_score) as avg_quality,
            array_agg(DISTINCT ai_tags[1:3]) FILTER (WHERE ai_tags IS NOT NULL) as dominant_tags,
            MAX(created_at) as last_added
        INTO stats_record
        FROM public.user_documents 
        WHERE collection_id = collection_uuid;
        
        UPDATE public.document_collections
        SET 
            document_count = stats_record.doc_count,
            total_size_bytes = stats_record.total_size,
            avg_quality_score = stats_record.avg_quality,
            auto_generated_tags = stats_record.dominant_tags[1:10],
            last_document_added_at = CASE 
                WHEN TG_OP = 'INSERT' THEN public.utc_now()
                ELSE COALESCE(stats_record.last_added, last_document_added_at)
            END,
            updated_at = public.utc_now()
        WHERE id = collection_uuid;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for collection statistics
CREATE TRIGGER update_collection_stats_on_insert
    AFTER INSERT ON public.user_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_collection_stats();

CREATE TRIGGER update_collection_stats_on_update
    AFTER UPDATE ON public.user_documents
    FOR EACH ROW
    WHEN (OLD.collection_id IS DISTINCT FROM NEW.collection_id)
    EXECUTE FUNCTION public.update_collection_stats();

CREATE TRIGGER update_collection_stats_on_delete
    AFTER DELETE ON public.user_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_collection_stats();

-- Function to cleanup expired memories with intelligent archiving
CREATE OR REPLACE FUNCTION public.cleanup_expired_memories()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
    archived_count INTEGER;
    user_record RECORD;
    retention_days INTEGER;
BEGIN
    archived_count := 0;
    
    -- Process each user based on their retention settings
    FOR user_record IN 
        SELECT uc.user_id, uc.conversation_retention_days, uc.document_retention_days
        FROM public.user_configuration uc
    LOOP
        -- Archive expired memories based on user's retention settings
        UPDATE public.user_memory
        SET 
            is_archived = true,
            archived_at = public.utc_now(),
            archived_reason = 'retention_policy_expired',
            updated_at = public.utc_now()
        WHERE user_id = user_record.user_id
        AND is_archived = false
        AND (
            (memory_type = 'conversation' AND created_at < public.utc_now() - (user_record.conversation_retention_days || ' days')::INTERVAL)
            OR (expires_at IS NOT NULL AND expires_at <= public.utc_now())
        );
        
        GET DIAGNOSTICS archived_count = archived_count + ROW_COUNT;
    END LOOP;
    
    -- Actually delete memories that have been archived for more than 30 days
    DELETE FROM public.user_memory
    WHERE is_archived = true 
    AND archived_at < public.utc_now() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN archived_count + deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to optimize document processing based on user patterns
CREATE OR REPLACE FUNCTION public.optimize_document_processing_config(user_uuid UUID)
RETURNS VOID AS $$
DECLARE
    usage_stats RECORD;
    config_updates JSONB := '{}';
BEGIN
    -- Analyze user's document processing patterns
    SELECT 
        AVG(file_size) as avg_file_size,
        AVG(processing_time_minutes) as avg_processing_time,
        COUNT(*) as total_documents,
        AVG(word_count) as avg_word_count
    INTO usage_stats
    FROM public.user_documents ud
    JOIN public.api_usage_logs aul ON aul.user_id = ud.user_id
    WHERE ud.user_id = user_uuid
    AND ud.created_at > public.utc_now() - INTERVAL '30 days'
    AND ud.processing_status = 'completed';
    
    -- Update configuration based on usage patterns
    IF usage_stats.avg_file_size > 0 THEN
        UPDATE public.document_processing_config
        SET 
            -- Optimize chunk size based on average document size
            chunk_size = CASE 
                WHEN usage_stats.avg_word_count > 10000 THEN 1500
                WHEN usage_stats.avg_word_count > 5000 THEN 1000
                ELSE 800
            END,
            -- Optimize processing timeout based on historical data
            processing_timeout_minutes = GREATEST(30, (usage_stats.avg_processing_time * 1.5)::INTEGER),
            -- Enable advanced features for power users
            enable_table_extraction = CASE 
                WHEN usage_stats.total_documents > 50 THEN true
                ELSE enable_table_extraction
            END,
            updated_at = public.utc_now()
        WHERE user_id = user_uuid;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create document processing config after user configuration
CREATE OR REPLACE FUNCTION public.create_doc_config_after_user_config()
RETURNS TRIGGER AS $$
BEGIN
    -- Create document processing configuration
    PERFORM public.create_document_processing_config_from_user_config(NEW.user_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_doc_config_trigger
    AFTER INSERT ON public.user_configuration
    FOR EACH ROW
    EXECUTE FUNCTION public.create_doc_config_after_user_config();

-- Add foreign key constraint for document collections
ALTER TABLE public.user_documents
ADD CONSTRAINT fk_user_documents_collection
FOREIGN KEY (collection_id) REFERENCES public.document_collections(id) ON DELETE SET NULL;

-- Add foreign key constraint for memory source documents
ALTER TABLE public.user_memory
ADD CONSTRAINT fk_user_memory_source_document
FOREIGN KEY (source_document_id) REFERENCES public.user_documents(id) ON DELETE SET NULL;

SELECT 'Dynamic memory and context system completed!' as status; 