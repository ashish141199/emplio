// Zentrunk, Plivo's SIP trunking: trunks, the credentials and IP lists outbound traffic signs in with,
// the URIs inbound calls are sent to, and the trunk's call records.
import { z } from "zod";
import type { OwnAction } from "../index";
import { optional, page, r, range } from "./client";

const trunkId = z.string().min(1).describe("The trunk_id (plivo.list_trunks)");
const credUuid = z.string().min(1).describe("The credential_uuid (plivo.list_trunk_credentials)");
const aclUuid = z.string().min(1).describe("The ipacl_uuid (plivo.list_trunk_ip_lists)");
const uriUuid = z.string().min(1).describe("The uri_uuid (plivo.list_trunk_uris)");
const status = z.enum(["enabled", "disabled"]);
const direction = z.enum(["inbound", "outbound"]).describe("inbound: calls to your numbers go to your PBX; outbound: your PBX calls out through Plivo");

const trunkFields = {
  name: z.string().optional(),
  trunk_status: status.optional().describe("Default enabled"),
  secure: z.boolean().optional().describe("TLS signalling and SRTP media (default false)"),
  ipacl_uuid: z.string().optional().describe("Outbound: IP list allowed to send calls (plivo.list_trunk_ip_lists); outbound needs this or credential_uuid"),
  credential_uuid: z.string().optional().describe("Outbound: credentials your PBX signs in with (plivo.list_trunk_credentials)"),
  primary_uri_uuid: z.string().optional().describe("Inbound: where calls go (plivo.list_trunk_uris); inbound needs it"),
  fallback_uri_uuid: z.string().optional().describe("Inbound: where calls go if the primary fails"),
};
const credFields = {
  name: z.string().optional(),
  username: z.string().min(5).max(20).describe("5-20 letters and digits"),
  password: z.string().min(5).max(20).describe("5-20 characters including at least one of ~!@#$%^&*()_+"),
};
const uriFields = {
  name: z.string().optional(),
  uri: z.string().min(1).describe("Your PBX: domain or IP, with optional port, e.g. pbx.example.com:5060 or sip:203.0.113.5"),
  authentication_needed: z.boolean().optional().describe("Your PBX wants a username/password (default false)"),
  username: z.string().optional().describe("Needed with authentication_needed"),
  password: z.string().optional().describe("Needed with authentication_needed"),
};

export const zentrunkActions: Record<string, OwnAction> = {
  list_trunks: r("GET", "/Zentrunk/Trunk/", "SIP trunks (Zentrunk).", {
    trunk_status: status.optional(),
    trunk_direction: z.enum(["inbound", "outbound"]).optional(),
    secure: z.boolean().optional(),
    ipacl_uuid: z.string().optional(),
    credential_uuid: z.string().optional(),
    primary_uri_uuid: z.string().optional(),
    fallback_uri_uuid: z.string().optional(),
    ...page(),
  }),
  get_trunk: r("GET", "/Zentrunk/Trunk/{trunk_id}/", "One SIP trunk: direction, status, termination domain.", { trunk_id: trunkId }),
  create_trunk: r("POST", "/Zentrunk/Trunk/", "Make a SIP trunk.", { trunk_direction: direction, ...trunkFields }),
  update_trunk: r("POST", "/Zentrunk/Trunk/{trunk_id}/", "Change a SIP trunk.", { trunk_id: trunkId, trunk_direction: direction.optional(), ...trunkFields }),
  delete_trunk: r("DELETE", "/Zentrunk/Trunk/{trunk_id}/", "Delete a SIP trunk.", { trunk_id: trunkId }),

  list_trunk_credentials: r("GET", "/Zentrunk/Credential/", "Credentials outbound trunks sign in with.", page()),
  get_trunk_credential: r("GET", "/Zentrunk/Credential/{credential_uuid}/", "One trunk credential.", { credential_uuid: credUuid }),
  create_trunk_credential: r("POST", "/Zentrunk/Credential/", "Make a trunk credential.", credFields),
  update_trunk_credential: r("POST", "/Zentrunk/Credential/{credential_uuid}/", "Change a trunk credential.", { credential_uuid: credUuid, ...optional(credFields) }),
  delete_trunk_credential: r("DELETE", "/Zentrunk/Credential/{credential_uuid}/", "Delete a trunk credential.", { credential_uuid: credUuid }),

  list_trunk_ip_lists: r("GET", "/Zentrunk/IPAccessControlList/", "IP allow-lists for outbound trunks.", page()),
  get_trunk_ip_list: r("GET", "/Zentrunk/IPAccessControlList/{ipacl_uuid}/", "One trunk IP allow-list.", { ipacl_uuid: aclUuid }),
  create_trunk_ip_list: r("POST", "/Zentrunk/IPAccessControlList/", "Make a trunk IP allow-list.", {
    name: z.string().optional(),
    ip_addresses: z.array(z.string()).min(1).describe('IPs your PBX sends from, e.g. ["203.0.113.5"]'),
  }),
  update_trunk_ip_list: r("POST", "/Zentrunk/IPAccessControlList/{ipacl_uuid}/", "Change a trunk IP allow-list; ip_addresses replaces the whole list.", {
    ipacl_uuid: aclUuid,
    name: z.string().optional(),
    ip_addresses: z.array(z.string()).optional().describe("The full new list"),
  }),
  delete_trunk_ip_list: r("DELETE", "/Zentrunk/IPAccessControlList/{ipacl_uuid}/", "Delete a trunk IP allow-list.", { ipacl_uuid: aclUuid }),

  list_trunk_uris: r("GET", "/Zentrunk/URI/", "Origination URIs: where inbound trunks send calls.", page()),
  get_trunk_uri: r("GET", "/Zentrunk/URI/{uri_uuid}/", "One origination URI.", { uri_uuid: uriUuid }),
  create_trunk_uri: r("POST", "/Zentrunk/URI/", "Add an origination URI (your PBX's address).", uriFields),
  update_trunk_uri: r("POST", "/Zentrunk/URI/{uri_uuid}/", "Change an origination URI.", { uri_uuid: uriUuid, ...optional(uriFields) }),
  delete_trunk_uri: r("DELETE", "/Zentrunk/URI/{uri_uuid}/", "Delete an origination URI.", { uri_uuid: uriUuid }),

  list_trunk_calls: r("GET", "/Zentrunk/Call/", "SIP trunk call records (last 30 days unless end_time is given; up to 90 days back).", {
    from_number: z.string().optional().describe("Exact number or prefix"),
    to_number: z.string().optional().describe("Exact number or prefix"),
    call_direction: z.enum(["inbound", "outbound"]).optional(),
    hangup_cause_code: z.number().int().optional(),
    hangup_source: z.enum(["customer", "carrier", "zentrunk"]).optional(),
    stir_verification: z.enum(["Verified", "Not Verified", "Not Applicable"]).optional(),
    bill_duration: z.number().int().optional().describe("Billed seconds (bill_duration__gt etc. also work)"),
    ...range("end_time", "Ended"),
    ...page(),
  }, { loose: true }),
  get_trunk_call: r("GET", "/Zentrunk/Call/{call_uuid}/", "One SIP trunk call record.", { call_uuid: z.string().min(1) }),
  get_trunk_call_insights: r("GET", "/Zentrunk/Call/{call_uuid}/Insights/", "Quality details of a SIP trunk call (jitter, packet loss, MOS).", { call_uuid: z.string().min(1) }),
};
