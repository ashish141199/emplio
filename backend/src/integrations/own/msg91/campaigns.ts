// Campaigns and OneAPI: multi-step, multi-channel sends designed in MSG91's panel, started from here with
// the recipients and their values. Plus making a reseller sub-account.
import { z } from "zod";
import { rest } from "../openapi";
import type { OwnAction } from "../index";
import { CONTROL, legacy, send } from "./client";

// both take what to send wrapped in {"data": {...}}
const omit = (i: Record<string, unknown>, ...keys: string[]) => Object.fromEntries(Object.entries(i).filter(([k]) => !keys.includes(k)));

const person = z.object({ name: z.string().optional(), email: z.string().optional() });
const recipients = z
  .array(
    z
      .object({
        to: z
          .array(
            z
              .object({
                name: z.string().optional(),
                email: z.string().optional(),
                mobiles: z.string().optional().describe("With country code, no +, e.g. 919876543210"),
                variables: z.record(z.string(), z.any()).optional().describe("This person's own variable values"),
              })
              .loose(),
          )
          .min(1),
        cc: z.array(person).optional().describe("Email copies"),
        bcc: z.array(person).optional().describe("Email blind copies"),
        variables: z.any().optional().describe('Values shared by this group, e.g. {"order": {"type": "text", "value": "1042"}}'),
      })
      .loose(),
  )
  .min(1)
  .describe('Who gets it: [{"to": [{"name": "Asha", "email": "asha@example.com", "mobiles": "919876543210", "variables": {"name": {"type": "text", "value": "Asha"}}}]}]. Give the fields each channel in the campaign needs (mobiles for SMS/WhatsApp/voice, email for email)');
const extras = {
  attachments: z
    .array(z.object({ fileType: z.enum(["url", "base64"]), fileName: z.string(), file: z.string().describe("The link or the base64 content") }))
    .optional()
    .describe("Email attachments"),
  reply_to: z.array(person).optional().describe("Email reply-to addresses"),
};

export const campaignActions: Record<string, OwnAction> = {
  run_campaign: send(
      CONTROL,
      "POST",
      "/campaign/api/campaigns/{campaign_slug}/run",
      "Start a campaign built in MSG91 → Campaign for the recipients given, now or at a set time.",
      z.object({
        campaign_slug: z.string().min(1).describe("The campaign's slug, from its page in MSG91 → Campaign"),
        sendTo: recipients,
        ...extras,
        schedule_for: z.string().optional().describe("Send later, at 'YYYY-MM-DD HH:mm' in timezone; leave out to send now"),
        timezone: z.string().optional().describe("For schedule_for, e.g. Asia/Kolkata (the default)"),
        timezone_by: z.enum(["company", "contact", "manual"]).optional().describe("Whose timezone schedule_for is in: the company's, each contact's, or the one given"),
      }),
      { query: ["schedule_for", "timezone", "timezone_by"], body: (i) => ({ data: omit(i, "campaign_slug", "schedule_for", "timezone", "timezone_by") }) },
    ),
  run_campaign_on_segment: rest(
    CONTROL,
    "POST",
    "/segmento/api/v1/phonebooks/{phonebook_id}/communications/api",
    "Start a campaign for every contact in a Segmento phonebook, or in one of its segments.",
    z.object({
      phonebook_id: z.string().min(1).describe("The Segmento phonebook's id"),
      campaign_slug: z.string().min(1).describe("The campaign's slug"),
      segment_id: z.string().optional().describe("Only this segment; leave out for the whole phonebook"),
      mappings: z.record(z.string(), z.string()).describe('Which phonebook field feeds which recipient field: {"to": "Email", "mobiles": "Phonenumber"}'),
      variables: z
        .record(z.string(), z.union([z.string(), z.object({ custom_value: z.string() })]))
        .optional()
        .describe('Template variables: a field name to take it from each contact ({"name": "Name"}), or a fixed value ({"offer": {"custom_value": "20% off"}})'),
      meta: z.object({ validate_email: z.boolean().optional(), handle_bar_support: z.boolean().optional() }).optional().describe("validate_email: skip addresses that fail validation; handle_bar_support: templates use Handlebars"),
    }),
  ),
  run_oneapi_flow: send(
    CONTROL,
    "POST",
    "/oneapi/api/flow/{oneapi_slug}/run",
    "Run a OneAPI flow: one call that reaches people on the channels and fallbacks set in MSG91 → OneAPI (e.g. WhatsApp, then SMS if unread).",
    z.object({
      oneapi_slug: z.string().min(1).describe("The flow's slug, shown when the flow is made or opened in the panel"),
      sendTo: recipients,
      ...extras,
      validateBeforeSend: z.boolean().optional().describe("Validate email addresses before sending"),
      handleBarSupport: z.boolean().optional().describe("Templates use Handlebars"),
    }),
    { body: (i) => ({ data: omit(i, "oneapi_slug") }) },
  ),
  add_subaccount: legacy(
    "/add_client.php",
    "Make a sub-account (reseller client) under this account. MSG91 texts its password to the client's mobile.",
    z.object({
      user_full_name: z.string().min(1).describe("The client's full name"),
      user_mobile_number: z.string().min(1).describe("The client's mobile, unique across MSG91, with country code"),
      user_email: z.string().email().describe("The client's email, unique across MSG91"),
      user_name: z.string().min(1).describe("Login username (MSG91 uses the email)"),
      user_company_name: z.string().min(1).describe("The client's company"),
      user_industry: z.string().min(1).describe("The client's industry"),
      services: z.array(z.enum(["1", "2", "3", "4", "5"])).min(1).describe("Products to enable: 1 SMS, 2 Email, 3 Voice, 4 WhatsApp, 5 RCS"),
    }),
    { readOnly: false, rename: { services: "services[]" } },
  ),
};

