export async function sendReviewRequestEmail({
  to,
  agentDisplayName,
  clientName,
  magicLinkUrl,
  subject,
  bodyTemplate
}) {
  // TODO: replace with real email provider; for now just log
  console.log('[sendReviewRequestEmail]', {
    to, agentDisplayName, clientName, magicLinkUrl, subject, bodyTemplate
  })
}
