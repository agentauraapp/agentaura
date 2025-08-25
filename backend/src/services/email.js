// backend/services/email.js
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// very small template helper: replaces {{ key }} with ctx[key]
function renderTemplate(tpl = '', ctx = {}) {
  return String(tpl).replace(/{{\s*(\w+)\s*}}/g, (_, k) => {
    const val = ctx[k];
    return (val === undefined || val === null) ? '' : String(val);
  });
}

/**
 * Sends the review request email via Resend (or logs in dev).
 */
export async function sendReviewRequestEmail({
  to,
  subject,
  bodyTemplate,    // raw template containing {{placeholders}}
  context = {},    // { agent_name, client_name, magic_link_url, agent_title_or_team, agent_phone, ... }
  fallbackHtml,    // optional: raw html to use if bodyTemplate is empty
  from,
}) {
  const finalFrom = from || process.env.EMAIL_FROM || 'onboarding@resend.dev';

  // render subject + html using the same context
  const finalSubject = renderTemplate(subject || 'Quick review for {{agent_name}}', context);

  const html = renderTemplate(
    bodyTemplate ||
      fallbackHtml ||
      `
        <p>Hi {{client_name}},</p>
        <p>Could you share a quick review of your experience with {{agent_name}}?</p>
        <p>
          <a href="{{magic_link_url}}" target="_blank" rel="noopener">Leave a review</a>
        </p>
        <p>Thanks!<br/>{{agent_name}}<br/>{{agent_title_or_team}}<br/>{{agent_phone}}</p>
      `,
    context
  );

  try {
    if (!resend) {
      console.log('[sendReviewRequestEmail] (DEV LOG ONLY)', { to, finalSubject, htmlPreview: html.slice(0, 500) });
      return { data: { id: 'local-log', simulated: true }, error: null };
    }

    const result = await resend.emails.send({
      from: finalFrom,
      to,
      subject: finalSubject,
      html,
    });

    console.log('[sendReviewRequestEmail] sent', { to, id: result?.data?.id, error: result?.error });
    return result;
  } catch (err) {
    console.error('[sendReviewRequestEmail] error', err);
    throw err;
  }
}
