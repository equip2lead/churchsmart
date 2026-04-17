/**
 * Trial expiration reminder utility.
 *
 * This function checks for churches on the FREE plan whose trial is
 * ending soon (7 days, 3 days, or 0 days) and marks reminders as sent.
 *
 * HOW TO RUN: Call this from a scheduled job —
 *   - Vercel Cron (vercel.json → crons) running once per day, OR
 *   - Supabase Edge Function on a pg_cron schedule.
 *
 * EMAIL PROVIDER: Replace the console.log stubs below with actual
 * email sends via Resend, SendGrid, or a Supabase Edge Function
 * that calls an SMTP relay.
 *
 * REQUIRED COLUMNS on the `churches` table (add via migration):
 *   trial_end              timestamptz
 *   trial_reminder_7d_sent boolean DEFAULT false
 *   trial_reminder_3d_sent boolean DEFAULT false
 *   trial_reminder_0d_sent boolean DEFAULT false
 *
 * EMAIL CONTENT GUIDELINES:
 *   7 days: "Your ChurchSmart trial ends in 7 days. Upgrade now to keep all your data."
 *   3 days: "Only 3 days left on your trial! Don't lose access to your church data."
 *   0 days: "Your trial has ended. Upgrade today to continue managing your church."
 */

import { createClient } from '@supabase/supabase-js';

const REMINDERS = [
  { daysLeft: 7, flag: 'trial_reminder_7d_sent', subject: 'Your ChurchSmart trial ends in 7 days' },
  { daysLeft: 3, flag: 'trial_reminder_3d_sent', subject: 'Only 3 days left on your trial!' },
  { daysLeft: 0, flag: 'trial_reminder_0d_sent', subject: 'Your trial has ended' },
];

export async function checkTrialReminders(supabaseUrl, supabaseServiceKey) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date();
  let sent = 0;

  for (const reminder of REMINDERS) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + reminder.daysLeft);
    const dateStr = targetDate.toISOString().split('T')[0];

    // Find churches whose trial_end falls on or before the target date
    // and haven't been sent this reminder yet
    const { data: churches, error } = await supabase
      .from('churches')
      .select('id, name, email, trial_end')
      .lte('trial_end', `${dateStr}T23:59:59Z`)
      .eq(reminder.flag, false);

    if (error) {
      console.error(`Trial reminder check failed for ${reminder.daysLeft}d:`, error);
      continue;
    }

    for (const church of (churches || [])) {
      // TODO: Replace with actual email send via Resend/SendGrid
      console.log(`TODO: Send trial reminder email to ${church.name} (${church.email}) - ${reminder.daysLeft}d left — "${reminder.subject}"`);

      // Mark as sent so we don't re-send
      await supabase
        .from('churches')
        .update({ [reminder.flag]: true })
        .eq('id', church.id);

      sent++;
    }
  }

  return { sent };
}
