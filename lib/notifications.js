/**
 * Email notification placeholders.
 *
 * These functions are stubs — wire them to an email provider
 * (e.g., Resend, SendGrid, or a Supabase Edge Function) when ready.
 * Each function accepts the data it will eventually need so call-sites
 * are already in place; the actual sending is a no-op for now.
 */

export async function notifyNewMember({ churchId, memberName, memberEmail }) {
  // TODO: send "New member joined" email to church admin
  console.log(`[notifications] notifyNewMember stub — church=${churchId}, member=${memberName}`);
}

export async function notifyDonationReceived({ churchId, donorName, amount, currency }) {
  // TODO: send donation receipt to donor + summary to church admin
  console.log(`[notifications] notifyDonationReceived stub — church=${churchId}, donor=${donorName}, amount=${currency} ${amount}`);
}

export async function notifyWeeklySummary({ churchId, stats }) {
  // TODO: send weekly digest email to church admin(s)
  console.log(`[notifications] notifyWeeklySummary stub — church=${churchId}`, stats);
}
