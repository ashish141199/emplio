// SIP: phone calls. Inbound trunks accept calls from a phone provider (Twilio, Telnyx, Plivo, Exotel…),
// dispatch rules decide which room (and agent) a call goes to, outbound trunks place calls. Managing them
// needs the sip admin grant; placing and transferring calls needs sip call.
import { z } from "zod";
import type { OwnAction } from "../index";
import { attributes, duration, sipPage, twirp } from "./client";

const S = "SIP";
const admin = { sip: { admin: true } };
const trunkId = z.string().min(1).describe("The trunk's id, ST_… (livekit.list_sip_inbound_trunks / list_sip_outbound_trunks show them)");
const ruleId = z.string().min(1).describe("The dispatch rule's id, SDR_… (livekit.list_sip_dispatch_rules shows them)");
const listUpdate = (what: string) =>
  z.object({
    set: z.array(z.string()).optional().describe("Replace the list with this"),
    add: z.array(z.string()).optional().describe("Add these"),
    remove: z.array(z.string()).optional().describe("Remove these"),
    clear: z.boolean().optional().describe("Empty the list"),
  }).describe(`Change ${what}: {add: [...]}, {remove: [...]}, {set: [...]} or {clear: true}`);
const numbers = z.array(z.string()).describe("Phone numbers, E.164, e.g. +14155552671");
const headerOpts = z.enum(["SIP_NO_HEADERS", "SIP_X_HEADERS", "SIP_ALL_HEADERS"]).describe("Which SIP headers become sip.h.* participant attributes");
const media = z.record(z.string(), z.any()).describe("Media settings: {encryption: SIP_MEDIA_ENCRYPT_DISABLE|ALLOW|REQUIRE, codecs, only_listed_codecs}");
const auth = {
  auth_username: z.string().optional().describe("Username for SIP digest auth with the provider"),
  auth_password: z.string().optional().describe("Password for SIP digest auth"),
};

const inbound = {
  name: z.string().optional().describe("A label, e.g. Twilio main line"),
  metadata: z.string().optional().describe("Free text kept with the trunk"),
  numbers: numbers.optional().describe("The phone numbers this trunk answers, E.164; empty = any"),
  allowed_addresses: z.array(z.string()).optional().describe("Only accept calls from these IPs/CIDRs (the provider's); empty = any"),
  allowed_numbers: z.array(z.string()).optional().describe("Only accept calls from these caller numbers; empty = any"),
  ...auth,
  krisp_enabled: z.boolean().optional().describe("Remove background noise from the caller"),
  headers_to_attributes: attributes.optional().describe("Copy these SIP X- headers into participant attributes: {header: attribute}"),
  include_headers: headerOpts.optional(),
  ringing_timeout: duration("How long the caller may wait for the room to answer").optional(),
  max_call_duration: duration("Longest a call may last").optional(),
  media: media.optional(),
};
const outbound = {
  name: z.string().optional().describe("A label, e.g. Twilio outbound"),
  metadata: z.string().optional().describe("Free text kept with the trunk"),
  address: z.string().optional().describe("The provider's SIP host, without sip:, e.g. mybiz.pstn.twilio.com"),
  numbers: numbers.optional().describe("Caller ID numbers to call from (one is picked at random)"),
  transport: z.enum(["SIP_TRANSPORT_AUTO", "SIP_TRANSPORT_UDP", "SIP_TRANSPORT_TCP", "SIP_TRANSPORT_TLS"]).optional().describe("How to reach the provider; AUTO (default) unless the provider says otherwise"),
  destination_country: z.string().optional().describe("Two-letter country the calls go to, e.g. IN; helps routing"),
  ...auth,
  headers: attributes.optional().describe("SIP X- headers to add to every call"),
  headers_to_attributes: attributes.optional(),
  include_headers: headerOpts.optional(),
  from_host: z.string().optional().describe("Custom host for the From header"),
  media: media.optional(),
};
const rule = z
  .object({
    dispatch_rule_direct: z.object({ room_name: z.string(), pin: z.string().optional() }).optional().describe("Every call into this one room"),
    dispatch_rule_individual: z.object({ room_prefix: z.string().optional(), pin: z.string().optional(), no_randomness: z.boolean().optional() }).optional().describe("A new room per caller, named <room_prefix>_<number>_<random>"),
    dispatch_rule_callee: z.object({ room_prefix: z.string().optional(), pin: z.string().optional(), randomize: z.boolean().optional() }).optional().describe("A room per number called"),
  })
  .describe('Which room a call goes to; give exactly one, e.g. {"dispatch_rule_individual": {"room_prefix": "call"}}');
const ruleFields = {
  name: z.string().optional().describe("A label"),
  metadata: z.string().optional().describe("Given to every caller's participant"),
  attributes: attributes.optional().describe("Given to every caller's participant"),
  trunk_ids: z.array(z.string()).optional().describe("Only calls through these inbound trunks; empty = any trunk"),
  numbers: numbers.optional().describe("Only calls made to these numbers"),
  inbound_numbers: numbers.optional().describe("Only calls made from these numbers"),
  hide_phone_number: z.boolean().optional().describe("Don't show the caller's number in the room"),
  krisp_enabled: z.boolean().optional().describe("Remove background noise from callers"),
  room_preset: z.string().optional().describe("Cloud: a room configuration preset's name"),
  room_config: z.record(z.string(), z.any()).optional().describe('Room settings, notably agents to send in: {"agents": [{"agent_name": "receptionist"}]}'),
  media: media.optional(),
};
// a flat input → the update/replace oneof the rpc takes
const updateOrReplace = (idField: string) => (i: Record<string, unknown>) => {
  const { [idField]: id, replace, ...update } = i;
  return replace ? { [idField]: id, replace } : { [idField]: id, update };
};

export const sipActions: Record<string, OwnAction> = {
  create_sip_inbound_trunk: twirp(S, "CreateSIPInboundTrunk", "Accept calls from a phone provider: point the provider's SIP trunk at this project's SIP URI and list the numbers here. Answers with the trunk and its id.", z.object(inbound).loose(), admin, { body: (i) => ({ trunk: i }) }),
  create_sip_outbound_trunk: twirp(S, "CreateSIPOutboundTrunk", "Set up placing calls through a phone provider's SIP trunk. Answers with the trunk and its id.", z.object({ ...outbound, address: z.string().min(1).describe("The provider's SIP host, without sip:, e.g. mybiz.pstn.twilio.com"), numbers: numbers.min(1).describe("Caller ID numbers to call from (one is picked at random)") }).loose(), admin, { body: (i) => ({ trunk: i }) }),
  update_sip_inbound_trunk: twirp(S, "UpdateSIPInboundTrunk", "Change an inbound trunk: only the fields given change.", z.object({
    sip_trunk_id: trunkId,
    name: z.string().optional().describe("New label"),
    metadata: z.string().optional().describe("New free text"),
    numbers: listUpdate("the numbers it answers").optional(),
    allowed_addresses: listUpdate("the allowed IPs").optional(),
    allowed_numbers: listUpdate("the allowed caller numbers").optional(),
    ...auth,
    media: media.optional(),
    replace: z.record(z.string(), z.any()).optional().describe("Instead: the whole trunk (as create_sip_inbound_trunk takes it), replacing everything"),
  }).loose(), admin, { body: updateOrReplace("sip_trunk_id") }),
  update_sip_outbound_trunk: twirp(S, "UpdateSIPOutboundTrunk", "Change an outbound trunk: only the fields given change.", z.object({
    sip_trunk_id: trunkId,
    name: z.string().optional().describe("New label"),
    metadata: z.string().optional().describe("New free text"),
    address: outbound.address,
    transport: outbound.transport,
    destination_country: outbound.destination_country,
    numbers: listUpdate("the caller ID numbers").optional(),
    ...auth,
    from_host: outbound.from_host,
    media: media.optional(),
    replace: z.record(z.string(), z.any()).optional().describe("Instead: the whole trunk (as create_sip_outbound_trunk takes it), replacing everything"),
  }).loose(), admin, { body: updateOrReplace("sip_trunk_id") }),
  get_sip_inbound_trunk: twirp(S, "GetSIPInboundTrunk", "One inbound trunk.", z.object({ sip_trunk_id: trunkId }), admin, { readOnly: true }),
  get_sip_outbound_trunk: twirp(S, "GetSIPOutboundTrunk", "One outbound trunk.", z.object({ sip_trunk_id: trunkId }), admin, { readOnly: true }),
  list_sip_inbound_trunks: twirp(S, "ListSIPInboundTrunk", "The inbound trunks: id, name, numbers, allowed callers.", z.object({
    trunk_ids: z.array(z.string()).optional().describe("Only these"),
    numbers: numbers.optional().describe("Only trunks answering one of these numbers"),
    page: sipPage.optional(),
  }), admin, { readOnly: true }),
  list_sip_outbound_trunks: twirp(S, "ListSIPOutboundTrunk", "The outbound trunks: id, name, address, numbers.", z.object({
    trunk_ids: z.array(z.string()).optional().describe("Only these"),
    numbers: numbers.optional().describe("Only trunks with one of these numbers"),
    page: sipPage.optional(),
  }), admin, { readOnly: true }),
  delete_sip_trunk: twirp(S, "DeleteSIPTrunk", "Delete a trunk, inbound or outbound.", z.object({ sip_trunk_id: trunkId }), admin),

  create_sip_dispatch_rule: twirp(S, "CreateSIPDispatchRule", "Decide where incoming calls go: which room, and (with room_config.agents) which agent answers. Answers with the rule and its id.", z.object({ rule, ...ruleFields }).loose(), admin, { body: (i) => ({ dispatch_rule: i }) }),
  update_sip_dispatch_rule: twirp(S, "UpdateSIPDispatchRule", "Change a dispatch rule: only the fields given change.", z.object({
    sip_dispatch_rule_id: ruleId,
    rule: rule.optional(),
    name: z.string().optional().describe("New label"),
    metadata: z.string().optional().describe("New free text"),
    attributes: attributes.optional(),
    trunk_ids: listUpdate("which trunks it applies to").optional(),
    media: media.optional(),
    replace: z.record(z.string(), z.any()).optional().describe("Instead: the whole rule (as create_sip_dispatch_rule takes it), replacing everything"),
  }).loose(), admin, { body: updateOrReplace("sip_dispatch_rule_id") }),
  list_sip_dispatch_rules: twirp(S, "ListSIPDispatchRule", "The dispatch rules: id, name, rule, trunks, numbers, room settings.", z.object({
    dispatch_rule_ids: z.array(z.string()).optional().describe("Only these"),
    trunk_ids: z.array(z.string()).optional().describe("Only rules for these trunks"),
    page: sipPage.optional(),
  }), admin, { readOnly: true }),
  delete_sip_dispatch_rule: twirp(S, "DeleteSIPDispatchRule", "Delete a dispatch rule.", z.object({ sip_dispatch_rule_id: ruleId }), admin),

  create_sip_participant: twirp(S, "CreateSIPParticipant", "Place a phone call and put the person in a room (where an agent can talk to them). Answers with the participant's identity and sip_call_id.", z.object({
    sip_trunk_id: z.string().min(1).describe("The outbound trunk to call through, ST_… (livekit.list_sip_outbound_trunks)"),
    sip_call_to: z.string().min(1).describe("The number to call, E.164, e.g. +919812345678"),
    room_name: z.string().min(1).describe("The room to put the call in (made if needed)"),
    sip_number: z.string().optional().describe("Caller ID to show; default one of the trunk's numbers"),
    participant_identity: z.string().optional().describe("The callee's identity in the room; default from the number"),
    participant_name: z.string().optional().describe("The callee's display name in the room"),
    participant_metadata: z.string().optional().describe("The callee's participant metadata, e.g. JSON about the customer for the agent"),
    participant_attributes: attributes.optional(),
    dtmf: z.string().optional().describe("Keys to press once answered, e.g. an extension; w waits half a second, e.g. ww123#"),
    play_dialtone: z.boolean().optional().describe("Play a dial tone in the room while it rings"),
    hide_phone_number: z.boolean().optional().describe("Don't show the number in the room (a random identity is used)"),
    wait_until_answered: z.boolean().optional().describe("Answer only after they pick up (or it fails)"),
    ringing_timeout: duration("How long to let it ring").optional(),
    max_call_duration: duration("Longest the call may last").optional(),
    krisp_enabled: z.boolean().optional().describe("Remove background noise from the callee"),
    display_name: z.string().optional().describe("Caller name to show (CNAM); empty string lets the network look it up"),
    headers: attributes.optional().describe("SIP X- headers to send"),
  }).loose(), { sip: { call: true } }),
  transfer_sip_participant: twirp(S, "TransferSIPParticipant", "Transfer a phone caller in a room to another number (a cold transfer; they leave the room).", z.object({
    room_name: z.string().min(1).describe("The room the caller is in"),
    participant_identity: z.string().min(1).describe("The caller's identity (livekit.list_participants)"),
    transfer_to: z.string().min(1).describe('Where to: "tel:+14155552671" or "sip:user@host"'),
    play_dialtone: z.boolean().optional().describe("Play a dial tone to the caller while transferring"),
    headers: attributes.optional().describe("SIP headers to add to the REFER"),
    ringing_timeout: duration("How long to let the new number ring").optional(),
  }), (i) => ({ sip: { call: true }, video: { roomAdmin: true, room: i.room_name } })),
};
