const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'ChurchSmart <noreply@churchsmartnow.com>';
const APP_URL = 'https://app.churchsmartnow.com';
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
${btn('Go to Dashboard', APP_URL)}
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
${btn('Upgrade Now', APP_URL)}
<p style="margin:0;font-size:13px;color:#9ca3af;">Plans start at just $9/month. Your data will be waiting for you.</p>`);

  return sendEmail({ to: toEmail, subject: subjects[daysLeft] || subjects[0], html });
}

export async function notifyNewMember(toEmail, churchName, memberName) {
  const html = emailWrapper('New member added', `
<h2 style="margin:0 0 8px;font-size:20px;color:#1f2937;">New member added</h2>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.6;">
<strong>${memberName}</strong> has been added to <strong>${churchName}</strong> on ChurchSmart.</p>
${btn('View Members', APP_URL)}
`);
  return sendEmail({ to: toEmail, subject: `New member added: ${memberName}`, html });
}

export async function notifyDonationReceived(toEmail, churchName, amount, donorName) {
  const html = emailWrapper('Donation received', `
<h2 style="margin:0 0 8px;font-size:20px;color:#1f2937;">Donation received</h2>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.6;">
A donation of <strong style="color:#10b981;">${amount}</strong> from <strong>${donorName}</strong> has been recorded for <strong>${churchName}</strong>.</p>
${btn('View Giving', APP_URL)}
`);
  return sendEmail({ to: toEmail, subject: `Donation received: ${amount} from ${donorName}`, html });
}
