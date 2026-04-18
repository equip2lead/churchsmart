// Rate limiting: Vercel provides basic DDoS protection. If abuse is detected,
// add next-rate-limit or upstash/ratelimit middleware here.
import { createClient } from '@supabase/supabase-js';
import { sendBirthdayEmail, sendBirthdayAdminNotification } from '../../../../lib/notifications';

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
  const errors = [];

  // Get all churches
  const { data: churches, error: churchErr } = await supabase
    .from('churches')
    .select('id, name');

  if (churchErr || !churches) {
    return Response.json({ error: 'Failed to fetch churches', detail: churchErr?.message }, { status: 500 });
  }

  for (const church of churches) {
    // Find members whose birthday is today (match month and day, ignore year)
    const { data: members } = await supabase
      .from('members')
      .select('id, first_name, last_name, email, date_of_birth')
      .eq('church_id', church.id)
      .not('date_of_birth', 'is', null);

    if (!members || members.length === 0) continue;

    const birthdayMembers = members.filter(m => {
      const dob = new Date(m.date_of_birth);
      return dob.getMonth() + 1 === month && dob.getDate() === day;
    });

    if (birthdayMembers.length === 0) continue;

    // Send birthday emails to members who have email addresses
    for (const member of birthdayMembers) {
      if (!member.email) continue;
      const result = await sendBirthdayEmail(
        member.email,
        member.first_name,
        church.name
      );
      if (result.success) memberEmails++;
      else errors.push(`${member.first_name} ${member.last_name}: ${result.error}`);
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
    errors: errors.length > 0 ? errors : undefined
  });
}
