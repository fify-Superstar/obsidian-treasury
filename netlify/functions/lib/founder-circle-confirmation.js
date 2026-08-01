/**
 * Obsidian Treasury — "Welcome to the Treasury" confirmation email (HTML)
 * Dynamically compiled for Stripe checkout.session.completed → Resend
 */

function formatMoneyFromCents(cents, currency = 'AUD') {
  if (typeof cents !== 'number' || Number.isNaN(cents)) return '$49.00 AUD';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * @param {{ customerName?: string, amountTotal?: number, sessionId?: string }} data
 * @returns {string} HTML email body
 */
function buildWelcomeToTheTreasuryEmail(data = {}) {
  const name = (data.customerName || '').trim() || 'Founder';
  const amount = formatMoneyFromCents(data.amountTotal, data.currency || 'AUD');
  const dashboardUrl = 'https://obsidian-treasury.netlify.app/?checkout=success';
  const year = new Date().getFullYear();
  const sessionRef = data.sessionId
    ? escapeHtml(String(data.sessionId).slice(0, 24))
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to the Treasury</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#F4F4F5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0A0A0F;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#111118;border:1px solid rgba(255,255,255,0.09);border-radius:20px;overflow:hidden;">
          <tr>
            <td style="padding:2px;background:linear-gradient(135deg,#00F5A0,#7000FF,#00F5A0);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#16161F;border-radius:18px;">
                <tr>
                  <td style="padding:36px 32px 28px;text-align:center;">
                    <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(0,245,160,0.12);border:1px solid rgba(255,255,255,0.09);color:#00F5A0;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">
                      Payment Confirmed
                    </div>
                    <h1 style="margin:20px 0 10px;font-size:26px;line-height:1.25;letter-spacing:-0.03em;color:#F4F4F5;font-weight:600;">
                      Welcome to the Treasury, ${escapeHtml(name)}!
                    </h1>
                    <p style="margin:0 auto;max-width:420px;font-size:15px;line-height:1.55;color:#A1A1AA;">
                      Your Obsidian Treasury subscription is active. Monthly billing is confirmed and your command center access is ready.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 32px 28px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#111118;border:1px solid rgba(255,255,255,0.06);border-radius:14px;">
                      <tr>
                        <td style="padding:18px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <div style="font-size:11px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Amount paid</div>
                          <div style="font-size:22px;font-weight:600;color:#00F5A0;letter-spacing:-0.02em;">${amount}</div>
                          <div style="font-size:12px;color:#71717A;margin-top:4px;">Monthly subscription · Billed in AUD</div>
                          ${sessionRef ? `<div style="font-size:11px;color:#52525B;margin-top:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">Ref ${sessionRef}</div>` : ''}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:18px 20px;">
                          <div style="font-size:11px;color:#71717A;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">What's included</div>
                          <p style="margin:0 0 8px;font-size:14px;color:#F4F4F5;">✓ Executive command center</p>
                          <p style="margin:0 0 8px;font-size:14px;color:#F4F4F5;">✓ Cash & runway intelligence</p>
                          <p style="margin:0;font-size:14px;color:#F4F4F5;">✓ AI insights & spend guardrails</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 32px 36px;text-align:center;">
                    <a href="${dashboardUrl}" style="display:inline-block;padding:14px 28px;border-radius:10px;background:linear-gradient(135deg,#00F5A0,#00D4AA,#7000FF);color:#0A0A0F;font-size:14px;font-weight:600;text-decoration:none;">
                      Enter the Treasury
                    </a>
                    <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#52525B;">
                      Keep this email as your confirmation receipt.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0;font-size:11px;color:#52525B;text-align:center;">
          © ${year} Obsidian Treasury ·
          <a href="https://obsidian-treasury.netlify.app/privacy.html" style="color:#71717A;text-decoration:none;">Privacy</a>
          ·
          <a href="https://obsidian-treasury.netlify.app/terms.html" style="color:#71717A;text-decoration:none;">Terms</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Back-compat alias
const buildFounderCircleConfirmationEmail = buildWelcomeToTheTreasuryEmail;

module.exports = {
  buildWelcomeToTheTreasuryEmail,
  buildFounderCircleConfirmationEmail,
};
