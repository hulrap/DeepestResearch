import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-05-28.basil' });

// Extend Stripe.Subscription to include the missing timestamp properties
interface StripeSubscriptionWithTimestamps extends Stripe.Subscription {
  current_period_start: number;
  current_period_end: number;
}

export async function POST(req: Request) {
  // Use service role for webhook operations to bypass RLS
  const supabase = await createClient(true);
  
  let body: string;
  let sig: string | null;
  
  try {
    body = await req.text();
    sig = req.headers.get('stripe-signature');
    
    if (!sig) {
      return NextResponse.json({ error: 'No signature found' }, { status: 400 });
    }
    
    if (!body) {
      return NextResponse.json({ error: 'Empty body' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Failed to extract request data' }, { status: 400 });
  }

  try {
    const event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
    
    // Sync products/prices to database
    if (['product.created', 'product.updated'].includes(event.type)) {
      const product = event.data.object as Stripe.Product;
      await supabase.from('stripe_products').upsert({
        id: product.id,
        active: product.active,
        name: product.name,
        description: product.description,
        image: product.images?.[0],
        metadata: product.metadata
      });
    }
    
    // Handle product deletion/archival
    if (event.type === 'product.deleted') {
      const product = event.data.object as Stripe.Product;
      await supabase.from('stripe_products').delete().eq('id', product.id);
    }
    
    if (['price.created', 'price.updated'].includes(event.type)) {
      const price = event.data.object as Stripe.Price;
      await supabase.from('stripe_prices').upsert({
        id: price.id,
        product_id: price.product as string,
        active: price.active,
        currency: price.currency,
        unit_amount: price.unit_amount,
        type: price.type,
        recurring_interval: price.recurring?.interval,
        recurring_interval_count: price.recurring?.interval_count || 1,
        metadata: price.metadata
      });
    }

    // Handle price deletion/archival
    if (event.type === 'price.deleted') {
      const price = event.data.object as Stripe.Price;
      await supabase.from('stripe_prices').delete().eq('id', price.id);
    }

    // Handle checkout session completion (both one-time and subscriptions)
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // ENFORCE 1 EMAIL = 1 CUSTOMER RULE: Check if customer record exists for this user
      if (session.customer && typeof session.customer === 'string' && session.metadata?.user_id) {
        const { data: existingCustomer, error: customerLookupError } = await supabase
          .from('stripe_customers')
          .select('id, stripe_customer_id')
          .eq('id', session.metadata.user_id) // Look up by id (user's profile id), NOT stripe_customer_id
          .maybeSingle();
          
        if (customerLookupError) {
          console.error(`Customer lookup error for user ${session.metadata.user_id}:`, customerLookupError);
        }

        if (!existingCustomer) {
          // No customer record exists for this user - create one
          try {
            const stripeCustomer = await stripe.customers.retrieve(session.customer);
            
            if (stripeCustomer.deleted) {
              throw new Error('Customer was deleted');
            }
            
            // ✅ ONLY INSERT (not upsert) to prevent duplicates
            const { error: insertError } = await supabase.from('stripe_customers').insert({
              id: session.metadata.user_id, // Use id field that links to profiles(id)
              stripe_customer_id: session.customer,
              stripe_email: stripeCustomer.email,
              stripe_name: stripeCustomer.name,
              stripe_phone: stripeCustomer.phone,
              billing_address: stripeCustomer.address || {},
              stripe_metadata: stripeCustomer.metadata || {}
            });
            
            if (insertError) {
              console.error(`❌ Failed to create customer record for user ${session.metadata.user_id}:`, insertError);
            } else {
              console.log(`✅ Created NEW customer record: user ${session.metadata.user_id} → ${session.customer}`);
            }
          } catch {
            // If Stripe API fails, create basic record
            const { error: basicInsertError } = await supabase.from('stripe_customers').insert({
              id: session.metadata.user_id,
              stripe_customer_id: session.customer
            });
            
            if (basicInsertError) {
              console.error(`❌ Failed to create basic customer record:`, basicInsertError);
            } else {
              console.log(`✅ Created basic customer record for user ${session.metadata.user_id} (Stripe API error)`);
            }
          }
        } else if (existingCustomer.stripe_customer_id !== session.customer) {
          // 🚨 CRITICAL VIOLATION: User already has different Stripe customer
          console.error(`🚨 CUSTOMER DUPLICATION DETECTED:`);
          console.error(`   User: ${session.metadata.user_id}`);
          console.error(`   Existing: ${existingCustomer.stripe_customer_id}`);
          console.error(`   Session:  ${session.customer}`);
          console.error(`   This violates 1 email = 1 customer rule!`);
          
          // TODO: In production, implement customer merging or contact cleanup
          // For now, log the violation but don't create duplicate
        } else {
          console.log(`ℹ️ Customer record already exists: user ${session.metadata.user_id} → ${session.customer}`);
        }
      }

      // Handle one-time payments (donations)
      if (session.mode === 'payment' && session.payment_intent) {
        const paymentIntentId = typeof session.payment_intent === 'string' 
          ? session.payment_intent 
          : session.payment_intent.id;

        // Store payment record with proper user ID from session metadata
        if (session.metadata?.user_id) {
          const { error: paymentError } = await supabase.from('stripe_payments').upsert({
            id: paymentIntentId,
            customer_id: session.metadata.user_id, // Use customer_id field as per actual schema
            amount: session.amount_total || 0,
            currency: session.currency || 'eur',
            status: 'succeeded',
            payment_method_type: 'card',
            metadata: session.metadata || {}
          });
          
          if (paymentError) {
            console.error(`Failed to store payment from checkout session ${session.id}:`, paymentError);
          } else {
            console.log(`Stored payment ${paymentIntentId} for user ${session.metadata.user_id} from checkout session`);
          }
        } else {
          console.error(`Checkout session ${session.id} completed but no user_id in metadata`);
        }
      }

      // Handle subscription checkouts
      if (session.mode === 'subscription' && session.subscription) {
        const subscriptionId = typeof session.subscription === 'string' 
          ? session.subscription 
          : session.subscription.id;

        console.log(`Subscription checkout completed: ${subscriptionId} for user ${session.metadata?.user_id}`);
        
        // The actual subscription sync will be handled by customer.subscription.created webhook
        // But we log here for debugging purposes
        if (session.metadata?.user_id) {
          console.log(`Subscription ${subscriptionId} checkout completed for user ${session.metadata.user_id}`);
        } else {
          console.error(`Subscription checkout session ${session.id} completed but no user_id in metadata`);
        }
      }
    }

    // Handle successful one-time payments
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      // Get user ID by looking up the Stripe customer ID in our database
      if (paymentIntent.customer && typeof paymentIntent.customer === 'string') {
        const { data: customer, error: customerError } = await supabase
          .from('stripe_customers')
          .select('id')
          .eq('stripe_customer_id', paymentIntent.customer)
          .maybeSingle();
          
        if (!customerError && customer) {
          // Store payment record with proper user UUID
          const { error } = await supabase.from('stripe_payments').upsert({
            id: paymentIntent.id,
            customer_id: customer.id, // Use the Supabase user UUID from stripe_customers.id
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: paymentIntent.status,
            payment_method_type: 'card',
            metadata: paymentIntent.metadata || {}
          });
          
          if (error) {
            console.error(`Failed to store payment ${paymentIntent.id} for user ${customer.id}:`, error);
          } else {
            console.log(`Stored payment ${paymentIntent.id} for user ${customer.id} via payment_intent.succeeded`);
          }
        } else {
          console.warn(`Payment intent ${paymentIntent.id} succeeded but customer ${paymentIntent.customer} not found in database`);
          
          // If customer not found, try to get user from metadata or skip
          if (paymentIntent.metadata?.user_id) {
            console.log(`Attempting to store payment with user_id from metadata: ${paymentIntent.metadata.user_id}`);
            
            const { error } = await supabase.from('stripe_payments').upsert({
              id: paymentIntent.id,
              customer_id: paymentIntent.metadata.user_id, // Use the user_id from metadata
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
              status: paymentIntent.status,
              payment_method_type: 'card',
              metadata: paymentIntent.metadata || {}
            });
            
            if (error) {
              console.error(`Failed to store payment with metadata user_id:`, error);
            } else {
              console.log(`Stored payment ${paymentIntent.id} using metadata user_id`);
            }
          }
        }
      } else {
        console.warn(`Payment intent ${paymentIntent.id} succeeded but has no customer attached`);
      }
    }

    // Handle failed one-time payments
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      // Try to get user ID for failed payments too
      let userId = null;
      if (paymentIntent.customer && typeof paymentIntent.customer === 'string') {
        const { data: customer } = await supabase
          .from('stripe_customers')
          .select('id')
          .eq('stripe_customer_id', paymentIntent.customer)
          .maybeSingle();
        userId = customer?.id;
      }
      
      const { error } = await supabase.from('stripe_payments').upsert({
        id: paymentIntent.id,
        customer_id: userId, // Store user UUID, not Stripe customer ID
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: 'failed',
        metadata: paymentIntent.metadata || {}
      });
      
      if (error) {
        console.error(`Failed to store failed payment ${paymentIntent.id}:`, error);
      }
    }

    // Handle customer creation - ENFORCE 1 EMAIL = 1 CUSTOMER RULE
    if (event.type === 'customer.created') {
      const customer = event.data.object as Stripe.Customer;
      
      // Only process if we have user metadata linking to our system
      if (customer.metadata?.supabase_user_id) {
        // ✅ CHECK: Does this user already have a customer record?
        const { data: existingCustomer, error: lookupError } = await supabase
          .from('stripe_customers')
          .select('id, stripe_customer_id')
          .eq('id', customer.metadata.supabase_user_id)
          .maybeSingle();
          
        if (lookupError) {
          console.error(`Customer lookup error during creation for user ${customer.metadata.supabase_user_id}:`, lookupError);
        }
        
        if (!existingCustomer) {
          // ✅ NO EXISTING CUSTOMER: Create new record
          const { error: insertError } = await supabase.from('stripe_customers').insert({
            id: customer.metadata.supabase_user_id, // Use id field - enforces 1:1 with profiles
            stripe_customer_id: customer.id,
            stripe_email: customer.email,
            stripe_name: customer.name,
            stripe_phone: customer.phone,
            billing_address: customer.address || {},
            stripe_metadata: customer.metadata || {}
          });
          
          if (insertError) {
            console.error(`❌ Failed to create customer record for user ${customer.metadata.supabase_user_id}:`, insertError);
          } else {
            console.log(`✅ Created NEW customer via webhook: user ${customer.metadata.supabase_user_id} → ${customer.id}`);
          }
        } else {
          // 🚨 VIOLATION: User already has a customer but Stripe created another one
          console.error(`🚨 DUPLICATE CUSTOMER CREATION BLOCKED:`);
          console.error(`   User: ${customer.metadata.supabase_user_id}`);
          console.error(`   Existing: ${existingCustomer.stripe_customer_id}`);
          console.error(`   New:      ${customer.id}`);
          console.error(`   Stripe created duplicate customer - this should not happen!`);
          
          // TODO: In production, delete the duplicate Stripe customer
          // await stripe.customers.del(customer.id);
        }
      } else {
        console.warn(`Customer ${customer.id} created without supabase_user_id metadata - not linking to database`);
      }
    }

    // Handle customer updates (billing address, name, etc. from portal)
    if (event.type === 'customer.updated') {
      const customer = event.data.object as Stripe.Customer;
      
      // Get our customer record to link to user
      const { data: customerRecord, error: customerError } = await supabase
        .from('stripe_customers')
        .select('id')
        .eq('stripe_customer_id', customer.id)
        .maybeSingle();
        
      if (!customerError && customerRecord) {
        console.log(`Customer updated for user ${customerRecord.id}:`, {
          stripe_customer_id: customer.id,
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          address: customer.address
        });
        
        // Sync customer data to our database
        const { error: syncError } = await supabase.from('stripe_customers').update({
          stripe_email: customer.email,
          stripe_name: customer.name,
          stripe_phone: customer.phone,
          billing_address: customer.address || {},
          stripe_metadata: customer.metadata || {}
        }).eq('stripe_customer_id', customer.id);
        
        if (syncError) {
          console.error('Failed to sync customer data:', syncError);
        } else {
          console.log(`Successfully synced customer data for user ${customerRecord.id}`);
        }
      }
      
      // Updates from billing portal will automatically be used in future checkout sessions
      // thanks to customer_update: 'auto' in our checkout configuration
    }

    // Handle payment method updates from billing portal and checkout
    if (['payment_method.attached', 'payment_method.detached'].includes(event.type)) {
      const paymentMethod = event.data.object as Stripe.PaymentMethod;
      
      if (paymentMethod.customer && typeof paymentMethod.customer === 'string') {
        // Get our customer record to link to user
        const { data: customer, error: customerError } = await supabase
          .from('stripe_customers')
          .select('id')
          .eq('stripe_customer_id', paymentMethod.customer)
          .maybeSingle();
          
        if (!customerError && customer) {
          console.log(`Payment method ${event.type === 'payment_method.attached' ? 'added' : 'removed'} for user ${customer.id}:`, {
            payment_method_id: paymentMethod.id,
            type: paymentMethod.type,
            brand: paymentMethod.card?.brand,
            last4: paymentMethod.card?.last4
          });
          
          // When payment method is attached, check for duplicates and update customer record
          if (event.type === 'payment_method.attached') {
            try {
              // DEDUPLICATION: Check for duplicate payment methods using card fingerprint
              if (paymentMethod.type === 'card' && paymentMethod.card?.fingerprint) {
                console.log(`Checking for duplicate payment methods for customer ${paymentMethod.customer}, fingerprint: ${paymentMethod.card.fingerprint}`);
                
                // List all payment methods for this customer
                const existingPaymentMethods = await stripe.paymentMethods.list({
                  customer: paymentMethod.customer,
                  type: 'card'
                });
                
                // Find other payment methods with the same fingerprint (excluding the current one)
                const duplicatePaymentMethods = existingPaymentMethods.data.filter(pm => 
                  pm.id !== paymentMethod.id && 
                  pm.card?.fingerprint === paymentMethod.card?.fingerprint
                );
                
                if (duplicatePaymentMethods.length > 0) {
                  console.log(`Found ${duplicatePaymentMethods.length} duplicate payment method(s) for user ${customer.id}:`, {
                    current_pm: paymentMethod.id,
                    duplicates: duplicatePaymentMethods.map(pm => ({
                      id: pm.id,
                      last4: pm.card?.last4,
                      brand: pm.card?.brand,
                      exp_month: pm.card?.exp_month,
                      exp_year: pm.card?.exp_year
                    }))
                  });
                  
                  // Detach the newly added payment method (keep the older one)
                  try {
                    await stripe.paymentMethods.detach(paymentMethod.id);
                    console.log(`✅ Detached duplicate payment method ${paymentMethod.id} for user ${customer.id} (fingerprint: ${paymentMethod.card.fingerprint})`);
                    
                    // Early return - don't sync customer data since we removed the payment method
                    return;
                  } catch (detachError) {
                    console.error(`Failed to detach duplicate payment method ${paymentMethod.id}:`, detachError);
                    // Continue with normal processing if detachment fails
                  }
                } else {
                  console.log(`No duplicate payment methods found for user ${customer.id}, keeping payment method ${paymentMethod.id}`);
                }
              }
              
              // Fetch fresh customer data from Stripe to sync any new billing info
              const stripeCustomer = await stripe.customers.retrieve(paymentMethod.customer);
              
              if (!stripeCustomer.deleted) {
                // Update our customer record with latest Stripe data
                const { error: syncError } = await supabase.from('stripe_customers').update({
                  stripe_email: stripeCustomer.email,
                  stripe_name: stripeCustomer.name,
                  stripe_phone: stripeCustomer.phone,
                  billing_address: stripeCustomer.address || {},
                  stripe_metadata: stripeCustomer.metadata || {}
                }).eq('stripe_customer_id', paymentMethod.customer);
                
                if (syncError) {
                  console.error('Failed to sync customer data after payment method attachment:', syncError);
                } else {
                  console.log(`Synced customer data for user ${customer.id} after payment method attachment`);
                }
              }
            } catch (error) {
              console.error('Failed to process payment method attachment:', error);
              // Continue processing even if deduplication fails to avoid breaking existing functionality
            }
          }
        }
      }
    }

    // Handle setup intent success (when payment method is saved during checkout)
    if (event.type === 'setup_intent.succeeded') {
      const setupIntent = event.data.object as Stripe.SetupIntent;
      
      if (setupIntent.customer && typeof setupIntent.customer === 'string') {
        // Get our customer record to link to user
        const { data: customer, error: customerError } = await supabase
          .from('stripe_customers')
          .select('id')
          .eq('stripe_customer_id', setupIntent.customer)
          .maybeSingle();
          
        if (!customerError && customer) {
          console.log(`Setup intent succeeded for user ${customer.id}:`, {
            setup_intent_id: setupIntent.id,
            payment_method_id: setupIntent.payment_method,
            usage: setupIntent.usage,
            status: setupIntent.status
          });
          
          // Optional: Store setup intent events for conversion tracking
          // This helps track successful payment method saves vs checkout completions
          /*
          await supabase.from('setup_intent_events').insert({
            user_id: customer.user_id,
            stripe_customer_id: setupIntent.customer,
            setup_intent_id: setupIntent.id,
            payment_method_id: setupIntent.payment_method as string,
            status: setupIntent.status,
            usage: setupIntent.usage,
            created_at: new Date(setupIntent.created * 1000).toISOString()
          });
          */
          
          // If this was for future payments, customer now has a saved payment method
          // which enables subscription features and easier future payments
          if (setupIntent.usage === 'off_session') {
            // Customer can now be charged for subscriptions or future purchases
            // without being present (off-session payments)
          }
        }
      }
    }
    
    // Sync subscriptions to database
    if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
      const subscription = event.data.object as StripeSubscriptionWithTimestamps;
      try {
        const priceId = subscription.items.data[0]?.price.id;
        
        console.log(`Processing subscription webhook: ${subscription.id}, user_id: ${subscription.metadata?.user_id}, customer: ${subscription.customer}`);
        
        if (priceId && subscription.customer && typeof subscription.customer === 'string') {
          // First try metadata user_id, then fallback to customer lookup
          let customer: { id: string } | null = null;
          
          if (subscription.metadata?.user_id) {
            const { data: customerByUserId, error: userLookupError } = await supabase
              .from('stripe_customers')
              .select('id')
              .eq('id', subscription.metadata.user_id)
              .maybeSingle();
              
            if (userLookupError) {
              console.error(`User lookup error for ${subscription.metadata.user_id}:`, userLookupError);
              throw userLookupError;
            }
              
            if (customerByUserId) {
              customer = customerByUserId;
              console.log(`Found customer via metadata: ${subscription.metadata.user_id}`);
            }
          }
          
          if (!customer) {
            const { data: customerByStripeId, error: customerLookupError } = await supabase
              .from('stripe_customers')
              .select('id')
              .eq('stripe_customer_id', subscription.customer)
              .maybeSingle();
              
            if (customerLookupError) {
              console.error(`Customer lookup error for ${subscription.customer}:`, customerLookupError);
              throw customerLookupError;
            }
              
            if (customerByStripeId) {
              customer = customerByStripeId;
              console.log(`Found customer via stripe_customer_id: ${subscription.customer}`);
            }
          }

          if (customer) {
            console.log(`Attempting to upsert subscription for user: ${customer.id}`);
            
            // Get period dates safely (could be on subscription or subscription item)
            const item = subscription.items.data[0];
            const periodStart = item?.current_period_start || subscription.current_period_start;
            const periodEnd = item?.current_period_end || subscription.current_period_end;
            
            // Validate dates before conversion
            if (!periodStart || !periodEnd) {
              throw new Error(`Missing period dates: start=${periodStart}, end=${periodEnd}`);
            }
            
            const { error: syncError } = await supabase.from('stripe_subscriptions').upsert({
              id: subscription.id,
              user_id: customer.id,
              stripe_customer_id: subscription.customer,
              status: event.type === 'customer.subscription.deleted' ? 'canceled' : subscription.status,
              price_id: priceId,
              current_period_start: new Date(periodStart * 1000).toISOString(),
              current_period_end: new Date(periodEnd * 1000).toISOString(),
              canceled_at: event.type === 'customer.subscription.deleted' ? 
                (subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : new Date().toISOString()) : 
                null,
              metadata: subscription.metadata || {}
            });
            
            if (syncError) {
              console.error(`CRITICAL: Subscription upsert failed for ${subscription.id}:`, syncError);
              throw syncError;
            } else {
              console.log(`SUCCESS: Synced subscription ${subscription.id} for user ${customer.id}`);
            }
          } else {
            console.error(`CRITICAL: No customer found for subscription ${subscription.id}, customer_id: ${subscription.customer}, user_id: ${subscription.metadata?.user_id}`);
            throw new Error(`Customer not found for subscription ${subscription.id}`);
          }
        } else {
          console.error(`CRITICAL: Missing required data - priceId: ${priceId}, customer: ${subscription.customer}`);
          throw new Error(`Missing required subscription data`);
        }
      } catch (subscriptionError) {
        console.error(`SUBSCRIPTION WEBHOOK ERROR:`, subscriptionError);
                 return NextResponse.json({ 
           error: 'Subscription processing failed',
           details: subscriptionError instanceof Error ? subscriptionError.message : 'Unknown error',
           subscription_id: subscription.id
         }, { status: 400 });
      }
    }

    // Handle invoice creation and finalization
    if (['invoice.created', 'invoice.finalized', 'invoice.paid'].includes(event.type)) {
      const invoice = event.data.object as Stripe.Invoice;
      
      // Sync invoice data to ensure it shows up in billing portal
      if (invoice.customer && typeof invoice.customer === 'string') {
        const { data: customer, error: customerError } = await supabase
          .from('stripe_customers')
          .select('id')
          .eq('stripe_customer_id', invoice.customer)
          .maybeSingle();
          
        if (!customerError && customer) {
          console.log(`Invoice ${event.type} for user ${customer.id}:`, {
            invoice_id: invoice.id,
            amount: invoice.amount_paid || invoice.amount_due,
            status: invoice.status,
            payment_type: invoice.metadata?.payment_type
          });
          
          // For donation invoices, ensure payment record exists
          if (invoice.metadata?.payment_type === 'donation' && invoice.status === 'paid') {
            const { error: paymentError } = await supabase.from('stripe_payments').upsert({
              id: `inv_${invoice.id}`, // Use prefixed invoice ID to avoid conflicts
              customer_id: customer.id, // Use the user UUID from stripe_customers.id
              amount: invoice.amount_paid || 0,
              currency: invoice.currency,
              status: 'succeeded',
              payment_method_type: 'card',
              metadata: {
                invoice_id: invoice.id,
                payment_type: 'donation',
                ...(invoice.metadata || {})
              }
            });
            
            if (paymentError) {
              console.error('Failed to store invoice payment:', paymentError);
            } else {
              console.log(`Stored invoice payment for user ${customer.id}`);
            }
          }
        }
      }
    }

    // Handle invoice payment events (for donations that create invoices)
    if (['invoice.payment_succeeded', 'invoice.payment_failed'].includes(event.type)) {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string | Stripe.Subscription };
      
      if (invoice.subscription) {
        // Update subscription status based on payment success/failure
        const status = event.type === 'invoice.payment_succeeded' ? 'active' : 'past_due';
        const subscriptionId = typeof invoice.subscription === 'string' 
          ? invoice.subscription 
          : invoice.subscription.id;
        
        await supabase.from('stripe_subscriptions')
          .update({ status })
          .eq('id', subscriptionId);
      } else {
        // Handle one-time donation invoice payments
        if (event.type === 'invoice.payment_succeeded' && invoice.metadata?.payment_type === 'donation') {
          // Get customer info to link to user
          if (invoice.customer && typeof invoice.customer === 'string') {
                    const { data: customer, error: customerError } = await supabase
          .from('stripe_customers')
          .select('id')
          .eq('stripe_customer_id', invoice.customer)
          .maybeSingle();
              
            if (!customerError && customer) {
              // Store payment record for donation using invoice ID
              const { error: paymentError } = await supabase.from('stripe_payments').upsert({
                id: invoice.id, // Use invoice ID as unique identifier
                customer_id: customer.id, // Use the user UUID from stripe_customers.id
                amount: invoice.amount_paid,
                currency: invoice.currency,
                status: 'succeeded',
                payment_method_type: 'card',
                metadata: {
                  invoice_id: invoice.id,
                  payment_type: 'donation',
                  ...(invoice.metadata || {})
                }
              });
              
              if (paymentError) {
                // Error handled silently
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ 
      received: true, 
      eventType: event.type,
      eventId: event.id,
      timestamp: new Date().toISOString()
    });
  } catch {
    // Return proper webhook response format
    return NextResponse.json({ 
      error: 'Webhook processing failed',
      timestamp: new Date().toISOString()
    }, { status: 400 });
  }
}

// Add GET method for webhook endpoint testing
export async function GET() {
  return NextResponse.json({
    message: 'Stripe Webhook Endpoint',
    status: 'active',
    timestamp: new Date().toISOString(),
    endpoints: {
      'POST /api/stripe/webhooks': 'Receives Stripe webhook events',
      'GET /api/stripe/webhooks': 'Webhook endpoint status check'
    }
  });
} 