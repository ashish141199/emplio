// Razorpay telling us about events the moment they happen, on the business's own account. One webhook per connection,
// at /webhooks/razorpay/<connection>, carrying the events its automations need. Razorpay's merchant API can't delete a
// webhook, and caps an account at 30, so it's reused and its events only ever grow; events nobody wants are ignored.
// ponytail: reconnecting with a different Razorpay account doesn't move the webhook until the automation is saved again
import { createHmac, timingSafeEqual } from "node:crypto";
import type { ActionDetail } from "@emplio/shared";
import { AppsError } from "../../types";
import { type Api, call } from "../openapi";

// A webhook really from Razorpay: its signature over the raw body, with this connection's secret.
export function razorpaySignatureOk(body: string, signature: string, secret: string) {
  const got = Buffer.from(signature, "hex");
  const want = createHmac("sha256", secret).update(body).digest();
  return got.length === want.length && timingSafeEqual(got, want);
}

// The polled triggers (polls/razorpay.ts) Razorpay also pushes: our name → its event.
const POLLED_TOO: Record<string, string> = {
  payment_captured: "payment.captured",
  payment_failed: "payment.failed",
  order_paid: "order.paid",
  new_refund: "refund.created",
  refund_processed: "refund.processed",
  refund_failed: "refund.failed",
  new_dispute: "payment.dispute.created",
  new_settlement: "settlement.processed",
  subscription_halted: "subscription.halted",
  subscription_cancelled: "subscription.cancelled",
  invoice_paid: "invoice.paid",
  invoice_expired: "invoice.expired",
  payment_link_paid: "payment_link.paid",
  payment_link_expired: "payment_link.expired",
  new_virtual_account: "virtual_account.created",
  new_qr_code: "qr_code.created",
};

// Triggers only a webhook can see: a list can't show them. [our name, its event, description, what the event carries]
const PUSHED: [string, string, string, string][] = [
  ["payment_authorized", "payment.authorized", "A payment is authorised by the bank, before it's captured", "payment"],
  ["refund_speed_changed", "refund.speed_changed", "A fast refund drops to the normal speed", "refund, payment"],
  ["dispute_action_required", "payment.dispute.action_required", "A dispute needs more evidence from you", "dispute, payment"],
  ["dispute_under_review", "payment.dispute.under_review", "Evidence for a dispute is under review", "dispute, payment"],
  ["dispute_won", "payment.dispute.won", "A dispute is won and the money comes back", "dispute, payment"],
  ["dispute_lost", "payment.dispute.lost", "A dispute is lost", "dispute, payment"],
  ["dispute_closed", "payment.dispute.closed", "A dispute ends with no win or loss", "dispute, payment"],
  ["downtime_started", "payment.downtime.started", "A bank, wallet or UPI handle stops working", "payment.downtime"],
  ["downtime_updated", "payment.downtime.updated", "An ongoing payment outage changes", "payment.downtime"],
  ["downtime_resolved", "payment.downtime.resolved", "A payment outage ends", "payment.downtime"],
  ["subscription_authenticated", "subscription.authenticated", "A customer approves a subscription's autopay", "subscription"],
  ["subscription_activated", "subscription.activated", "A subscription starts", "subscription"],
  ["subscription_charged", "subscription.charged", "A subscription's renewal is paid", "subscription, payment"],
  ["subscription_pending", "subscription.pending", "A subscription's renewal fails and will be retried", "subscription"],
  ["subscription_paused", "subscription.paused", "A subscription is paused", "subscription"],
  ["subscription_resumed", "subscription.resumed", "A paused subscription starts again", "subscription"],
  ["subscription_completed", "subscription.completed", "A subscription runs its full term", "subscription"],
  ["subscription_updated", "subscription.updated", "A subscription's plan or quantity changes", "subscription"],
  ["invoice_partially_paid", "invoice.partially_paid", "Part of an invoice is paid", "invoice, order, payment"],
  ["payment_link_partially_paid", "payment_link.partially_paid", "Part of a payment link is paid", "payment_link, order, payment"],
  ["payment_link_cancelled", "payment_link.cancelled", "A payment link is cancelled", "payment_link"],
  ["virtual_account_credited", "virtual_account.credited", "Money arrives in a virtual account", "virtual_account, payment, bank_transfer"],
  ["virtual_account_closed", "virtual_account.closed", "A virtual account is closed", "virtual_account"],
  ["qr_code_credited", "qr_code.credited", "Someone pays a QR code", "qr_code, payment"],
  ["qr_code_closed", "qr_code.closed", "A QR code is closed", "qr_code"],
  ["transfer_processed", "transfer.processed", "A Route transfer to a linked account goes through", "transfer"],
  ["transfer_failed", "transfer.failed", "A Route transfer fails", "transfer"],
  ["route_activated", "product.route.activated", "A sub-merchant's Route is activated", "account, merchant_product"],
  ["route_under_review", "product.route.under_review", "A sub-merchant's Route goes under review", "account, merchant_product"],
  ["route_needs_clarification", "product.route.needs_clarification", "Razorpay needs more about a sub-merchant's Route", "account, merchant_product"],
];

export const events: Record<string, string> = { ...POLLED_TOO, ...Object.fromEntries(PUSHED.map(([name, event]) => [name, event])) };

export const triggers: Record<string, { description: string; output: ActionDetail["input"] }> = Object.fromEntries(
  PUSHED.map(([name, , description, carries]) => [
    name,
    {
      description: `${description}.`,
      output: carries.split(", ").map((field) => ({ name: field, type: "object", required: false, description: `The Razorpay ${field}. Amounts are in paise: 50000 is ₹500.` })),
    },
  ]),
);

// the triggers (razorpay.payment_captured) one of Razorpay's events starts
export const triggersFor = (event: string) => Object.keys(events).filter((name) => events[name] === event).map((name) => `razorpay.${name}`);

// What an automation sees, the same shape as a polled event: { payment: {...}, order: {...} }.
export const eventData = (payload: Record<string, any> = {}) => Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, v?.entity ?? v]));

// Each connection's webhook secret, worked out rather than stored. Razorpay signs with whatever we give it.
export function webhookSecret(connection: string) {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY isn't set");
  return createHmac("sha256", key).update(`razorpay-webhook:${connection}`).digest("hex");
}

export const watchId = (connection: string) => `razorpay:${connection}`;
export const connectionOf = (id: string) => id.slice(id.indexOf(":") + 1);

// Make sure this connection's webhook exists and carries `event`. Answers the id automations are stored under.
export async function watch(api: Api, key: string, connection: string, event: string) {
  const base = process.env.WEBHOOK_URL;
  if (!base) throw new AppsError("this server can't receive Razorpay's events (WEBHOOK_URL isn't set)");
  const url = `${base}/webhooks/razorpay/${connection}`;
  const get = { method: "GET", path: "/v1/webhooks", query: ["count"], headers: [] };
  const { items = [] } = (await call(api, key, get, { count: 100 })) as { items?: { id: string; url: string; active: boolean; events?: Record<string, boolean> }[] };
  const found = items.find((h) => h.url === url);
  if (found?.active && found.events?.[event]) return watchId(connection);
  const wanted = { ...Object.fromEntries(Object.entries(found?.events ?? {}).filter(([, on]) => on)), [event]: true };
  await call(
    api,
    key,
    {
      method: found ? "PUT" : "POST",
      path: found ? "/v1/webhooks/{id}" : "/v1/webhooks",
      query: [],
      headers: [],
      body: { kind: "fields", fields: [["url", "url"], ["secret", "secret"], ["events", "events"], ["active", "active"]] },
    },
    { id: found?.id, url, secret: webhookSecret(connection), events: wanted, active: true },
  );
  return watchId(connection);
}
