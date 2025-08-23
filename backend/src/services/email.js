// backend/services/email.js
let Resend;
try {
  // Keep the import inside try so local dev without the package won't crash
  ({ Resend } = await import('resend'));
} catch {
  // no-op; we'll handle missing SDK or key below
}

const API_KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.EMAIL_FROM || 'scott@agentaura.guidefire.tech';

// If we have both SDK and key, build a client; otherwise we'll fallback to console logging
const resend = (Resend && API_KEY) ? new Resend(API_KEY) : null;

/**
 * Sends a review request email via Resend if configured; otherwise logs the payload.
 * Returns an object with shape similar to Resend's response for diagnostics.
 */
export async function sendReviewRequestEmail({
  to,
  agentDisplayName,
  clientName,
  magicLinkUrl,
  subject,
  bodyTemplate,
}) {
  // Basic validation
  if (!to) throw new Error('sendReviewRequestEmail: "to" is required');
  if (!magicLinkUrl) throw new Error('sendReviewRequestEmail: "magicLinkUrl" is required');

  // Normalize recipient(s)
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [String(to).trim()].filter(Boolean);
  if (!recipients.length) throw new Error('sendReviewRequestEmail: no valid recipients');

  const finalSubject = subject || `Quick review for ${agentDisplayName ?? 'your agent'}`;

  // Plain text (good for spam scores + fallback)
  const text = bodyTemplate
    ? stripHtml(bodyTemplate) + `\n\nReview link: ${magicLinkUrl}\n`
    : [
        `Hi ${clientName || 'there'},`,
        ``,
        `Could you leave a quick review? It really helps!`,
        `Review link: ${magicLinkUrl}`,
        ``,
        `Thank you, ${agentDisplayName || 'Your Agent'}`,
      ].join('\n');

  // HTML body
  const html =
    bodyTemplate ??
    `
      <p>Hi ${clientName || 'there'},</p>
      <p>Could you leave a quick review? It really helps!</p>
      <p><a href="${magicLinkUrl}" target="_blank" rel="noopener">Leave a review</a></p>
      <p>Thank you, ${agentDisplayName || 'Your Agent'}</p>
    `;

  // If Resend not configured, just log (useful in dev)
  if (!resend) {
    console.log('[sendReviewRequestEmail:FALLBACK_LOG]', {
      from: FROM,
      to: recipients,
      subject: finalSubject,
      text,
      htmlPreview: html.slice(0, 200) + (html.length > 200 ? '…' : ''),
      note: 'No RESEND_API_KEY or SDK unavailable; not actually sent.',
    });
    return { data: { id: 'local-log', simulated: true }, error: null };
  }

  try {
    const result = await resend.emails.send({
      from: FROM,               // MUST be a verified sender/domain in Resend
      to: recipients,
      subject: finalSubject,
      html,
      text,
      // headers / tags optional:
      // headers: { 'X-Entity-Ref-ID': 'review-request' },
      // tags: [{ name: 'type', value: 'review_request' }],
    });

    console.log('[sendReviewRequestEmail] sent', {
      to: recipients,
      id: result?.data?.id,
      error: result?.error || null,
    });

    return result;
  } catch (err) {
    console.error('[sendReviewRequestEmail] error', err);
    throw err;
  }
}

/** Very basic HTML -> text helper */
function stripHtml(html) {
  return String(html)
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
