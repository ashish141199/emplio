import { afterEach, expect, test } from "bun:test";
import { z } from "zod";
import { AppsError } from "../../types";
import { msg91 } from "./index";

type Call = { method: string; url: URL; headers: Record<string, string>; body: any };
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

// records every request and answers with reply(call); anything unanswered is a test bug, not a trip to MSG91
function stub(reply: (c: Call) => { status?: number; body?: unknown; type?: string } | undefined) {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const raw = init.body;
    const c = { method: init.method!, url: new URL(url), headers: init.headers as Record<string, string>, body: typeof raw === "string" ? JSON.parse(raw) : raw };
    calls.push(c);
    const r = reply(c);
    if (!r) throw new Error(`unexpected ${c.method} ${c.url}`);
    const text = typeof r.body === "string" ? r.body : JSON.stringify(r.body ?? {});
    return new Response(text, { status: r.status ?? 200, headers: { "content-type": r.type ?? "application/json" } });
  }) as typeof fetch;
  return calls;
}

const KEY = "123456AbCdEfGh";
// what own.run does once msg91 is listed in APPS: check the input, then run (the app isn't registered here yet)
const run = async (action: string, input: unknown) => {
  const a = msg91.actions[action]!;
  const parsed = a.input.safeParse(input);
  if (!parsed.success) throw new AppsError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return a.run(parsed.data, KEY);
};
const fails = (p: Promise<unknown>) =>
  p.then(
    () => {
      throw new Error("expected it to fail");
    },
    (e: AppsError) => e,
  );
const ok = { type: "success", message: "req1" };

test("an SMS goes to /flow with the key as the authkey header and the recipients as given", async () => {
  const calls = stub(() => ({ body: ok }));
  await run("send_sms", { template_id: "t1", recipients: [{ mobiles: "919876543210", VAR1: "Asha" }], short_url: "1" });
  expect(calls[0]!.method).toBe("POST");
  expect(calls[0]!.url.href).toBe("https://control.msg91.com/api/v5/flow");
  expect(calls[0]!.headers.authkey).toBe(KEY);
  expect(calls[0]!.headers.Authorization).toBeUndefined();
  expect(calls[0]!.body).toEqual({ template_id: "t1", recipients: [{ mobiles: "919876543210", VAR1: "Asha" }], short_url: "1" });
});

test("send_otp puts the template and number in the query and extra variables in the body", async () => {
  const calls = stub(() => ({ body: ok }));
  await run("send_otp", { template_id: "otp1", mobile: "919876543210", otp_length: 6, Param1: "Acme" });
  expect(calls[0]!.url.origin + calls[0]!.url.pathname).toBe("https://control.msg91.com/api/v5/otp");
  expect(Object.fromEntries(calls[0]!.url.searchParams)).toEqual({ template_id: "otp1", mobile: "919876543210", otp_length: "6" });
  expect(calls[0]!.body).toEqual({ Param1: "Acme" });
});

test("a WhatsApp template send is wrapped in MSG91's bulk payload", async () => {
  const calls = stub(() => ({ body: { status: "success", hasError: false, request_id: "r1" } }));
  await run("send_whatsapp_template", {
    integrated_number: "918012345678",
    template_name: "order_shipped",
    language: "en",
    recipients: [{ to: ["919876543210"], components: { body_1: { type: "text", value: "Asha" } } }],
  });
  expect(calls[0]!.url.href).toBe("https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/");
  expect(calls[0]!.body).toEqual({
    integrated_number: "918012345678",
    content_type: "template",
    payload: {
      messaging_product: "whatsapp",
      type: "template",
      template: { name: "order_shipped", language: { code: "en", policy: "deterministic" }, to_and_components: [{ to: ["919876543210"], components: { body_1: { type: "text", value: "Asha" } } }] },
    },
  });
});

test("reply buttons are built into an interactive message", async () => {
  const calls = stub(() => ({ body: { status: "success", hasError: false } }));
  await run("send_whatsapp_buttons", { integrated_number: "918012345678", recipient_number: "919876543210", body: "Confirm?", buttons: [{ id: "y", title: "Yes" }], footer: "Acme" });
  expect(calls[0]!.body).toEqual({
    integrated_number: "918012345678",
    recipient_number: "919876543210",
    content_type: "interactive",
    interactive: { type: "button", body: { text: "Confirm?" }, action: { buttons: [{ type: "reply", reply: { id: "y", title: "Yes" } }] }, footer: { text: "Acme" } },
  });
});

test("group calls go to api.msg91.com, and a DELETE carries its JSON body", async () => {
  const calls = stub(() => ({ body: { status: "Participant delete request sent successfully", hasError: false } }));
  await run("remove_whatsapp_group_participants", { group_id: "g/1", integrated_number: "918012345678", remove_participants: ["919876543210"] });
  expect(calls[0]!.method).toBe("DELETE");
  expect(calls[0]!.url.href).toBe("https://api.msg91.com/api/v5/whatsapp/groups/g%2F1/");
  expect(calls[0]!.body).toEqual({ integrated_number: "918012345678", remove_participants: ["919876543210"] });
});

test("an email is sent with the whole body as given", async () => {
  const calls = stub(() => ({ body: { status: "success", hasError: false, data: { unique_id: "u1" } } }));
  const input = { template_id: "welcome", from: { name: "Acme", email: "hi@mail.acme.in" }, domain: "mail.acme.in", recipients: [{ to: [{ email: "a@b.co" }], variables: { name: "Asha" } }] };
  await run("send_email", input);
  expect(calls[0]!.url.href).toBe("https://control.msg91.com/api/v5/email/send");
  expect(calls[0]!.body).toEqual(input);
});

test("campaigns wrap the recipients in data and keep the schedule in the query", async () => {
  const calls = stub(() => ({ body: { status: "success" } }));
  await run("run_campaign", { campaign_slug: "diwali", sendTo: [{ to: [{ mobiles: "919876543210" }] }], schedule_for: "2026-11-01 10:00" });
  expect(calls[0]!.url.pathname).toBe("/api/v5/campaign/api/campaigns/diwali/run");
  expect(calls[0]!.url.searchParams.get("schedule_for")).toBe("2026-11-01 10:00");
  expect(calls[0]!.body).toEqual({ data: { sendTo: [{ to: [{ mobiles: "919876543210" }] }] } });
});

test("the old balance endpoint takes the key in the query", async () => {
  const calls = stub(() => ({ body: "1520", type: "text/plain" }));
  expect(await run("get_sms_balance", {})).toBe("1520");
  expect(calls[0]!.url.href).toBe(`https://control.msg91.com/api/balance.php?type=4&authkey=${KEY}`);
  expect(calls[0]!.headers.authkey).toBeUndefined();
});

test("a 200 that says error fails, in each of MSG91's shapes", async () => {
  stub(() => ({ body: { message: "OTP retry count maxed out", type: "error" } }));
  expect((await fails(run("resend_otp", { mobile: "919876543210" }))).message).toBe("MSG91: OTP retry count maxed out");
  stub(() => ({ body: { status: "fail", hasError: true, data: null, errors: "Template with that name already exists" } }));
  expect((await fails(run("create_rcs_template", { project_id: "p", template_name: "x", function_name: "text_message", content: { text: "hi" } }))).message).toBe(
    "MSG91: Template with that name already exists",
  );
  stub(() => ({ body: { error: "Duration exceeds, allowed limit is 3 days" } }));
  expect((await fails(run("email_logs", { startDate: "2026-10-01", endDate: "2026-10-26" }))).message).toBe("MSG91: Duration exceeds, allowed limit is 3 days");
});

test("a bad key asks for reconnecting, and check() uses it", async () => {
  const calls = stub(() => ({ status: 401, body: { status: "fail", hasError: true, errors: "Unauthorized", code: "401" } }));
  const e = await fails(msg91.check("bad"));
  expect(e).toBeInstanceOf(AppsError);
  expect(e.expired).toBe(true);
  expect(calls[0]!.url.pathname).toBe("/api/v5/report/analytics/p/sms");
  expect(calls[0]!.headers.authkey).toBe("bad");
});

test("bad input is refused before any request", async () => {
  const calls = stub(() => ({ body: ok }));
  const e = await fails(run("verify_otp", { mobile: "+91 98765 43210", otp: "1234" }));
  expect(e).toBeInstanceOf(AppsError);
  expect(calls).toHaveLength(0);
});

test("every action has a described input the agent can read, and lookups don't ask first", async () => {
  for (const [name, a] of Object.entries(msg91.actions)) {
    expect(name).toMatch(/^[a-z0-9_]+$/);
    const schema = z.toJSONSchema(a.input, { io: "input" }) as { properties?: Record<string, { description?: string }> };
    for (const [field, p] of Object.entries(schema.properties ?? {})) expect(p.description ? "" : `${name}.${field}`).toBe("");
  }
  expect(msg91.actions.sms_logs!.readOnly).toBe(true);
  expect(msg91.actions.mark_sms_template_version_default!.readOnly).toBe(false);
  expect(msg91.actions.get_sip_credentials!.readOnly).toBe(false);
  expect(msg91.actions.delete_contacts!.readOnly).toBe(false);
});

test("SMS templates go up as a multipart form; sub-accounts list services as services[]", async () => {
  const calls = stub(() => ({ body: { status: "success", hasError: false, data: { template_id: "t9" } } }));
  await run("add_sms_template", { template: "Hi ##name##", template_name: "hi", sender_id: "ACMEIN", dlt_template_id: "1207000000000000001" });
  const form = calls[0]!.body as FormData;
  expect(form).toBeInstanceOf(FormData);
  expect(Object.fromEntries(form)).toEqual({ template: "Hi ##name##", template_name: "hi", sender_id: "ACMEIN", dlt_template_id: "1207000000000000001" });
  const sub = stub(() => ({ body: { msg_type: "success" } }));
  await run("add_subaccount", { user_full_name: "A", user_mobile_number: "919876543210", user_email: "a@b.co", user_name: "a@b.co", user_company_name: "B", user_industry: "Retail", services: ["1", "4"] });
  expect(sub[0]!.url.pathname).toBe("/api/add_client.php");
  expect(sub[0]!.url.searchParams.getAll("services[]")).toEqual(["1", "4"]);
  expect(sub[0]!.url.searchParams.get("authkey")).toBe(KEY);
});
