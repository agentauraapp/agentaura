// backend/src/services/email.js
// ESM module (your package.json has "type":"module")

const FROM = process.env.EMAIL_FROM;          // e.g. "Agent Aura <hello@yourdomain.com>"
const RESEND_KEY = process.env.RESEND_API_KEY; // from Resend dashboard
const REPLY_TO = process.env.EMAIL_REPLY_TO || undefined;

function buildEmailHTML({ agentDisplayName, clientName, magicLinkUrl, bodyTemplate }) {
  const greeting = clientName ? `Hi ${clientName},` : `Hi there,`;
  const body = bodyTemplate?.trim() ||
    `We'd love your quick feedback. Please click the button below to leave a review.`;
  return /* html */ `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height:1.6;">
      <p>${greeting}</p>
      <p>${body}</p>
      <p style="margin: 24px 0;">
        <a href="${magicLinkUrl}" style="background:#000;color:#fff;padding:12px 18px;
           text-decoration:none;border-radius:8px;display:inline-block">
          Leave a review
        </a>
      </p>
      <p>If the button doesn't work, copy & paste this link:</p>
      <p style="word-break:break-all;color:#555;">${magicLinkUrl}</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee" />
      <p style="color:#666">— ${agentDisplayName || 'Your agent'}</p>
    </div>
  `;
}

function buildEmailText({ agentDisplayName, clientName, magicLinkUrl, bodyTemplate }) {
  const greeting = clientName ? `Hi ${clientName},` : `Hi there,`;
  const body = bodyTemplate?.trim() ||
    `We'd love your quick feedback. Please open the link below to leave a review.`;
  return [
    greeting,
    '',
    body,
    '',
    magicLinkUrl,
    '',
    `— ${agentDisplayName || 'Your agent'}`
  ].join('\n');
}

/**
 * Sends the review request email via Resend HTTP API.
 * Throws on non-2xx to let the route log/report it.
 */
export async function sendReviewRequestEmail({
  to,
  agentDisplayName,
  clientName,
  magicLinkUrl,
  subject,
  bodyTemplate,
}) {
  if (!RESEND_KEY) throw new Error('RESEND_API_KEY is not set');
  if (!FROM) throw new Error('EMAIL_FROM is not set');
  if (!to) throw new Error('Recipient "to" is required');

  const finalSubject = subject?.trim() || 'Quick review request';
  const html = buildEmailHTML({ agentDisplayName, clientName, magicLinkUrl, bodyTemplate });
  const text = buildEmailText({ agentDisplayName, clientName, magicLinkUrl, bodyTemplate });

  const payload = {
    from: FROM,
    to: [to],
    subject: finalSubject,
    html,
    text,
    ...(REPLY_TO ? { reply_to: REPLY_TO } : {}),
  };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const bodyJson = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = `Resend error ${res.status}: ${bodyJson?.message || bodyJson?.error || 'Unknown error'}`
    throw new Error(msg);
  }
  return bodyJson; // { id: "..." }
}
