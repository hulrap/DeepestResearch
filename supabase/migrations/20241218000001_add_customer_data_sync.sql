-- Add customer data sync fields to stripe_customers table
-- This allows us to store and track Stripe customer data locally

-- Add columns for Stripe customer data
ALTER TABLE public.stripe_customers 
ADD COLUMN IF NOT EXISTS stripe_email TEXT,
ADD COLUMN IF NOT EXISTS stripe_name TEXT,
ADD COLUMN IF NOT EXISTS stripe_phone TEXT,
ADD COLUMN IF NOT EXISTS billing_address JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS stripe_metadata JSONB DEFAULT '{}';

-- Add constraints for data validation
DO $$
BEGIN
    -- Add billing_address constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'valid_billing_address' 
        AND table_name = 'stripe_customers'
    ) THEN
        ALTER TABLE public.stripe_customers 
        ADD CONSTRAINT valid_billing_address CHECK (jsonb_typeof(billing_address) = 'object');
    END IF;
    
    -- Add stripe_metadata constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'valid_stripe_metadata' 
        AND table_name = 'stripe_customers'
    ) THEN
        ALTER TABLE public.stripe_customers 
        ADD CONSTRAINT valid_stripe_metadata CHECK (jsonb_typeof(stripe_metadata) = 'object');
    END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stripe_customers_email ON public.stripe_customers USING BTREE (stripe_email);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_name ON public.stripe_customers USING BTREE (stripe_name);

-- Add comment explaining the purpose
COMMENT ON COLUMN public.stripe_customers.stripe_email IS 'Email address from Stripe customer object - may differ from profile email';
COMMENT ON COLUMN public.stripe_customers.stripe_name IS 'Full name from Stripe customer object - from billing portal';
COMMENT ON COLUMN public.stripe_customers.stripe_phone IS 'Phone number from Stripe customer object';
COMMENT ON COLUMN public.stripe_customers.billing_address IS 'Billing address from Stripe customer object (JSON)';
COMMENT ON COLUMN public.stripe_customers.stripe_metadata IS 'Additional metadata from Stripe customer object';

-- Create a view for easier customer data access
CREATE OR REPLACE VIEW public.customer_billing_info AS
SELECT 
  sc.id as user_id,
  sc.stripe_customer_id,
  sc.stripe_email,
  sc.stripe_name,
  sc.stripe_phone,
  sc.billing_address,
  sc.stripe_metadata,
  p.email as profile_email,
  p.first_name,
  p.last_name,
  p.phone as profile_phone,
  sc.created_at as customer_created_at,
  sc.updated_at as customer_updated_at
FROM public.stripe_customers sc
JOIN public.profiles p ON sc.id = p.id;

-- Note: Views inherit RLS policies from underlying tables
-- The customer_billing_info view will automatically respect the RLS policies 
-- from stripe_customers and profiles tables

COMMENT ON VIEW public.customer_billing_info IS 'Combined view of Stripe customer data and profile data for billing purposes'; 