// Rate limiting: Vercel provides basic DDoS protection. If abuse is detected,
// add next-rate-limit or upstash/ratelimit middleware here.
import { createClient } from '@supabase/supabase-js';
import { sendVisitorFollowupReminder } from '../../../../lib/notifications';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  const now = new Date();
  const intervals = [1, 3, 7]; // days ago
  let sent = 0;
  const errors = [];

  // Get all churches with their admins
  const { data: churches } = await supabase
    .from('churches')
    .select('id, name');

  if (!churches) {
    return Response.json({ error: 'Failed to fetch churches' }, { status: 500 });
  }

  for (const church of churches) {
    // Get admin emails for this church
    const { data: admins } = await supabase
      .from('church_users')
      .select('email')
      .eq('church_id', church.id)
      .eq('role', 'ADMIN')
      .eq('is_active', true);

    if (!admins || admins.length === 0) continue;
    const adminEmails = admins.filter(a => a.email).map(a => a.email);
    if (adminEmails.length === 0) continue;

    for (const daysAgo of intervals) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() - daysAgo);
      const dateStr = targetDate.toISOString().split('T')[0];

      // Find visitors who visited on that exact date and aren't completed
      const { data: visitors } = await supabase
        .from('visitors')
        .select('id, full_name, visit_date, followup_status')
        .eq('church_id', church.id)
        .eq('visit_date', dateStr)
        .neq('followup_status', 'COMPLETED');

      if (!visitors || visitors.length === 0) continue;

      for (const visitor of visitors) {
        // Send to the first admin (avoid spamming all admins per visitor)
        const result = await sendVisitorFollowupReminder(
          adminEmails[0],
          church.name,
          visitor.full_name,
          daysAgo
        );
        if (result.success) sent++;
        else errors.push(`${visitor.full_name} (${daysAgo}d): ${result.error}`);
      }
    }
  }

  return Response.json({ sent, errors: errors.length > 0 ? errors : undefined });
}
