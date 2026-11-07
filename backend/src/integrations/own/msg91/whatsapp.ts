// WhatsApp on MSG91: templates (the only way to start a conversation), messages inside the 24-hour window,
// interactive messages, groups, calling settings, prepaid balance, logs and analytics.
import { z } from "zod";
import { rest } from "../openapi";
import type { OwnAction } from "../index";
import { analyticsRange, API, CONTROL, integratedNumber, logRange, mobile, send } from "./client";

const OUTBOUND = "/whatsapp/whatsapp-outbound-message/";
const to = mobile.describe("The customer's WhatsApp number with country code, digits only, e.g. 919876543210");
const bodyText = z.string().min(1).max(1024).describe("The message text (up to 1024 characters)");
const footer = z.string().max(60).optional().describe("Small grey text under the message (up to 60 characters)");
const groupId = z.string().min(1).describe("The group's id (msg91.list_whatsapp_groups shows them)");
const timezone = z.string().default("+05:30").describe("UTC offset the answer's times are shown in, e.g. +05:30 (the default) or -04:00");
const templateName = z.string().min(1).describe("The template's name, lowercase with underscores, e.g. order_shipped");
const components = z
  .array(z.record(z.string(), z.any()))
  .min(1)
  .describe(
    "Meta's template components, in order: " +
      '{"type": "HEADER", "format": "TEXT", "text": "Order {{1}}", "example": {"header_text": ["#1042"]}} (format may be IMAGE/VIDEO/DOCUMENT with example.header_handle), ' +
      '{"type": "BODY", "text": "Hi {{1}}, your order ships on {{2}}", "example": {"body_text": [["Asha", "Monday"]]}}, ' +
      '{"type": "FOOTER", "text": "Reply STOP to opt out"}, ' +
      '{"type": "BUTTONS", "buttons": [{"type": "QUICK_REPLY", "text": "Yes"}, {"type": "URL", "text": "Track", "url": "https://shop.in/t/{{1}}", "example": ["1042"]}, {"type": "PHONE_NUMBER", "text": "Call us", "phone_number": "+919876543210"}]}. ' +
      "Variables are numbered {{1}}, {{2}}… and every one needs a sample in example",
  );

// interactive messages share one envelope; only `interactive` differs
const interactive = (i: any, inner: Record<string, unknown>) => ({
  integrated_number: i.integrated_number,
  recipient_number: i.recipient_number,
  content_type: "interactive",
  interactive: { ...inner, ...(i.footer && { footer: { text: i.footer } }) },
});

export const whatsappActions: Record<string, OwnAction> = {
  list_whatsapp_numbers: rest(CONTROL, "GET", "/whatsapp/whatsapp-activation/", "The WhatsApp business numbers on this MSG91 account; the integrated_number every other WhatsApp action asks for.", z.object({})),

  // ── templates
  list_whatsapp_templates: rest(
    CONTROL,
    "GET",
    "/whatsapp/get-template-client/{number}",
    "The WhatsApp templates of a business number, with their status (approved, pending, rejected), language, category and components.",
    z.object({
      number: integratedNumber,
      template_name: z.string().optional().describe("Only the template with this name"),
      template_status: z.enum(["approved", "rejected", "pending"]).optional().describe("Only templates in this state"),
      template_language: z.string().optional().describe("Only this language code, e.g. en, en_US, hi"),
      pagination: z.literal("true").optional().describe("true to page the answer with page_size and page_num; leave out for everything at once"),
      page_size: z.number().int().optional().describe("With pagination: templates per page, e.g. 25, 50, 100"),
      page_num: z.number().int().optional().describe("With pagination: page number from 1"),
    }),
  ),
  create_whatsapp_template: rest(
    API,
    "POST",
    "/whatsapp/client-panel-template/",
    "Submit a new WhatsApp template to Meta for approval. It can be sent once msg91.list_whatsapp_templates shows it approved (minutes to a day).",
    z.object({
      integrated_number: integratedNumber,
      template_name: templateName,
      language: z.string().min(1).describe("Language code, e.g. en, en_US, hi, mr"),
      category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).describe("UTILITY for order and account updates, MARKETING for offers, AUTHENTICATION for codes"),
      components,
      button_url: z.boolean().optional().describe("true when a URL button's link has a {{1}} variable"),
    }).loose(),
  ),
  edit_whatsapp_template: rest(
    CONTROL,
    "PUT",
    "/whatsapp/client-panel-template/{template_id}/",
    "Change an existing WhatsApp template's components; it goes back to Meta for approval.",
    z.object({
      template_id: z.string().min(1).describe("The template's id (the id field in msg91.list_whatsapp_templates)"),
      integrated_number: integratedNumber,
      components,
      button_url: z.boolean().optional().describe("true when a URL button's link has a {{1}} variable"),
    }).loose(),
  ),
  delete_whatsapp_template: rest(
    CONTROL,
    "DELETE",
    "/whatsapp/client-panel-template/",
    "Delete a WhatsApp template (all its languages) by name.",
    z.object({ integrated_number: integratedNumber, template_name: templateName }),
  ),

  // ── sending
  send_whatsapp_template: send(
    CONTROL,
    "POST",
    "/whatsapp/whatsapp-outbound-message/bulk/",
    "Send an approved WhatsApp template to one or many numbers, each with its own variable values. This is the only way to message someone who hasn't written in the last 24 hours. The answer's request_id is what msg91.whatsapp_logs reports against.",
    z.object({
      integrated_number: integratedNumber,
      template_name: templateName,
      language: z.string().min(1).describe("The template's language code exactly as approved, e.g. en, en_US, hi"),
      recipients: z
        .array(
          z.object({
            to: z.array(mobile).min(1).describe("Numbers that get these values, with country code, e.g. [\"919876543210\"]"),
            components: z
              .record(z.string(), z.object({ type: z.string(), value: z.string() }).loose())
              .optional()
              .describe(
                'The template\'s variables, named by place: body_1, body_2… for {{1}}, {{2}} in the body; header_1 for a header variable or media; button_1 for a URL button\'s variable. ' +
                  'Each is {"type": "text", "value": "Asha"}; header media is {"type": "image" | "video" | "document", "value": "https://…public link"} (documents may add "filename"). Leave out for a template without variables',
              ),
          }),
        )
        .min(1)
        .describe("One entry per set of values"),
    }),
    {
      body: (i) => ({
        integrated_number: i.integrated_number,
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          template: { name: i.template_name, language: { code: i.language, policy: "deterministic" }, to_and_components: i.recipients.map((r: any) => ({ to: r.to, components: r.components ?? {} })) },
        },
      }),
    },
  ),
  send_whatsapp_message: rest(
    CONTROL,
    "POST",
    OUTBOUND,
    "Send a free-form WhatsApp message to someone who wrote in the last 24 hours: text, an image/video/audio/document by link, a location, or a reaction. Outside the window use msg91.send_whatsapp_template.",
    z
      .object({
        integrated_number: integratedNumber,
        recipient_number: to,
        content_type: z.enum(["text", "image", "video", "audio", "document", "location", "reaction", "sticker", "contacts"]).describe("What kind of message"),
        text: z.string().optional().describe("content_type text: the message"),
        attachment_url: z.string().url().optional().describe("image/video/audio/document/sticker: a public link to the file"),
        caption: z.string().optional().describe("image/video/document: text under the file"),
        filename: z.string().optional().describe("document: the file name the customer sees, e.g. invoice.pdf"),
        message_id: z.string().optional().describe("reaction: the WhatsApp message id (wamid…) being reacted to; also used to reply to a message"),
        emoji: z.string().optional().describe("reaction: the emoji, e.g. 👍"),
        latitude: z.string().optional().describe("location: latitude, e.g. 19.0760"),
        longitude: z.string().optional().describe("location: longitude, e.g. 72.8777"),
        name: z.string().optional().describe("location: the place's name"),
        address: z.string().optional().describe("location: the place's address"),
      })
      .loose(),
  ),
  send_whatsapp_buttons: send(
    CONTROL,
    "POST",
    OUTBOUND,
    "Send a WhatsApp message with up to 3 reply buttons (inside the 24-hour window). The tapped button's id comes back on the incoming message.",
    z.object({
      integrated_number: integratedNumber,
      recipient_number: to,
      body: bodyText,
      buttons: z
        .array(z.object({ id: z.string().min(1).max(256).describe("Your id for this choice"), title: z.string().min(1).max(20).describe("The button's label, up to 20 characters") }))
        .min(1)
        .max(3)
        .describe("1-3 buttons"),
      header_image_url: z.string().url().optional().describe("A public image link to show above the text"),
      footer,
    }),
    {
      body: (i) =>
        interactive(i, {
          type: "button",
          ...(i.header_image_url && { header: { type: "image", image: { link: i.header_image_url } } }),
          body: { text: i.body },
          action: { buttons: i.buttons.map((b: any) => ({ type: "reply", reply: b })) },
        }),
    },
  ),
  send_whatsapp_list: send(
    CONTROL,
    "POST",
    OUTBOUND,
    "Send a WhatsApp list message: a button that opens a menu of up to 10 rows in sections (inside the 24-hour window).",
    z.object({
      integrated_number: integratedNumber,
      recipient_number: to,
      body: bodyText,
      button: z.string().min(1).max(20).describe("The label of the button that opens the list, e.g. 'See options'"),
      sections: z
        .array(
          z.object({
            title: z.string().max(24).describe("Section heading"),
            rows: z.array(z.object({ id: z.string().min(1).describe("Your id for this row"), title: z.string().min(1).max(24), description: z.string().max(72).optional() })).min(1),
          }),
        )
        .min(1)
        .max(10)
        .describe("Sections of rows; 10 rows at most in all"),
      header: z.string().max(60).optional().describe("Bold text above the body"),
      footer,
    }),
    {
      body: (i) =>
        interactive(i, {
          type: "list",
          ...(i.header && { header: { type: "text", text: i.header } }),
          body: { text: i.body },
          action: { button: i.button, sections: i.sections },
        }),
    },
  ),
  request_whatsapp_location: send(
    CONTROL,
    "POST",
    OUTBOUND,
    "Ask a customer to share their location, with a 'Send location' button (inside the 24-hour window).",
    z.object({ integrated_number: integratedNumber, recipient_number: to, body: bodyText.describe("Why you're asking, e.g. 'Please share your delivery location'") }),
    { body: (i) => interactive(i, { type: "location_request_message", body: { text: i.body }, action: { name: "send_location" } }) },
  ),
  send_whatsapp_product: send(
    CONTROL,
    "POST",
    OUTBOUND,
    "Send one product from the business's WhatsApp (Meta) catalog (inside the 24-hour window).",
    z.object({
      integrated_number: integratedNumber,
      recipient_number: to,
      catalog_id: z.string().min(1).describe("The Meta catalog's id, from Commerce Manager"),
      product_retailer_id: z.string().min(1).describe("The product's content id (SKU) in that catalog"),
      body: bodyText.optional(),
      footer,
    }),
    {
      body: (i) =>
        interactive(i, { type: "product", ...(i.body && { body: { text: i.body } }), action: { catalog_id: i.catalog_id, product_retailer_id: i.product_retailer_id } }),
    },
  ),
  send_whatsapp_product_list: send(
    CONTROL,
    "POST",
    OUTBOUND,
    "Send several products from the business's WhatsApp catalog, grouped in sections (up to 30 products; inside the 24-hour window).",
    z.object({
      integrated_number: integratedNumber,
      recipient_number: to,
      header: z.string().min(1).max(60).describe("Bold heading text (required for product lists)"),
      body: bodyText,
      catalog_id: z.string().min(1).describe("The Meta catalog's id"),
      sections: z
        .array(z.object({ title: z.string().max(24), product_retailer_ids: z.array(z.string().min(1)).min(1).describe("Product content ids (SKUs)") }))
        .min(1)
        .max(10)
        .describe("Sections, each with a title and its products"),
      footer,
    }),
    {
      body: (i) =>
        interactive(i, {
          type: "product_list",
          header: { type: "text", text: i.header },
          body: { text: i.body },
          action: { catalog_id: i.catalog_id, sections: i.sections.map((s: any) => ({ title: s.title, product_items: s.product_retailer_ids.map((id: string) => ({ product_retailer_id: id })) })) },
        }),
    },
  ),
  send_whatsapp_payment_link: rest(
    API,
    "POST",
    OUTBOUND,
    "Send an order with a WhatsApp Payments link (India; the number needs WhatsApp Payments set up in MSG91).",
    z
      .object({
        integrated_number: integratedNumber,
        recipient_number: to,
        content_type: z.literal("interactive").default("interactive").describe("Always interactive"),
        interactive: z
          .object({
            type: z.literal("payment_link").default("payment_link"),
            header: z.any().optional().describe('e.g. {"type": "image", "image": {"link": "https://…/product.jpg"}}'),
            body: z.object({ text: z.string() }).describe('{"text": "Please review your order and pay below"}'),
            footer: z.object({ text: z.string() }).optional(),
            items: z.array(z.object({ name: z.string(), amount: z.string().describe("Price in rupees, e.g. '499'"), quantity: z.string() }).loose()).optional(),
          })
          .loose()
          .describe("The payment message: header, body, footer and the order's items"),
      })
      .loose(),
  ),
  send_whatsapp_typing: rest(
    API,
    "POST",
    "/whatsapp/typing-indicator/",
    "Show 'typing…' to a customer (and mark their message read) while a reply is being prepared.",
    z.object({ message_id: z.string().min(1).describe("The WhatsApp id (wamid.…) of the customer's message being answered") }),
  ),

  // ── account
  whatsapp_prepaid_balance: rest(
    CONTROL,
    "POST",
    "/subscriptions/fetchPrepaidBalance",
    "Prepaid WhatsApp balance left on a business number, and its plan status.",
    z.object({ integrated_number: integratedNumber, service: z.literal("whatsapp").default("whatsapp").describe("Always whatsapp") }),
    { readOnly: true },
  ),
  update_whatsapp_call_settings: rest(
    CONTROL,
    "POST",
    "/whatsapp/integrated-number/call-settings/",
    "Turn WhatsApp voice calling on or off for a business number and set the hours calls are taken.",
    z
      .object({
        integrated_number: integratedNumber,
        status: z.enum(["ENABLED", "DISABLED"]).describe("Whether customers can call this number on WhatsApp"),
        call_hours: z
          .object({
            status: z.enum(["ENABLED", "DISABLED"]).describe("ENABLED to only take calls in these hours"),
            timezone_id: z.string().describe("IANA timezone, e.g. Asia/Kolkata"),
            weekly_operating_hours: z
              .array(z.object({ day_of_week: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]), open_time: z.string().describe("HHMM, e.g. 0930"), close_time: z.string().describe("HHMM, e.g. 1830") }))
              .optional(),
            holiday_schedule: z.array(z.object({ date: z.string().describe("YYYY-MM-DD"), start_time: z.string().describe("HHMM"), end_time: z.string().describe("HHMM") })).optional(),
          })
          .optional()
          .describe("When calls are taken; leave out to keep the current hours"),
      })
      .loose(),
  ),

  // ── groups
  list_whatsapp_groups: rest(API, "GET", "/whatsapp/groups/", "The WhatsApp groups a business number made, with invite links and settings.", z.object({ integrated_number: integratedNumber, timezone })),
  get_whatsapp_group: rest(API, "GET", "/whatsapp/groups/{group_id}/", "One WhatsApp group: subject, description, participants, invite link.", z.object({ group_id: groupId, integrated_number: integratedNumber, timezone })),
  create_whatsapp_group: rest(
    API,
    "POST",
    "/whatsapp/groups/",
    "Make a WhatsApp group owned by a business number. Its invite link shows in msg91.list_whatsapp_groups once ready.",
    z.object({
      integrated_number: integratedNumber,
      subject: z.string().min(1).max(128).describe("The group's name"),
      description: z.string().max(2048).optional().describe("The group's description"),
      join_approval_mode: z.enum(["approval_required", "auto_approve"]).optional().describe("approval_required: people who use the link wait for approval; auto_approve: they join straight away"),
    }),
  ),
  update_whatsapp_group: send(
    API,
    "PUT",
    // the docs print /groups/ without the id; every other per-group call puts it in the path
    "/whatsapp/groups/{group_id}/",
    "Change a WhatsApp group's name, description or picture.",
    z.object({
      group_id: groupId,
      integrated_number: integratedNumber,
      subject: z.string().optional().describe("New name"),
      description: z.string().optional().describe("New description"),
      profile_picture_file: z.any().optional().describe('New group picture, a JPG or PNG: give the file as {"file": "/work/…"}'),
    }),
    { form: true },
  ),
  reset_whatsapp_group_link: rest(
    API,
    "PATCH",
    "/whatsapp/groups/{group_id}/",
    "Make a new invite link for a WhatsApp group; the old one stops working.",
    z.object({ group_id: groupId, integrated_number: integratedNumber, reset_group_link: z.literal("true").default("true").describe("Always true") }),
    { query: ["integrated_number", "reset_group_link"] },
  ),
  delete_whatsapp_group: send(API, "DELETE", "/whatsapp/groups/{group_id}/", "Delete a WhatsApp group.", z.object({ group_id: groupId, integrated_number: integratedNumber })),
  remove_whatsapp_group_participants: send(
    API,
    "DELETE",
    "/whatsapp/groups/{group_id}/",
    "Remove people from a WhatsApp group.",
    z.object({ group_id: groupId, integrated_number: integratedNumber, remove_participants: z.array(mobile).min(1).describe("Their numbers with country code, e.g. [\"919876543210\"]") }),
  ),
  list_whatsapp_group_join_requests: rest(
    API,
    "GET",
    "/whatsapp/groups/{group_id}/join_req",
    "People waiting to join a WhatsApp group (for groups that need approval), with their request ids.",
    z.object({ group_id: groupId, integrated_number: integratedNumber, timezone }),
  ),
  approve_whatsapp_group_join_requests: rest(
    API,
    "POST",
    "/whatsapp/groups/{group_id}/join_requests",
    "Let people into a WhatsApp group.",
    z.object({ group_id: groupId, integrated_number: integratedNumber, join_requests: z.array(z.string().min(1)).min(1).describe("Request ids from msg91.list_whatsapp_group_join_requests") }),
  ),
  reject_whatsapp_group_join_requests: send(
    API,
    "DELETE",
    "/whatsapp/groups/{group_id}/join_requests",
    "Turn down requests to join a WhatsApp group.",
    z.object({ group_id: groupId, integrated_number: integratedNumber, join_requests: z.array(z.string().min(1)).min(1).describe("Request ids from msg91.list_whatsapp_group_join_requests") }),
  ),
  send_whatsapp_group_message: send(
    API,
    "POST",
    OUTBOUND,
    "Post a text message in a WhatsApp group the business number owns.",
    z.object({ integrated_number: integratedNumber, group_id: groupId, text: z.string().min(1).describe("The message") }),
    { body: (i) => ({ integrated_number: i.integrated_number, recipient_number: i.group_id, recipient_type: "group", content_type: "text", text: i.text }) },
  ),

  // ── reports
  whatsapp_logs: rest(
    CONTROL,
    "GET",
    "/report/logs/wa",
    "WhatsApp message log: each message's number, template, status (sent, delivered, read, failed) and failure reason.",
    z.object({ ...logRange, requestId: z.string().optional().describe("Only the messages of one send (the request_id a send answered with)"),
      fields: z.string().optional().describe("Only these columns, comma separated without spaces"),
      limit: z.number().int().min(1).optional().describe("Most rows to return (MSG91's default is 1000)"),
    }),
  ),
  whatsapp_analytics: rest(CONTROL, "GET", "/report/analytics/p/wa/", "WhatsApp totals per day: sent, delivered, read, failed, cost.", z.object(analyticsRange)),
};
