import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' });

/**
 * Stripe Checkout API - Fully Integrated with Billing Portal
 * 
 * This implementation ensures complete bidirectional synchronization between
 * Stripe Checkout and the Billing Portal:
 * 
 * 🔄 FROM BILLING PORTAL TO CHECKOUT:
 * - Payment methods saved in portal are auto-prefilled in checkout
 * - Billing addresses from portal are auto-prefilled
 * - Customer name/phone from portal are auto-prefilled
 * 
 * 🔄 FROM CHECKOUT TO BILLING PORTAL:
 * - Payment methods saved during checkout appear in portal
 * - Billing addresses entered during checkout update portal
 * - Customer data entered during checkout updates portal
 * 
 * ✅ AUTOMATIC FEATURES:
 * - Same Stripe customer ID used everywhere
 * - Customer data prefilled from Supabase profiles
 * - Payment method saving enabled with setup_future_usage
 * - Billing address collection for consistency
 * - Customer updates sync automatically via webhooks
 */

// Rate limiting helper with exponential backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      // Check if it's a rate limit error (429)
      if (error && typeof error === 'object' && 'type' in error && 'code' in error && 
          (error as { type: string; code: string }).type === 'StripeError' && 
          (error as { type: string; code: string }).code === 'rate_limit') {
        if (attempt === maxRetries) {
          throw error; // Last attempt failed
        }
        
        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Non-rate-limit error, throw immediately
      throw error;
    }
  }
  
  throw new Error('Max retries exceeded');
}

export async function POST(req: Request) {
  // Check Content-Type header
  const contentType = req.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return NextResponse.json(
      { error: 'Content-Type must be application/json' }, 
      { status: 406 }
    );
  }
  
  // Validate environment variables first
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }
  
  const supabase = await createClient(true); // Use service role to bypass RLS
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { priceId, locale } = body;
    
    if (!priceId) {
      return NextResponse.json({ error: 'Price ID is required' }, { status: 400 });
    }
    
    // Use provided locale or fallback to 'en'
    const userLocale = locale || 'en';
    
    // Get or create Stripe customer
    const { data: stripeCustomer, error: customerLookupError } = await supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();
      
    if (customerLookupError && customerLookupError.code !== 'PGRST116') {
      throw new Error(`Customer lookup failed: ${customerLookupError.message}`);
    }

    let finalStripeCustomer: { stripe_customer_id: string };

    if (!stripeCustomer) {
      // Get user profile data to prefill customer information
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone')
        .eq('id', user.id)
        .single();

      // Create customer with available profile data for better billing portal experience
      const customerData: Stripe.CustomerCreateParams = {
        email: user.email || '',
        metadata: { supabase_user_id: user.id }
      };

      // Add name if available from profile
      if (userProfile?.first_name || userProfile?.last_name) {
        customerData.name = `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim();
      }

      // Add phone if available from profile  
      if (userProfile?.phone) {
        customerData.phone = userProfile.phone;
      }

      const customer = await withRetry(() => stripe.customers.create(customerData));
      
      const { error: insertError } = await supabase.from('stripe_customers').insert({
        id: user.id,
        stripe_customer_id: customer.id
      });
      
      if (insertError) {
        throw new Error(`Customer database save failed: ${insertError.message}`);
      }
      
      finalStripeCustomer = { stripe_customer_id: customer.id };
    } else {
      finalStripeCustomer = stripeCustomer;
    }

    // Get price details to determine if it's a subscription or one-time payment
    const price = await withRetry(() => stripe.prices.retrieve(priceId));

    const origin = req.headers.get('origin');
    
    // Create checkout session based on price type
    let sessionData: Stripe.Checkout.SessionCreateParams;
    
    if (price.type === 'one_time') {
      // Check if this is a "pay as you wish" price (unit_amount is null)
      if (price.unit_amount === null) {
        // Use the price directly - Stripe handles custom amount input natively
        sessionData = {
          customer: finalStripeCustomer.stripe_customer_id,
          mode: 'payment',
          payment_method_types: ['card'],
          line_items: [{
            price: priceId,
            quantity: 1
          }],
          // Enable payment method saving for billing portal integration
          payment_intent_data: {
            setup_future_usage: 'on_session', // Save payment method for future use
          },
          // Enable pre-filling saved payment methods from billing portal
          saved_payment_method_options: {
            payment_method_save: 'enabled',
            allow_redisplay_filters: ['always']
          },
          // Enable invoice creation for donations (shows up in billing portal)
          invoice_creation: {
            enabled: true,
            invoice_data: {
              description: 'Donation - Thank you for your support!',
              metadata: {
                payment_type: 'donation',
                user_id: user.id,
                price_id: priceId
              },
              footer: 'Thank you for your generous donation!'
            }
          },
          // Auto-prefill customer data from billing portal if available
          customer_update: {
            address: 'auto', // Update customer address if user enters different one
            name: 'auto',    // Update customer name if user enters different one
            shipping: 'auto' // Update shipping address if provided
          },
          // Auto-collect billing address only if customer doesn't have one saved
          billing_address_collection: 'auto',
          success_url: `${origin}/${userLocale}/protected?success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/${userLocale}/protected?canceled=true`,
          metadata: {
            user_id: user.id,
            price_id: priceId,
            payment_type: 'donation'
          }
        };
      } else {
        // Fixed amount one-time payment
        sessionData = {
          customer: finalStripeCustomer.stripe_customer_id,
          mode: 'payment',
          payment_method_types: ['card'],
          line_items: [{
            price: priceId,
            quantity: 1
          }],
          // Enable payment method saving for billing portal integration
          payment_intent_data: {
            setup_future_usage: 'on_session', // Save payment method for future use
          },
          // Enable pre-filling saved payment methods from billing portal
          saved_payment_method_options: {
            payment_method_save: 'enabled',
            allow_redisplay_filters: ['always']
          },
          // Enable invoice creation for donations (shows up in billing portal)
          invoice_creation: {
            enabled: true,
            invoice_data: {
              description: 'Donation - Thank you for your support!',
              metadata: {
                payment_type: 'donation',
                user_id: user.id,
                price_id: priceId
              },
              footer: 'Thank you for your generous donation!'
            }
          },
          // Auto-prefill customer data from billing portal if available
          customer_update: {
            address: 'auto', // Update customer address if user enters different one
            name: 'auto',    // Update customer name if user enters different one
            shipping: 'auto' // Update shipping address if provided
          },
          // Auto-collect billing address only if customer doesn't have one saved
          billing_address_collection: 'auto',
          success_url: `${origin}/${userLocale}/protected?success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/${userLocale}/protected?canceled=true`,
          metadata: {
            user_id: user.id,
            price_id: priceId,
            payment_type: 'donation'
          }
        };
      }
    } else {
      // Subscription payment
      sessionData = {
        customer: finalStripeCustomer.stripe_customer_id,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        // Enable pre-filling saved payment methods from billing portal
        saved_payment_method_options: {
          payment_method_save: 'enabled',
          allow_redisplay_filters: ['always']
        },
        // Auto-prefill customer data from billing portal if available
        customer_update: {
          address: 'auto', // Update customer address if user enters different one
          name: 'auto',    // Update customer name if user enters different one
          shipping: 'auto' // Update shipping address if provided
        },
        // Auto-collect billing address only if customer doesn't have one saved
        billing_address_collection: 'auto',
        success_url: `${origin}/${userLocale}/protected?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/${userLocale}/protected?canceled=true`,
        metadata: {
          user_id: user.id,
          price_id: priceId
        },
        // CRITICAL: Add subscription metadata to ensure user_id is available in subscription webhooks
        subscription_data: {
          metadata: {
            user_id: user.id,
            price_id: priceId,
            created_via: 'checkout'
          }
        }
      };
    }
    
    const session = await withRetry(() => stripe.checkout.sessions.create(sessionData));

    const response = NextResponse.json({ url: session.url });
    
    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', origin || '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return response;
    
  } catch (error) {
    // Return generic error message to prevent information disclosure
    const errorResponse = NextResponse.json({ 
      error: 'Failed to create checkout session. Please try again.',
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : 
        undefined
    }, { status: 500 });
    
    // Add CORS headers to error responses too
    const origin = req.headers.get('origin');
    errorResponse.headers.set('Access-Control-Allow-Origin', origin || '*');
    errorResponse.headers.set('Access-Control-Allow-Methods', 'POST');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return errorResponse;
  }
}

// Handle preflight OPTIONS requests
export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin');
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
} 