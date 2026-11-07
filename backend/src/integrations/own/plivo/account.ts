// The account itself: details and balance, subaccounts, applications (where Plivo sends incoming calls and
// messages), SIP endpoints, SIP auth credentials and IP lists, pricing, and browser/mobile SDK tokens.
import { z } from "zod";
import type { OwnAction } from "../index";
import { method, page, r, subaccount } from "./client";

const subId = z.string().min(1).describe("The subaccount's auth_id, e.g. SAXXXXXXXXXXXXXXXXXX (plivo.list_subaccounts)");
const appId = z.string().min(1).describe("The application's app_id (plivo.list_applications)");
const endpointId = z.string().min(1).describe("The endpoint's endpoint_id (plivo.list_endpoints)");
const credId = z.string().min(1).describe("The credential's credential_uuid (plivo.list_sip_credentials)");
const aclId = z.string().min(1).describe("The IP list's ip_acl_uuid (plivo.list_sip_ip_lists)");

const appFields = {
  answer_url: z.string().optional().describe("URL Plivo fetches XML from when a call comes in to a number/endpoint on this app"),
  answer_method: method("answer_url"),
  hangup_url: z.string().optional().describe("URL told when a call ends (defaults to answer_url)"),
  hangup_method: method("hangup_url"),
  fallback_answer_url: z.string().optional().describe("URL used when answer_url fails"),
  fallback_method: method("fallback_answer_url"),
  message_url: z.string().optional().describe("URL told about incoming SMS/MMS/WhatsApp messages"),
  message_method: method("message_url"),
  default_number_app: z.boolean().optional().describe("Make this the app new numbers get (default false)"),
  default_endpoint_app: z.boolean().optional().describe("Make this the app new SIP endpoints get (default false)"),
  subaccount,
  log_incoming_messages: z.boolean().optional().describe("Keep the text of incoming messages in Plivo's logs (default true)"),
  public_uri: z.boolean().optional().describe("Let SIP calls reach this app's endpoints from outside Plivo (default false)"),
};

export const accountActions: Record<string, OwnAction> = {
  // ── account
  get_account: r("GET", "/", "The account: name, type, cash_credits (balance), billing mode, address, timezone, auto-recharge."),
  update_account: r("POST", "/", "Change the account's name, address, city, state or timezone. Fields left out stay as they are.", {
    name: z.string().optional().describe("Account holder's name"),
    address: z.string().optional().describe("Postal address shown on invoices"),
    city: z.string().optional(),
    state: z.string().optional().describe("State or region"),
    timezone: z.string().optional().describe("Dashboard timezone, IANA name, e.g. Asia/Kolkata"),
  }),

  // ── subaccounts
  list_subaccounts: r("GET", "/Subaccount/", "Subaccounts of this account, each with its own auth_id/auth_token.", page()),
  get_subaccount: r("GET", "/Subaccount/{auth_id}/", "One subaccount: name, enabled, auth_token.", { auth_id: subId }),
  create_subaccount: r("POST", "/Subaccount/", "Make a subaccount (separate credentials and usage, billed to this account). Answers with its auth_id and auth_token.", {
    name: z.string().min(1).describe("The subaccount's name"),
    enabled: z.boolean().optional().describe("Whether it can make calls/messages right away (default false)"),
  }),
  update_subaccount: r("POST", "/Subaccount/{auth_id}/", "Rename a subaccount or turn it on/off.", {
    auth_id: subId,
    name: z.string().min(1).describe("Its name (required by Plivo even if unchanged)"),
    enabled: z.boolean().optional().describe("true to let it make calls/messages, false to block it"),
  }),
  delete_subaccount: r("DELETE", "/Subaccount/{auth_id}/", "Delete a subaccount. Its numbers, apps and endpoints move to the main account unless cascade is true.", {
    auth_id: subId,
    cascade: z.boolean().optional().describe("true also deletes its applications and endpoints and unrents its numbers (default false)"),
  }),

  // ── applications
  list_applications: r("GET", "/Application/", "Applications: the URLs Plivo calls for incoming calls and messages on the numbers/endpoints linked to them.", {
    subaccount,
    app_name: z.string().optional().describe("Only apps whose name contains this"),
    ...page(),
  }),
  get_application: r("GET", "/Application/{app_id}/", "One application and its URLs.", { app_id: appId }),
  create_application: r("POST", "/Application/", "Make an application: where incoming calls (answer_url, which returns Plivo XML) and messages (message_url) on its numbers go.", {
    app_name: z.string().min(1).describe("A name for it (letters, digits, - and _)"),
    ...appFields,
  }),
  update_application: r("POST", "/Application/{app_id}/", "Change an application's URLs or settings; fields left out stay.", { app_id: appId, ...appFields }),
  delete_application: r("DELETE", "/Application/{app_id}/", "Delete an application.", {
    app_id: appId,
    cascade: z.boolean().optional().describe("Also delete the endpoints linked to it (default true); false keeps them, moved to new_endpoint_application"),
    new_endpoint_application: z.string().optional().describe("app_id to move its endpoints to when cascade is false"),
  }),

  // ── SIP endpoints (softphones / SIP devices that sign in to Plivo)
  list_endpoints: r("GET", "/Endpoint/", "SIP endpoints: usernames softphones and SIP phones sign in with, and the app that handles their calls.", page()),
  get_endpoint: r("GET", "/Endpoint/{endpoint_id}/", "One SIP endpoint, including its SIP URI and whether it's registered now.", { endpoint_id: endpointId }),
  create_endpoint: r("POST", "/Endpoint/", "Make a SIP endpoint. Plivo adds digits to the username; the answer has the full SIP username/URI.", {
    username: z.string().min(1).describe("Username prefix (letters and digits)"),
    password: z.string().min(5).describe("Password the device signs in with"),
    alias: z.string().min(1).describe("A friendly name"),
    app_id: z.string().optional().describe("Application that handles its calls (plivo.list_applications)"),
  }),
  update_endpoint: r("POST", "/Endpoint/{endpoint_id}/", "Change an endpoint's password, name or application.", {
    endpoint_id: endpointId,
    password: z.string().optional(),
    alias: z.string().optional(),
    app_id: z.string().optional(),
  }),
  delete_endpoint: r("DELETE", "/Endpoint/{endpoint_id}/", "Delete a SIP endpoint.", { endpoint_id: endpointId }),

  // ── SIP auth: credentials and IP allow-lists for SIP calls into Plivo
  list_sip_credentials: r("GET", "/SipAuth/Credential/", "SIP auth credentials (username/password pairs SIP traffic authenticates with)."),
  get_sip_credential: r("GET", "/SipAuth/Credential/{credential_uuid}/", "One SIP auth credential.", { credential_uuid: credId }),
  create_sip_credential: r("POST", "/SipAuth/Credential/", "Make a SIP auth credential.", {
    username: z.string().min(3).max(64).describe("3-64 characters: letters, digits, . _ -; unique in the account"),
    password: z.string().min(8).max(128).describe("8-128 characters with an uppercase letter, a lowercase letter and a digit"),
  }),
  update_sip_credential: r("POST", "/SipAuth/Credential/{credential_uuid}/", "Change a SIP credential's password (the username can't change).", {
    credential_uuid: credId,
    password: z.string().min(8).describe("New password: 8+ characters with uppercase, lowercase and a digit"),
  }),
  delete_sip_credential: r("DELETE", "/SipAuth/Credential/{credential_uuid}/", "Delete a SIP auth credential.", { credential_uuid: credId }),
  list_sip_ip_lists: r("GET", "/SipAuth/IpAccessControlList/", "SIP IP allow-lists (IP access control lists)."),
  get_sip_ip_list: r("GET", "/SipAuth/IpAccessControlList/{ip_acl_uuid}/", "One SIP IP allow-list and its entries.", { ip_acl_uuid: aclId }),
  create_sip_ip_list: r("POST", "/SipAuth/IpAccessControlList/", "Make a SIP IP allow-list.", {
    name: z.string().min(1).max(120),
    entries: z
      .array(z.object({ ip: z.string(), cidr_prefix: z.number().int().min(0).max(32).optional(), description: z.string().optional() }))
      .max(50)
      .optional()
      .describe("Up to 50 entries: {ip: IPv4, cidr_prefix: 0-32 (default 32), description}"),
  }),
  update_sip_ip_list: r("POST", "/SipAuth/IpAccessControlList/{ip_acl_uuid}/", "Rename a SIP IP allow-list (change entries with add/remove_sip_ip_list_entry).", {
    ip_acl_uuid: aclId,
    name: z.string().min(1),
  }),
  delete_sip_ip_list: r("DELETE", "/SipAuth/IpAccessControlList/{ip_acl_uuid}/", "Delete a SIP IP allow-list.", { ip_acl_uuid: aclId }),
  add_sip_ip_list_entry: r("POST", "/SipAuth/IpAccessControlList/{ip_acl_uuid}/Entry/", "Allow one more IP (or range) on a SIP IP allow-list.", {
    ip_acl_uuid: aclId,
    ip: z.string().min(1).describe("IPv4 address, e.g. 203.0.113.10"),
    cidr_prefix: z.number().int().min(0).max(32).optional().describe("Range size: 32 (default) is one address, 24 a /24; 0 allows every IP"),
    description: z.string().max(255).optional(),
  }),
  remove_sip_ip_list_entry: r("DELETE", "/SipAuth/IpAccessControlList/{ip_acl_uuid}/Entry/{entry_id}/", "Remove an entry from a SIP IP allow-list.", {
    ip_acl_uuid: aclId,
    entry_id: z.string().min(1).describe("The entry's id (plivo.get_sip_ip_list)"),
  }),

  // ── pricing and tokens
  get_pricing: r("GET", "/Pricing/", "Plivo's prices for one country: calls (in/out per minute), SMS/MMS, and phone number rental.", {
    country_iso: z.string().length(2).describe("Two-letter country code, e.g. IN, US, GB"),
  }),
  create_sdk_token: r("POST", "/JWT/Token/", "A JWT for Plivo's browser/mobile Voice SDKs, so an app can sign in without the auth token.", {
    iss: z.string().min(1).describe("Your Auth ID (the part before the colon in the key)"),
    sub: z.string().optional().describe("The SIP endpoint username the token is for; needed to receive calls"),
    nbf: z.string().optional().describe("Not valid before this Unix time (seconds)"),
    exp: z.string().optional().describe("Expires at this Unix time (seconds); Plivo's default is 24 hours"),
    per: z
      .object({ voice: z.object({ incoming_allow: z.boolean().optional(), outgoing_allow: z.boolean().optional() }) })
      .optional()
      .describe("Permissions, e.g. {voice: {incoming_allow: true, outgoing_allow: true}}; incoming needs sub"),
    app: z.string().optional().describe("Application (app_id) its outgoing calls use"),
  }),
};
