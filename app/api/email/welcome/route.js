import { sendWelcomeEmail } from '../../../../lib/notifications';

export async function POST(request) {
  try {
    const { email, churchName, adminName } = await request.json();
    if (!email) {
      return Response.json({ error: 'email is required' }, { status: 400 });
    }
    const result = await sendWelcomeEmail(email, churchName || 'Your Church', adminName || '');
    if (!result.success) {
      return Response.json({ error: result.error }, { status: 500 });
    }
    return Response.json({ success: true, id: result.id });
  } catch (err) {
    console.error('Welcome email route error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
