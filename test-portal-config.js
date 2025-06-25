// Test script to verify portal configuration
// Run this in browser console on your app page to test portal generation

async function testPortalConfig() {
  console.log('🧪 Testing Portal Configuration...');
  
  try {
    // Test portal creation
    const response = await fetch('/api/stripe/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'en' })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Portal created successfully');
      console.log('Portal URL:', data.url);
      
      // Extract session ID from URL
      const sessionMatch = data.url.match(/\/session\/([^?]+)/);
      if (sessionMatch) {
        console.log('Session ID:', sessionMatch[1]);
      }
      
      // Open portal in new tab for testing
      window.open(data.url, '_blank');
      
    } else {
      console.error('❌ Portal creation failed:', data);
    }
    
  } catch (error) {
    console.error('❌ Network error:', error);
  }
}

// Run the test
testPortalConfig(); 