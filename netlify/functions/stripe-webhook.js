const Stripe = require('stripe');
const { Resend } = require('resend');
const {
  buildWelcomeToTheTreasuryEmail,
} = require('./lib/founder-circle-confirmation');

/**
 * Stripe Webhook → Resend "Welcome to the Treasury" email
 *
 * Listens for: checkout.session.completed
 * Live URL:    https://obsidian-treasury.netlify.app/.netlify/functions/stripe-webhook
 *
 * Netlify env vars required:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 *   RESEND_API_KEY
 *   EMAIL_FROM   e.g. "Obsidian Treasury <onboarding@resend.dev>"
 */
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { Allow: 'POST' },
      body: 'Method Not Allowed',
    };
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;

  if (!stripeSecret || !webhookSecret || !resendApiKey || !emailFrom) {
    console.error('Missing required env vars for Stripe/Resend webhook');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server misconfigured' }),
    };
  }

  const stripe = new Stripe(stripeSecret);
  const resend = new Resend(resendApiKey);

  const signature =
    event.headers['stripe-signature'] || event.headers['Stripe-Signature'];

  if (!signature) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing Stripe-Signature header' }),
    };
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : event.body || '';

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error('Stripe signature verification failed:', err.message);
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }

  if (stripeEvent.type !== 'checkout.session.completed') {
    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, handled: false }),
    };
  }

  const session = stripeEvent.data.object;
  const customerEmail =
    session.customer_details?.email || session.customer_email || null;
  const customerName =
    session.customer_details?.name || session.metadata?.customer_name || '';

  if (!customerEmail) {
    console.error('checkout.session.completed missing customer email', {
      sessionId: session.id,
    });
    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, emailed: false }),
    };
  }

  const html = buildWelcomeToTheTreasuryEmail({
    customerName,
    amountTotal: session.amount_total,
    currency: (session.currency || 'aud').toUpperCase(),
    sessionId: session.id,
  });

  try {
    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: [customerEmail],
      subject: 'Welcome to the Treasury — Confirmation',
      html,
    });

    if (error) {
      console.error('Resend send failed:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to send confirmation email' }),
      };
    }

    console.log('Welcome to the Treasury email sent', {
      sessionId: session.id,
      emailId: data?.id,
      to: customerEmail,
    });
  } catch (err) {
    console.error('Resend exception:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send confirmation email' }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true, emailed: true }),
  };
};
