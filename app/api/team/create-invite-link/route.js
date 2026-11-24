// API: Generate a shareable invite link for a church.
// Admin creates a reusable link that anyone can use to join as VOLUNTEER.
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

const APP_URL = 'https://app.churchsmartnow.com';

export async function POST(request) {
  const reqId = crypto.randomUUID().slice(0, 8);
  const tag = `[create-invite-link ${reqId}]`;

  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return Response.json({ error: 'Missing authorization', code: 'NO_AUTH' }, { status: 401 });
    }

    const supabase = getSupabase();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      return Response.json({ error: 'Invalid session', code: 'INVALID_AUTH' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { churchId, base_role, role_id, expires_days } = body;

    if (!churchId) {
      return Response.json({ error: 'Missing churchId', code: 'MISSING_FIELDS' }, { status: 400 });
    }

    // Caller must be ADMIN
    const { data: caller } = await supabase
      .from('church_users')
      .select('id, role, church_id, full_name, email')
      .eq('auth_id', authUser.id)
      .eq('church_id', churchId)
      .eq('is_active', true)
      .maybeSingle();

    if (!caller || caller.role !== 'ADMIN') {
      return Response.json({ error: 'Only admins can create invite links', code: 'AUTH_INSUFFICIENT_ROLE' }, { status: 403 });
    }

    // Generate a short, shareable code
    const linkCode = crypto.randomBytes(6).toString('hex'); // 12 chars
    const expiresAt = new Date(Date.now() + (expires_days || 30) * 24 * 60 * 60 * 1000);

    // Store in church_invite_links table
    const { data: inserted, error: insertError } = await supabase
      .from('church_invite_links')
      .insert({
        church_id: churchId,
        link_code: linkCode,
        base_role: base_role || 'VOLUNTEER',
        role_id: role_id || null,
        expires_at: expiresAt.toISOString(),
        created_by: caller.email,
        is_active: true,
        uses_count: 0
      })
      .select('id, link_code')
      .single();

    if (insertError) {
      console.error(`${tag} insert_failed`, insertError.message);
      return Response.json({ error: 'Failed to create link', code: 'INSERT_FAILED' }, { status: 500 });
    }

    const inviteUrl = `${APP_URL}/join/${linkCode}`;

    console.log(`${tag} success link_id=${inserted.id} code=${linkCode}`);
    return Response.json({
      success: true,
      link_id: inserted.id,
      link_code: linkCode,
      invite_url: inviteUrl,
      expires_at: expiresAt.toISOString()
    });
  } catch (err) {
    console.error(`${tag} internal`, err?.message || err);
    return Response.json({ error: 'Internal server error', code: 'INTERNAL' }, { status: 500 });
  }
}

// GET: Retrieve active invite links for a church
export async function GET(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return Response.json({ error: 'Missing authorization' }, { status: 401 });
    }

    const supabase = getSupabase();
    const { data: { user: authUser } } = await supabase.auth.getUser(token);
    if (!authUser) {
      return Response.json({ error: 'Invalid session' }, { status: 401 });
    }

    const url = new URL(request.url);
    const churchId = url.searchParams.get('churchId');
    if (!churchId) {
      return Response.json({ error: 'Missing churchId' }, { status: 400 });
    }

    // Verify admin
    const { data: caller } = await supabase
      .from('church_users')
      .select('role')
      .eq('auth_id', authUser.id)
      .eq('church_id', churchId)
      .eq('is_active', true)
      .maybeSingle();

    if (!caller || caller.role !== 'ADMIN') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { data: links } = await supabase
      .from('church_invite_links')
      .select('*')
      .eq('church_id', churchId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    return Response.json({ links: links || [] });
  } catch (err) {
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

// DELETE: Deactivate an invite link
export async function DELETE(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return Response.json({ error: 'Missing authorization' }, { status: 401 });
    }

    const supabase = getSupabase();
    const { data: { user: authUser } } = await supabase.auth.getUser(token);
    if (!authUser) {
      return Response.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { linkId, churchId } = body;

    const { data: caller } = await supabase
      .from('church_users')
      .select('role')
      .eq('auth_id', authUser.id)
      .eq('church_id', churchId)
      .eq('is_active', true)
      .maybeSingle();

    if (!caller || caller.role !== 'ADMIN') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    await supabase
      .from('church_invite_links')
      .update({ is_active: false })
      .eq('id', linkId)
      .eq('church_id', churchId);

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
