// Verify the stored PawaPay token against the wallet endpoint.
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
    const res = await fetch(`${baseUrl}/v1/wallets`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      return Response.json(
        { connected: false, mode, baseUrl, error: payload?.message || `HTTP ${res.status}`, code: 'PAWAPAY_ERROR' },
        { status: 200 }
      );
    }
    return Response.json({
      connected: true,
      mode,
      baseUrl,
      wallets: Array.isArray(payload) ? payload.length : (Array.isArray(payload?.wallets) ? payload.wallets.length : null)
    });
  } catch (error) {
    return Response.json(
      { connected: false, mode, baseUrl, error: error?.message || 'Network error', code: 'NETWORK_ERROR' },
      { status: 200 }
    );
  }
}
