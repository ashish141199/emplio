// SMS: sending through a template (MSG91 calls it a flow), the templates themselves, logs and analytics,
// and the account's SMS credit balance.
import { z } from "zod";
import { rest } from "../openapi";
import type { OwnAction } from "../index";
import { analyticsRange, CONTROL, legacy, logRange, mobile, send } from "./client";

const templateId = z.string().min(1).describe("The MSG91 SMS template id (a 24-character id like 669a29fbd6fc053066739b42, from the SMS → Templates page or msg91.add_sms_template)");
const dltTemplateId = z
  .string()
  .optional()
  .describe("India only: the 19-digit template id the DLT portal (Jio, Airtel, Vi…) gave this exact text. Every SMS to an Indian number needs an approved DLT template");
const senderId = z.string().describe("The sender id (header) messages come from, e.g. MSGIND; in India it must be registered on DLT");

export const smsActions: Record<string, OwnAction> = {
  send_sms: rest(
    CONTROL,
    "POST",
    "/flow",
    "Send an SMS from an approved template to one or many numbers, each with its own variable values. The answer's message is the request id that msg91.sms_logs reports against.",
    z
      .object({
        template_id: templateId,
        recipients: z
          .array(z.object({ mobiles: mobile }).catchall(z.string()))
          .min(1)
          .describe(
            'One entry per number: {"mobiles": "919876543210", "VAR1": "Asha", "VAR2": "₹499"}. The keys besides mobiles are the template\'s variables by name (##VAR1## in the template is VAR1). A mobiles value may also hold several numbers comma separated, all getting the same values',
          ),
        short_url: z.enum(["0", "1"]).optional().describe("1 to shorten and track the links in the message (MSG91's short URL service); 0 or leave out for no shortening"),
        short_url_expiry: z.string().optional().describe("With short_url 1: how many seconds the short links work for"),
        realTimeResponse: z.enum(["0", "1"]).optional().describe("1 to wait for the operator's answer and get per-number results back; leave out for a queued send"),
      })
      .loose(),
    {},
  ),
  add_sms_template: send(
    CONTROL,
    "POST",
    "/sms/addTemplate",
    "Add an SMS template. Variables are written ##name## in the text (e.g. 'Your order ##order## ships today'). The answer has the new template_id that msg91.send_sms needs.",
    z.object({
      template: z.string().min(1).describe("The message text, with variables as ##name##, e.g. 'Hi ##name##, your OTP is ##otp##'. In India it must match the DLT-approved text exactly"),
      template_name: z.string().min(1).describe("A name to know it by in MSG91"),
      sender_id: senderId,
      dlt_template_id: dltTemplateId,
      smsType: z.enum(["NORMAL", "UNICODE"]).optional().describe("NORMAL for English (default); UNICODE for Hindi or any other non-Latin script"),
    }),
    { form: true },
  ),
  add_sms_template_version: send(
    CONTROL,
    "POST",
    "/sms/addTemplateVersion",
    "Add a new version (new text) to an existing SMS template. It isn't used until marked default with msg91.mark_sms_template_version_default.",
    z.object({
      template_id: templateId,
      template: z.string().min(1).describe("The new text, variables as ##name##"),
      sender_id: senderId,
      dlt_template_id: dltTemplateId,
    }),
    { form: true },
  ),
  get_sms_template_versions: rest(
    CONTROL,
    "POST",
    "/sms/getTemplateVersions",
    "One SMS template's versions: text, sender id, DLT id, status, and which version is the default.",
    z.object({ template_id: templateId }),
    { readOnly: true },
  ),
  mark_sms_template_version_default: rest(
    CONTROL,
    "GET",
    "/sms/markActive",
    "Make one version of an SMS template the default, so msg91.send_sms with that template id sends its text.",
    z.object({
      template_id: templateId,
      id: z.string().min(1).describe("The version's id (msg91.get_sms_template_versions lists them)"),
    }),
    { readOnly: false },
  ),
  sms_logs: rest(
    CONTROL,
    "POST",
    "/report/logs/p/sms",
    "Delivery log of SMS sent: one row per message with number, status (delivered, failed, rejected, NDNC), times, sender and credits.",
    z.object(logRange),
    { readOnly: true, query: ["startDate", "endDate"] },
  ),
  sms_analytics: rest(
    CONTROL,
    "GET",
    "/report/analytics/p/sms",
    "SMS totals per day: sent, delivered, failed, rejected, NDNC, average delivery time and credits spent.",
    z.object(analyticsRange),
  ),
  get_sms_balance: legacy(
    "/balance.php",
    "Credits left on the account for one SMS route (MSG91's older balance API; the answer is a number).",
    z.object({
      type: z
        .enum(["1", "4", "106"])
        .default("4")
        .describe("Which balance: 4 transactional SMS (the default), 1 promotional SMS, 106 SendOTP"),
    }),
  ),
};
