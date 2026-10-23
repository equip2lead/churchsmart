// Returns the raw platform data that the super-admin frontend tabs need:
// churches list, member counts, subscriptions, audit log, and mobile payments.
// This replaces the direct supabaseQuery() calls on the client which hang when
// the Supabase client's auth initialization gets stuck.
import { requireSuperAdmin } from '../../../../lib/superAdmin';

export async function GET(request) {
  const gate = await requireSuperAdmin(request, 'view_stats');
  if (gate.response) return gate.response;
  const { supabase } = gate;

  try {
    const [churchesRes, membersRes, subsRes, logRes, momoRes] = await Promise.all([
      supabase.from('churches').select('id,name,email,plan,is_suspended,created_at,city,country').order('created_at', { ascending: false }),
      supabase.from('members').select('church_id'),
      supabase.from('subscriptions').select('church_id,plan,status,current_period_end'),
      supabase.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('mobile_payments').select('*').order('created_at', { ascending: false }).limit(300)
    ]);

    const firstError = [churchesRes, membersRes, subsRes, logRes, momoRes].find(r => r.error);
    if (firstError) {
      console.error('[platform-data] query failed:', firstError.error.message);
      return Response.json({ error: 'Failed to load platform data' }, { status: 500 });
    }

    return Response.json({
      churches: churchesRes.data || [],
      members: membersRes.data || [],
      subscriptions: subsRes.data || [],
      auditLog: logRes.data || [],
      mobilePayments: momoRes.data || []
    });
  } catch (error) {
    console.error('[platform-data] unhandled', error);
    return Response.json({ error: 'Failed to load platform data' }, { status: 500 });
  }
}
