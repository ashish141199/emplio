// Voice: calls that play a template or run an IVR flow, click-to-call bridging, templates and recorded files,
// agents and their softphone (SIP/VPN) credentials, call logs and recordings.
import { z } from "zod";
import { rest } from "../openapi";
import type { OwnAction } from "../index";
import { analyticsRange, CONTROL, logRange, mobile } from "./client";

const callerId = z.string().min(1).describe("Your MSG91 voice number the call comes from, with country code and no +, e.g. 918035012345");
const callbackUrl = z.string().url().optional().describe("A URL MSG91 posts the call's outcome to when it ends");
const variables = z
  .record(z.string(), z.object({ type: z.enum(["text", "number", "currency", "date", "time"]).describe("How it's read out"), value: z.string(), as_digits: z.boolean().optional(), currency_code: z.string().optional() }).loose())
  .optional()
  .describe(
    'Values for the template\'s or flow\'s variables, by name: {"VAR1": {"type": "text", "value": "Asha"}, "VAR2": {"type": "number", "value": "1234", "as_digits": true}, "VAR3": {"type": "currency", "value": "499", "currency_code": "INR"}}. ' +
      "as_digits true reads 1234 as one-two-three-four",
  );

export const voiceActions: Record<string, OwnAction> = {
  send_voice_message: rest(
    CONTROL,
    "POST",
    "/voice/call/",
    "Call a customer and play a voice template (text-to-speech with variables, and recorded files). For reminders, order updates, spoken OTPs.",
    z.object({
      template: z.string().min(1).describe("The voice template's name (msg91.list_voice_templates shows them)"),
      caller_id: callerId,
      client_number: mobile.describe("Who is called, with country code, e.g. 919876543210"),
      callback_url: callbackUrl,
      variables,
    }),
  ),
  run_voice_flow: rest(
    CONTROL,
    "POST",
    "/voice/call/",
    "Call a number and run an IVR flow built in MSG91's voice panel (menus, key presses, transfers).",
    z.object({
      flow: z.string().min(1).describe("The flow's name in MSG91 → Voice → Flows"),
      caller_id: callerId,
      client_number: mobile.describe("Who is called, with country code"),
      callback_url: callbackUrl,
      variables,
    }),
  ),
  click_to_call: rest(
    CONTROL,
    "POST",
    "/voice/call/ctc",
    "Connect two people by phone: MSG91 calls destination first, then bridges in destinationB (tried in order). Both see your caller id. For callbacks and sales calls.",
    z.object({
      caller_id: callerId,
      destination: mobile.describe("Called first (usually your agent), with country code"),
      destinationB: z.array(mobile).min(1).describe("Then connected to (usually the customer), tried in order, e.g. [\"919876543210\"]"),
      expire_time: z.string().optional().describe("Seconds before the request is dropped if not connected"),
    }),
  ),
  list_voice_templates: rest(
    CONTROL,
    "GET",
    "/voice/templates/",
    "The voice templates, or one by id.",
    z.object({
      id: z.string().optional().describe("Only this template"),
      page_size: z.number().int().optional().describe("Templates per page (e.g. 25)"),
      page_num: z.number().int().optional().describe("Page number from 1"),
      sort_by: z.literal("name").optional().describe("Sort by name (the only choice)"),
      sort_order: z.enum(["asc", "desc"]).optional().describe("A to Z (asc) or Z to A (desc)"),
    }),
  ),
  create_voice_template: rest(
    CONTROL,
    "POST",
    "/voice/templates/",
    "Make a voice template: parts spoken one after another, text, recorded files and variables.",
    z
      .object({
        name: z.string().min(1).describe("The template's name"),
        voice_name: z.string().describe("The text-to-speech voice, e.g. en-IN-Standard-A (English, India) or hi-IN-Standard-A (Hindi)"),
        has_variable: z.boolean().optional().describe("true when structure has var parts"),
        structure: z
          .array(z.object({ type: z.enum(["text", "file", "var"]), value: z.union([z.string(), z.number()]) }).loose())
          .min(1)
          .describe(
            'The parts in order: {"type": "text", "value": "Hello, your order "}, {"type": "var", "value": "VAR1", "name": "VAR1", "var_type": "number", "as_digits": true}, ' +
              '{"type": "file", "value": 1234, "name": "jingle"} (a file id from msg91.list_voice_files). var_type: text, number, currency, date or time',
          ),
      })
      .loose(),
  ),
  list_voice_files: rest(CONTROL, "GET", "/voice/files", "The recorded audio files uploaded for voice templates, with their ids.", z.object({ page_size: z.number().int().optional().describe("Files per page (e.g. 100)") })),
  list_voice_agents: rest(CONTROL, "GET", "/voice/company-agent-list/", "The company's voice agents, with the id and username the credential actions need.", z.object({})),
  get_sip_credentials: rest(
    CONTROL,
    "GET",
    "/voice/public/sip-credentials/",
    "An agent's SIP login (username, password, server) for a softphone. Reveals a password.",
    z.object({ agent_id: z.string().min(1).describe("From msg91.list_voice_agents"), agent_username: z.string().min(1).describe("From msg91.list_voice_agents") }),
    { readOnly: false },
  ),
  get_vpn_credentials: rest(
    CONTROL,
    "GET",
    "/voice/public/vpn-credentials/",
    "An agent's WireGuard VPN keys, needed when their SIP login says vpn_required. Reveals a private key.",
    z.object({ agent_id: z.string().min(1).describe("From msg91.list_voice_agents"), server_id: z.string().min(1).describe("server_id from msg91.get_sip_credentials") }),
    { readOnly: false },
  ),
  voice_call_logs: rest(CONTROL, "GET", "/voice/call-logs/", "Recent calls with their uuid, times, caller id, numbers, status, duration and cost.", z.object({}).loose()),
  get_call_recording: rest(
    CONTROL,
    "GET",
    "/voice/call-recording/{uuid}",
    "A download link for a call's recording.",
    z.object({
      uuid: z.string().min(1).describe("The call's uuid (msg91.voice_call_logs shows it)"),
      expiry: z.number().int().min(1).max(604800).default(3600).describe("Seconds the link works for, up to 604800 (7 days); default 3600"),
    }),
  ),
  voice_logs: rest(CONTROL, "GET", "/report/logs/voice", "Voice report log for a date range: each call's number, status, duration and cost.", z.object(logRange)),
  voice_analytics: rest(CONTROL, "GET", "/report/analytics/p/voice", "Voice totals per day: calls, answered, failed, minutes, cost.", z.object(analyticsRange)),
};
