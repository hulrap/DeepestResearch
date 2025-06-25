import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' });

/**
 * Stripe Billing Portal - Out-of-the-Box Features
 * 
 * This endpoint uses Stripe's Customer Portal which provides:
 * ✅ Invoice history & PDF downloads
 * ✅ Payment method management (add/remove cards)
 * ✅ Subscription management (upgrade/downgrade/cancel)
 * ✅ Billing address updates
 * ✅ Tax ID collection
 * ✅ Email updates
 * ✅ Proration handling
 * ✅ PCI compliance out-of-the-box
 * 
 * To customize the portal further:
 * 1. Go to Stripe Dashboard > Settings > Billing > Customer Portal
 * 2. Configure which features to enable/disable
 * 3. Customize branding, terms, and messaging
 * 4. Set up custom return URLs
 * 
 * This follows Stripe's best practices for customer self-service billing.
 */

// Create or get a configuration that ensures invoice history is enabled
async function getOrCreatePortalConfiguration() {
  try {
    // First, try to get existing configurations
    const configurations = await stripe.billingPortal.configurations.list({ limit: 10 });
    
    // Look for a configuration with invoice history enabled
    const existingConfig = configurations.data.find(config => 
      config.active && config.features.invoice_history?.enabled
    );
    
    if (existingConfig) {
      console.log('Using existing portal configuration:', existingConfig.id);
      return existingConfig.id;
    }
    
    console.log('Creating new portal configuration...');
    
    // Get active products and prices for subscription management
    const supabase = await createClient(true);
    const { data: activeProducts } = await supabase
      .from('stripe_products')
      .select(`
        id,
        name,
        stripe_prices!inner (
          id,
          type,
          active,
          unit_amount,
          recurring_interval
        )
      `)
      .eq('active', true)
      .eq('stripe_prices.active', true)
      .eq('stripe_prices.type', 'recurring');

    // Build product catalog for subscription management
    const products = activeProducts?.map(product => ({
      product: product.id,
      prices: product.stripe_prices.map((price: { id: string }) => price.id)
    })) || [];

    // Create a new configuration with all necessary features enabled
    const newConfig = await stripe.billingPortal.configurations.create({
      features: {
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        customer_update: { 
          enabled: true,
          allowed_updates: ['email', 'address', 'phone', 'tax_id']
        },
        subscription_update: {
          enabled: true, // Enable subscription management
          default_allowed_updates: ['price', 'quantity'],
          proration_behavior: 'create_prorations',
          products: products.length > 0 ? products : undefined // Add product catalog for plan switching
        },
        subscription_cancel: {
          enabled: true, // Enable subscription cancellation
          mode: 'at_period_end',
          cancellation_reason: {
            enabled: true,
            options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other']
          }
        }
      },
      business_profile: {
        headline: 'Manage your donations and subscription',
        privacy_policy_url: process.env.NEXT_PUBLIC_SITE_URL ? 
          `${process.env.NEXT_PUBLIC_SITE_URL}/privacy-policy` : undefined,
        terms_of_service_url: process.env.NEXT_PUBLIC_SITE_URL ? 
          `${process.env.NEXT_PUBLIC_SITE_URL}/imprint` : undefined
      },
      default_return_url: process.env.NEXT_PUBLIC_SITE_URL ? 
        `${process.env.NEXT_PUBLIC_SITE_URL}/en/protected` : undefined
    });
    
    console.log('Created new portal configuration:', newConfig.id);
    return newConfig.id;
  } catch (error) {
    console.error('Portal configuration error:', error);
    throw new Error(`Failed to configure billing portal: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function POST(req: Request) {
  const supabase = await createClient(true); // Use service role to bypass RLS
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    const origin = req.headers.get('origin');
    const errorResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    errorResponse.headers.set('Access-Control-Allow-Origin', origin || '*');
    return errorResponse;
  }

  try {
    // Get locale from request body if provided
    const body = await req.json().catch(() => ({}));
    const { locale } = body;
    const userLocale = locale || 'en';
    const { data: stripeCustomer, error: customerError } = await supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    if (customerError) {
      const origin = req.headers.get('origin');
      const errorResponse = NextResponse.json({ error: 'Database error' }, { status: 500 });
      errorResponse.headers.set('Access-Control-Allow-Origin', origin || '*');
      return errorResponse;
    }

    let customerIds: { stripe_customer_id: string };

    // Create customer on-demand if they don't exist yet
    if (!stripeCustomer) {
      // Get user profile data to prefill customer information  
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone')
        .eq('id', user.id)
        .single();

      // Create customer with available profile data for better portal experience
      const customerData: Stripe.CustomerCreateParams = {
        email: user.email || '',
        metadata: { 
          supabase_user_id: user.id,
          created_for: 'billing_portal_access' 
        }
      };

      // Add name if available from profile
      if (userProfile?.first_name || userProfile?.last_name) {
        customerData.name = `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim();
      }

      // Add phone if available from profile
      if (userProfile?.phone) {
        customerData.phone = userProfile.phone;
      }

      const customer = await stripe.customers.create(customerData);
      
      // Save to database
      const { error: insertError } = await supabase.from('stripe_customers').insert({
        id: user.id,
        stripe_customer_id: customer.id
      });
      
      if (insertError) {
        throw new Error(`Customer database save failed: ${insertError.message}`);
      }
      
      customerIds = { stripe_customer_id: customer.id };
    } else {
      customerIds = stripeCustomer;
    }

    const origin = req.headers.get('origin');

    // Get or create a configuration that ensures invoice history is enabled
    const configurationId = await getOrCreatePortalConfiguration();

    // Create billing portal session with explicit configuration
    const session = await stripe.billingPortal.sessions.create({
      customer: customerIds.stripe_customer_id,
      configuration: configurationId, // Use our custom configuration
      return_url: `${origin}/${userLocale}/protected?from=billing`, // Return to donation page with context
    });

    const response = NextResponse.json({ url: session.url });
    
    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', origin || '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return response;
  } catch (error) {
    console.error('Billing portal error:', error);
    
    // Provide specific error message for portal configuration issue
    let errorMessage = 'Failed to create billing portal session. Please try again.';
    let statusCode = 500;
    
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMsg = (error as { message?: string }).message;
      if (errorMsg?.includes('No configuration provided') || 
          errorMsg?.includes('default configuration has not been created')) {
        errorMessage = 'Billing portal requires setup in Stripe Dashboard. Please contact support or try again later.';
        statusCode = 503; // Service Unavailable
      }
    }
    
    const errorResponse = NextResponse.json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : 
        undefined
    }, { status: statusCode });
    
    // Add CORS headers to error responses too
    const origin = req.headers.get('origin');
    errorResponse.headers.set('Access-Control-Allow-Origin', origin || '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'POST');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return errorResponse;
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin');
  
  const response = new NextResponse(null, { status: 200 });
  response.headers.set('Access-Control-Allow-Origin', origin || '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400');
  
  return response;
} 