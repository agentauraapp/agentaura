// backend/services/email.js
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev'

export async function sendReviewRequestEmail({
  to,
  agentDisplayName,
  clientName,
  magicLinkUrl,
  subject,
  bodyTemplate
}) {
  const text = bodyTemplate
    ? bodyTemplate.replaceAll('{{name}}', clientName || '').replaceAll('{{link}}', magicLinkUrl)
    : `Hi ${clientName || ''},\n\nPlease leave a quick review: ${magicLinkUrl}\n\n— ${agentDisplayName}`

  const finalSubject = subject || 'Quick review request'

  const result = await resend.emails.send({
    from: FROM,          // must be a verified domain/sender in Resend
    to,
    subject: finalSubject,
    text
  })

  console.log('[sendReviewRequestEmail] result:', result)
  return result
}
