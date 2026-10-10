// Verify the stored PawaPay token against the active-conf endpoint.
import { requireSuperAdmin, getPlatformSetting, pawapayBaseUrl } from '../../../../lib/superAdmin';

export async function POST(request) {
  const gate = await requireSuperAdmin(request, 'view_payment_settings');
  if (gate.response) return gate.response;
  const { supabase } = gate;

  const token = await getPlatformSetting(supabase, 'pawapay_token', 'PAWAPAY_API_TOKEN');
  if (!token) {
    return Response.json({ connected: false, error: 'No PawaPay token configured', code: 'NO_TOKEN' }, { status: 200 });
  }

  const mode = (await getPlatformSetting(supabase, 'pawapay_mode')) || 'sandbox';
  const baseUrl = pawapayBaseUrl(mode);

  try {
    // Try v2 endpoint first, fall back to v1
    let res = await fetch(`${baseUrl}/v2/active-conf`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    // If v2 returns 404, try v1 path
    if (res.status === 404) {
      res = await fetch(`${baseUrl}/active-conf`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }

    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      return Response.json(
        { connected: false, mode, baseUrl, error: payload?.message || `HTTP ${res.status}`, code: 'PAWAPAY_ERROR' },
        { status: 200 }
      );
    }

    // Count providers/correspondents from the response
    const providers = payload?.providers || payload?.correspondents || [];
    return Response.json({
      connected: true,
      mode,
      baseUrl,
      providers: Array.isArray(providers) ? providers.length : 0
    });
  } catch (error) {
    return Response.json(
      { connected: false, mode, baseUrl, error: error?.message || 'Network error', code: 'NETWORK_ERROR' },
      { status: 200 }
    );
  }
}
