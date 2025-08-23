// backend/services/email.js
import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const fromAddress  = process.env.EMAIL_FROM || '@scott@agentaura.guidefire.tech';

if (!resendApiKey) {
  console.warn('⚠️ RESEND_API_KEY is not set – emails will fail.');
}

const resend = new Resend(resendApiKey);

export async function sendReviewRequestEmail({
  to,
  agentDisplayName,
  clientName,
  magicLinkUrl,
  subject,
  bodyTemplate,
}) {
  // Basic template fallbacks
  const safeAgent  = agentDisplayName || 'your agent';
  const safeClient = clientName || '';
  const subj = subject || `Quick review for ${safeAgent}`;
  const body =
    bodyTemplate ||
    `Hi ${safeClient || 'there'},<br/><br/>
     ${safeAgent} would love your quick feedback. Click the link to leave a review:<br/>
     <a href="${magicLinkUrl}">${magicLinkUrl}</a><br/><br/>
     Thank you!`;

  const text =
    (bodyTemplate || '')
      .replace(/<[^>]+>/g, ' ') || // strip tags if you gave HTML
    `Please leave a review here: ${magicLinkUrl}`;

  const result = await resend.emails.send({
    from: fromAddress,      // MUST be a verified domain/sender in Resend
    to:   [to],
    subject: subj,
    html:  body,
    text,
  });

  // Helpful log lines for Render logs
  console.log('[Resend] send result:', {
    id: result?.data?.id,
    error: result?.error?.message,
  });

  if (result.error) {
    throw new Error(result.error.message || 'Resend send failed');
  }

  return result.data;
}
