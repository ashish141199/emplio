// Connector (Cloud only): WhatsApp Business calls and Twilio calls into LiveKit rooms, so an agent can talk on
// them. The WhatsApp calls carry the business's own Meta access token. Grant: roomCreate (with the room when known).
import { z } from "zod";
import type { OwnAction } from "../index";
import { agentDispatch, attributes, duration, twirp } from "./client";

const C = "Connector";
const create = (i: { room_name?: string }) => ({ video: { roomCreate: true, ...(i.room_name && { room: i.room_name }) } });
const waToken = z.string().min(1).describe("The WhatsApp Business (Meta Graph API) access token of the business");
const waNumberId = z.string().min(1).describe("The business's WhatsApp phone number id (from Meta's WhatsApp Manager, not the phone number itself)");
const apiVersion = z.string().min(1).describe('Meta Graph API version, e.g. "23.0"');
const callId = z.string().min(1).describe("The WhatsApp call id, from Meta's calls webhook or livekit.dial_whatsapp_call");
const sdp = z.object({ type: z.string().describe('"offer" or "answer"'), sdp: z.string().describe("The SDP text") }).describe("The session description Meta's webhook carried");
const into = {
  room_name: z.string().optional().describe("The room to put the call in; one is made up when left out"),
  agents: z.array(agentDispatch).optional().describe("Agents to send into the room to talk to the caller"),
  participant_identity: z.string().optional().describe("The caller's identity in the room (avoid personal data; it's logged)"),
  participant_name: z.string().optional().describe("The caller's display name in the room"),
  participant_metadata: z.string().optional().describe("The caller's participant metadata, e.g. JSON for the agent"),
  participant_attributes: attributes.optional(),
  destination_country: z.string().optional().describe("Two-letter country where the call ends, e.g. IN; helps routing"),
};

export const connectorActions: Record<string, OwnAction> = {
  dial_whatsapp_call: twirp(C, "DialWhatsAppCall", "Call someone on WhatsApp from the business's WhatsApp number and put the call in a room. Answers with whatsapp_call_id and room_name.", z.object({
    whatsapp_phone_number_id: waNumberId,
    whatsapp_to_phone_number: z.string().min(1).describe("Who to call, with country code, e.g. 919812345678"),
    whatsapp_api_key: waToken,
    whatsapp_cloud_api_version: apiVersion,
    whatsapp_biz_opaque_callback_data: z.string().optional().describe("Your own tracking text, echoed in Meta's webhooks"),
    ringing_timeout: duration("How long to let it ring").optional(),
    ...into,
  }).loose(), create),
  accept_whatsapp_call: twirp(C, "AcceptWhatsAppCall", "Pick up a call someone made to the business's WhatsApp number (from Meta's call webhook) and put it in a room.", z.object({
    whatsapp_phone_number_id: waNumberId,
    whatsapp_api_key: waToken,
    whatsapp_cloud_api_version: apiVersion,
    whatsapp_call_id: callId,
    sdp,
    whatsapp_biz_opaque_callback_data: z.string().optional().describe("Your own tracking text, echoed in Meta's webhooks"),
    ringing_timeout: duration("How long to wait for it to connect").optional(),
    wait_until_answered: z.boolean().optional().describe("Answer only once the call is connected"),
    ...into,
  }).loose(), create),
  connect_whatsapp_call: twirp(C, "ConnectWhatsAppCall", "Finish connecting a call the business made (dial_whatsapp_call), with the SDP answer from Meta's connect webhook.", z.object({
    whatsapp_call_id: callId,
    sdp,
    wait_until_answered: z.boolean().optional().describe("Answer only once the call is connected"),
  }), create),
  disconnect_whatsapp_call: twirp(C, "DisconnectWhatsAppCall", "Hang up a WhatsApp call.", z.object({
    whatsapp_call_id: callId,
    whatsapp_api_key: waToken.optional().describe("The business's Meta access token; needed when the business hangs up"),
    disconnect_reason: z.enum(["BUSINESS_INITIATED", "USER_INITIATED"]).optional().describe("BUSINESS_INITIATED (default): we hang up; USER_INITIATED: the caller already did"),
  }), create),
  connect_twilio_call: twirp(C, "ConnectTwilioCall", "Bring a Twilio call into a room: answers with connect_url, the websocket to put in the call's TwiML <Connect><Stream url=…>.", z.object({
    twilio_call_direction: z.enum(["TWILIO_CALL_DIRECTION_INBOUND", "TWILIO_CALL_DIRECTION_OUTBOUND"]).optional().describe("INBOUND (default) for a call to the business, OUTBOUND for one it makes"),
    ...into,
  }).loose(), create),
};
