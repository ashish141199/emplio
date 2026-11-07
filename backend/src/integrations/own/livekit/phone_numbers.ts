// PhoneNumberService (Cloud only): buying LiveKit phone numbers and pointing them at a SIP dispatch rule, so
// calls to them reach a room (and an agent). Grant: sip admin.
import { z } from "zod";
import type { OwnAction } from "../index";
import { pageToken, twirp } from "./client";

const P = "PhoneNumberService";
const admin = { sip: { admin: true } };
const which = {
  id: z.string().optional().describe("The number's id (livekit.list_phone_numbers shows them)"),
  phone_number: z.string().optional().describe("Or the number itself, E.164, e.g. +14155552671"),
};
const ruleId = z.string().describe("A SIP dispatch rule's id, SDR_… (livekit.list_sip_dispatch_rules); decides which room and agent calls go to");

export const phoneNumberActions: Record<string, OwnAction> = {
  search_phone_numbers: twirp(P, "SearchPhoneNumbers", "Phone numbers available to buy, by country and area code.", z.object({
    country_code: z.string().min(2).describe('Two-letter country, e.g. "US"'),
    area_code: z.string().optional().describe('Area code, e.g. "415"'),
    limit: z.number().int().optional().describe("How many at most (default 50)"),
    page_token: pageToken.optional(),
  }), admin, { readOnly: true }),
  purchase_phone_number: twirp(P, "PurchasePhoneNumber", "Buy phone numbers (this costs money monthly). Find them with livekit.search_phone_numbers first.", z.object({
    phone_numbers: z.array(z.string()).min(1).describe("The numbers to buy, E.164, e.g. [\"+14155552671\"]"),
    sip_dispatch_rule_id: ruleId.optional(),
  }), admin),
  list_phone_numbers: twirp(P, "ListPhoneNumbers", "The project's phone numbers: number, status, whether inbound/outbound calling works, and their dispatch rules.", z.object({
    limit: z.number().int().optional().describe("How many at most (default 50)"),
    statuses: z.array(z.enum(["PHONE_NUMBER_STATUS_ACTIVE", "PHONE_NUMBER_STATUS_PENDING", "PHONE_NUMBER_STATUS_RELEASED", "PHONE_NUMBER_STATUS_OFFLINE"])).optional().describe("Only these statuses"),
    sip_dispatch_rule_id: ruleId.optional().describe("Only numbers using this dispatch rule"),
    page_token: pageToken.optional(),
  }), admin, { readOnly: true }),
  get_phone_number: twirp(P, "GetPhoneNumber", "One phone number's details. Give id or phone_number.", z.object(which), admin, { readOnly: true }),
  update_phone_number: twirp(P, "UpdatePhoneNumber", "Rename a phone number or point it at another dispatch rule. Give id or phone_number.", z.object({
    ...which,
    sip_dispatch_rule_id: ruleId.optional(),
    name: z.string().optional().describe("A label for the number"),
  }), admin),
  release_phone_numbers: twirp(P, "ReleasePhoneNumbers", "Give phone numbers back: they stop taking calls and may not be gettable again.", z.object({
    ids: z.array(z.string()).optional().describe("The numbers' ids"),
    phone_numbers: z.array(z.string()).optional().describe("Or the numbers, E.164"),
  }), admin),
};
