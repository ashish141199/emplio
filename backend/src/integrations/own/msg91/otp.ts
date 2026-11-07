// OTP: MSG91 makes the code, sends it (SMS, voice fallback) and checks it, so nothing is stored on our side.
// The OTP widget does the same across SMS, email, WhatsApp and voice, and hands back a token to verify server side.
import { z } from "zod";
import { rest } from "../openapi";
import type { OwnAction } from "../index";
import { analyticsRange, API, CONTROL, logRange, mobile } from "./client";

const widgetId = z.string().min(1).describe("The OTP widget's id, from MSG91 panel → OTP → Widget");
const reqId = z.string().min(1).describe("The request id msg91.widget_send_otp answered with (its message field)");

export const otpActions: Record<string, OwnAction> = {
  send_otp: rest(
    CONTROL,
    "POST",
    "/otp",
    "Send a one-time code by SMS using an OTP template. MSG91 makes and remembers the code; check what the person types with msg91.verify_otp.",
    z
      .object({
        template_id: z.string().min(1).describe("The OTP template's id, from MSG91 panel → OTP → Templates; its text holds ##OTP## where the code goes"),
        mobile,
        otp_length: z.number().int().min(4).max(9).optional().describe("Digits in the code, 4-9; MSG91's default when left out"),
        otp_expiry: z.number().int().min(1).optional().describe("Minutes the code stays valid; MSG91's default when left out"),
        otp: z.string().regex(/^\d{4,9}$/).optional().describe("Send this code instead of letting MSG91 make one; leave out normally"),
        realTimeResponse: z.enum(["0", "1"]).optional().describe("1 to wait for the operator's delivery answer"),
        invisible: z.enum(["0", "1"]).optional().describe("1 to try invisible verification on mobile networks that support it"),
        unicode: z.enum(["0", "1"]).optional().describe("1 when the template has non-English text"),
        userip: z.string().optional().describe("The end user's IP address, for MSG91's fraud checks"),
      })
      .catchall(z.string())
      .describe('Extra template variables go in as more fields, e.g. "Param1": "Asha" for ##Param1##'),
    { query: ["template_id", "mobile", "otp_length", "otp_expiry", "otp", "realTimeResponse", "invisible", "unicode", "userip"] },
  ),
  verify_otp: rest(
    CONTROL,
    "GET",
    "/otp/verify",
    'Check the code a person typed against the one msg91.send_otp sent them. {"type": "success"} means it matched; a wrong or expired code fails.',
    z.object({ mobile, otp: z.string().min(1).describe("The code the person entered") }),
  ),
  resend_otp: rest(
    CONTROL,
    "GET",
    "/otp/retry",
    "Send the same code again to a number that already got one from msg91.send_otp, by text or as a voice call.",
    z.object({
      mobile,
      retrytype: z.enum(["text", "voice"]).default("text").describe("text to resend by SMS (the default here), voice to have it read out in a call"),
    }),
    { readOnly: false },
  ),
  edit_otp_template: rest(
    CONTROL,
    "POST",
    "/otp/updateOtpTemplate",
    "Change an OTP template's text, sender id or DLT id.",
    z.object({
      templateId: z.string().min(1).describe("The OTP template's id"),
      template: z.string().min(1).describe("The new text; must contain ##OTP## where the code goes, e.g. 'Your Acme code is ##OTP##'"),
      dltTemplateId: z.string().optional().describe("India: the DLT portal's template id for this exact text"),
      senderId: z.string().optional().describe("Sender id (DLT-registered header in India), e.g. ACMEIN"),
    }),
  ),
  otp_logs: rest(CONTROL, "GET", "/report/logs/p/otp", "OTP send log: number, status, delivery time, whether it was verified.", z.object(logRange)),
  otp_analytics: rest(CONTROL, "GET", "/report/analytics/p/otp", "OTP totals per day: sent, delivered, failed, verified, credits.", z.object(analyticsRange)),

  // ── OTP widget
  widget_send_otp: rest(
    API,
    "POST",
    "/widget/sendOtp",
    "Send a code through an OTP widget to a mobile number or email (channels as set on the widget). The answer's message is the reqId for verifying or retrying.",
    z.object({
      widgetId,
      identifier: z.string().min(1).describe("Where the code goes: a mobile number with country code and no + (919876543210) or an email address"),
    }),
  ),
  widget_retry_otp: rest(
    API,
    "POST",
    "/widget/retryOtp",
    "Send a widget code again, on the same or another channel.",
    z.object({
      widgetId,
      reqId,
      retryChannel: z.string().optional().describe("The id of the channel to retry on (SMS, voice, email, WhatsApp…), as the widget's settings list them; leave out for the same channel"),
    }),
  ),
  widget_verify_otp: rest(
    API,
    "POST",
    "/widget/verifyOtp",
    "Check a code sent by the widget. On success the answer carries an access token (JWT) to confirm with msg91.verify_access_token.",
    z.object({ widgetId, reqId, otp: z.string().min(1).describe("The code the person entered") }),
  ),
  verify_access_token: rest(
    API,
    "POST",
    "/widget/verifyAccessToken",
    "Confirm, server side, an access token the OTP widget gave a browser or app after it verified someone. The answer's message is the verified number or email.",
    z.object({ "access-token": z.string().min(1).describe("The JWT the widget returned after verification") }),
    { readOnly: true },
  ),
  widget_logs: rest(CONTROL, "GET", "/report/logs/p/widget", "OTP widget log: each code sent, its channel and whether it was verified.", z.object(logRange)),
  widget_analytics: rest(CONTROL, "GET", "/report/analytics/p/widget", "OTP widget totals per day.", z.object(analyticsRange)),
};
