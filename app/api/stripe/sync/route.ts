import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' });

// Extend Stripe.Subscription to include the missing timestamp properties
interface StripeSubscriptionWithTimestamps extends Stripe.Subscription {
  current_period_start: number;
  current_period_end: number;
}

export async function POST() {
  try {
    // Use service role for sync operations to bypass RLS
    const supabase = await createClient(true);
    
    const result = {
      customers: { synced: 0, errors: 0 },
      products: { synced: 0, errors: 0 },
      prices: { synced: 0, errors: 0 },
      subscriptions: { synced: 0, errors: 0 },
      payments: { synced: 0, errors: 0 },
      totalTime: 0
    };
    
    const startTime = Date.now();
    
    // 1. Sync Products
    const products = await stripe.products.list({ limit: 100, active: true });
    
    for (const product of products.data) {
      try {
        const { error } = await supabase.from('stripe_products').upsert({
          id: product.id,
          active: product.active,
          name: product.name,
          description: product.description,
          image: product.images?.[0],
          metadata: product.metadata || {}
        });
        
        if (error) {
          result.products.errors++;
        } else {
          result.products.synced++;
        }
      } catch {
        result.products.errors++;
      }
    }

    // 2. Sync Prices
    const prices = await stripe.prices.list({ limit: 100, active: true });
    
    for (const price of prices.data) {
      try {
        const { error } = await supabase.from('stripe_prices').upsert({
          id: price.id,
          product_id: price.product as string,
          active: price.active,
          currency: price.currency,
          unit_amount: price.unit_amount,
          type: price.type,
          recurring_interval: price.recurring?.interval || null,
          recurring_interval_count: price.recurring?.interval_count || 1,
          metadata: price.metadata || {}
        });
        
        if (error) {
          result.prices.errors++;
        } else {
          result.prices.synced++;
        }
      } catch {
        result.prices.errors++;
      }
    }

    // 3. Sync Customers (STRICT metadata-only mapping to prevent ID mixing)
    const customers = await stripe.customers.list({ limit: 100 });
    
    for (const customer of customers.data) {
      try {
        // ONLY use metadata for mapping - never fallback to email lookup
        // This prevents accidental user ID mixing
        const userId = customer.metadata?.supabase_user_id;
        
        if (userId) {
          // Verify the user actually exists before creating customer record
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, email')
            .eq('id', userId)
            .maybeSingle();
          
          if (profileError || !profile) {
            console.warn(`Skipping customer ${customer.id}: User ${userId} not found in profiles`);
            result.customers.errors++;
            continue;
          }
          
          // Check if this customer ID is already linked to a different user
          const { data: existingCustomer } = await supabase
            .from('stripe_customers')
            .select('id')
            .eq('stripe_customer_id', customer.id)
            .maybeSingle();
          
          if (existingCustomer && existingCustomer.id !== userId) {
            console.warn(`Customer ID conflict: ${customer.id} already linked to user ${existingCustomer.id}, not ${userId}`);
            result.customers.errors++;
            continue;
          }
          
          // Safe to upsert now
          const { error } = await supabase.from('stripe_customers').upsert({
            id: userId,
            stripe_customer_id: customer.id,
            stripe_email: customer.email,
            stripe_name: customer.name,
            stripe_phone: customer.phone,
            billing_address: customer.address || {},
            stripe_metadata: customer.metadata || {}
          });
          
          if (error) {
            console.error(`Failed to sync customer ${customer.id}:`, error);
            result.customers.errors++;
          } else {
            result.customers.synced++;
          }
        } else {
          // Skip customers without proper metadata - don't guess based on email
          console.log(`Skipping customer ${customer.id}: No supabase_user_id in metadata`);
        }
      } catch (error) {
        console.error(`Error processing customer ${customer.id}:`, error);
        result.customers.errors++;
      }
    }

    // 4. Sync Subscriptions
    const subscriptions = await stripe.subscriptions.list({ 
      limit: 100,
      status: 'all'
    });
    
    for (const subscription of subscriptions.data) {
      try {
        const { data: customer } = await supabase
          .from('stripe_customers')
          .select('id')
          .eq('stripe_customer_id', subscription.customer as string)
          .maybeSingle();
        
        if (customer) {
          const priceId = subscription.items.data[0]?.price.id;
          
          // Get period dates safely (could be on subscription or subscription item)
          const subscriptionWithTimestamps = subscription as StripeSubscriptionWithTimestamps;
          const item = subscription.items.data[0];
          const periodStart = item?.current_period_start || subscriptionWithTimestamps.current_period_start;
          const periodEnd = item?.current_period_end || subscriptionWithTimestamps.current_period_end;
          
          // Skip if missing period dates
          if (!periodStart || !periodEnd) {
            console.warn(`Skipping subscription ${subscription.id}: missing period dates`);
            result.subscriptions.errors++;
            continue;
          }
          
          const { error } = await supabase.from('stripe_subscriptions').upsert({
            id: subscription.id,
            user_id: customer.id,
            stripe_customer_id: subscription.customer as string,
            status: subscription.status,
            price_id: priceId,
            current_period_start: new Date(periodStart * 1000).toISOString(),
            current_period_end: new Date(periodEnd * 1000).toISOString(),
            canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
            metadata: subscription.metadata || {}
          });
          
          if (error) {
            result.subscriptions.errors++;
          } else {
            result.subscriptions.synced++;
          }
        }
      } catch {
        result.subscriptions.errors++;
      }
    }

    // 5. Sync Payment Intents (for one-time payments)
    const paymentIntents = await stripe.paymentIntents.list({ 
      limit: 100,
      expand: ['data.customer']
    });
    
    for (const paymentIntent of paymentIntents.data) {
      try {
        if (paymentIntent.status === 'succeeded' && paymentIntent.customer) {
          const customerId = typeof paymentIntent.customer === 'string' 
            ? paymentIntent.customer 
            : paymentIntent.customer.id;
            
          const { data: customer } = await supabase
            .from('stripe_customers')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();
          
          if (customer) {
            const { error } = await supabase.from('stripe_payments').upsert({
              id: paymentIntent.id,
              customer_id: customer.id,
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
              status: paymentIntent.status,
              payment_method_type: 'card',
              metadata: paymentIntent.metadata || {}
            });
            
            if (error) {
              result.payments.errors++;
            } else {
              result.payments.synced++;
            }
          }
        }
      } catch {
        result.payments.errors++;
      }
    }

    result.totalTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      message: 'Stripe data synced successfully',
      result
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Sync failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Stripe Sync Endpoint',
    usage: 'POST to this endpoint to sync all Stripe data to Supabase',
    endpoints: {
      'POST /api/stripe/sync': 'Sync all Stripe data (products, prices, customers, subscriptions, payments)',
      'GET /api/stripe/sync': 'Sync endpoint status check'
    }
  });
} 