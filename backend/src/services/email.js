// backend/src/services/email.js
import { Resend } from 'resend';

const HAS_API_KEY = !!process.env.RESEND_API_KEY;
const resend = HAS_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

/**
 * Send a review request email. If RESEND_API_KEY is missing,
 * we log a simulated send so you still get useful info in logs.
 */
export async function sendReviewRequestEmail({
  to,
  agentDisplayName,
  clientName,
  magicLinkUrl,
  subject,
  bodyTemplate,
}) {
  const finalSubject = subject || `Quick review for ${agentDisplayName ?? 'your agent'}`;
  const html =
    bodyTemplate ??
    `
      <p>Hi ${clientName || 'there'},</p>
      <p>Could you leave a quick review? It really helps!</p>
      <p><a href="${magicLinkUrl}" target="_blank" rel="noopener">Leave a review</a></p>
      <p>Thank you, ${agentDisplayName || 'Your Agent'}</p>
    `;

  // Always log inputs so you can verify what’s being sent
  console.log('[email] prepare', {
    to, from: FROM, hasApiKey: HAS_API_KEY, subject: finalSubject,
    magicLinkUrl
  });

  if (!HAS_API_KEY || !resend) {
    const result = {
      data: { id: 'local-log', simulated: true },
      error: null
    };
    console.warn('[email] SIMULATED SEND (missing RESEND_API_KEY)', {
      to, from: FROM, subject: finalSubject,
      textPreview: `Review link: ${magicLinkUrl}`,
      htmlPreview: html,
    });
    return result;
  }

  try {
    const result = await resend.emails.send({
      from: FROM,
      to,
      subject: finalSubject,
      html,
    });

    console.log('[email] sent', {
      to,
      id: result?.data?.id || null,
      error: result?.error || null
    });

    return result;
  } catch (err) {
    console.error('[email] error', {
      to,
      message: err?.message,
      stack: err?.stack
    });
    throw err;
  }
}
