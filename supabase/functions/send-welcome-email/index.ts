import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!

interface WebhookPayload {
  type: 'INSERT'
  table: string
  record: {
    id: string
    email: string
    raw_user_meta_data: {
      name?: string
    }
  }
}

Deno.serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json()

    const userEmail = payload.record.email
    const userName = payload.record.raw_user_meta_data?.name || 'there'

    // Send welcome email via Brevo using template
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: 'MemoryAisle',
          email: 'welcome@memoryaisle.app',
        },
        to: [{ email: userEmail, name: userName }],
        templateId: 2,
        params: {
          name: userName,
          email: userEmail,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Brevo API error: ${error}`)
    }

    console.log(`Welcome email sent to ${userEmail}`)

    return new Response(
      JSON.stringify({ success: true, email: userEmail }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error sending welcome email:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
