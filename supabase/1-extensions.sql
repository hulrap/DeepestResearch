-- =============================================
-- EXTENSIONS & BASIC SETUP
-- Enable necessary PostgreSQL extensions
-- =============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable encryption functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable vector operations for AI embeddings
CREATE EXTENSION IF NOT EXISTS "vector";

-- Enable fuzzy string matching (useful for search)
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch";

-- Enable full text search enhancements
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- =============================================
-- CUSTOM TYPES
-- =============================================

-- Audit operation types
CREATE TYPE public.audit_operation AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- Workflow status types
CREATE TYPE public.workflow_status AS ENUM (
    'pending', 'running', 'paused', 'completed', 'failed', 'cancelled'
);

-- Step execution status types
CREATE TYPE public.step_status AS ENUM (
    'pending', 'running', 'completed', 'failed', 'skipped'
);

-- =============================================
-- UTILITY FUNCTIONS
-- =============================================

-- Function to generate secure random strings
CREATE OR REPLACE FUNCTION public.generate_secure_token(length INTEGER DEFAULT 32)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(length), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate email format
CREATE OR REPLACE FUNCTION public.is_valid_email(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get current timestamp in UTC
CREATE OR REPLACE FUNCTION public.utc_now()
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    RETURN NOW() AT TIME ZONE 'UTC';
END;
$$ LANGUAGE plpgsql STABLE;

SELECT 'Extensions and basic setup completed!' as status; 