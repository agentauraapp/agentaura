// backend/services/email.js
import { Resend } from 'resend';

const haveKey = !!process.env.RESEND_API_KEY;
let resend = null;

try {
  if (haveKey) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
} catch (e) {
  // If the SDK import/construct fails, we’ll log it and still simulate.
  console.error('[email] Failed to init Resend SDK:', e);
}

export async function sendReviewRequestEmail({
  to,
  agentDisplayName,
  clientName,
  magicLinkUrl,
  subject,
  bodyTemplate,
}) {
  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  const finalSubject = subject || `Quick review for ${agentDisplayName ?? 'your agent'}`;
  const html =
    bodyTemplate ??
    `
      <p>Hi ${clientName || 'there'},</p>
      <p>Could you leave a quick review? It really helps!</p>
      <p><a href="${magicLinkUrl}" target="_blank" rel="noopener">Leave a review</a></p>
      <p>Thank you, ${agentDisplayName || 'Your Agent'}</p>
    `;

  // Always log inputs (sanitized) so we can trace from Render logs
  console.log('[email] sendReviewRequestEmail called', {
    to,
    from,
    haveKey,
    subject: finalSubject,
    hasHtml: !!html,
  });

  if (!haveKey || !resend) {
    const result = {
      data: { id: 'local-log', simulated: true },
      error: null,
    };
    console.log('[email] SIMULATED send (missing key or SDK). Result:', result);
    return result;
  }

  try {
    const result = await resend.emails.send({ from, to, subject: finalSubject, html });
    console.log('[email] Resend response:', { id: result?.data?.id, error: result?.error });
    return result;
  } catch (err) {
    console.error('[email] Resend error:', err);
    throw err;
  }
}
