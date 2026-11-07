// Phone numbers: searching, renting, managing and giving them back; number lookup; Verify (OTP) and
// verified caller ids; and the paperwork some countries need before a number is rented (compliance,
// regulatory end users/documents/applications, addresses and identities).
import { z } from "zod";
import type { OwnAction } from "../index";
import { e164, file, lookupApi, method, optional, page, pathNumber, r, range, subaccount, upload } from "./client";

const numberType = z.enum(["local", "mobile", "tollfree"]);
const endUserType = z.enum(["individual", "business"]);
const complianceId = z.string().min(1).describe("The compliance application's id (plivo.list_number_compliance)");
const endUserId = z.string().min(1).describe("The end user's end_user_id (plivo.list_end_users)");
const documentId = z.string().min(1).describe("The compliance_document_id (plivo.list_compliance_documents)");
const applicationId = z.string().min(1).describe("The compliance_application_id (plivo.list_compliance_applications)");
const addressId = z.string().min(1).describe("The address's id (plivo.list_addresses)");
const identityId = z.string().min(1).describe("The identity's id (plivo.list_identities)");
const verificationInfo = z.record(z.string(), z.string()).optional().describe("Address/identity proof some countries need, e.g. {address_id: \"…\", identity_id: \"…\"}");

// documents go as documents[0].file, documents[1].file… next to a JSON `data` field
const complianceFiles = (i: Record<string, any>) => ({
  documents: undefined,
  ...Object.fromEntries(((i.documents as unknown[]) ?? []).map((f, n) => [`documents[${n}].file`, f])),
});
const complianceData = z
  .record(z.string(), z.any())
  .describe(
    'The application: {country_iso: "IN", number_type: "local"|"mobile"|"tollfree", alias, end_user: {type: "individual"|"business", name, last_name, email, address_line1, address_line2, city, state, postal_code, country, registration_number}, documents: [{document_type_id (from plivo.get_number_compliance_requirements), data_fields: {field_name: value}}], callback_url, callback_method, subaccount}',
  );
const complianceDocs = z.array(file).optional().describe('Proof files in the same order as data.documents (PDF/JPEG/PNG, up to 5 MB): [{"file": "/work/pan.pdf"}, …]');

const addressFields = {
  salutation: z.enum(["Mr", "Ms"]).describe("Mr or Ms"),
  first_name: z.string(),
  last_name: z.string(),
  country_iso: z.string().length(2).describe("Two-letter country of the address, e.g. DE"),
  address_line1: z.string().describe("Building / house number"),
  address_line2: z.string().describe("Street"),
  city: z.string(),
  region: z.string().describe("State or province"),
  postal_code: z.string(),
  alias: z.string().optional(),
  auto_correct_address: z.boolean().optional().describe("Let Plivo fix small mistakes in the address"),
  callback_url: z.string().optional().describe("URL told when verification finishes"),
};
const identityFields = {
  ...addressFields,
  birth_place: z.string(),
  birth_date: z.string().describe("YYYY-MM-DD"),
  nationality: z.string().length(2).describe("Two-letter country"),
  id_nationality: z.string().length(2).describe("Two-letter country that issued the id"),
  id_issue_date: z.string().describe("YYYY-MM-DD"),
  id_type: z.string().describe("e.g. passport, NIF, NIE, DNI, national_id"),
  id_number: z.string(),
  business_name: z.string().optional(),
  fiscal_identification_code: z.string().optional(),
  street_code: z.string().optional(),
  municipal_code: z.string().optional(),
  subaccount,
};

export const numberActions: Record<string, OwnAction> = {
  // ── phone numbers
  search_phone_numbers: r("GET", "/PhoneNumber/", "Numbers available to rent in a country, with monthly and setup prices.", {
    country_iso: z.string().length(2).describe("Two-letter country code, e.g. IN, US, GB"),
    type: z.enum(["local", "mobile", "tollfree", "fixed", "national", "any"]).optional().describe("Kind of number (default any)"),
    pattern: z.string().optional().describe("Digits the number should contain or start with, e.g. 415 or 22; * is any digit"),
    region: z.string().optional().describe("State/region name or code, e.g. California or Maharashtra"),
    city: z.string().optional(),
    services: z.string().optional().describe("Must support these, comma separated: voice, sms, mms (e.g. voice,sms)"),
    lata: z.string().optional().describe("US/Canada LATA code"),
    rate_center: z.string().optional().describe("US/Canada rate center"),
    npanxx: z.string().optional().describe("US/Canada first six digits (area code + exchange)"),
    local_calling_area: z.boolean().optional(),
    compliance_requirement: z.string().optional(),
    ...page(),
  }, { loose: true }),
  buy_phone_number: r("POST", "/PhoneNumber/{number}/", "Rent a number found with plivo.search_phone_numbers. Costs money every month.", {
    number: pathNumber("The number to rent"),
    app_id: z.string().optional().describe("Application for its incoming calls/messages (plivo.list_applications)"),
    verification_info: verificationInfo,
    compliance_application_id: z.string().optional().describe("Approved compliance application, where the country needs one"),
    cnam_lookup: z.enum(["enabled", "disabled"]).optional().describe("US: look up caller names on incoming calls"),
    ha_enable: z.boolean().optional().describe("High-availability routing"),
  }),
  list_numbers: r("GET", "/Number/", "Numbers this account rents: number, type, region, application, monthly cost, renewal date.", {
    type: z.enum(["local", "mobile", "tollfree", "fixed", "national"]).optional(),
    number_startswith: z.string().optional().describe("Only numbers starting with these digits (with country code)"),
    subaccount,
    alias: z.string().optional(),
    services: z.string().optional().describe("Only those supporting these, comma separated: voice, sms, mms"),
    cnam_lookup: z.enum(["enabled", "disabled"]).optional(),
    tendlc_campaign_id: z.string().optional(),
    tendlc_registration_status: z.enum(["COMPLETED", "PROCESSING", "UNREGISTERED"]).optional(),
    toll_free_sms_verification: z.enum(["verified", "unverified", "pending_verification"]).optional(),
    ...range("renewal_date", "Renewing", "YYYY-MM-DD"),
    ...page(),
  }, { loose: true }),
  get_number: r("GET", "/Number/{number}/", "One rented number: application, alias, capabilities, cost, compliance and 10DLC status.", { number: pathNumber() }),
  update_number: r("POST", "/Number/{number}/", "Point a rented number at an application, rename it, or move it to a subaccount.", {
    number: pathNumber(),
    app_id: z.string().optional().describe("Application for its incoming calls/messages"),
    subaccount,
    alias: z.string().optional(),
    verification_info: verificationInfo,
    cnam_lookup: z.enum(["enabled", "disabled"]).optional(),
  }),
  unrent_number: r("DELETE", "/Number/{number}/", "Stop renting a number. It is gone from the account and may go to someone else.", { number: pathNumber() }),
  add_carrier_numbers: r("POST", "/Number/", "Add numbers you have at your own carrier (set up on Plivo as an incoming carrier) to the account.", {
    numbers: z.string().min(1).describe("Numbers with country code, comma separated"),
    carrier: z.string().min(1).describe("The incoming carrier's id"),
    region: z.string().min(1).describe("Region of the numbers"),
    number_type: z.enum(["local", "national", "mobile", "tollfree", "fixed"]).optional(),
    app_id: z.string().optional(),
    subaccount,
  }),

  // ── lookup
  lookup_number: r("GET", "/v1/Number/{number}", "Look up a phone number: valid or not, country, carrier, mobile/landline/VoIP, ported. Paid per lookup.", {
    number: z.string().min(1).describe("The number in E.164, e.g. +919876543210"),
    type: z.literal("carrier").default("carrier").describe("Always carrier"),
  }, { api: lookupApi }),

  // ── Verify (OTP)
  create_verify_session: r("POST", "/Verify/Session/", "Send a one-time code to a phone by SMS or voice call, for verifying a user. Check what they type with plivo.validate_verify_session.", {
    recipient: e164("Who gets the code"),
    channel: z.enum(["sms", "voice"]).optional().describe("Default sms"),
    app_uuid: z.string().optional().describe("Verify application with the message template (default: the account's default)"),
    locale: z.string().optional().describe("Language of the message, e.g. en (default), hi, es, fr_FR"),
    brand_name: z.string().optional().describe("Fills ${brand_name} in the template"),
    code_length: z.number().int().min(4).max(8).optional().describe("Digits in the code (default from the application)"),
    app_hash: z.string().optional().describe("Android SMS Retriever hash, to autofill the code"),
    url: z.string().optional().describe("URL told about the session's status"),
    method: method("url"),
  }, { loose: true }),
  validate_verify_session: r("POST", "/Verify/Session/{session_uuid}/", "Check the code a user typed against a Verify session (up to 10 tries).", {
    session_uuid: z.string().min(1).describe("The session_uuid plivo.create_verify_session answered with"),
    otp: z.string().min(1).describe("The code the user typed"),
  }),
  get_verify_session: r("GET", "/Verify/Session/{session_uuid}/", "One Verify session: status (in-progress, verified, expired), attempts, cost.", { session_uuid: z.string().min(1) }),
  list_verify_sessions: r("GET", "/Verify/Session/", "Verify sessions of the last 90 days.", {
    status: z.enum(["in-progress", "verified", "expired"]).optional(),
    recipient: z.string().optional(),
    app_uuid: z.string().optional(),
    subaccount,
    country: z.string().optional().describe("Two-letter country of the recipient"),
    brand_name: z.string().optional(),
    ...range("session_time", "Started", "YYYY-MM-DD HH:MM"),
    ...page(),
  }, { loose: true }),

  // ── verified caller ids (your own numbers you may show as caller id)
  start_caller_id_verification: r("POST", "/VerifiedCallerId/", "Verify a number you own so it can be used as caller id: Plivo sends it a code (then plivo.complete_caller_id_verification).", {
    phone_number: e164("The number to verify"),
    channel: z.enum(["sms", "call"]).optional().describe("How the code is sent (default sms)"),
    alias: z.string().optional(),
    country: z.string().optional().describe("Two-letter country"),
    subaccount,
  }),
  complete_caller_id_verification: r("POST", "/VerifiedCallerId/Verification/{verification_uuid}/", "Finish verifying a caller id with the code it received.", {
    verification_uuid: z.string().min(1).describe("From plivo.start_caller_id_verification"),
    otp: z.string().min(1).describe("The code received"),
  }),
  list_verified_caller_ids: r("GET", "/VerifiedCallerId/", "Verified caller ids.", { country: z.string().optional(), alias: z.string().optional(), subaccount, ...page() }),
  get_verified_caller_id: r("GET", "/VerifiedCallerId/{phone_number}/", "One verified caller id.", { phone_number: z.string().min(1).describe("The number in E.164, e.g. +919876543210") }),
  update_verified_caller_id: r("POST", "/VerifiedCallerId/{phone_number}/", "Rename a verified caller id or move it to a subaccount.", {
    phone_number: z.string().min(1).describe("The number in E.164"),
    alias: z.string().optional(),
    subaccount,
  }),
  delete_verified_caller_id: r("DELETE", "/VerifiedCallerId/{phone_number}/", "Remove a verified caller id.", { phone_number: z.string().min(1).describe("The number in E.164") }),

  // ── phone number compliance (current API)
  get_number_compliance_requirements: r("GET", "/PhoneNumber/Compliance/Requirements/", "What a country needs before renting a number there: the documents (document_type_id) and fields.", {
    country_iso: z.string().length(2).describe("Two-letter country, e.g. IN"),
    number_type: numberType,
    user_type: endUserType,
  }),
  list_number_compliance: r("GET", "/PhoneNumber/Compliance/", "Phone number compliance applications and their status.", {
    status: z.enum(["draft", "submitted", "accepted", "rejected", "suspended", "expired"]).optional(),
    country_iso: z.string().optional(),
    number_type: numberType.optional(),
    user_type: endUserType.optional(),
    alias: z.string().optional(),
    expand: z.string().optional().describe("Include, comma separated: end_user, documents, linked_numbers"),
    subaccount,
    ...page(100),
  }),
  get_number_compliance: r("GET", "/PhoneNumber/Compliance/{compliance_id}/", "One compliance application.", {
    compliance_id: complianceId,
    expand: z.string().optional().describe("Include, comma separated: end_user, documents, linked_numbers"),
  }),
  create_number_compliance: upload("POST", "/PhoneNumber/Compliance/", "Submit the end user's details and proof documents so numbers in a country can be rented.", {
    data: complianceData,
    documents: complianceDocs,
  }, complianceFiles),
  update_number_compliance: upload("PATCH", "/PhoneNumber/Compliance/{compliance_id}/", "Fix a rejected compliance application; documents given replace all the old ones.", {
    compliance_id: complianceId,
    data: complianceData.describe("What changes: {alias, end_user: {…}, documents: [{document_type_id, data_fields}], callback_url, callback_method}"),
    documents: complianceDocs,
  }, complianceFiles),
  delete_number_compliance: r("DELETE", "/PhoneNumber/Compliance/{compliance_id}/", "Delete a compliance application.", { compliance_id: complianceId }),
  link_number_compliance: r("POST", "/PhoneNumber/Compliance/Link/", "Attach accepted compliance applications to rented numbers.", {
    numbers: z
      .array(z.object({ number: z.string(), compliance_application_id: z.string() }))
      .min(1)
      .describe('e.g. [{number: "+912261234567", compliance_application_id: "…"}]'),
  }),

  // ── regulatory compliance (end users, documents, applications)
  list_end_users: r("GET", "/EndUser/", "End users (the people/businesses numbers are registered to).", {
    name: z.string().optional(),
    last_name: z.string().optional(),
    end_user_type: endUserType.optional(),
    ...page(),
  }),
  get_end_user: r("GET", "/EndUser/{end_user_id}/", "One end user.", { end_user_id: endUserId }),
  create_end_user: r("POST", "/EndUser/", "Add an end user for regulatory compliance.", {
    name: z.string().min(1).describe("First name, or the business name"),
    last_name: z.string().optional(),
    end_user_type: endUserType,
  }),
  update_end_user: r("POST", "/EndUser/{end_user_id}/", "Change an end user.", { end_user_id: endUserId, name: z.string().optional(), last_name: z.string().optional(), end_user_type: endUserType.optional() }),
  delete_end_user: r("DELETE", "/EndUser/{end_user_id}/", "Delete an end user.", { end_user_id: endUserId }),
  list_compliance_document_types: r("GET", "/ComplianceDocumentType/", "Kinds of documents compliance accepts (passport, utility bill…).", page()),
  get_compliance_document_type: r("GET", "/ComplianceDocumentType/{document_type_id}/", "One document type and its fields.", { document_type_id: z.string().min(1) }),
  list_compliance_documents: r("GET", "/ComplianceDocument/", "Documents uploaded for compliance.", {
    end_user_id: z.string().optional(),
    document_type_id: z.string().optional(),
    alias: z.string().optional(),
    ...page(),
  }),
  get_compliance_document: r("GET", "/ComplianceDocument/{compliance_document_id}/", "One compliance document.", { compliance_document_id: documentId }),
  create_compliance_document: upload(
    "POST",
    "/ComplianceDocument/",
    "Upload a document for an end user. Fields the document type needs (plivo.get_compliance_document_type) go in extra fields.",
    {
      end_user_id: endUserId,
      document_type_id: z.string().min(1).describe("plivo.list_compliance_document_types"),
      alias: z.string().min(1),
      file: file.optional(),
      fields: z.record(z.string(), z.string()).optional().describe("The type's own fields, e.g. {first_name: \"Asha\", date_of_birth: \"1990-01-31\"}"),
    },
    (i) => ({ fields: undefined, ...i.fields }),
  ),
  update_compliance_document: upload(
    "POST",
    "/ComplianceDocument/{compliance_document_id}/",
    "Change a compliance document.",
    {
      compliance_document_id: documentId,
      end_user_id: z.string().optional(),
      document_type_id: z.string().optional(),
      alias: z.string().optional(),
      file: file.optional(),
      fields: z.record(z.string(), z.string()).optional().describe("The type's own fields to change"),
    },
    (i) => ({ fields: undefined, ...i.fields }),
  ),
  delete_compliance_document: r("DELETE", "/ComplianceDocument/{compliance_document_id}/", "Delete a compliance document.", { compliance_document_id: documentId }),
  list_compliance_requirements: r("GET", "/ComplianceRequirement/", "What documents a country/number type needs, as a compliance_requirement_id.", {
    country_iso2: z.string().optional().describe("Two-letter country"),
    number_type: z.enum(["local", "mobile", "tollfree", "national", "fixed"]).optional(),
    end_user_type: endUserType.optional(),
    phone_number: z.string().optional().describe("Or: the requirements for this number"),
  }),
  get_compliance_requirement: r("GET", "/ComplianceRequirement/{compliance_requirement_id}/", "One compliance requirement.", { compliance_requirement_id: z.string().min(1) }),
  list_compliance_applications: r("GET", "/ComplianceApplication/", "Compliance applications (an end user + documents for a requirement) and their status.", {
    status: z.enum(["draft", "submitted", "accepted", "rejected", "expired"]).optional(),
    end_user_id: z.string().optional(),
    end_user_type: endUserType.optional(),
    number_type: z.string().optional(),
    country_iso2: z.string().optional(),
    alias: z.string().optional(),
    ...page(),
  }),
  get_compliance_application: r("GET", "/ComplianceApplication/{compliance_application_id}/", "One compliance application.", { compliance_application_id: applicationId }),
  create_compliance_application: r("POST", "/ComplianceApplication/", "Put an end user and their documents together against a requirement (then plivo.submit_compliance_application).", {
    compliance_requirement_id: z.string().optional().describe("plivo.list_compliance_requirements; or give country_iso2 + number_type + end_user_type"),
    end_user_id: endUserId,
    document_ids: z.array(z.string()).min(1).describe("compliance_document_ids"),
    alias: z.string().min(1),
    end_user_type: endUserType.optional(),
    country_iso2: z.string().optional(),
    number_type: z.string().optional(),
  }),
  update_compliance_application: r("POST", "/ComplianceApplication/{compliance_application_id}/", "Replace an application's documents.", {
    compliance_application_id: applicationId,
    document_ids: z.array(z.string()).min(1),
  }),
  delete_compliance_application: r("DELETE", "/ComplianceApplication/{compliance_application_id}/", "Delete a compliance application.", { compliance_application_id: applicationId }),
  submit_compliance_application: r("POST", "/ComplianceApplication/{compliance_application_id}/Submit/", "Send a compliance application for review.", { compliance_application_id: applicationId }),

  // ── addresses and identities (older proof for renting numbers in some countries)
  list_addresses: r("GET", "/Verification/Address/", "Addresses submitted as proof for renting numbers.", {
    country_iso: z.string().optional(),
    customer_name: z.string().optional(),
    alias: z.string().optional(),
    verification_status: z.enum(["pending", "accepted", "rejected"]).optional(),
    validation_status: z.enum(["pending", "failed", "success"]).optional(),
    ...page(),
  }),
  get_address: r("GET", "/Verification/Address/{address_id}/", "One address.", { address_id: addressId }),
  create_address: upload("POST", "/Verification/Address/", "Submit an address (with a proof file) for renting numbers in countries that need one.", {
    ...addressFields,
    address_proof_type: z.string().describe("e.g. NATIONAL_ID, PASSPORT, BUSINESS_ID, NIF, NIE, DNI, ANY"),
    fiscal_identification_code: z.string().optional(),
    street_code: z.string().optional(),
    municipal_code: z.string().optional(),
    file: file.optional(),
  }),
  update_address: upload("POST", "/Verification/Address/{address_id}/", "Change an address.", { address_id: addressId, ...optional(addressFields), file: file.optional() }),
  delete_address: r("DELETE", "/Verification/Address/{address_id}/", "Delete an address.", { address_id: addressId }),
  list_identities: r("GET", "/Verification/Identity/", "Identities submitted as proof for renting numbers.", {
    country_iso: z.string().optional(),
    customer_name: z.string().optional(),
    alias: z.string().optional(),
    verification_status: z.enum(["pending", "accepted", "rejected"]).optional(),
    ...page(),
  }),
  get_identity: r("GET", "/Verification/Identity/{identity_id}/", "One identity.", { identity_id: identityId }),
  create_identity: upload("POST", "/Verification/Identity/", "Submit an identity (with an id document) for renting numbers in countries that need one.", { ...identityFields, file: file.optional() }),
  update_identity: upload("POST", "/Verification/Identity/{identity_id}/", "Change an identity.", { identity_id: identityId, ...optional(identityFields), file: file.optional() }),
  delete_identity: r("DELETE", "/Verification/Identity/{identity_id}/", "Delete an identity.", { identity_id: identityId }),
};
