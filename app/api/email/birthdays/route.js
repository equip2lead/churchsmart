// Rate limiting: Vercel provides basic DDoS protection. If abuse is detected,
// add next-rate-limit or upstash/ratelimit middleware here.
import { createClient } from '@supabase/supabase-js';
import { sendBirthdayEmail, sendBirthdayAdminNotification } from '../../../../lib/notifications';
import {
  toWamatasNumber,
  sendWamatasText,
  loadWhatsAppConfig,
  recordSend,
  logSend,
  delay,
  SEND_SPACING_MS
} from '../../../../lib/whatsapp';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  const today = new Date();
  const month = today.getMonth() + 1; // 1-indexed
  const day = today.getDate();
  let memberEmails = 0;
  let adminEmails = 0;
  let whatsappSent = 0;
  const errors = [];

  // Get all churches
  const { data: churches, error: churchErr } = await supabase
    .from('churches')
    .select('id, name, default_language');

  if (churchErr || !churches) {
    return Response.json({ error: 'Failed to fetch churches', detail: churchErr?.message }, { status: 500 });
  }

  for (const church of churches) {
    // ── Check automation settings for this church ──
    const { data: autoSettings } = await supabase
      .from('automation_settings')
      .select('automation_type, is_enabled')
      .eq('church_id', church.id);

    const automationMap = {};
    (autoSettings || []).forEach(s => { automationMap[s.automation_type] = s.is_enabled; });

    // Default to enabled if no setting exists
    const birthdayEmailEnabled = automationMap['BIRTHDAY_EMAIL'] !== false;
    const birthdayWhatsappEnabled = automationMap['BIRTHDAY_WHATSAPP'] !== false;

    // Find members whose birthday is today (match month and day, ignore year)
    const { data: members } = await supabase
      .from('members')
      .select('id, first_name, last_name, email, phone, date_of_birth')
      .eq('church_id', church.id)
      .not('date_of_birth', 'is', null);

    if (!members || members.length === 0) continue;

    const birthdayMembers = members.filter(m => {
      const dob = new Date(m.date_of_birth);
      return dob.getMonth() + 1 === month && dob.getDate() === day;
    });

    if (birthdayMembers.length === 0) continue;

    // ── Fetch custom birthday template (once per church) ──
    const { data: birthdayTemplate } = await supabase
      .from('message_templates')
      .select('body')
      .eq('church_id', church.id)
      .eq('category', 'BIRTHDAY')
      .eq('is_active', true)
      .limit(1)
      .single();

    // Send birthday emails to members who have email addresses
    if (birthdayEmailEnabled) {
      for (const member of birthdayMembers) {
        if (!member.email) continue;
        let customEmailMessage;
        if (birthdayTemplate?.body) {
          customEmailMessage = birthdayTemplate.body
            .replace(/\{name\}/gi, member.first_name)
            .replace(/\{churchName\}/gi, church.name);
        }
        const result = await sendBirthdayEmail(
          member.email,
          member.first_name,
          church.name,
          customEmailMessage
        );
        if (result.success) memberEmails++;
        else errors.push(`${member.first_name} ${member.last_name}: ${result.error}`);
      }
    }

    // ── WhatsApp birthday wishes ──
    // Independent of the email leg above: a member with a phone but no email
    // still gets a WhatsApp greeting, and vice versa. Credentials are the
    // church's own Wamatas instance, so a church that has not connected one is
    // skipped without affecting its emails.
    if (birthdayWhatsappEnabled) {
      const configResult = await loadWhatsAppConfig(supabase, church.id);
      if (!configResult.error) {
        const { config, instanceId, accessToken, dailyLimit } = configResult;
        let sentToday = configResult.sentToday;
        let churchWhatsappSent = 0;

        // French is the default greeting; English churches get the English one.
        const isEnglish = String(church.default_language || '').toLowerCase().startsWith('en');

        const withPhone = birthdayMembers.filter(m => m.phone);
        for (let i = 0; i < withPhone.length; i++) {
          const member = withPhone[i];

          if (sentToday >= dailyLimit) {
            errors.push(`WhatsApp for ${church.name}: daily limit reached`);
            break;
          }

          const formatted = toWamatasNumber(member.phone);
          if (!formatted) {
            await logSend(supabase, {
              churchId: church.id, recipientId: member.id, purpose: 'birthday',
              phone: member.phone, message: '', status: 'failed',
              errorMessage: 'Invalid phone number'
            });
            continue;
          }

          let message;
          if (birthdayTemplate?.body) {
            message = birthdayTemplate.body
              .replace(/\{name\}/gi, member.first_name)
              .replace(/\{churchName\}/gi, church.name);
          } else {
            message = isEnglish
              ? `\u{1F382} Happy Birthday, ${member.first_name}! ${church.name} wishes you a blessed birthday. May God continue to bless you abundantly!`
              : `\u{1F382} Joyeux anniversaire ${member.first_name} ! ${church.name} vous souhaite un anniversaire béni. Que Dieu continue de vous bénir abondamment !`;
          }

          const result = await sendWamatasText({ to: member.phone, message, instanceId, accessToken });

          if (result.ok) {
            whatsappSent++;
            churchWhatsappSent++;
            sentToday++;
            await recordSend(supabase, config.id, sentToday);
            await logSend(supabase, {
              churchId: church.id, recipientId: member.id, purpose: 'birthday',
              phone: formatted, message, status: 'sent',
              providerMessageId: result.providerMessageId
            });
          } else {
            errors.push(`WhatsApp ${member.first_name} ${member.last_name}: ${result.error}`);
            await logSend(supabase, {
              churchId: church.id, recipientId: member.id, purpose: 'birthday',
              phone: formatted, message, status: 'failed',
              errorMessage: result.error, raw: result.raw
            });
          }

          // Space out sends to stay under the provider's rate limit.
          if (i < withPhone.length - 1) await delay(SEND_SPACING_MS);
        }

        if (churchWhatsappSent > 0) {
          // Logged the same aggregate way as a manual blast so the History tab
          // shows automated birthday messages alongside them.
          await supabase.from('messages').insert({
            church_id: church.id,
            message_type: 'WHATSAPP',
            recipient_type: 'ALL_MEMBERS',
            recipient_count: churchWhatsappSent,
            body: 'Automated birthday WhatsApp messages',
            status: 'SENT',
            sent_by: 'System'
          });
        }
      }
    }

    // Send admin summary
    const { data: admins } = await supabase
      .from('church_users')
      .select('email')
      .eq('church_id', church.id)
      .eq('role', 'ADMIN')
      .eq('is_active', true);

    const birthdayNames = birthdayMembers.map(m => `${m.first_name} ${m.last_name}`);
    for (const admin of (admins || [])) {
      if (!admin.email) continue;
      const result = await sendBirthdayAdminNotification(admin.email, church.name, birthdayNames);
      if (result.success) adminEmails++;
      else errors.push(`Admin ${admin.email}: ${result.error}`);
    }
  }

  return Response.json({
    date: `${month}/${day}`,
    memberEmails,
    adminEmails,
    whatsappSent,
    errors: errors.length > 0 ? errors : undefined
  });
}
