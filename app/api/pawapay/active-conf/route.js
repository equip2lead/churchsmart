// The correspondents your PawaPay account actually has enabled.
//
// The country table in lib/pawapay.js is maintained by hand, so this exists to
// check it against the source of truth: anything listed here but missing from
// the config (or spelled differently) will fail at deposit time.
import { requireSuperAdmin } from '../../../../lib/superAdmin';
import { getPawapayConfig, PAWAPAY_COUNTRIES } from '../../../../lib/pawapay';

export async function GET(request) {
  const gate = await requireSuperAdmin(request, 'view_payment_settings');
  if (gate.response) return gate.response;
  const { supabase } = gate;

  const { token, baseUrl, mode } = await getPawapayConfig(supabase);
  if (!token) {
    return Response.json({ error: 'No PawaPay token configured', code: 'NO_TOKEN' }, { status: 503 });
  }

  try {
    const res = await fetch(`${baseUrl}/active-conf`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      return Response.json({ error: payload?.message || `HTTP ${res.status}`, code: 'PAWAPAY_ERROR' }, { status: 502 });
    }

    // Flatten whatever shape came back into a plain list of correspondent ids.
    const live = new Set();
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (typeof node.correspondent === 'string') live.add(node.correspondent);
      Object.values(node).forEach(walk);
    };
    walk(payload);

    const configured = new Set();
    for (const country of Object.values(PAWAPAY_COUNTRIES)) {
      for (const op of country.operators) configured.add(op.correspondent);
    }

    return Response.json({
      mode,
      liveCorrespondents: [...live].sort(),
      // In your PawaPay account but absent from our config: unusable until added.
      missingFromConfig: [...live].filter(c => !configured.has(c)).sort(),
      // In our config but not enabled upstream: will be rejected at deposit time.
      notEnabledUpstream: [...configured].filter(c => !live.has(c)).sort()
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Network error', code: 'NETWORK_ERROR' }, { status: 502 });
  }
}
