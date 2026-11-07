// Hello, MSG91's shared inbox / help desk: email and chat tickets, their state and assignment, saved filters,
// agents' unsent drafts, and the bot's usage. Several bulk calls are DELETEs with a JSON body, as MSG91 built them.
import { z } from "zod";
import { rest } from "../openapi";
import type { OwnAction } from "../index";
import { analyticsRange, CONTROL, send } from "./client";

const H = "/hello";
const chatId = z.string().regex(/^\d+$/).describe("The conversation's id, a number (chat_id in the ticket lists)");
const draftId = z.string().regex(/^[0-9a-f]{24}$/).describe("The draft's id, 24 hex characters (msg91.get_hello_drafts)");
const agentId = z.number().int().describe("The agent's id (msg91.list_hello_inbox_participants)");
const ticketState = z.enum(["open", "close", "snooze", "spam"]);
const attachments = z
  .array(z.object({ path: z.string().describe("Public link to the file"), name: z.string(), mime_type: z.string().optional(), extension: z.string().optional() }))
  .optional()
  .describe('Files: [{"path": "https://…/invoice.pdf", "name": "invoice.pdf", "mime_type": "application/pdf", "extension": "pdf"}]');
const chatDraft = {
  message_type: z.string().default("text-attachment").describe("text-attachment (the default)"),
  agent_id: agentId,
  content: z.object({ text: z.string().describe("The draft text"), attachment: attachments }).describe("The draft: text and attachments"),
};
const mailDraft = {
  message_type: z.string().default("text-attachment").describe("text-attachment (the default)"),
  agent_id: agentId,
  content: z
    .object({
      formValue: z.object({ text: z.string().describe("The email body"), to: z.array(z.string()).default([]), cc: z.array(z.string()).default([]), bcc: z.array(z.string()).default([]) }),
      subject: z.string().optional(),
      attachment: z.array(z.string()).default([]).describe("Public links to attach"),
      message_id: z.number().int().optional().describe("The email being replied to"),
      mentioned_agent_id: z.array(z.number().int()).default([]).describe("Agents @-mentioned"),
    })
    .describe("The email draft"),
};

export const helloActions: Record<string, OwnAction> = {
  list_hello_inboxes: rest(
    CONTROL,
    "GET",
    `${H}/v2/inbox/all/`,
    "The Hello inboxes (email and chat) with their ids, which the other Hello actions ask for.",
    z.object({
      search: z.string().optional().describe("Inbox name contains"),
      inbox_list: z.string().optional().describe("Only this kind, e.g. mail"),
      show_disabled: z.boolean().optional().describe("Include disabled inboxes"),
      start_from: z.number().int().optional().describe("Skip this many (default 0)"),
      page_size: z.number().int().optional().describe("How many (default 30)"),
    }),
  ),
  list_hello_inbox_participants: rest(
    CONTROL,
    "GET",
    `${H}/inboxes/{inbox_id}/participants`,
    "The agents, teams and bot of an inbox, with the ids assigning tickets needs.",
    z.object({
      inbox_id: z.string().min(1).describe("The inbox's id (msg91.list_hello_inboxes)"),
      filter_by: z.enum(["agent", "team"]).optional().describe("Only agents or only teams"),
      status: z.enum(["permitted", "not permitted", "all"]).optional().describe("permitted (default): those with access"),
      search: z.string().optional().describe("Name contains"),
      sort_order: z.enum(["asc", "desc"]).optional().describe("By name, asc or desc"),
      pageNumber: z.number().int().optional().describe("Page from 1"),
      itemsPerPage: z.number().int().optional().describe("How many per page (e.g. 1000)"),
    }),
  ),
  list_hello_tickets: rest(
    CONTROL,
    "GET",
    `${H}/tickets/tickets/`,
    "Tickets across email and chat inboxes in one state, newest message first.",
    z.object({
      type: ticketState.describe("Which tickets: open, close, snooze or spam"),
      mail_inboxes: z.string().optional().describe("Email inbox ids to include, comma separated (up to 100), e.g. 1234,5678"),
      chat_inboxes: z.string().optional().describe("Chat inbox ids to include, comma separated (up to 100)"),
    }).loose(),
  ),
  list_hello_mail_tickets: rest(
    CONTROL,
    "GET",
    `${H}/v2/mail-channel/`,
    "One email inbox's tickets in a state, newest message first.",
    z.object({
      inbox_id: z.string().min(1).describe("The inbox's id"),
      type: ticketState.describe("open, close, snooze or spam"),
      start_from: z.number().int().min(0).optional().describe("Skip this many (default 0)"),
      page_size: z.number().int().min(1).max(100).optional().describe("How many, up to 100 (default 30)"),
    }),
  ),
  send_hello_mail: rest(
    CONTROL,
    "POST",
    `${H}/v2/send/`,
    "Send an email from a Hello inbox: a new conversation (compose true) or a reply on an existing ticket. The answer has the ticket and chat ids.",
    z
      .object({
        inbox_id: z.number().int().describe("The email inbox it's sent from"),
        to: z.string().min(3).describe("Recipient address"),
        compose: z.boolean().default(true).describe("true for a new conversation, false to reply in an existing one"),
        type: z.literal("mail").default("mail").describe("Always mail"),
        message_type: z.string().default("text-attachment").describe("text-attachment (the default)"),
        content: z.object({
          subject: z.string().optional(),
          text: z.string().describe("The body"),
          cc: z.array(z.string()).default([]),
          bcc: z.array(z.string()).default([]),
          attachment: attachments,
        }).describe("The email: subject, text, cc, bcc, attachment"),
      })
      .loose(),
  ),
  set_hello_ticket_closed: rest(
    CONTROL,
    "PUT",
    `${H}/v2/mail-channel/{id}`,
    "Close one email ticket, or reopen it.",
    z.object({ id: z.string().min(1).describe("The ticket's id"), is_closed: z.boolean().describe("true to close, false to reopen") }),
  ),
  change_hello_ticket_state: send(
    CONTROL,
    "DELETE",
    `${H}/v2/mail-channel/`,
    "Close, open, snooze or mark as spam several email tickets at once.",
    z.object({
      ticket_id: z.array(z.number().int()).min(1).describe("The tickets' ids"),
      new_state: ticketState.describe("The state to move them to"),
      snoozed_till: z.string().nullable().optional().describe("For snooze: until when, ISO 8601"),
    }),
  ),
  close_hello_tickets: send(
    CONTROL,
    "DELETE",
    `${H}/v2/mail-channel/`,
    "Close every email ticket that matches: inboxes, who it's assigned to, who replied last, last changed between.",
    z.object({
      close_all: z.literal(true).default(true).describe("Always true"),
      new_state: z.literal("close").default("close").describe("Always close"),
      inboxes: z.array(z.number().int()).min(1).describe("Inbox ids"),
      assignees: z
        .object({ all: z.boolean().optional(), unassigned: z.boolean().optional(), bot: z.boolean().optional(), agents: z.array(z.number().int()).optional(), teams: z.array(z.number().int()).optional() })
        .describe('Whose tickets: {"all": true}, or e.g. {"unassigned": true, "agents": [415392]}'),
      last_reply_by: z.array(z.enum(["agent", "client", "workflow", "bot"])).optional().describe("Only where the last reply came from these"),
      last_modified_between: z.object({ from_date: z.string().nullable(), to_date: z.string().nullable() }).optional().describe("Dates, or null for open-ended"),
    }),
  ),
  close_hello_tickets_by_filter: send(
    CONTROL,
    "DELETE",
    `${H}/v2/mail-channel/`,
    "Close every ticket a saved filter matches.",
    z.object({
      close_all: z.literal(true).default(true).describe("Always true"),
      new_state: z.literal("close").default("close").describe("Always close"),
      filter_id: z.string().min(1).describe("The saved filter's id (msg91.list_hello_saved_filters)"),
      agent_id: agentId.describe("The agent the filter belongs to"),
    }),
  ),
  assign_hello_tickets: rest(
    CONTROL,
    "PUT",
    `${H}/ticket-assign/`,
    "Assign the tickets a saved filter matches to an agent, team or bot (in pages).",
    z.object({
      channel: z.number().int().describe("The inbox id"),
      filter_id: z.number().int().describe("The saved filter whose tickets are assigned"),
      assignee_id: z.number().int().describe("Who gets them (msg91.list_hello_inbox_participants)"),
      assignee_type: z.enum(["agent", "team", "bot"]).describe("What assignee_id is"),
      type: z.enum(["chat", "mail"]).describe("Ticket channel"),
      state: ticketState.describe("Only tickets in this state"),
      start_from: z.number().int().optional().describe("Skip this many tickets"),
      page_size: z.number().int().optional().describe("How many to assign in this call (e.g. 50)"),
    }),
  ),
  list_hello_saved_filters: rest(CONTROL, "GET", `${H}/saved-filter/`, "An agent's saved ticket filters.", z.object({ agent_id: z.number().int().describe("The agent's id") })),
  get_hello_saved_filter: rest(CONTROL, "GET", `${H}/saved-filter/{filter_id}`, "One saved filter: what it matches.", z.object({ filter_id: z.string().min(1).describe("The filter's id") })),

  // ── drafts
  get_hello_drafts: rest(
    CONTROL,
    "GET",
    `${H}/v2/draft/{origin}/{chat_id}/`,
    "The unsent drafts on a conversation.",
    z.object({
      origin: z.enum(["chat", "mail", "whatsapp", "facebook", "instagram", "rcs", "numbers", "apple_message", "note"]).describe("The conversation's channel"),
      chat_id: chatId,
      agent_id: z.number().int().optional().describe("Only this agent's drafts"),
    }),
  ),
  create_hello_chat_draft: rest(CONTROL, "POST", `${H}/draft/whatsapp/{chat_id}/`, "Save a draft reply on a WhatsApp/chat conversation.", z.object({ chat_id: chatId, ...chatDraft })),
  update_hello_chat_draft: rest(CONTROL, "PUT", `${H}/draft/whatsapp/{chat_id}/{draft_id}/`, "Change a draft reply on a WhatsApp/chat conversation.", z.object({ chat_id: chatId, draft_id: draftId, ...chatDraft })),
  delete_hello_chat_draft: rest(CONTROL, "DELETE", `${H}/whatsapp/{chat_id}/{draft_id}`, "Delete a draft on a WhatsApp/chat conversation.", z.object({ chat_id: chatId, draft_id: draftId })),
  create_hello_mail_draft: rest(CONTROL, "POST", `${H}/draft/mail/{chat_id}/`, "Save a draft reply on an email conversation.", z.object({ chat_id: chatId, ...mailDraft })),
  update_hello_mail_draft: rest(CONTROL, "PUT", `${H}/draft/mail/{chat_id}/{draft_id}/`, "Change a draft reply on an email conversation.", z.object({ chat_id: chatId, draft_id: draftId, ...mailDraft })),
  delete_hello_mail_draft: rest(CONTROL, "DELETE", `${H}/mail/{chat_id}/{draft_id}`, "Delete a draft on an email conversation.", z.object({ chat_id: chatId, draft_id: draftId })),

  hello_bot_analytics: rest(CONTROL, "GET", "/report/analytics/bot", "The Hello bot's requests and cost per day.", z.object(analyticsRange)),
};
