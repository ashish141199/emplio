// Email through Resend: plain text, or text plus an HTML version. False (and logged) when it
// didn't go out; never throws. from/replyTo default to RESEND_FROM and none.
export async function sendEmail(to: string | string[], subject: string, text: string, o: { html?: string; from?: string; replyTo?: string[] } = {}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set; skipped email to", to);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: o.from ?? process.env.RESEND_FROM, to, subject, text, html: o.html, reply_to: o.replyTo?.length ? o.replyTo : undefined }),
  }).catch((error) => error as Error);
  if (res instanceof Error || !res.ok) {
    console.error("email failed", to, res instanceof Error ? res : await res.text());
    return false;
  }
  return true;
}
