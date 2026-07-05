async function testRawSignUp() {
  const email = `liga-${Math.random().toString(36).substring(7)}@poker.com`;
  const password = 'test-password-12345';
  console.log(`Testing raw fetch signup with email: ${email}`);

  try {
    const res = await fetch('https://supabase.agrolara.dedyn.io/auth/v1/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4MDk4MDE4MCwiZXhwIjo0OTM2NjUzNzgwLCJyb2xlIjoiYW5vbiJ9.iejQ436gpvOWQq5clGjhq-lZdkXN593b9pSNEh70Jq8'
      },
      body: JSON.stringify({
        email,
        password,
        data: {
          name: 'Test League'
        }
      })
    });

    const status = res.status;
    const text = await res.text();
    console.log(`Status: ${status}`);
    console.log(`Response body: ${text}`);
  } catch (err) {
    console.error('Fetch Error:', err);
  }
}

testRawSignUp();
