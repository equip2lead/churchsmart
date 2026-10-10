const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'ChurchSmart <noreply@contact.churchsmartnow.com>';
const APP_URL = 'https://app.churchsmartnow.com';
const utm = (campaign) => `utm_source=email&utm_medium=notification&utm_campaign=${campaign}`;
const BRAND_COLOR = '#4F46E5';

async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.warn('[notifications] RESEND_API_KEY not set — skipping email to', to);
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[notifications] Resend error:', data);
      return { success: false, error: data.message || 'Send failed' };
    }
    return { success: true, id: data.id };
  } catch (err) {
    console.error('[notifications] Send failed:', err);
    return { success: false, error: err.message };
  }
}

function emailWrapper(title, body) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
<tr><td style="background-color:${BRAND_COLOR};padding:24px 32px;text-align:center;">
<span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">ChurchSmart</span>
</td></tr>
<tr><td style="padding:32px;">${body}</td></tr>
<tr><td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="margin:0;font-size:12px;color:#9ca3af;">&copy; 2026 ChurchSmart by DigiSmart Africa</p>
</td></tr>
</table>
</td></tr></table></body></html>`;
}

function btn(text, href) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td align="center">
<a href="${href}" style="display:inline-block;padding:14px 32px;background-color:${BRAND_COLOR};color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">${text}</a>
</td></tr></table>`;
}

export async function sendWelcomeEmail(toEmail, churchName, adminName) {
  const html = emailWrapper('Welcome to ChurchSmart!', `
<h2 style="margin:0 0 8px;font-size:22px;color:#1f2937;">Welcome to ChurchSmart! 🎉</h2>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.6;">
Hi ${adminName || 'there'},</p>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.6;">
Your church <strong style="color:${BRAND_COLOR};">${churchName}</strong> is all set up on ChurchSmart. You now have a 30-day free trial with full access to all features.</p>
<p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1f2937;">Here are 3 things to do first:</p>
<ol style="margin:4px 0 16px;padding-left:20px;font-size:14px;color:#4b5563;line-height:1.8;">
<li>Add your church members</li>
<li>Set up your weekly services</li>
<li>Explore the dashboard analytics</li>
</ol>
${btn('Go to Dashboard', `${APP_URL}?${utm('welcome')}`)}
<p style="margin:0;font-size:13px;color:#9ca3af;">If you have any questions, reply to this email and we'll help you get started.</p>`);

  return sendEmail({ to: toEmail, subject: 'Welcome to ChurchSmart! 🎉', html });
}

export async function sendTrialReminderEmail(toEmail, churchName, daysLeft) {
  const subjects = {
    7: 'Your ChurchSmart trial ends in 7 days',
    3: 'Only 3 days left on your ChurchSmart trial!',
    0: 'Your ChurchSmart trial has ended',
  };
  const headlines = {
    7: 'Your trial ends in 7 days',
    3: 'Only 3 days left!',
    0: 'Your trial has ended',
  };
  const messages = {
    7: `Your 30-day free trial for <strong>${churchName}</strong> ends in 7 days. Upgrade now to keep all your church data, member records, and financial reports.`,
    3: `Your trial for <strong>${churchName}</strong> expires in just 3 days. Don't lose access to your church management tools and data.`,
    0: `The free trial for <strong>${churchName}</strong> has ended. Your data is safe, but you'll need to upgrade to continue using ChurchSmart.`,
  };

  const html = emailWrapper(subjects[daysLeft] || subjects[0], `
<h2 style="margin:0 0 8px;font-size:22px;color:#1f2937;">${headlines[daysLeft] || headlines[0]}</h2>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.6;">
${messages[daysLeft] || messages[0]}</p>
<p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1f2937;">What you'll lose without upgrading:</p>
<ul style="margin:4px 0 16px;padding-left:20px;font-size:14px;color:#4b5563;line-height:1.8;">
<li>Member & visitor management</li>
<li>Financial tracking & reports</li>
<li>SMS & WhatsApp messaging</li>
<li>Attendance analytics</li>
</ul>
${btn('Upgrade Now', `${APP_URL}?${utm('trial_reminder')}`)}
<p style="margin:0;font-size:13px;color:#9ca3af;">Plans start at just $9/month. Your data will be waiting for you.</p>`);

  return sendEmail({ to: toEmail, subject: subjects[daysLeft] || subjects[0], html });
}

export async function notifyNewMember(toEmail, churchName, memberName) {
  const html = emailWrapper('New member added', `
<h2 style="margin:0 0 8px;font-size:20px;color:#1f2937;">New member added</h2>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.6;">
<strong>${memberName}</strong> has been added to <strong>${churchName}</strong> on ChurchSmart.</p>
${btn('View Members', `${APP_URL}?${utm('new_member')}`)}
`);
  return sendEmail({ to: toEmail, subject: `New member added: ${memberName}`, html });
}

export async function notifyDonationReceived(toEmail, churchName, amount, donorName) {
  const html = emailWrapper('Donation received', `
<h2 style="margin:0 0 8px;font-size:20px;color:#1f2937;">Donation received</h2>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.6;">
A donation of <strong style="color:#10b981;">${amount}</strong> from <strong>${donorName}</strong> has been recorded for <strong>${churchName}</strong>.</p>
${btn('View Giving', `${APP_URL}?${utm('donation_received')}`)}
`);
  return sendEmail({ to: toEmail, subject: `Donation received: ${amount} from ${donorName}`, html });
}

export async function sendBirthdayEmail(toEmail, memberName, churchName) {
  const html = emailWrapper(`Happy Birthday, ${memberName}!`, `
<h2 style="margin:0 0 8px;font-size:22px;color:#1f2937;">Happy Birthday, ${memberName}! 🎂</h2>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.6;">
<strong style="color:${BRAND_COLOR};">${churchName}</strong> wishes you a blessed birthday. May God continue to bless you and your family abundantly in the year ahead.</p>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.6;">
We thank God for your life and your presence in our church family. You are a blessing to us all!</p>
${btn('Visit ChurchSmart', `${APP_URL}?${utm('birthday')}`)}
<p style="margin:0;font-size:13px;color:#9ca3af;">With love from your church family at ${churchName}.</p>`);
  return sendEmail({ to: toEmail, subject: `Happy Birthday, ${memberName}! 🎂`, html });
}

export async function sendBirthdayAdminNotification(toEmail, churchName, birthdayNames) {
  const list = birthdayNames.map(n => `<li style="padding:4px 0;">${n}</li>`).join('');
  const html = emailWrapper("Today's Birthdays", `
<h2 style="margin:0 0 8px;font-size:20px;color:#1f2937;">🎂 Today's Birthdays</h2>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.6;">
The following members of <strong>${churchName}</strong> are celebrating their birthday today. Don't forget to wish them well!</p>
<ul style="margin:0 0 16px;padding-left:20px;font-size:15px;color:#1f2937;line-height:1.8;">${list}</ul>
${btn('View Members', `${APP_URL}?${utm('birthday_admin')}`)}
`);
  return sendEmail({ to: toEmail, subject: `🎂 Today's Birthdays at ${churchName}: ${birthdayNames.join(', ')}`, html });
}

export async function sendVisitorFollowupReminder(toEmail, churchName, visitorName, daysAgo) {
  const urgency = daysAgo === 1 ? 'visited yesterday' : `visited ${daysAgo} days ago`;
  const html = emailWrapper('Visitor Follow-up Reminder', `
<h2 style="margin:0 0 8px;font-size:20px;color:#1f2937;">Visitor Follow-up Reminder</h2>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.6;">
<strong>${visitorName}</strong> ${urgency} at <strong>${churchName}</strong> and hasn't been followed up with yet. Reach out to welcome them!</p>
<p style="margin:0 0 16px;font-size:14px;color:#6b7280;">
A timely follow-up makes visitors feel valued and increases the chance they'll return.</p>
${btn('View Visitors', `${APP_URL}?${utm('visitor_followup')}`)}
`);
  return sendEmail({ to: toEmail, subject: `Visitor follow-up: ${visitorName} (${urgency})`, html });
}

export async function sendInvitationEmail(toEmail, churchName, inviterName, baseRole, inviteLink, lang = 'en') {
  const useLang = lang === 'fr' ? 'fr' : 'en';
  const subjects = {
    en: `You've been invited to ${churchName}`,
    fr: `Vous êtes invité(e) à rejoindre ${churchName}`
  };
  const titles = {
    en: `You've been invited! 🎉`,
    fr: `Vous êtes invité(e) ! 🎉`
  };
  const greetings = {
    en: 'Hello,',
    fr: 'Bonjour,'
  };
  const intros = {
    en: `<strong>${inviterName}</strong> has invited you to join <strong style="color:${BRAND_COLOR};">${churchName}</strong> on ChurchSmart as <strong>${baseRole}</strong>.`,
    fr: `<strong>${inviterName}</strong> vous a invité(e) à rejoindre <strong style="color:${BRAND_COLOR};">${churchName}</strong> sur ChurchSmart en tant que <strong>${baseRole}</strong>.`
  };
  const ctaIntros = {
    en: 'Click the button below to accept and create your account password. This invitation expires in 7 days.',
    fr: 'Cliquez sur le bouton ci-dessous pour accepter et créer votre mot de passe. Cette invitation expire dans 7 jours.'
  };
  const ctaButtons = {
    en: 'Accept Invitation',
    fr: `Accepter l'invitation`
  };
  const fallbacks = {
    en: 'If the button does not work, copy and paste this link into your browser:',
    fr: 'Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :'
  };
  const ignores = {
    en: `If you weren't expecting this email, you can safely ignore it.`,
    fr: `Si vous n'attendiez pas cet email, vous pouvez l'ignorer en toute sécurité.`
  };

  const html = emailWrapper(titles[useLang], `
<h2 style="margin:0 0 8px;font-size:22px;color:#1f2937;">${titles[useLang]}</h2>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.6;">${greetings[useLang]}</p>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.6;">${intros[useLang]}</p>
<p style="margin:0 0 8px;font-size:15px;color:#4b5563;line-height:1.6;">${ctaIntros[useLang]}</p>
${btn(ctaButtons[useLang], inviteLink)}
<p style="margin:0 0 4px;font-size:12px;color:#9ca3af;line-height:1.5;">${fallbacks[useLang]}</p>
<p style="margin:0 0 16px;font-size:12px;color:#6b7280;word-break:break-all;"><a href="${inviteLink}" style="color:${BRAND_COLOR};text-decoration:none;">${inviteLink}</a></p>
<p style="margin:0;font-size:13px;color:#9ca3af;">${ignores[useLang]}</p>`);

  return sendEmail({ to: toEmail, subject: subjects[useLang], html });
}

// ==========================================
// CONGREGATION BROADCAST (Messaging page)
// ==========================================
// Bulk email composed by a church admin, as opposed to the transactional
// templates above. Reuses the same Resend account, sender and branded shell so
// a broadcast looks like the rest of the platform's mail.

const RESEND_BATCH_LIMIT = 100; // Resend accepts up to 100 messages per batch call

/** Escape admin-typed text before it goes into an HTML email. */
function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isValidEmailAddress(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Render a plain-text broadcast into the branded email shell.
 * Blank lines become paragraphs; single newlines become <br>.
 */
function broadcastHtml({ subject, body, churchName }) {
  const paragraphs = String(body || '')
    .split(/\n{2,}/)
    .map(block => `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#374151;">${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');

  return emailWrapper(subject, `
    <h1 style="margin:0 0 20px 0;font-size:20px;font-weight:700;color:#111827;">${escapeHtml(subject)}</h1>
    ${paragraphs}
    ${churchName ? `<p style="margin:24px 0 0 0;padding-top:16px;border-top:1px solid #e5e7eb;font-size:13px;color:#9ca3af;">${escapeHtml(churchName)}</p>` : ''}
  `);
}

/**
 * Send one broadcast to many recipients.
 *
 * Each recipient gets their OWN message: addresses are never combined into a
 * single `to`, which would disclose the whole congregation's email addresses to
 * every reader.
 *
 * Uses Resend's batch endpoint rather than one request per recipient — the
 * default account rate limit is ~2 requests/second, so a 60-person blast sent
 * individually would outlive the serverless function.
 *
 * Resolves to { sent, failed, errors } and never throws.
 */
export async function sendChurchBroadcast({ recipients, subject, body, churchName }) {
  if (!RESEND_API_KEY) {
    return { sent: 0, failed: recipients?.length || 0, errors: ['RESEND_API_KEY is not configured'], notConfigured: true };
  }
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return { sent: 0, failed: 0, errors: ['No recipients'] };
  }

  const html = broadcastHtml({ subject, body, churchName });
  let sent = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < recipients.length; i += RESEND_BATCH_LIMIT) {
    const chunk = recipients.slice(i, i + RESEND_BATCH_LIMIT);
    const payload = chunk.map(r => ({
      from: FROM_EMAIL,
      to: [r.email],
      subject,
      html
    }));

    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // A rejected batch means none of its messages were accepted.
        failed += chunk.length;
        const reason = data?.message || data?.error?.message || `HTTP ${res.status}`;
        errors.push(`${chunk.length} recipient(s): ${reason}`);
        continue;
      }

      // Resend returns one entry per accepted message, in order.
      const accepted = Array.isArray(data?.data) ? data.data.length : chunk.length;
      sent += accepted;
      if (accepted < chunk.length) {
        failed += chunk.length - accepted;
        errors.push(`${chunk.length - accepted} recipient(s) were not accepted by the provider`);
      }
    } catch (err) {
      failed += chunk.length;
      errors.push(`${chunk.length} recipient(s): ${err.message || 'Network error'}`);
    }
  }

  return { sent, failed, errors };
}
