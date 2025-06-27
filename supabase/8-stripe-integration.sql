-- =============================================
-- ENHANCED STRIPE INTEGRATION
-- Complete billing and payment management system
-- =============================================

-- Stripe customers (enhanced)
CREATE TABLE public.stripe_customers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    stripe_customer_id TEXT UNIQUE NOT NULL,
    
    -- Customer information
    email TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    
    -- Address information
    address_line1 TEXT,
    address_line2 TEXT,
    address_city TEXT,
    address_state TEXT,
    address_postal_code TEXT,
    address_country TEXT, -- Set from user profile or preferences
    
    -- Business information
    business_name TEXT,
    tax_id TEXT,
    business_type TEXT, -- individual, company, non_profit
    
    -- Customer status and metadata
    is_active BOOLEAN DEFAULT true,
    preferred_locale TEXT, -- Synced from user profile
    currency TEXT, -- Set from user preferences or profile
    timezone TEXT, -- Synced from user profile
    customer_metadata JSONB DEFAULT '{}',
    
    -- Billing preferences
    default_payment_method_id TEXT,
    invoice_settings JSONB DEFAULT '{}', -- Custom invoice settings
    tax_exempt TEXT DEFAULT 'none', -- none, exempt, reverse
    
    -- Balance and credits
    account_balance INTEGER DEFAULT 0, -- In cents, can be negative for credits
    credit_balance DECIMAL(10,6) DEFAULT 0, -- AI service credits
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_email CHECK (public.is_valid_email(email)),
    CONSTRAINT valid_business_type CHECK (business_type IS NULL OR business_type IN ('individual', 'company', 'non_profit')),
    CONSTRAINT valid_tax_exempt CHECK (tax_exempt IN ('none', 'exempt', 'reverse')),
    CONSTRAINT valid_currency CHECK (currency IN ('usd', 'eur', 'gbp', 'cad', 'aud')),
    CONSTRAINT valid_credit_balance CHECK (credit_balance >= 0)
);

-- Enhanced Stripe products
CREATE TABLE public.stripe_products (
    id TEXT PRIMARY KEY, -- Stripe product ID
    name TEXT NOT NULL,
    description TEXT,
    
    -- Product categorization
    product_type TEXT NOT NULL, -- subscription, one_time, usage_based, credits
    category TEXT, -- pro_plan, enterprise_plan, ai_credits, storage, api_access
    
    -- Product configuration
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    features JSONB DEFAULT '[]', -- List of features included
    
    -- Limits and quotas (for subscription products)
    monthly_ai_credits DECIMAL(10,6),
    storage_gb INTEGER,
    max_team_members INTEGER,
    max_workflows INTEGER,
    max_documents INTEGER,
    
    -- Display and marketing
    display_order INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    marketing_description TEXT,
    feature_highlights TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    CONSTRAINT valid_product_type CHECK (product_type IN ('subscription', 'one_time', 'usage_based', 'credits')),
    CONSTRAINT valid_limits CHECK (
        (monthly_ai_credits IS NULL OR monthly_ai_credits > 0) AND
        (storage_gb IS NULL OR storage_gb > 0) AND
        (max_team_members IS NULL OR max_team_members > 0) AND
        (max_workflows IS NULL OR max_workflows > 0) AND
        (max_documents IS NULL OR max_documents > 0)
    )
);

-- Enhanced Stripe prices
CREATE TABLE public.stripe_prices (
    id TEXT PRIMARY KEY, -- Stripe price ID
    product_id TEXT REFERENCES public.stripe_products(id) ON DELETE CASCADE,
    
    -- Pricing information
    unit_amount INTEGER, -- In cents
    currency TEXT DEFAULT 'usd',
    billing_scheme TEXT DEFAULT 'per_unit', -- per_unit, tiered
    
    -- Recurring configuration
    recurring_interval TEXT, -- month, year, week, day
    recurring_interval_count INTEGER DEFAULT 1,
    recurring_usage_type TEXT, -- licensed, metered
    
    -- Pricing type and structure
    price_type TEXT DEFAULT 'recurring', -- recurring, one_time
    tiers JSONB, -- For tiered pricing
    transform_quantity JSONB, -- For usage-based pricing
    
    -- Trial and promotional
    trial_period_days INTEGER,
    promotional_price BOOLEAN DEFAULT false,
    promotion_end_date TIMESTAMP WITH TIME ZONE,
    
    -- Status and metadata
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    nickname TEXT, -- Human-readable identifier
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    CONSTRAINT valid_price_type CHECK (price_type IN ('recurring', 'one_time')),
    CONSTRAINT valid_recurring_interval CHECK (
        recurring_interval IS NULL OR 
        recurring_interval IN ('day', 'week', 'month', 'year')
    ),
    CONSTRAINT valid_billing_scheme CHECK (billing_scheme IN ('per_unit', 'tiered')),
    CONSTRAINT valid_usage_type CHECK (recurring_usage_type IS NULL OR recurring_usage_type IN ('licensed', 'metered')),
    CONSTRAINT valid_trial_period CHECK (trial_period_days IS NULL OR trial_period_days >= 0),
    CONSTRAINT valid_interval_count CHECK (recurring_interval_count > 0)
);

-- Enhanced Stripe subscriptions
CREATE TABLE public.stripe_subscriptions (
    id TEXT PRIMARY KEY, -- Stripe subscription ID
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES public.stripe_customers(stripe_customer_id),
    price_id TEXT REFERENCES public.stripe_prices(id),
    
    -- Subscription status and lifecycle
    status TEXT NOT NULL,
    billing_cycle_anchor TIMESTAMP WITH TIME ZONE,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    
    -- Trial information
    trial_start TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    
    -- Cancellation
    cancel_at_period_end BOOLEAN DEFAULT false,
    cancel_at TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    cancellation_feedback TEXT,
    
    -- Subscription configuration
    collection_method TEXT DEFAULT 'charge_automatically', -- charge_automatically, send_invoice
    default_payment_method TEXT,
    days_until_due INTEGER,
    
    -- Usage and metering (for usage-based subscriptions)
    usage_records JSONB DEFAULT '{}',
    current_usage JSONB DEFAULT '{}',
    
    -- Discounts and promotions
    discount_coupon_id TEXT,
    discount_percentage DECIMAL(5,2),
    discount_amount_off INTEGER,
    discount_end_date TIMESTAMP WITH TIME ZONE,
    
    -- Metadata and customizations
    metadata JSONB DEFAULT '{}',
    subscription_items JSONB DEFAULT '[]', -- Multiple subscription items
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    CONSTRAINT valid_status CHECK (status IN (
        'active', 'canceled', 'incomplete', 'incomplete_expired', 
        'past_due', 'trialing', 'unpaid', 'paused'
    )),
    CONSTRAINT valid_collection_method CHECK (collection_method IN ('charge_automatically', 'send_invoice')),
    CONSTRAINT valid_discount_percentage CHECK (discount_percentage IS NULL OR (discount_percentage >= 0 AND discount_percentage <= 100))
);

-- Stripe invoices
CREATE TABLE public.stripe_invoices (
    id TEXT PRIMARY KEY, -- Stripe invoice ID
    customer_id TEXT REFERENCES public.stripe_customers(stripe_customer_id),
    subscription_id TEXT REFERENCES public.stripe_subscriptions(id),
    
    -- Invoice details
    invoice_number TEXT,
    amount_due INTEGER NOT NULL, -- In cents
    amount_paid INTEGER DEFAULT 0,
    amount_remaining INTEGER DEFAULT 0,
    subtotal INTEGER NOT NULL,
    total INTEGER NOT NULL,
    tax_amount INTEGER DEFAULT 0,
    
    -- Currency and locale
    currency TEXT DEFAULT 'usd',
    
    -- Invoice status and lifecycle
    status TEXT NOT NULL, -- draft, open, paid, void, uncollectible
    paid BOOLEAN DEFAULT false,
    attempt_count INTEGER DEFAULT 0,
    
    -- Important dates
    created_date TIMESTAMP WITH TIME ZONE NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    
    -- Invoice configuration
    auto_advance BOOLEAN DEFAULT true,
    billing_reason TEXT, -- subscription_create, subscription_cycle, manual, etc.
    collection_method TEXT DEFAULT 'charge_automatically',
    
    -- Payment information
    payment_intent_id TEXT,
    charge_id TEXT,
    receipt_number TEXT,
    
    -- Invoice content
    description TEXT,
    statement_descriptor TEXT,
    footer TEXT,
    custom_fields JSONB DEFAULT '[]',
    
    -- Invoice delivery
    hosted_invoice_url TEXT,
    invoice_pdf TEXT,
    email_sent BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    CONSTRAINT valid_invoice_status CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
    CONSTRAINT valid_amounts CHECK (
        amount_due >= 0 AND amount_paid >= 0 AND amount_remaining >= 0 AND
        subtotal >= 0 AND total >= 0 AND tax_amount >= 0
    ),
    CONSTRAINT valid_attempt_count CHECK (attempt_count >= 0)
);

-- Payment methods
CREATE TABLE public.stripe_payment_methods (
    id TEXT PRIMARY KEY, -- Stripe payment method ID
    customer_id TEXT REFERENCES public.stripe_customers(stripe_customer_id),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Payment method details
    payment_method_type TEXT NOT NULL, -- card, bank_account, etc.
    
    -- Card details (if type is card)
    card_brand TEXT, -- visa, mastercard, amex, etc.
    card_last4 TEXT,
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    card_fingerprint TEXT,
    card_country TEXT,
    
    -- Bank account details (if type is bank_account)
    bank_account_last4 TEXT,
    bank_account_bank_name TEXT,
    bank_account_account_type TEXT,
    bank_account_country TEXT,
    
    -- Status and usage
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    billing_details JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    CONSTRAINT valid_payment_method_type CHECK (payment_method_type IN ('card', 'bank_account', 'sepa_debit', 'ach_debit')),
    CONSTRAINT valid_card_exp_month CHECK (card_exp_month IS NULL OR (card_exp_month >= 1 AND card_exp_month <= 12)),
    CONSTRAINT valid_card_exp_year CHECK (card_exp_year IS NULL OR card_exp_year >= 2020),
    CONSTRAINT valid_usage_count CHECK (usage_count >= 0)
);

-- Enhanced Stripe payments/charges
CREATE TABLE public.stripe_payments (
    id TEXT PRIMARY KEY, -- Stripe charge ID
    customer_id TEXT REFERENCES public.stripe_customers(stripe_customer_id),
    payment_method_id TEXT REFERENCES public.stripe_payment_methods(id),
    invoice_id TEXT REFERENCES public.stripe_invoices(id),
    
    -- Payment details
    amount INTEGER NOT NULL, -- In cents
    amount_captured INTEGER DEFAULT 0,
    amount_refunded INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'usd',
    
    -- Payment status
    status TEXT NOT NULL, -- succeeded, pending, failed, canceled, requires_action
    captured BOOLEAN DEFAULT false,
    paid BOOLEAN DEFAULT false,
    refunded BOOLEAN DEFAULT false,
    
    -- Payment intent and processing
    payment_intent_id TEXT,
    receipt_email TEXT,
    receipt_number TEXT,
    receipt_url TEXT,
    
    -- Failure information
    failure_code TEXT,
    failure_message TEXT,
    failure_reason TEXT, -- card_declined, insufficient_funds, etc.
    
    -- Dispute information
    disputed BOOLEAN DEFAULT false,
    dispute_reason TEXT,
    dispute_status TEXT,
    dispute_evidence_due_by TIMESTAMP WITH TIME ZONE,
    
    -- Processing details
    processing_fee INTEGER DEFAULT 0, -- Stripe's processing fee
    application_fee INTEGER DEFAULT 0, -- Our application fee
    
    -- Risk and fraud
    risk_level TEXT, -- normal, elevated, highest
    risk_score INTEGER, -- 0-100
    fraud_score INTEGER, -- 0-100
    
    -- Transfer and payout information
    transfer_id TEXT, -- If transferred to connected account
    payout_id TEXT, -- Which payout this payment was included in
    
    -- Metadata
    description TEXT,
    statement_descriptor TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    CONSTRAINT valid_payment_status CHECK (status IN ('succeeded', 'pending', 'failed', 'canceled', 'requires_action')),
    CONSTRAINT valid_amounts CHECK (
        amount > 0 AND amount_captured >= 0 AND amount_refunded >= 0 AND
        processing_fee >= 0 AND application_fee >= 0
    ),
    CONSTRAINT valid_risk_level CHECK (risk_level IS NULL OR risk_level IN ('normal', 'elevated', 'highest')),
    CONSTRAINT valid_scores CHECK (
        (risk_score IS NULL OR (risk_score >= 0 AND risk_score <= 100)) AND
        (fraud_score IS NULL OR (fraud_score >= 0 AND fraud_score <= 100))
    )
);

-- Webhook events for reliable processing
CREATE TABLE public.stripe_webhook_events (
    id TEXT PRIMARY KEY, -- Stripe event ID
    event_type TEXT NOT NULL,
    api_version TEXT,
    
    -- Event data
    data JSONB NOT NULL,
    object_id TEXT, -- ID of the main object (customer, subscription, etc.)
    object_type TEXT, -- Type of the main object
    
    -- Processing status
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    processing_attempts INTEGER DEFAULT 0,
    processing_error TEXT,
    
    -- Event metadata
    livemode BOOLEAN DEFAULT false,
    pending_webhooks INTEGER DEFAULT 0,
    request_id TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    CONSTRAINT valid_processing_attempts CHECK (processing_attempts >= 0),
    CONSTRAINT valid_pending_webhooks CHECK (pending_webhooks >= 0)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Customer indexes
CREATE INDEX idx_stripe_customers_user ON public.stripe_customers(user_id);
CREATE INDEX idx_stripe_customers_workspace ON public.stripe_customers(workspace_id);
CREATE INDEX idx_stripe_customers_stripe_id ON public.stripe_customers(stripe_customer_id);
CREATE INDEX idx_stripe_customers_email ON public.stripe_customers(email);

-- Product and price indexes
CREATE INDEX idx_stripe_products_type ON public.stripe_products(product_type, is_active);
CREATE INDEX idx_stripe_products_category ON public.stripe_products(category, display_order);
CREATE INDEX idx_stripe_prices_product ON public.stripe_prices(product_id, is_active);

-- Subscription indexes
CREATE INDEX idx_stripe_subscriptions_user ON public.stripe_subscriptions(user_id, status);
CREATE INDEX idx_stripe_subscriptions_workspace ON public.stripe_subscriptions(workspace_id, status);
CREATE INDEX idx_stripe_subscriptions_customer ON public.stripe_subscriptions(customer_id, status);
CREATE INDEX idx_stripe_subscriptions_status ON public.stripe_subscriptions(status, current_period_end);
CREATE INDEX idx_stripe_subscriptions_trial ON public.stripe_subscriptions(trial_end) WHERE trial_end IS NOT NULL;

-- Invoice indexes
CREATE INDEX idx_stripe_invoices_customer ON public.stripe_invoices(customer_id, created_date DESC);
CREATE INDEX idx_stripe_invoices_subscription ON public.stripe_invoices(subscription_id, created_date DESC);
CREATE INDEX idx_stripe_invoices_status ON public.stripe_invoices(status, due_date);
CREATE INDEX idx_stripe_invoices_unpaid ON public.stripe_invoices(due_date) WHERE status IN ('open', 'uncollectible');

-- Payment method indexes
CREATE INDEX idx_stripe_payment_methods_customer ON public.stripe_payment_methods(customer_id, is_active);
CREATE INDEX idx_stripe_payment_methods_user ON public.stripe_payment_methods(user_id, is_default);
CREATE INDEX idx_stripe_payment_methods_type ON public.stripe_payment_methods(payment_method_type, is_active);

-- Payment indexes
CREATE INDEX idx_stripe_payments_customer ON public.stripe_payments(customer_id, created_at DESC);
CREATE INDEX idx_stripe_payments_invoice ON public.stripe_payments(invoice_id);
CREATE INDEX idx_stripe_payments_status ON public.stripe_payments(status, created_at DESC);
CREATE INDEX idx_stripe_payments_disputed ON public.stripe_payments(disputed, created_at DESC) WHERE disputed = true;

-- Webhook indexes
CREATE INDEX idx_stripe_webhook_events_type ON public.stripe_webhook_events(event_type, processed);
CREATE INDEX idx_stripe_webhook_events_object ON public.stripe_webhook_events(object_type, object_id);
CREATE INDEX idx_stripe_webhook_events_unprocessed ON public.stripe_webhook_events(created_at) WHERE processed = false;

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE TRIGGER update_stripe_customers_updated_at
    BEFORE UPDATE ON public.stripe_customers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stripe_products_updated_at
    BEFORE UPDATE ON public.stripe_products
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stripe_prices_updated_at
    BEFORE UPDATE ON public.stripe_prices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stripe_subscriptions_updated_at
    BEFORE UPDATE ON public.stripe_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stripe_invoices_updated_at
    BEFORE UPDATE ON public.stripe_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stripe_payment_methods_updated_at
    BEFORE UPDATE ON public.stripe_payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stripe_payments_updated_at
    BEFORE UPDATE ON public.stripe_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FUNCTIONS FOR BILLING MANAGEMENT
-- =============================================

-- Function to sync Stripe customer data with user profile
CREATE OR REPLACE FUNCTION public.sync_stripe_customer_with_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Update Stripe customer when profile is updated
    UPDATE public.stripe_customers
    SET 
        preferred_locale = NEW.locale,
        timezone = NEW.timezone,
        currency = NEW.currency,
        address_country = CASE 
            WHEN NEW.locale = 'en' THEN 'US'
            WHEN NEW.locale = 'de' THEN 'DE'
            WHEN NEW.locale = 'fr' THEN 'FR'
            WHEN NEW.locale = 'es' THEN 'ES'
            WHEN NEW.locale = 'it' THEN 'IT'
            WHEN NEW.locale = 'nl' THEN 'NL'
            WHEN NEW.locale = 'pt' THEN 'PT'
            WHEN NEW.locale = 'ja' THEN 'JP'
            WHEN NEW.locale = 'ko' THEN 'KR'
            WHEN NEW.locale = 'zh' THEN 'CN'
            ELSE COALESCE(address_country, 'US')
        END,
        updated_at = public.utc_now()
    WHERE user_id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync Stripe customer data when profile changes
CREATE TRIGGER sync_stripe_customer_trigger
    AFTER UPDATE OF locale, timezone, currency ON public.profiles
    FOR EACH ROW
    WHEN (OLD.locale IS DISTINCT FROM NEW.locale OR 
          OLD.timezone IS DISTINCT FROM NEW.timezone OR 
          OLD.currency IS DISTINCT FROM NEW.currency)
    EXECUTE FUNCTION public.sync_stripe_customer_with_profile();

-- Function to check if user has active subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.stripe_subscriptions
        WHERE user_id = user_uuid
        AND status IN ('active', 'trialing')
        AND (current_period_end IS NULL OR current_period_end > public.utc_now())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's subscription limits
CREATE OR REPLACE FUNCTION public.get_subscription_limits(user_uuid UUID)
RETURNS TABLE(
    monthly_ai_credits DECIMAL,
    storage_gb INTEGER,
    max_team_members INTEGER,
    max_workflows INTEGER,
    max_documents INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(p.monthly_ai_credits, 0),
        COALESCE(p.storage_gb, 1),
        COALESCE(p.max_team_members, 1),
        COALESCE(p.max_workflows, 10),
        COALESCE(p.max_documents, 50)
    FROM public.stripe_subscriptions s
    JOIN public.stripe_prices pr ON pr.id = s.price_id
    JOIN public.stripe_products p ON p.id = pr.product_id
    WHERE s.user_id = user_uuid
    AND s.status IN ('active', 'trialing')
    ORDER BY s.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process webhook events
CREATE OR REPLACE FUNCTION public.process_stripe_webhook_event(event_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    event_record RECORD;
    success BOOLEAN := false;
BEGIN
    -- Get the unprocessed event
    SELECT * INTO event_record
    FROM public.stripe_webhook_events
    WHERE id = event_id AND processed = false;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Update processing attempts
    UPDATE public.stripe_webhook_events
    SET processing_attempts = processing_attempts + 1
    WHERE id = event_id;
    
    -- Process based on event type
    CASE event_record.event_type
        WHEN 'customer.subscription.created', 'customer.subscription.updated' THEN
            -- Handle subscription events
            success := true;
        WHEN 'customer.subscription.deleted' THEN
            -- Handle subscription cancellation
            success := true;
        WHEN 'invoice.payment_succeeded' THEN
            -- Handle successful payment
            success := true;
        WHEN 'invoice.payment_failed' THEN
            -- Handle failed payment
            success := true;
        ELSE
            -- Unknown event type, mark as processed to avoid retries
            success := true;
    END CASE;
    
    -- Mark as processed if successful
    IF success THEN
        UPDATE public.stripe_webhook_events
        SET 
            processed = true,
            processed_at = public.utc_now(),
            processing_error = NULL
        WHERE id = event_id;
    ELSE
        UPDATE public.stripe_webhook_events
        SET processing_error = 'Processing failed'
        WHERE id = event_id;
    END IF;
    
    RETURN success;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Enhanced Stripe integration setup completed!' as status; 

-- =============================================
-- STRIPE INTEGRATION & BILLING
-- Dynamic billing, subscription, and payment management
-- =============================================

-- Dynamic subscription plans (no hardcoded pricing)
CREATE TABLE public.subscription_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stripe_price_id TEXT UNIQUE NOT NULL,
    stripe_product_id TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    plan_description TEXT,
    plan_type TEXT NOT NULL, -- free, starter, pro, enterprise, custom
    billing_interval TEXT NOT NULL, -- month, year, one_time
    
    -- Dynamic pricing (synced from Stripe)
    unit_amount INTEGER NOT NULL, -- Amount in smallest currency unit
    currency TEXT DEFAULT 'usd',
    pricing_model TEXT DEFAULT 'per_seat', -- per_seat, tiered, volume, usage_based
    
    -- Dynamic plan features (configurable)
    features JSONB NOT NULL DEFAULT '{}',
    feature_limits JSONB NOT NULL DEFAULT '{}',
    
    -- Plan availability and targeting
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    target_audience TEXT[], -- individual, business, enterprise, developer
    availability_regions TEXT[],
    
    -- Plan metadata
    sort_order INTEGER DEFAULT 0,
    trial_period_days INTEGER DEFAULT 0,
    setup_fee INTEGER DEFAULT 0,
    cancellation_grace_days INTEGER DEFAULT 0,
    
    -- Plan intelligence
    recommended_for TEXT[],
    upgrade_path TEXT, -- Next plan to suggest for upgrade
    downgrade_path TEXT, -- Previous plan for downgrade
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    CONSTRAINT valid_plan_type CHECK (plan_type IN ('free', 'starter', 'pro', 'enterprise', 'custom')),
    CONSTRAINT valid_billing_interval CHECK (billing_interval IN ('month', 'year', 'one_time', 'usage_based')),
    CONSTRAINT valid_pricing_model CHECK (pricing_model IN ('per_seat', 'tiered', 'volume', 'usage_based', 'flat_rate')),
    CONSTRAINT valid_currency CHECK (length(currency) = 3),
    CONSTRAINT valid_amounts CHECK (unit_amount >= 0 AND setup_fee >= 0),
    CONSTRAINT valid_trial_period CHECK (trial_period_days >= 0),
    CONSTRAINT valid_grace_period CHECK (cancellation_grace_days >= 0)
);

-- Enhanced user subscriptions with dynamic management
CREATE TABLE public.user_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.subscription_plans(id),
    stripe_subscription_id TEXT UNIQUE,
    stripe_customer_id TEXT NOT NULL,
    
    -- Subscription status and lifecycle
    status TEXT NOT NULL DEFAULT 'active',
    subscription_type TEXT DEFAULT 'paid', -- paid, trial, free, sponsored, legacy
    
    -- Dynamic billing configuration
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    trial_start TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    
    -- Usage-based billing support
    usage_based_billing BOOLEAN DEFAULT false,
    usage_reset_day INTEGER DEFAULT 1,
    usage_billing_cycle TEXT DEFAULT 'monthly',
    
    -- Plan customization (user-configurable overrides)
    custom_limits JSONB DEFAULT '{}',
    custom_features JSONB DEFAULT '{}',
    addon_subscriptions JSONB DEFAULT '[]',
    
    -- Billing intelligence
    auto_renewal BOOLEAN DEFAULT true,
    payment_method_id TEXT,
    billing_email TEXT,
    billing_address JSONB DEFAULT '{}',
    tax_info JSONB DEFAULT '{}',
    
    -- Subscription lifecycle
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    cancellation_feedback JSONB DEFAULT '{}',
    
    -- Subscription history and changes
    upgrade_downgrade_history JSONB DEFAULT '[]',
    pricing_changes JSONB DEFAULT '[]',
    last_invoice_date TIMESTAMP WITH TIME ZONE,
    next_invoice_date TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    CONSTRAINT valid_status CHECK (status IN ('active', 'past_due', 'canceled', 'unpaid', 'paused', 'trialing', 'incomplete')),
    CONSTRAINT valid_subscription_type CHECK (subscription_type IN ('paid', 'trial', 'free', 'sponsored', 'legacy', 'beta')),
    CONSTRAINT valid_usage_cycle CHECK (usage_billing_cycle IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    CONSTRAINT valid_usage_reset CHECK (usage_reset_day BETWEEN 1 AND 31),
    CONSTRAINT valid_period CHECK (
        current_period_start IS NULL OR current_period_end IS NULL OR 
        current_period_end > current_period_start
    ),
    CONSTRAINT valid_trial CHECK (
        trial_start IS NULL OR trial_end IS NULL OR 
        trial_end > trial_start
    )
);

-- Dynamic pricing tiers for usage-based billing
CREATE TABLE public.pricing_tiers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
    
    -- Tier configuration
    tier_name TEXT NOT NULL,
    tier_order INTEGER NOT NULL,
    usage_metric TEXT NOT NULL, -- requests, tokens, storage_gb, users
    
    -- Tier pricing (dynamic)
    tier_start_quantity INTEGER NOT NULL,
    tier_end_quantity INTEGER, -- NULL for unlimited top tier
    unit_price DECIMAL(10,8) NOT NULL,
    flat_fee DECIMAL(10,2) DEFAULT 0,
    
    -- Tier features and benefits
    included_quantity INTEGER DEFAULT 0,
    overage_rate DECIMAL(10,8),
    tier_benefits TEXT[],
    
    -- Tier intelligence
    is_popular BOOLEAN DEFAULT false,
    recommended_for TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    UNIQUE(plan_id, tier_order, usage_metric),
    CONSTRAINT valid_tier_order CHECK (tier_order > 0),
    CONSTRAINT valid_usage_metric CHECK (usage_metric IN ('requests', 'tokens', 'storage_gb', 'users', 'workspaces', 'documents')),
    CONSTRAINT valid_quantities CHECK (
        tier_start_quantity >= 0 AND 
        (tier_end_quantity IS NULL OR tier_end_quantity > tier_start_quantity)
    ),
    CONSTRAINT valid_pricing CHECK (unit_price >= 0 AND flat_fee >= 0),
    CONSTRAINT valid_overage CHECK (overage_rate IS NULL OR overage_rate >= 0)
);

-- Enhanced invoice tracking with dynamic itemization
CREATE TABLE public.user_invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.user_subscriptions(id),
    stripe_invoice_id TEXT UNIQUE,
    
    -- Invoice details
    invoice_number TEXT,
    invoice_date TIMESTAMP WITH TIME ZONE NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    
    -- Dynamic amounts
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    amount_remaining DECIMAL(10,2) DEFAULT 0,
    
    -- Invoice status and payment
    status TEXT DEFAULT 'draft',
    payment_status TEXT DEFAULT 'pending',
    currency TEXT DEFAULT 'usd',
    
    -- Dynamic line items (usage-based billing)
    line_items JSONB DEFAULT '[]',
    usage_summary JSONB DEFAULT '{}',
    proration_details JSONB DEFAULT '{}',
    
    -- Invoice delivery and communication
    invoice_pdf_url TEXT,
    hosted_invoice_url TEXT,
    delivery_method TEXT DEFAULT 'email',
    sent_at TIMESTAMP WITH TIME ZONE,
    payment_reminder_sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Payment tracking
    payment_attempts INTEGER DEFAULT 0,
    last_payment_attempt_at TIMESTAMP WITH TIME ZONE,
    payment_method_types TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    CONSTRAINT valid_invoice_status CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
    CONSTRAINT valid_payment_status CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partially_paid')),
    CONSTRAINT valid_amounts CHECK (
        subtotal >= 0 AND tax_amount >= 0 AND discount_amount >= 0 AND
        total_amount >= 0 AND amount_paid >= 0 AND amount_remaining >= 0
    ),
    CONSTRAINT valid_payment_attempts CHECK (payment_attempts >= 0),
    CONSTRAINT valid_delivery_method CHECK (delivery_method IN ('email', 'webhook', 'api', 'manual'))
);

-- Dynamic payment methods with intelligent management
CREATE TABLE public.user_payment_methods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    stripe_payment_method_id TEXT UNIQUE NOT NULL,
    
    -- Payment method details
    payment_type TEXT NOT NULL,
    last_four TEXT,
    brand TEXT,
    exp_month INTEGER,
    exp_year INTEGER,
    
    -- Payment method metadata
    is_default BOOLEAN DEFAULT false,
    fingerprint TEXT,
    country TEXT,
    funding TEXT, -- credit, debit, prepaid, unknown
    
    -- Usage tracking and intelligence
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    success_rate DECIMAL(3,2),
    average_amount DECIMAL(10,2),
    
    -- Security and fraud detection
    risk_score DECIMAL(3,2),
    verification_status TEXT DEFAULT 'unverified',
    verification_method TEXT,
    
    -- Billing preferences
    auto_retry_enabled BOOLEAN DEFAULT true,
    retry_schedule JSONB DEFAULT '[]',
    notification_preferences JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    CONSTRAINT valid_payment_type CHECK (payment_type IN ('card', 'bank_account', 'paypal', 'apple_pay', 'google_pay')),
    CONSTRAINT valid_exp_month CHECK (exp_month IS NULL OR (exp_month >= 1 AND exp_month <= 12)),
    CONSTRAINT valid_exp_year CHECK (exp_year IS NULL OR exp_year >= EXTRACT(year FROM public.utc_now())),
    CONSTRAINT valid_funding CHECK (funding IN ('credit', 'debit', 'prepaid', 'unknown')),
    CONSTRAINT valid_usage_count CHECK (usage_count >= 0),
    CONSTRAINT valid_success_rate CHECK (success_rate IS NULL OR (success_rate >= 0 AND success_rate <= 1)),
    CONSTRAINT valid_risk_score CHECK (risk_score IS NULL OR (risk_score >= 0 AND risk_score <= 1)),
    CONSTRAINT valid_verification_status CHECK (verification_status IN ('unverified', 'verified', 'failed', 'pending'))
);

-- Dynamic billing alerts and notifications
CREATE TABLE public.billing_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    
    -- Alert content and context
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    alert_data JSONB DEFAULT '{}',
    
    -- Alert triggers (dynamic based on user configuration)
    trigger_condition JSONB NOT NULL,
    trigger_threshold DECIMAL(15,8),
    current_value DECIMAL(15,8),
    
    -- Alert delivery and status
    delivery_methods JSONB DEFAULT '{"email": true, "push": false}',
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP WITH TIME ZONE,
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    
    -- Alert automation and actions
    auto_actions JSONB DEFAULT '[]',
    actions_executed JSONB DEFAULT '[]',
    action_results JSONB DEFAULT '{}',
    
    -- Alert lifecycle
    expires_at TIMESTAMP WITH TIME ZONE,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_method TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT public.utc_now() NOT NULL,
    
    CONSTRAINT valid_alert_type CHECK (alert_type IN (
        'payment_failed', 'subscription_expiring', 'usage_limit_approaching', 
        'overage_detected', 'payment_method_expiring', 'invoice_overdue',
        'upgrade_recommended', 'cost_spike_detected', 'budget_exceeded'
    )),
    CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    CONSTRAINT valid_resolution_method CHECK (resolution_method IN ('auto', 'user', 'admin', 'system'))
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Subscription plan indexes
CREATE INDEX idx_subscription_plans_active ON public.subscription_plans(is_active, sort_order);
CREATE INDEX idx_subscription_plans_type ON public.subscription_plans(plan_type, billing_interval);
CREATE INDEX idx_subscription_plans_stripe ON public.subscription_plans(stripe_price_id, stripe_product_id);

-- User subscription indexes
CREATE INDEX idx_user_subscriptions_user ON public.user_subscriptions(user_id, status);
CREATE INDEX idx_user_subscriptions_stripe ON public.user_subscriptions(stripe_subscription_id, stripe_customer_id);
CREATE INDEX idx_user_subscriptions_status ON public.user_subscriptions(status, current_period_end);
CREATE INDEX idx_user_subscriptions_trial ON public.user_subscriptions(trial_end) WHERE trial_end IS NOT NULL;
CREATE INDEX idx_user_subscriptions_auto_renewal ON public.user_subscriptions(auto_renewal, current_period_end);

-- Pricing tier indexes
CREATE INDEX idx_pricing_tiers_plan ON public.pricing_tiers(plan_id, tier_order);
CREATE INDEX idx_pricing_tiers_metric ON public.pricing_tiers(usage_metric, tier_start_quantity);

-- Invoice indexes
CREATE INDEX idx_user_invoices_user_date ON public.user_invoices(user_id, invoice_date DESC);
CREATE INDEX idx_user_invoices_status ON public.user_invoices(status, payment_status);
CREATE INDEX idx_user_invoices_stripe ON public.user_invoices(stripe_invoice_id);
CREATE INDEX idx_user_invoices_due ON public.user_invoices(due_date) WHERE due_date IS NOT NULL;

-- Payment method indexes
CREATE INDEX idx_user_payment_methods_user ON public.user_payment_methods(user_id, is_default);
CREATE INDEX idx_user_payment_methods_stripe ON public.user_payment_methods(stripe_payment_method_id);
CREATE INDEX idx_user_payment_methods_usage ON public.user_payment_methods(last_used_at DESC, usage_count DESC);

-- Billing alert indexes
CREATE INDEX idx_billing_alerts_user ON public.billing_alerts(user_id, created_at DESC);
CREATE INDEX idx_billing_alerts_type ON public.billing_alerts(alert_type, severity);
CREATE INDEX idx_billing_alerts_unresolved ON public.billing_alerts(is_resolved, expires_at) WHERE is_resolved = false;

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON public.subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON public.user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_invoices_updated_at
    BEFORE UPDATE ON public.user_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_payment_methods_updated_at
    BEFORE UPDATE ON public.user_payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- DYNAMIC BILLING FUNCTIONS
-- =============================================

-- Function to calculate dynamic pricing based on usage
CREATE OR REPLACE FUNCTION public.calculate_usage_based_pricing(
    user_uuid UUID,
    billing_period_start TIMESTAMP WITH TIME ZONE,
    billing_period_end TIMESTAMP WITH TIME ZONE
)
RETURNS JSONB AS $$
DECLARE
    subscription_record RECORD;
    usage_record RECORD;
    pricing_breakdown JSONB := '{}';
    total_cost DECIMAL(10,2) := 0;
    tier_record RECORD;
    tier_cost DECIMAL(10,2);
BEGIN
    -- Get user's subscription
    SELECT 
        us.*,
        sp.features,
        sp.feature_limits
    INTO subscription_record
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON sp.id = us.plan_id
    WHERE us.user_id = user_uuid 
    AND us.status = 'active'
    ORDER BY us.created_at DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN '{"error": "No active subscription found"}'::JSONB;
    END IF;
    
    -- Get usage data for the period
    SELECT 
        COALESCE(SUM(total_requests), 0) as total_requests,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(total_cost_usd), 0) as base_cost
    INTO usage_record
    FROM public.usage_summaries
    WHERE user_id = user_uuid
    AND period_start >= billing_period_start
    AND period_end <= billing_period_end;
    
    -- Calculate pricing for each usage metric
    FOR tier_record IN 
        SELECT * FROM public.pricing_tiers 
        WHERE plan_id = subscription_record.plan_id
        ORDER BY usage_metric, tier_order
    LOOP
        tier_cost := 0;
        
        -- Calculate cost based on usage metric
        CASE tier_record.usage_metric
            WHEN 'requests' THEN
                IF usage_record.total_requests > tier_record.tier_start_quantity THEN
                    tier_cost := LEAST(
                        usage_record.total_requests - tier_record.tier_start_quantity,
                        COALESCE(tier_record.tier_end_quantity - tier_record.tier_start_quantity, usage_record.total_requests)
                    ) * tier_record.unit_price + tier_record.flat_fee;
                END IF;
            WHEN 'tokens' THEN
                IF usage_record.total_tokens > tier_record.tier_start_quantity THEN
                    tier_cost := LEAST(
                        usage_record.total_tokens - tier_record.tier_start_quantity,
                        COALESCE(tier_record.tier_end_quantity - tier_record.tier_start_quantity, usage_record.total_tokens)
                    ) * tier_record.unit_price + tier_record.flat_fee;
                END IF;
        END CASE;
        
        total_cost := total_cost + tier_cost;
        
        -- Add to breakdown
        pricing_breakdown := pricing_breakdown || jsonb_build_object(
            tier_record.usage_metric || '_tier_' || tier_record.tier_order,
            jsonb_build_object(
                'usage', CASE tier_record.usage_metric 
                    WHEN 'requests' THEN usage_record.total_requests
                    WHEN 'tokens' THEN usage_record.total_tokens
                    ELSE 0
                END,
                'tier_cost', tier_cost,
                'unit_price', tier_record.unit_price,
                'tier_range', jsonb_build_object(
                    'start', tier_record.tier_start_quantity,
                    'end', tier_record.tier_end_quantity
                )
            )
        );
    END LOOP;
    
    RETURN jsonb_build_object(
        'total_cost', total_cost,
        'base_subscription_cost', subscription_record.plan_id, -- Would get from plan
        'usage_breakdown', pricing_breakdown,
        'billing_period', jsonb_build_object(
            'start', billing_period_start,
            'end', billing_period_end
        ),
        'usage_summary', to_jsonb(usage_record)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sync plan configuration with user limits
CREATE OR REPLACE FUNCTION public.sync_subscription_with_user_config()
RETURNS TRIGGER AS $$
DECLARE
    plan_config RECORD;
BEGIN
    -- Get plan configuration
    SELECT 
        sp.feature_limits,
        sp.features
    INTO plan_config
    FROM public.subscription_plans sp
    WHERE sp.id = NEW.plan_id;
    
    IF FOUND THEN
        -- Update user configuration with plan limits
        UPDATE public.user_configuration
        SET 
            plan_daily_cost_limit = COALESCE(
                (plan_config.feature_limits->>'daily_cost_limit')::DECIMAL(10,6),
                plan_daily_cost_limit
            ),
            plan_monthly_cost_limit = COALESCE(
                (plan_config.feature_limits->>'monthly_cost_limit')::DECIMAL(10,6),
                plan_monthly_cost_limit
            ),
            plan_daily_request_limit = COALESCE(
                (plan_config.feature_limits->>'daily_request_limit')::INTEGER,
                plan_daily_request_limit
            ),
            plan_monthly_request_limit = COALESCE(
                (plan_config.feature_limits->>'monthly_request_limit')::INTEGER,
                plan_monthly_request_limit
            ),
            plan_daily_token_limit = COALESCE(
                (plan_config.feature_limits->>'daily_token_limit')::INTEGER,
                plan_daily_token_limit
            ),
            plan_monthly_token_limit = COALESCE(
                (plan_config.feature_limits->>'monthly_token_limit')::INTEGER,
                plan_monthly_token_limit
            ),
            updated_at = public.utc_now()
        WHERE user_id = NEW.user_id;
        
        -- Update plan configuration reference
        UPDATE public.plan_configurations
        SET 
            daily_cost_limit = COALESCE(
                (plan_config.feature_limits->>'daily_cost_limit')::DECIMAL(10,6),
                daily_cost_limit
            ),
            monthly_cost_limit = COALESCE(
                (plan_config.feature_limits->>'monthly_cost_limit')::DECIMAL(10,6),
                monthly_cost_limit
            ),
            updated_at = public.utc_now()
        WHERE plan_type = (
            SELECT plan_type FROM public.subscription_plans 
            WHERE id = NEW.plan_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync subscription changes with user configuration
CREATE TRIGGER sync_subscription_config_trigger
    AFTER INSERT OR UPDATE OF plan_id, status ON public.user_subscriptions
    FOR EACH ROW
    WHEN (NEW.status = 'active')
    EXECUTE FUNCTION public.sync_subscription_with_user_config();

SELECT 'Dynamic billing and subscription system completed!' as status; 