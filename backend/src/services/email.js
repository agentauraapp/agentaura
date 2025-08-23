// backend/services/email.js
// Sends real email via Resend REST API (no extra deps; Node 18+ has global fetch)

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;

// tiny helper so logs are easy to find in Render
function log(...args) {
  console.log('[email]', ...args);
}

export async function sendReviewRequestEmail({
  to,
  agentDisplayName,
  clientName,
  magicLinkUrl,
  subject,
  bodyTemplate,
}) {
  if (!RESEND_API_KEY) {
    log('ERROR: RESEND_API_KEY is missing – skipping send.');
    return;
  }
  if (!EMAIL_FROM) {
    log('ERROR: EMAIL_FROM is missing – skipping send.');
    return;
  }
  if (!to) {
    log('ERROR: "to" is missing – skipping send.');
    return;
  }

  // Build a sane default subject/body if not provided
  const fallbackSubject = `Quick review request from ${agentDisplayName || 'your agent'}`;
  const greeting = clientName ? `Hi ${clientName},` : 'Hi,';
  const fallbackHtml = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5">
      <p>${greeting}</p>
      <p>Would you mind leaving a quick review? It helps a ton.</p>
      <p><a href="${magicLinkUrl}" style="display:inline-block;padding:10px 14px;border-radius:6px;background:#111;color:#fff;text-decoration:none">
        Leave a review
      </a></p>
      <p>Thanks!${agentDisplayName ? ` – ${agentDisplayName}` : ''}</p>
    </div>
  `;
  const html = bodyTemplate?.includes('{{MAGIC_LINK}}')
    ? bodyTemplate.replaceAll('{{MAGIC_LINK}}', magicLinkUrl)
    : fallbackHtml;

  const payload = {
    from: EMAIL_FROM,   // must be a verified domain/sender in Resend
    to: [to],
    subject: subject || fallbackSubject,
    html,
  };

  try {
    log('Sending via Resend →', { to, subject: payload.subject });
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await resp.text(); // capture raw for easier debugging
    if (!resp.ok) {
      log('ERROR: Resend failed', resp.status, text);
      throw new Error(`Resend ${resp.status}: ${text}`);
    }
    log('Sent OK:', text);
  } catch (err) {
    log('ERROR: sendReviewRequestEmail threw', err?.message || err);
    // do not rethrow — email failures shouldn’t 500 your API unless you want them to
  }
}
