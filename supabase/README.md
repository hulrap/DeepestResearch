# Database Setup Scripts

This directory contains modular SQL scripts to set up a production-ready database for the AI Agent Platform. The scripts are designed to be run in order and implement best practices for security, performance, and maintainability.

## 🗂️ Script Overview

| Script | Purpose | Key Features |
|--------|---------|--------------|
| `0-cleanup.sql` | **Complete database wipe** | Dynamically removes all objects, no hardcoded names |
| `1-extensions.sql` | **Extensions & basic setup** | PostgreSQL extensions, custom types, utility functions |
| `2-profiles.sql` | **User management** | Profiles, preferences, sessions with validation |
| `3-ai-providers.sql` | **AI providers & models** | Enhanced API key management, usage tracking |
| `4-workflows.sql` | **Workflow system** | Templates, sessions, reviews with state management |
| `5-usage-tracking.sql` | **Cost management** | Usage limits, detailed tracking, alerts |
| `6-memory-context.sql` | **AI memory system** | Vector embeddings, document processing, knowledge graph |
| `7-collaboration.sql` | **Team features** | Workspaces, sharing, real-time collaboration |
| `8-stripe-integration.sql` | **Enhanced billing** | Complete Stripe integration with webhooks |
| `9-security-rls.sql` | **Row Level Security** | Comprehensive security policies |
| `10-audit-monitoring.sql` | **Audit & monitoring** | Audit logs, health checks, error tracking |
| `11-seed-data.sql` | **Initial data** | AI models, workflow templates, products |

## 🚀 Quick Start

### For New Database Setup:
```bash
# Run scripts in order (1-11)
psql -f 1-extensions.sql
psql -f 2-profiles.sql
psql -f 3-ai-providers.sql
psql -f 4-workflows.sql
psql -f 5-usage-tracking.sql
psql -f 6-memory-context.sql
psql -f 7-collaboration.sql
psql -f 8-stripe-integration.sql
psql -f 9-security-rls.sql
psql -f 10-audit-monitoring.sql
psql -f 11-seed-data.sql
```

### For Complete Database Reset:
```bash
# ⚠️ WARNING: This will destroy ALL data!
psql -f 0-cleanup.sql

# Then run setup scripts 1-11 as above
```

### Using Supabase CLI:
```bash
# Apply all migrations
supabase db reset

# Or apply individual scripts
supabase db reset --script-path 1-extensions.sql
```

## 🏗️ Architecture Highlights

### ✅ Production Best Practices Implemented

- **Comprehensive validation** with check constraints
- **Audit logging** for all sensitive operations  
- **Row Level Security (RLS)** for data isolation
- **Performance optimization** with strategic indexes
- **Data retention policies** for compliance
- **Health monitoring** and error tracking
- **Vector search** for AI embeddings
- **Rate limiting** and usage controls
- **Webhook validation** for Stripe integration
- **Automated cleanup** functions

### 🔒 Security Features

- **Complete RLS policies** for multi-tenant security
- **API key encryption** with user-specific salts
- **Audit trails** for compliance requirements
- **Security event tracking** with risk scoring
- **Session management** with IP tracking
- **Input validation** at database level

### ⚡ Performance Optimizations

- **Strategic indexing** including vector indexes
- **Table partitioning** for large datasets
- **Computed columns** for frequently accessed data
- **Optimized queries** with proper constraints
- **Connection pooling** considerations
- **Automated statistics** updates

### 🔄 Monitoring & Maintenance

- **System health checks** with alerting
- **Performance metrics** collection
- **Error tracking** and resolution
- **Automated data cleanup** based on retention policies
- **Usage analytics** and reporting

## 🎯 Key Improvements Over Original Script

### ❌ Issues Fixed in Original:
- Missing data validation constraints
- Incomplete RLS policies  
- No audit logging
- Missing rate limiting
- Inadequate error handling
- No data retention strategy
- Basic Stripe integration
- Limited monitoring

### ✅ Enhancements Added:
- **Comprehensive validation** on all user inputs
- **Complete audit system** for compliance
- **Advanced RLS** for proper multi-tenancy
- **Enhanced Stripe integration** with full billing features
- **AI memory system** with vector embeddings
- **Team collaboration** features
- **Real-time monitoring** and alerting
- **Automated maintenance** functions

## 🔧 Environment Setup

### Required Extensions:
- `uuid-ossp` - UUID generation
- `pgcrypto` - Encryption functions  
- `vector` - AI embeddings support
- `fuzzystrmatch` - Fuzzy matching
- `unaccent` - Text search enhancement

### Recommended Settings:
```sql
-- For production performance
shared_preload_libraries = 'pg_stat_statements'
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
```

## 📊 Database Schema Summary

**Total Tables:** ~35 tables across 11 domains
**Total Functions:** ~25 utility and business logic functions  
**Total Indexes:** ~80 performance-optimized indexes
**Total Policies:** ~60 RLS policies for security

### Core Domains:
- **User Management** (profiles, preferences, sessions)
- **AI Integration** (providers, models, API keys)
- **Workflow Engine** (templates, executions, reviews)
- **Usage Tracking** (limits, logs, summaries, alerts)
- **Memory System** (AI memory, documents, knowledge graph)
- **Collaboration** (workspaces, sharing, comments)
- **Billing** (Stripe integration, subscriptions, invoices)
- **Security** (audit logs, RLS policies, monitoring)

## 🚨 Important Notes

### ⚠️ Before Running in Production:
1. **Backup existing data** if applicable
2. **Review environment variables** in your application
3. **Test RLS policies** with your authentication system
4. **Configure monitoring** and alerting
5. **Set up automated backups**
6. **Review retention policies** for your compliance needs

### 🔐 Security Considerations:
- Enable SSL/TLS for all database connections
- Use connection pooling (like PgBouncer)
- Regularly rotate service account credentials
- Monitor for suspicious access patterns
- Keep PostgreSQL updated to latest stable version

### 📈 Scaling Considerations:
- Consider read replicas for heavy read workloads
- Implement table partitioning for very large datasets
- Monitor connection pool utilization
- Set up proper monitoring for query performance

## 📞 Support

If you encounter issues:
1. Check the PostgreSQL logs for detailed error messages
2. Verify all required extensions are installed
3. Ensure proper user permissions for schema creation
4. Review any custom configuration that might conflict

---

**✨ This database schema is production-ready and implements enterprise-grade best practices for security, performance, and maintainability.** 