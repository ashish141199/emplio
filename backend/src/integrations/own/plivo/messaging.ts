// Messaging: SMS/MMS/WhatsApp messages and media, Powerpacks and their number pools, WhatsApp templates,
// US 10DLC (profiles, brands, campaigns, linking numbers), toll-free verification, and hosted messaging numbers.
import { z } from "zod";
import type { OwnAction } from "../index";
import { e164, file, method, optional, page, pathNumber, r, range, subaccount, upload } from "./client";

const messageUuid = z.string().min(1).describe("The message_uuid (from plivo.send_message or plivo.list_messages)");
const powerpackUuid = z.string().min(1).describe("The Powerpack's uuid (plivo.list_powerpacks)");
const poolUuid = z.string().min(1).describe("The number pool's uuid: number_pool in plivo.get_powerpack's answer (the last part of its URL)");
const wabaId = z.string().min(1).describe("The WhatsApp Business Account id the templates belong to (from Plivo console → WhatsApp)");
const templateId = z.string().min(1).describe("The template's id (plivo.list_whatsapp_templates)");
const profileUuid = z.string().min(1).describe("The business profile's profile_uuid (plivo.list_profiles)");
const brandId = z.string().min(1).describe("The 10DLC brand_id (plivo.list_brands)");
const campaignId = z.string().min(1).describe("The 10DLC campaign_id (plivo.list_campaigns)");
const tfvUuid = z.string().min(1).describe("The toll-free verification's uuid (plivo.list_tollfree_verifications)");
const service = z.enum(["sms", "mms"]).optional().describe("Which service the number is used for in the pool (default sms)");
const verticals = z
  .enum(["PROFESSIONAL", "REAL_ESTATE", "HEALTHCARE", "HUMAN_RESOURCES", "ENERGY", "ENTERTAINMENT", "RETAIL", "TRANSPORTATION", "AGRICULTURE", "INSURANCE", "POSTAL", "EDUCATION", "HOSPITALITY", "FINANCIAL", "POLITICAL", "GAMBLING", "LEGAL", "CONSTRUCTION", "NGO", "MANUFACTURING", "GOVERNMENT", "TECHNOLOGY", "COMMUNICATION"])
  .describe("The business's industry");
const usecases = ["2FA", "ACCOUNT_NOTIFICATION", "CUSTOMER_CARE", "DELIVERY_NOTIFICATION", "FRAUD_ALERT", "HIGHER_EDUCATION", "MARKETING", "POLLING_VOTING", "PUBLIC_SERVICE_ANNOUNCEMENT", "SECURITY_ALERT"] as const;
const callbackUrl = z.string().optional().describe("URL Plivo tells when the status changes");

const powerpackFields = {
  sticky_sender: z.boolean().optional().describe("Keep using the same sender number for the same recipient (default true)"),
  local_connect: z.boolean().optional().describe("Prefer a sender number local to the recipient (default true)"),
  application_type: z.enum(["xml", "phlo"]).optional().describe("Kind of application handling replies; needed with application_id"),
  application_id: z.string().optional().describe("XML app_id or PHLO id that handles incoming messages, or 'none'"),
  number_priority: z
    .array(z.object({ country_iso: z.string(), service_type: z.string(), priority: z.record(z.string(), z.string()) }))
    .optional()
    .describe('Which sender type to try first per country, e.g. [{country_iso: "US", service_type: "SMS", priority: {priority1: "shortcode", priority2: "longcode", priority3: "tollfree"}}]'),
};

const profileFields = {
  entity_type: z.enum(["PRIVATE", "PUBLIC", "NON_PROFIT", "GOVERNMENT", "INDIVIDUAL"]).describe("Kind of organization"),
  company_name: z.string().describe("Legal company name"),
  vertical: verticals,
  address: z
    .object({ street: z.string(), city: z.string(), state: z.string(), postal_code: z.string(), country: z.string() })
    .describe("Business address: {street, city, state (code, e.g. TX), postal_code, country (two letters, e.g. US)}"),
  authorized_contact: z
    .object({
      first_name: z.string(),
      last_name: z.string(),
      email: z.string(),
      title: z.string(),
      seniority: z.enum(["DIRECTOR", "GM", "VP", "CEO", "CFO", "GENERAL_COUNSEL", "OTHER"]),
      phone: z.string(),
    })
    .partial({ title: true, seniority: true, phone: true })
    .describe("Who represents the business: {first_name, last_name, email, title, seniority, phone (E.164)}"),
  business_contact_email: z.string().optional().describe("Corporate email (not gmail etc.); needed for public companies"),
  doing_business_as: z.string().optional(),
  ein: z.string().optional().describe("Tax id, e.g. the US EIN (needed for STANDARD brands)"),
  ein_issuing_country: z.string().optional().describe("Two-letter country that issued the EIN"),
  website: z.string().optional(),
  stock_symbol: z.string().optional(),
  stock_exchange: z.string().optional().describe("e.g. NASDAQ, NYSE, NSE, BSE, LON, OTHER"),
  alt_business_id: z.string().optional(),
  alt_business_id_type: z.enum(["DUNS", "LEI", "GIIN", "NONE"]).optional(),
  number_of_employees: z.string().optional().describe("BETWEEN_1_AND_10, BETWEEN_11_AND_50, BETWEEN_51_AND_200, … MORE_THAN_10001"),
  plivo_subaccount: z.string().optional().describe("Subaccount auth_id the profile belongs to"),
  enable_caller_reputation: z.boolean().optional().describe("Register the numbers with US carriers' caller-reputation programs"),
};

const campaignTexts = {
  description: z.string().min(40).describe("What the campaign sends and why (40+ characters)"),
  sample1: z.string().min(20).describe("A sample message (20+ characters)"),
  sample2: z.string().min(20).describe("A second sample message (20+ characters)"),
  sample3: z.string().optional(),
  sample4: z.string().optional(),
  sample5: z.string().optional(),
  message_flow: z.string().describe("How people opt in, e.g. 'Customers tick a box on the checkout form at example.com'"),
  help_message: z.string().describe("Reply to HELP, e.g. 'Acme: help at support@acme.com. Msg&data rates may apply.'"),
  optout_message: z.string().describe("Reply to STOP, e.g. 'You are unsubscribed from Acme alerts.'"),
  optin_message: z.string().optional(),
  optin_keywords: z.string().optional().describe("Comma separated, e.g. START,YES"),
  optout_keywords: z.string().optional().describe("Comma separated, e.g. STOP,UNSUBSCRIBE"),
  help_keywords: z.string().optional().describe("Comma separated capitals, e.g. HELP,INFO"),
  terms_and_conditions_link: z.string().optional(),
  privacy_policy_link: z.string().optional(),
};

const tfvFields = {
  profile_uuid: profileUuid,
  usecase: z.string().describe(`Comma separated, from: ${usecases.join(", ")}`),
  usecase_summary: z.string().max(500).describe("What the messages are for"),
  message_sample: z.string().max(1000).describe("Example messages"),
  optin_image_url: z.string().describe("Comma separated URLs of screenshots showing how people opt in"),
  optin_type: z.enum(["VERBAL", "WEB_FORM", "PAPER_FORM", "VIA_TEXT", "MOBILE_QR_CODE"]),
  volume: z.string().describe("Expected messages a month: 10, 100, 1000, 10000, 100000, 250000, 500000, 750000, 1000000, 5000000 or 10000000+"),
  additional_information: z.string().max(1000).optional(),
  terms_and_conditions_link: z.string().optional(),
  privacy_policy_link: z.string().optional(),
  optin_message: z.string().max(500).optional(),
  help_message: z.string().max(500).optional(),
  extra_data: z.string().max(100).optional(),
  callback_url: callbackUrl,
  callback_method: method("callback_url"),
};

const templateBody = {
  name: z.string().regex(/^[a-z0-9_]+$/).describe("snake_case name, unique in the WABA, e.g. order_shipped"),
  language: z.string().describe("Language code, e.g. en_US, en, hi"),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  components: z
    .array(z.record(z.string(), z.any()))
    .min(1)
    .describe(
      'Parts of the template; needs a BODY. e.g. [{type: "HEADER", format: "TEXT", text: "Order update"}, {type: "BODY", text: "Hi {{1}}, order {{2}} shipped", example: {body_text: [["Asha", "#123"]]}}, {type: "FOOTER", text: "Acme"}, {type: "BUTTONS", buttons: [{type: "URL", text: "Track", url: "https://acme.com/t/{{1}}"}]}]',
    ),
  allow_category_change: z.boolean().optional().describe("Let Meta change the category during review (default false)"),
};

export const messagingActions: Record<string, OwnAction> = {
  // ── messages
  send_message: r(
    "POST",
    "/Message/",
    "Send an SMS, MMS or WhatsApp message. Answers with message_uuid(s); delivery comes later (plivo.get_message or the url callback).",
    {
      src: z.string().optional().describe("Sender: a Plivo number in E.164 (+14155551234), a short code, or an alphanumeric sender id; for WhatsApp the business's WhatsApp number. Give src or powerpack_uuid"),
      dst: z.string().min(1).describe("Recipient in E.164, e.g. +919876543210; several separated by <, e.g. +14155550001<+14155550002"),
      text: z.string().optional().describe("The message (SMS up to 1600 GSM / 737 Unicode characters; WhatsApp up to 4096)"),
      type: z.enum(["sms", "mms", "whatsapp"]).optional().describe("Default sms"),
      powerpack_uuid: z.string().optional().describe("Send from a Powerpack's number pool instead of src"),
      media_urls: z.array(z.string()).optional().describe("MMS: up to 10 public URLs (under 5 MB total); WhatsApp: one image/video/document URL"),
      media_ids: z.array(z.string()).optional().describe("MMS media already uploaded with plivo.upload_media"),
      template: z
        .record(z.string(), z.any())
        .optional()
        .describe(
          'WhatsApp template message (needed to start a conversation): {name, language, components: [{type: "header", parameters: [{type: "media", media: "https://…/a.jpg"}]}, {type: "body", parameters: [{type: "text", text: "Asha"}]}, {type: "button", sub_type: "url", index: "0", parameters: [{type: "text", text: "abc"}]}]}',
        ),
      interactive: z
        .record(z.string(), z.any())
        .optional()
        .describe(
          'WhatsApp buttons or list (within 24 h of the customer\'s last message): {type: "button", body: {text: "Confirm?"}, action: {buttons: [{id: "yes", title: "Yes"}, {id: "no", title: "No"}]}} or {type: "list", body: {text}, action: {buttons: [{title: "Menu"}], sections: [{title, rows: [{id, title, description}]}]}} or {type: "cta_url", body: {text}, action: {buttons: [{title, cta_url}]}}',
        ),
      location: z
        .object({ latitude: z.string(), longitude: z.string(), name: z.string().optional(), address: z.string().optional() })
        .optional()
        .describe('WhatsApp location pin: {latitude: "19.0760", longitude: "72.8777", name, address}'),
      url: z.string().optional().describe("URL Plivo tells about delivery status changes"),
      method: method("url"),
      log: z.enum(["true", "false", "content_only", "number_only"]).optional().describe("What Plivo keeps in its logs: true (default) all; false nothing; content_only hides the number; number_only hides the text"),
      trackable: z.boolean().optional().describe("Count it in Plivo's conversion tracking (default false)"),
      message_expiry: z.number().int().min(5).max(10799).optional().describe("Give up if not sent within this many seconds (default 10800, 3 hours)"),
      dlt_entity_id: z.string().optional().describe("India DLT entity id (mostly no longer needed)"),
      dlt_template_id: z.string().optional().describe("India DLT template id"),
      dlt_template_category: z.string().optional().describe("India DLT template category: transactional, promotional, service_implicit, service_explicit"),
    },
    { loose: true },
  ),
  get_message: r("GET", "/Message/{message_uuid}/", "One message: state (queued, sent, delivered, undelivered, failed, received, read), error_code, units, cost.", { message_uuid: messageUuid }),
  list_messages: r("GET", "/Message/", "Messages sent and received in the last 90 days, newest first, with filters.", {
    subaccount,
    message_direction: z.enum(["inbound", "outbound"]).optional(),
    message_state: z.enum(["queued", "sent", "failed", "delivered", "undelivered", "rejected", "received", "read"]).optional(),
    message_type: z.enum(["sms", "mms", "whatsapp"]).optional(),
    from_number: z.string().optional().describe("Only from this number (E.164 or prefix)"),
    to_number: z.string().optional().describe("Only to this number (E.164 or prefix)"),
    error_code: z.number().int().optional(),
    powerpack_id: z.string().optional(),
    conversation_id: z.string().optional().describe("WhatsApp conversation id"),
    destination_country_iso2: z.string().optional().describe("Two-letter country of the recipient"),
    tendlc_campaign_id: z.string().optional(),
    ...range("message_time", "Sent/received", "YYYY-MM-DD HH:MM[:SS], UTC"),
    ...page(),
  }, { loose: true }),
  list_message_media: r("GET", "/Message/{message_uuid}/Media/", "The media (images, files) of an MMS or WhatsApp message, with URLs to fetch them.", { message_uuid: messageUuid }),

  // ── media library (for MMS)
  upload_media: upload("POST", "/Media/", "Upload images/files to Plivo to send by MMS with media_ids (each up to 5 MB; jpg, png, gif, pdf, mp4…).", {
    file: z.union([file, z.array(file)]).describe('One file {"file": "/work/a.jpg"} or several [{"file": …}, …]'),
  }),
  list_media: r("GET", "/Media/", "Media uploaded to Plivo, with media_id and URL.", page()),
  get_media: r("GET", "/Media/{media_id}/", "One uploaded media item.", { media_id: z.string().min(1).describe("The media_id (plivo.list_media)") }),

  // ── Powerpacks (send from a pool of numbers)
  list_powerpacks: r("GET", "/Powerpack/", "Powerpacks: pools of sender numbers Plivo picks from for each message.", page()),
  get_powerpack: r("GET", "/Powerpack/{uuid}/", "One Powerpack: settings and its number_pool URL (the pool uuid is its last part).", { uuid: powerpackUuid }),
  create_powerpack: r("POST", "/Powerpack/", "Make a Powerpack (a number pool for sending). Add numbers with plivo.add_pool_number.", {
    name: z.string().min(1).describe("Unique name"),
    ...powerpackFields,
  }),
  update_powerpack: r("POST", "/Powerpack/{uuid}/", "Change a Powerpack's settings.", { uuid: powerpackUuid, name: z.string().optional(), ...powerpackFields }),
  delete_powerpack: r("DELETE", "/Powerpack/{uuid}/", "Delete a Powerpack.", {
    uuid: powerpackUuid,
    unrent_numbers: z.boolean().optional().describe("Also stop renting (and paying for) all its numbers (default false)"),
  }),
  list_pool_numbers: r("GET", "/NumberPool/{pool_uuid}/Number/", "Long-code numbers in a Powerpack's pool.", {
    pool_uuid: poolUuid,
    starts_with: z.string().optional().describe("Comma separated prefixes without country code (up to 10); needs country_iso2"),
    country_iso2: z.string().optional().describe("Two-letter country code"),
    type: z.enum(["fixed", "mobile", "toll-free"]).optional(),
    service,
    ...page(),
  }),
  get_pool_number: r("GET", "/NumberPool/{pool_uuid}/Number/{number}/", "One number in a pool.", { pool_uuid: poolUuid, number: pathNumber() }),
  add_pool_number: r("POST", "/NumberPool/{pool_uuid}/Number/{number}/", "Add a number you rent to a Powerpack's pool.", { pool_uuid: poolUuid, number: pathNumber(), service }),
  buy_pool_number: r("POST", "/NumberPool/{pool_uuid}/Number/{number}/", "Rent a number (found with plivo.search_phone_numbers) and add it to a pool in one step. Costs money.", {
    pool_uuid: poolUuid,
    number: pathNumber("The number to rent"),
    rent: z.literal("true").default("true").describe("Always true: rent it first"),
    service,
  }),
  remove_pool_number: r("DELETE", "/NumberPool/{pool_uuid}/Number/{number}/", "Take a number out of a pool.", {
    pool_uuid: poolUuid,
    number: pathNumber(),
    unrent: z.boolean().optional().describe("Also stop renting it (default false)"),
  }),
  list_pool_shortcodes: r("GET", "/NumberPool/{pool_uuid}/Shortcode/", "Short codes in a pool.", { pool_uuid: poolUuid, ...page() }),
  get_pool_shortcode: r("GET", "/NumberPool/{pool_uuid}/Shortcode/{shortcode}/", "One short code in a pool.", { pool_uuid: poolUuid, shortcode: z.string().min(1) }),
  remove_pool_shortcode: r("DELETE", "/NumberPool/{pool_uuid}/Shortcode/{shortcode}/", "Unlink a short code from a pool (it stays rented).", { pool_uuid: poolUuid, shortcode: z.string().min(1) }),
  list_pool_tollfree: r("GET", "/NumberPool/{pool_uuid}/Tollfree/", "Toll-free numbers in a pool.", { pool_uuid: poolUuid, ...page() }),
  get_pool_tollfree: r("GET", "/NumberPool/{pool_uuid}/Tollfree/{tollfree}/", "One toll-free number in a pool.", { pool_uuid: poolUuid, tollfree: pathNumber("The toll-free number") }),
  add_pool_tollfree: r("POST", "/NumberPool/{pool_uuid}/Tollfree/{tollfree}/", "Add a toll-free number you rent to a pool.", { pool_uuid: poolUuid, tollfree: pathNumber("The toll-free number") }),
  remove_pool_tollfree: r("DELETE", "/NumberPool/{pool_uuid}/Tollfree/{tollfree}/", "Take a toll-free number out of a pool.", {
    pool_uuid: poolUuid,
    tollfree: pathNumber("The toll-free number"),
    unrent: z.boolean().optional().describe("Also stop renting it (default false)"),
  }),

  // ── WhatsApp templates
  list_whatsapp_templates: r("GET", "/WhatsApp/Template/{waba_id}/", "WhatsApp message templates of a WhatsApp Business Account, with their review status.", {
    waba_id: wabaId,
    template_name: z.string().optional().describe("Only names containing this"),
    ...page(),
  }),
  get_whatsapp_template: r("GET", "/WhatsApp/Template/{waba_id}/{template_id}/", "One WhatsApp template.", { waba_id: wabaId, template_id: templateId }),
  create_whatsapp_template: r("POST", "/WhatsApp/Template/{waba_id}/", "Submit a WhatsApp template to Meta for review.", { waba_id: wabaId, ...templateBody }),
  update_whatsapp_template: r("POST", "/WhatsApp/Template/{waba_id}/{template_id}/", "Change a WhatsApp template (goes back to review). Send the whole template.", {
    waba_id: wabaId,
    template_id: templateId,
    ...templateBody,
  }),
  delete_whatsapp_template: r("DELETE", "/WhatsApp/Template/{waba_id}/{template_id}/", "Delete a WhatsApp template.", {
    waba_id: wabaId,
    template_id: templateId,
    name: z.string().min(1).describe("The template's name (required by Plivo)"),
  }),

  // ── business profiles (10DLC and toll-free)
  list_profiles: r("GET", "/Profile/", "Business profiles used for US 10DLC brands and toll-free verification.", {
    entity_type: z.enum(["PRIVATE", "PUBLIC", "NON_PROFIT", "GOVERNMENT", "INDIVIDUAL"]).optional(),
    type: z.enum(["PRIMARY", "SECONDARY"]).optional(),
    vertical: verticals.optional(),
    ...page(),
  }),
  get_profile: r("GET", "/Profile/{profile_uuid}/", "One business profile.", { profile_uuid: profileUuid }),
  create_profile: r("POST", "/Profile/", "Make a business profile (the company's details for US messaging registration).", {
    profile_alias: z.string().min(1).describe("A name for the profile"),
    customer_type: z.enum(["DIRECT", "RESELLER"]).describe("DIRECT for your own business, RESELLER when sending for clients"),
    ...profileFields,
  }, { loose: true }),
  update_profile: r("POST", "/Profile/{profile_uuid}/", "Change a business profile; give only what changes.", {
    profile_uuid: profileUuid,
    ...optional(profileFields),
  }, { loose: true }),
  delete_profile: r("DELETE", "/Profile/{profile_uuid}/", "Delete a business profile.", { profile_uuid: profileUuid }),

  // ── 10DLC brands
  list_brands: r("GET", "/10dlc/Brand/", "US 10DLC brands (registered businesses) and their status.", {
    type: z.enum(["STARTER", "STANDARD"]).optional(),
    registration_status: z.enum(["FAILED", "PROCESSING", "COMPLETED"]).optional(),
    ...page(),
  }),
  get_brand: r("GET", "/10dlc/Brand/{brand_id}/", "One 10DLC brand: registration status, vetting score.", { brand_id: brandId }),
  create_brand: r("POST", "/10dlc/Brand/", "Register a US 10DLC brand from a business profile (costs a registration fee).", {
    profile_uuid: profileUuid,
    brand_alias: z.string().min(1).describe("A name for the brand"),
    brand_type: z.enum(["STANDARD", "STARTER"]).optional().describe("STANDARD (default; needs an EIN) or STARTER (sole proprietor)"),
    secondary_vetting: z.boolean().optional().describe("Ask for extra vetting for higher sending limits"),
    url: callbackUrl,
    method: method("url"),
  }),
  delete_brand: r("DELETE", "/10dlc/Brand/{brand_id}/", "Delete a 10DLC brand.", { brand_id: brandId }),
  get_brand_usecases: r("GET", "/10dlc/Brand/{brand_id}/usecases/", "Campaign use cases this brand may register.", { brand_id: brandId }),
  resend_brand_otp: r("POST", "/10dlc/Brand/{brand_id}/OTP/", "Send the STARTER brand's verification code to its contact's phone again.", { brand_id: brandId }),

  // ── 10DLC campaigns
  list_campaigns: r("GET", "/10dlc/Campaign/", "US 10DLC campaigns and their registration status.", {
    brand_id: z.string().optional(),
    usecase: z.string().optional().describe("Only this use case, e.g. MARKETING"),
    registration_status: z.enum(["Active", "Failed", "Processing", "Expired"]).optional(),
    campaign_source: z.enum(["plivo", "shared"]).optional(),
    ...page(),
  }),
  get_campaign: r("GET", "/10dlc/Campaign/{campaign_id}/", "One 10DLC campaign.", { campaign_id: campaignId }),
  create_campaign: r("POST", "/10dlc/Campaign/", "Register a 10DLC campaign (what a brand sends) with US carriers. Costs a fee.", {
    brand_id: brandId,
    campaign_alias: z.string().min(1),
    vertical: verticals,
    usecase: z.enum([...usecases, "LOW_VOLUME", "MIXED"]),
    sub_usecases: z.array(z.enum(usecases)).optional().describe("2-5 use cases; needed for MIXED or LOW_VOLUME"),
    ...campaignTexts,
    subscriber_optin: z.boolean().describe("People opt in (must be true)"),
    subscriber_optout: z.boolean().describe("People can opt out (must be true)"),
    subscriber_help: z.boolean().describe("People can ask for help (must be true)"),
    direct_lending: z.boolean().describe("Messages are about loans"),
    embedded_link: z.boolean().describe("Messages contain links"),
    embedded_phone: z.boolean().describe("Messages contain phone numbers"),
    age_gated: z.boolean().describe("Content is age-restricted"),
    affiliate_marketing: z.boolean().describe("Messages are affiliate marketing"),
    url: callbackUrl,
    method: method("url"),
  }),
  update_campaign: r("POST", "/10dlc/Campaign/{campaign_id}/", "Change a campaign's texts (mainly after a rejection); give only what changes.", {
    campaign_id: campaignId,
    campaign_alias: z.string().optional(),
    ...optional(campaignTexts),
  }),
  delete_campaign: r("DELETE", "/10dlc/Campaign/{campaign_id}/", "Delete a 10DLC campaign (no numbers may be in processing).", { campaign_id: campaignId }),
  import_campaign: r("POST", "/10dlc/Campaign/Import/", "Bring in a campaign registered elsewhere and shared with Plivo on the TCR portal.", {
    campaign_id: z.string().min(1).describe("The TCR campaign id"),
    campaign_alias: z.string().min(1),
    url: callbackUrl,
    method: method("url"),
  }),
  link_campaign_numbers: r("POST", "/10dlc/Campaign/{campaign_id}/Number/", "Link numbers to a 10DLC campaign so they can send to the US.", {
    campaign_id: campaignId,
    numbers: z.array(z.string()).min(1).describe("Numbers in E.164, e.g. [\"+14155551234\"]"),
    url: callbackUrl,
    method: method("url"),
  }),
  list_campaign_numbers: r("GET", "/10dlc/Campaign/{campaign_id}/Number/", "Numbers linked to a campaign and their link status.", { campaign_id: campaignId, ...page() }),
  get_campaign_number: r("GET", "/10dlc/Campaign/{campaign_id}/Number/{number}/", "One number's link status on a campaign.", { campaign_id: campaignId, number: pathNumber() }),
  unlink_campaign_number: r("DELETE", "/10dlc/Campaign/{campaign_id}/Number/{number}/", "Unlink a number from a campaign.", {
    campaign_id: campaignId,
    number: pathNumber(),
    url: callbackUrl,
    method: method("url"),
  }),

  // ── toll-free verification (US/Canada)
  list_tollfree_verifications: r("GET", "/TollfreeVerification/", "Toll-free number verification requests and their status.", {
    number: z.string().optional(),
    status: z.enum(["SUBMITTED", "APPROVED", "REJECTED", "UPDATE_REQUIRED"]).optional(),
    profile_uuid: z.string().optional(),
    usecase: z.string().optional(),
    ...range("created", "Created", "YYYY-MM-DD"),
    ...page(),
  }),
  get_tollfree_verification: r("GET", "/TollfreeVerification/{uuid}/", "One toll-free verification request.", { uuid: tfvUuid }),
  create_tollfree_verification: r("POST", "/TollfreeVerification/", "Ask carriers to verify a US/Canada toll-free number for SMS.", {
    number: e164("The toll-free number"),
    ...tfvFields,
  }),
  update_tollfree_verification: r("POST", "/TollfreeVerification/{uuid}/", "Change a toll-free verification (while SUBMITTED or UPDATE_REQUIRED); give only what changes.", {
    uuid: tfvUuid,
    ...optional(tfvFields),
  }),
  delete_tollfree_verification: r("DELETE", "/TollfreeVerification/{uuid}/", "Withdraw a toll-free verification request.", { uuid: tfvUuid }),

  // ── hosted messaging numbers (text-enable a number rented elsewhere)
  list_hosted_messaging_numbers: r("GET", "/HostedMessagingNumber/", "Numbers from another carrier being text-enabled on Plivo.", {
    alias: z.string().optional(),
    hosted_status: z.string().optional().describe("e.g. pending, completed, failed"),
    number: z.string().optional(),
    loa_id: z.string().optional(),
    ...page(),
  }),
  get_hosted_messaging_number: r("GET", "/HostedMessagingNumber/{id}/", "One hosted messaging number order.", { id: z.string().min(1) }),
  create_hosted_messaging_number: r("POST", "/HostedMessagingNumber/", "Start text-enabling a number you own at another carrier (needs a signed LOA).", {
    number: e164("The number"),
    loa_id: z.string().min(1).describe("The signed letter of authorization (plivo.create_loa)"),
    alias: z.string().optional(),
    application_id: z.string().optional().describe("Application for its incoming messages"),
  }),
  list_loas: r("GET", "/HostedMessagingNumber/LOA/", "Letters of authorization uploaded for hosted messaging.", { alias: z.string().optional(), ...page() }),
  get_loa: r("GET", "/HostedMessagingNumber/LOA/{loa_id}/", "One letter of authorization.", { loa_id: z.string().min(1) }),
  create_loa: upload("POST", "/HostedMessagingNumber/LOA/", "Upload a signed letter of authorization (PDF) for hosted messaging.", {
    alias: z.string().min(1),
    file: file.describe('The signed LOA: {"file": "/work/loa.pdf"}'),
  }),
  delete_loa: r("DELETE", "/HostedMessagingNumber/LOA/{loa_id}/", "Delete a letter of authorization.", { loa_id: z.string().min(1) }),
};
