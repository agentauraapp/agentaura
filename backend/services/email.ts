// Minimal Resend wrapper
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = process.env.EMAIL_FROM || 'Agent Aura <noreply@agentaura.app>';

export async function sendReviewRequestEmail(opts: {
  to: string;
  agentDisplayName: string;
  clientName?: string;
  magicLinkUrl: string;
  subject?: string;
  bodyTemplate?: string; // optional override
}) {
  const subject = opts.subject || `Quick favor: 60‑second review for ${opts.agentDisplayName}`;
  const greeting = opts.clientName ? `Hi ${opts.clientName},` : 'Hi there,';

  // If a custom body was supplied, prefer it (but still include the link)
  const text = opts.bodyTemplate
    ? `${opts.bodyTemplate.trim()}\n\nReview link: ${opts.magicLinkUrl}`
    : `${greeting}

Would you mind sharing a quick review for ${opts.agentDisplayName}? It takes about a minute.

Click your personal link:
${opts.magicLinkUrl}

Thanks so much!`;

  const html = `
    <p>${greeting}</p>
    <p>Would you mind sharing a quick review for <b>${opts.agentDisplayName}</b>? It takes about a minute.</p>
    <p><a href="${opts.magicLinkUrl}">${opts.magicLinkUrl}</a></p>
    <p>Thanks so much!</p>
  `;

  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject,
    text,
    html,
  });
}
