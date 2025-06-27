-- =============================================
-- TOTAL DATABASE CLEANUP - FORCE WIPE
-- WARNING: This will destroy ALL data!
-- =============================================

-- This script dynamically finds and destroys everything in the database
-- It doesn't need to know specific table/function names

DO $$
DECLARE
    r RECORD;
    func_name TEXT;
    table_name TEXT;
    type_name TEXT;
    schema_name TEXT := 'public';
BEGIN
    -- Disable all triggers to avoid constraint issues during cleanup
    SET session_replication_role = replica;
    
    RAISE NOTICE 'Starting complete database wipe...';
    
    -- Drop all views first (they depend on tables)
    FOR r IN (
        SELECT table_name 
        FROM information_schema.views 
        WHERE table_schema = schema_name
    ) LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || schema_name || '.' || quote_ident(r.table_name) || ' CASCADE';
        RAISE NOTICE 'Dropped view: %', r.table_name;
    END LOOP;
    
    -- Drop all functions and procedures
    FOR r IN (
        SELECT routine_name, routine_type
        FROM information_schema.routines 
        WHERE routine_schema = schema_name
        AND routine_name NOT LIKE 'pg_%'
        AND routine_name NOT LIKE 'information_schema_%'
    ) LOOP
        BEGIN
            EXECUTE 'DROP ' || r.routine_type || ' IF EXISTS ' || schema_name || '.' || quote_ident(r.routine_name) || ' CASCADE';
            RAISE NOTICE 'Dropped %: %', r.routine_type, r.routine_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop %: % - %', r.routine_type, r.routine_name, SQLERRM;
        END;
    END LOOP;
    
    -- Drop all tables (CASCADE will handle dependencies)
    FOR r IN (
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = schema_name
        AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE 'pg_%'
        AND table_name != 'schema_migrations'
    ) LOOP
        BEGIN
            EXECUTE 'DROP TABLE IF EXISTS ' || schema_name || '.' || quote_ident(r.table_name) || ' CASCADE';
            RAISE NOTICE 'Dropped table: %', r.table_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop table: % - %', r.table_name, SQLERRM;
        END;
    END LOOP;
    
    -- Drop all sequences
    FOR r IN (
        SELECT sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = schema_name
    ) LOOP
        BEGIN
            EXECUTE 'DROP SEQUENCE IF EXISTS ' || schema_name || '.' || quote_ident(r.sequence_name) || ' CASCADE';
            RAISE NOTICE 'Dropped sequence: %', r.sequence_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop sequence: % - %', r.sequence_name, SQLERRM;
        END;
    END LOOP;
    
    -- Drop all custom types
    FOR r IN (
        SELECT typname
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = schema_name
        AND t.typtype = 'e'  -- enum types
        AND t.typname NOT LIKE 'pg_%'
    ) LOOP
        BEGIN
            EXECUTE 'DROP TYPE IF EXISTS ' || schema_name || '.' || quote_ident(r.typname) || ' CASCADE';
            RAISE NOTICE 'Dropped type: %', r.typname;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop type: % - %', r.typname, SQLERRM;
        END;
    END LOOP;
    
    -- Drop all custom domains
    FOR r IN (
        SELECT typname
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = schema_name
        AND t.typtype = 'd'  -- domain types
        AND t.typname NOT LIKE 'pg_%'
    ) LOOP
        BEGIN
            EXECUTE 'DROP DOMAIN IF EXISTS ' || schema_name || '.' || quote_ident(r.typname) || ' CASCADE';
            RAISE NOTICE 'Dropped domain: %', r.typname;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop domain: % - %', r.typname, SQLERRM;
        END;
    END LOOP;
    
    -- Re-enable triggers
    SET session_replication_role = DEFAULT;
    
    RAISE NOTICE 'Database wipe completed!';
END
$$;

-- Clean up any remaining objects that might have been missed
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Final cleanup of any remaining objects
    FOR r IN (
        SELECT 'DROP ' || CASE 
            WHEN c.relkind = 'r' THEN 'TABLE'
            WHEN c.relkind = 'v' THEN 'VIEW'
            WHEN c.relkind = 'm' THEN 'MATERIALIZED VIEW'
            WHEN c.relkind = 'S' THEN 'SEQUENCE'
        END || ' IF EXISTS public.' || quote_ident(c.relname) || ' CASCADE' as drop_statement
        FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'v', 'm', 'S')
        AND c.relname NOT LIKE 'pg_%'
        AND c.relname != 'schema_migrations'
    ) LOOP
        BEGIN
            EXECUTE r.drop_statement;
        EXCEPTION WHEN OTHERS THEN
            -- Ignore errors in final cleanup
            NULL;
        END;
    END LOOP;
END
$$;

-- Vacuum to reclaim space
VACUUM FULL;

-- Reset statistics
ANALYZE;

-- Final status check
SELECT 
    'Database completely wiped clean!' as status,
    count(*) as remaining_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name NOT LIKE 'pg_%'
AND table_name != 'schema_migrations'; 