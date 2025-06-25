const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function syncStripeData() {
  console.log('🔄 Starting Stripe data sync...');
  
  try {
    // 1. Fetch all active products from Stripe
    console.log('📦 Fetching products from Stripe...');
    const products = await stripe.products.list({ 
      limit: 100,
      active: true
    });
    
    console.log(`Found ${products.data.length} active products in Stripe`);
    
    // 2. Sync products to database
    console.log('💾 Syncing products to database...');
    for (const product of products.data) {
      console.log(`Syncing product: ${product.name} (${product.id})`);
      
      const { error: productError } = await supabase.from('stripe_products').upsert({
        id: product.id,
        active: product.active,
        name: product.name,
        description: product.description,
        image: product.images?.[0] || null,
        metadata: product.metadata || {}
      });
      
      if (productError) {
        console.error(`Failed to sync product ${product.id}:`, productError);
      } else {
        console.log(`✅ Product synced: ${product.name}`);
      }
    }
    
    // 3. Fetch ALL prices from Stripe (both active and inactive)
    console.log('💰 Fetching all prices from Stripe...');
    const allPrices = await stripe.prices.list({ 
      limit: 100
    });
    
    console.log(`Found ${allPrices.data.length} total prices in Stripe`);
    
    // 4. Sync prices to database (including updating inactive ones)
    console.log('💾 Syncing prices to database...');
    for (const price of allPrices.data) {
      console.log(`Syncing price: ${price.id} (${price.unit_amount} ${price.currency}) - Active: ${price.active}`);
      
      const { error: priceError } = await supabase.from('stripe_prices').upsert({
        id: price.id,
        product_id: price.product,
        active: price.active, // This will now properly mark archived prices as inactive
        currency: price.currency,
        unit_amount: price.unit_amount, // This will be null for pay-as-you-wish
        type: price.type,
        recurring_interval: price.recurring?.interval || null,
        recurring_interval_count: price.recurring?.interval_count || 1,
        metadata: price.metadata || {}
      });
      
      if (priceError) {
        console.error(`Failed to sync price ${price.id}:`, priceError);
      } else {
        const status = price.active ? 'active' : 'archived';
        console.log(`✅ Price synced: ${price.unit_amount || 'pay-as-you-wish'} ${price.currency} (${status})`);
      }
    }
    
    // 5. Clean up any orphaned prices that no longer exist in Stripe
    console.log('🧹 Cleaning up orphaned prices...');
    const stripePageIds = allPrices.data.map(p => p.id);
    const { data: dbPrices } = await supabase.from('stripe_prices').select('id');
    
    if (dbPrices) {
      const orphanedPrices = dbPrices.filter(dbPrice => !stripePageIds.includes(dbPrice.id));
      
      if (orphanedPrices.length > 0) {
        console.log(`Found ${orphanedPrices.length} orphaned prices to clean up`);
        for (const orphan of orphanedPrices) {
          const { error: deleteError } = await supabase
            .from('stripe_prices')
            .delete()
            .eq('id', orphan.id);
            
          if (deleteError) {
            console.error(`Failed to delete orphaned price ${orphan.id}:`, deleteError);
          } else {
            console.log(`🗑️ Deleted orphaned price: ${orphan.id}`);
          }
        }
      } else {
        console.log('✅ No orphaned prices found');
      }
    }
    
    // 6. Verify what we synced
    const { data: syncedProducts } = await supabase
      .from('stripe_products')
      .select('id, name, active');
      
    const { data: syncedPrices } = await supabase
      .from('stripe_prices')
      .select('id, product_id, unit_amount, currency, active');
      
    const { data: activePrices } = await supabase
      .from('stripe_prices')
      .select('id, product_id, unit_amount, currency, active')
      .eq('active', true);
    
    console.log('\n🎉 Sync completed successfully!');
    console.log(`Products synced: ${syncedProducts?.length || 0}`);
    console.log(`Total prices in database: ${syncedPrices?.length || 0}`);
    console.log(`Active prices available to users: ${activePrices?.length || 0}`);
    
    console.log('\n📋 ACTIVE pricing data (what users will see):');
    activePrices?.forEach(price => {
      console.log(`- ${price.id}: ${price.unit_amount || 'pay-as-you-wish'} ${price.currency}`);
    });
    
    if (syncedPrices && syncedPrices.length > (activePrices?.length || 0)) {
      const inactivePrices = syncedPrices.filter(p => !p.active);
      console.log('\n📋 ARCHIVED pricing data (hidden from users):');
      inactivePrices.forEach(price => {
        console.log(`- ${price.id}: ${price.unit_amount || 'pay-as-you-wish'} ${price.currency} (archived)`);
      });
    }
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

// Run the sync
syncStripeData().then(() => {
  console.log('\n✅ Sync completed!');
  process.exit(0);
}); 