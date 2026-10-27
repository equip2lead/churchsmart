// Nightly reset of the per-church WhatsApp send counters.
// Scheduled from vercel.json; protected by CRON_SECRET.
//
// lib/whatsapp.js also rolls a stale counter over when it reads the config, so
// a missed run here degrades gracefully rather than freezing a church's quota.
import { getServiceClient, todayISO } from '../../../../lib/whatsapp';

async function resetCounters() {
  const supabase = getServiceClient();
  if (!supabase) {
    console.error('[whatsapp-reset-daily] missing supabase env');
    return Response.json({ error: 'Server is not configured', code: 'SERVER_NOT_CONFIGURED' }, { status: 503 });
  }
  const today = todayISO();

  const { data, error } = await supabase
    .from('whatsapp_config')
    .update({ messages_sent_today: 0, last_reset_date: today })
    .lt('last_reset_date', today)
    .select('church_id');

  if (error) {
    console.error('[whatsapp-reset-daily] failed:', error.message);
    return Response.json({ error: 'Failed to reset counters', detail: error.message }, { status: 500 });
  }

  const reset = data?.length || 0;
  console.log(`[whatsapp-reset-daily] reset=${reset} date=${today}`);
  return Response.json({ reset, date: today });
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return resetCounters();
}

// Vercel cron issues GET; POST is accepted so the job can also be triggered
// manually with the same secret.
export async function POST(request) {
  return GET(request);
}
