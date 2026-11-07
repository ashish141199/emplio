import { z } from "zod";
import type { PollTrigger } from "./index";

const DAY = 86_400;

// A row appearing in one of Razorpay's lists, or (with `status`) reaching that status. Razorpay has no event log.
// Those it also pushes arrive by webhook instead (own/razorpay/webhooks.ts); this is for the rest, and for a server
// or account where the webhook can't be set up.
// ponytail: one page, the newest 100 rows of the window; a list busier than that between checks loses some
const trigger = (description: string, action: string, field: string, what: string, o: { status?: string; days?: number } = {}): PollTrigger => ({
  description: `${description}.`,
  config: z.object({}),
  output: [{ name: field, type: "object", required: true, description: `The Razorpay ${what}. Amounts are in paise: 50000 is ₹500.` }],
  every: 5,
  min: 5,
  async poll(_config, run) {
    const from = Math.floor(Date.now() / 1000) - (o.days ?? 1) * DAY;
    const out = (await run(`razorpay.${action}`, { count: 100, from })) as { items?: any[] };
    return (out.items ?? []).filter((r) => !o.status || r.status === o.status).map((r) => ({ id: String(r.id), item: { [field]: r } }));
  },
});

const PAYMENT = "payment: id, amount, currency, status, method, email, contact, order_id, notes";
const ORDER = "order: id, amount, amount_paid, currency, receipt, status, notes";
const REFUND = "refund: id, payment_id, amount, currency, status, speed_processed, notes";
const SUBSCRIPTION = "subscription: id, plan_id, customer_id, status, paid_count, current_end, notes";
const INVOICE = "invoice: id, invoice_number, customer_details, amount, amount_paid, status, short_url, notes";
const LINK = "payment link: id, amount, amount_paid, currency, customer, status, short_url, notes";

// Things paid or ended well after they were created look back a month, since the lists filter by creation date.
export const razorpay: Record<string, PollTrigger> = {
  new_payment: trigger("A customer starts a payment, whatever comes of it", "list_payments", "payment", PAYMENT),
  payment_captured: trigger("A payment succeeds and the money is captured", "list_payments", "payment", PAYMENT, { status: "captured", days: 3 }),
  payment_failed: trigger("A customer's payment fails", "list_payments", "payment", PAYMENT, { status: "failed" }),
  new_order: trigger("An order is created", "list_orders", "order", ORDER),
  order_paid: trigger("An order is paid in full", "list_orders", "order", ORDER, { status: "paid", days: 30 }),
  new_refund: trigger("A refund is started", "list_refunds", "refund", REFUND),
  refund_processed: trigger("A refund reaches the customer", "list_refunds", "refund", REFUND, { status: "processed", days: 30 }),
  refund_failed: trigger("A refund fails: the money went back to the balance and the customer wasn't paid", "list_refunds", "refund", REFUND, { status: "failed", days: 30 }),
  new_dispute: trigger("A customer opens a dispute or chargeback", "list_disputes", "dispute", "dispute: id, payment_id, amount, reason_code, status, respond_by"),
  new_settlement: trigger("A settlement is made to the bank", "list_settlements", "settlement", "settlement: id, amount, status, fees, tax, utr", { days: 3 }),
  new_subscription: trigger("A subscription is created", "list_subscriptions", "subscription", SUBSCRIPTION),
  subscription_halted: trigger("A subscription stops because its payments keep failing", "list_subscriptions", "subscription", SUBSCRIPTION, { status: "halted", days: 30 }),
  subscription_cancelled: trigger("A subscription is cancelled", "list_subscriptions", "subscription", SUBSCRIPTION, { status: "cancelled", days: 30 }),
  new_invoice: trigger("An invoice is created", "list_invoices", "invoice", INVOICE),
  invoice_paid: trigger("An invoice is paid", "list_invoices", "invoice", INVOICE, { status: "paid", days: 30 }),
  invoice_expired: trigger("An invoice expires unpaid", "list_invoices", "invoice", INVOICE, { status: "expired", days: 30 }),
  new_payment_link: trigger("A payment link is created", "list_payment_links", "payment_link", LINK),
  payment_link_paid: trigger("A payment link is paid", "list_payment_links", "payment_link", LINK, { status: "paid", days: 30 }),
  payment_link_expired: trigger("A payment link expires unpaid", "list_payment_links", "payment_link", LINK, { status: "expired", days: 30 }),
  new_virtual_account: trigger("A virtual account is created (needs Smart Collect switched on at Razorpay)", "list_virtual_accounts", "virtual_account", "virtual account: id, name, customer_id, receivers, status, amount_paid"),
  new_qr_code: trigger("A QR code is created", "list_qr_codes", "qr_code", "QR code: id, name, usage, status, payments_amount_received, image_url"),
  new_transfer: trigger("A Route transfer to a linked account is created (needs Route switched on at Razorpay)", "list_transfers", "transfer", "transfer: id, source, recipient, amount, currency, status"),
  new_customer: trigger("A customer is saved on Razorpay", "list_customers", "customer", "customer: id, name, email, contact, gstin, notes"),
};
