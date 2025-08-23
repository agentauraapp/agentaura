// backend/services/email.js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sends the review request email via Resend.
 * Returns Resend's response object for logging/diagnostics.
 */
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

  try {
    const result = await resend.emails.send({
      from,
      to,
      subject: finalSubject,
      html,
    });

    // helpful diagnostics in Render logs
    console.log('[sendReviewRequestEmail] sent', { to, id: result?.data?.id, error: result?.error });
    return result;
  } catch (err) {
    console.error('[sendReviewRequestEmail] error', err);
    throw err;
  }
}
