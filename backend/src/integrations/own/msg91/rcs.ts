// RCS: rich messages in Android's Messages app (cards, carousels, buttons) from a verified business agent.
// Every message and template is one of a handful of shapes, picked by function_name; the fields follow the shape.
import { z } from "zod";
import { rest } from "../openapi";
import type { OwnAction } from "../index";
import { analyticsRange, CONTROL, logRange, mobile } from "./client";

const projectId = z.string().min(1).describe("Your RCS project (agent) id, a UUID from MSG91 → RCS");
const ttl = z.string().optional().describe("Seconds to keep trying to deliver, 1-1296000 (15 days); leave out for MSG91's default");
const kinds = ["text_message", "media", "rich_card", "carousel", "suggested_replies", "dial", "open_url", "view_location", "share_location", "calendar_event"] as const;
const action = '{"type": "dial", "text_to_show": "Call us", "dial_number": "919876543210"}, {"type": "open_url", "text_to_show": "Shop", "url": "https://…"}, ' +
  '{"type": "view_location", "text_to_show": "Find us", "location_query": "Acme Store, Pune"}, {"type": "share_location", "text_to_show": "Share location"}, ' +
  '{"type": "calendar_event", "text_to_show": "Add to calendar", "start_time": "2026-11-01T09:30:00Z", "end_time": "…", "title": "…", "description": "…"}';
// fields each shape takes, for both sending and templates
const shapeFields = {
  text: z.string().optional().describe("The message text (text_message, suggested_replies, dial, open_url, view_location, share_location, calendar_event); templates may use {{1}}, {{2}}"),
  text_to_show: z.string().optional().describe("The button's label (dial, open_url, view_location, share_location, calendar_event)"),
  media_url: z.string().optional().describe("Public link to an image, video or PDF (media, rich_card)"),
  title: z.string().optional().describe("Card or event title, up to 100 characters (rich_card, calendar_event)"),
  description: z.string().optional().describe("Card or event description, up to 2000 characters (rich_card, calendar_event)"),
  dial_number: z.string().optional().describe("Number the button calls, with country code (dial)"),
  url: z.string().optional().describe("Link the button opens (open_url)"),
  location_query: z.string().optional().describe("Place the button shows on a map, e.g. 'Acme Store, MG Road, Pune' (view_location)"),
  start_time: z.string().optional().describe("Event start, ISO 8601 e.g. 2026-11-01T09:30:00Z (calendar_event)"),
  end_time: z.string().optional().describe("Event end, ISO 8601 (calendar_event)"),
  replies_list: z.array(z.string()).optional().describe("Quick-reply chips, e.g. [\"Yes\", \"No\"] (suggested_replies, rich_card)"),
  actions: z.array(z.record(z.string(), z.any())).optional().describe(`Buttons (suggested_replies, rich_card), each one of: ${action}`),
  image_urls: z.array(z.string()).optional().describe("carousel: one image link per card"),
  video_urls: z.array(z.string()).optional().describe("carousel: one video link per card (cards with video)"),
  titles: z.array(z.string()).optional().describe("carousel: one title per card"),
  descriptions: z.array(z.string()).optional().describe("carousel: one description per card"),
  replies_list_of_list: z.array(z.array(z.string())).optional().describe("carousel: each card's reply chips"),
  actions_list_of_list: z.array(z.array(z.record(z.string(), z.any()))).optional().describe("carousel: each card's buttons, shaped like actions"),
};

export const rcsActions: Record<string, OwnAction> = {
  send_rcs_message: rest(
    CONTROL,
    "POST",
    "/rcs/send-rcs-message/bulk/",
    "Send an RCS message (no template) to one or many numbers. function_name picks the shape; fill the fields that shape uses. Phones without RCS don't get it.",
    z
      .object({
        project_id: projectId,
        customer_numbers: z.array(mobile).min(1).describe("Who gets it, with country code, e.g. [\"919876543210\"]"),
        function_name: z.enum(kinds).describe("The shape: text_message, media, rich_card, carousel, suggested_replies, dial, open_url, view_location, share_location or calendar_event"),
        ttl,
        ...shapeFields,
      })
      .loose(),
  ),
  send_rcs_template: rest(
    CONTROL,
    "POST",
    "/rcs/send-rcs-message/bulk/",
    "Send an approved RCS template to one or many numbers, each group with its own variable values.",
    z
      .object({
        project_id: projectId,
        name: z.string().min(1).describe("The template's name (msg91.list_rcs_templates)"),
        namespace: z.string().min(1).describe("The template's namespace (msg91.list_rcs_templates)"),
        function_name: z.enum(kinds).describe("The template's shape, as msg91.list_rcs_templates shows it"),
        customer_number_variables: z
          .array(z.object({ customer_number: z.array(mobile).min(1), variables: z.array(z.string()).describe("Values for {{1}}, {{2}}… in order") }))
          .min(1)
          .describe('[{"customer_number": ["919876543210"], "variables": ["Asha", "1042"]}]'),
        ttl,
      })
      .loose(),
  ),
  create_rcs_template: rest(
    CONTROL,
    "POST",
    "/rcs/rcs-client-panel/template/",
    "Submit an RCS template for approval. function_name picks the shape; content holds that shape's fields (text with {{1}} variables, media_url, title, actions…).",
    z
      .object({
        project_id: projectId,
        template_name: z.string().min(1).describe("A unique name"),
        function_name: z.enum(kinds).describe("The template's shape (see send_rcs_message for what each holds)"),
        content: z.object(shapeFields).loose().describe("The shape's fields, e.g. text_message: {\"text\": \"Hi {{1}}, your order {{2}} shipped\"}"),
        language: z.string().optional().describe("Language code, e.g. en"),
        click_count: z.boolean().optional().describe("open_url: true to count link clicks"),
        ttl,
      })
      .loose(),
  ),
  list_rcs_templates: rest(
    CONTROL,
    "GET",
    "/rcs/rcs-client-panel/template/",
    "An RCS project's templates in a given state, with the name and namespace sending needs.",
    z.object({ project_id: projectId, status: z.enum(["approved", "pending", "rejected"]).default("approved").describe("Which templates (default approved)") }),
  ),
  rcs_logs: rest(CONTROL, "GET", "/report/logs/rcs", "RCS message log: status, failure reason, template, price, delivered/read times, clicks.", z.object(logRange)),
  rcs_analytics: rest(CONTROL, "GET", "/report/analytics/rcs", "RCS totals per day.", z.object(analyticsRange)),
};
