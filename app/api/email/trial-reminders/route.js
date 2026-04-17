import { createClient } from '@supabase/supabase-js';
import { sendTrialReminderEmail } from '../../../../lib/notifications';

const REMINDERS = [
  { daysLeft: 7, flag: 'trial_reminder_7d_sent' },
  { daysLeft: 3, flag: 'trial_reminder_3d_sent' },
  { daysLeft: 0, flag: 'trial_reminder_0d_sent' },
];

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(request) {
  // Verify cron secret — reject unauthorized calls
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  const now = new Date();
  let sent = 0;
  const errors = [];

  for (const reminder of REMINDERS) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + reminder.daysLeft);
    const dateStr = targetDate.toISOString().split('T')[0];

    // Find FREE-plan churches whose trial ends on or before this date
    // and haven't received this reminder yet
    const { data: churches, error } = await supabase
      .from('churches')
      .select('id, name, email, trial_end')
      .lte('trial_end', `${dateStr}T23:59:59Z`)
      .eq(reminder.flag, false);

    if (error) {
      errors.push(`${reminder.daysLeft}d query: ${error.message}`);
      continue;
    }

    for (const church of (churches || [])) {
      if (!church.email) continue;

      const result = await sendTrialReminderEmail(church.email, church.name, reminder.daysLeft);

      // Mark as sent regardless of email success to prevent retry spam
      await supabase
        .from('churches')
        .update({ [reminder.flag]: true })
        .eq('id', church.id);

      if (result.success) {
        sent++;
      } else {
        errors.push(`${church.name}: ${result.error}`);
      }
    }
  }

  return Response.json({ sent, errors: errors.length > 0 ? errors : undefined });
}

// Also support GET for Vercel Cron (which sends GET requests)
export async function GET(request) {
  return POST(request);
}
