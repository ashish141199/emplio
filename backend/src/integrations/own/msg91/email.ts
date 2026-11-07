// Email: sending through templates (with Handlebars or a CSV of recipients), the templates, address validation,
// logs and analytics. Sending needs a domain verified in MSG91 (Email → Domains); the from address must be on it.
import { z } from "zod";
import { rest } from "../openapi";
import type { OwnAction } from "../index";
import { analyticsRange, CONTROL, logRange } from "./client";

const person = z.object({ email: z.string().email(), name: z.string().optional() });
const people = (what: string) => z.array(person).optional().describe(`${what}: [{"name": "Asha", "email": "asha@example.com"}]`);

export const emailActions: Record<string, OwnAction> = {
  send_email: rest(
    CONTROL,
    "POST",
    "/email/send",
    "Send an email from a template to one or many recipient groups, each with its own variable values. Use recipients for a list, or recipients_csv for a CSV file. The answer's unique_id tracks it in msg91.email_logs.",
    z
      .object({
        template_id: z.string().min(1).describe("The template's slug (its unique id, e.g. welcome_mail; msg91.list_email_templates shows them)"),
        from: person.describe('The sender, on your verified domain: {"name": "Acme", "email": "hello@mail.acme.in"}'),
        domain: z.string().min(1).describe("Your sending domain as verified in MSG91, e.g. mail.acme.in (DKIM is signed with it)"),
        recipients: z
          .array(
            z.object({
              to: z.array(person).min(1).describe('Who gets it: [{"name": "Asha", "email": "asha@example.com"}]'),
              cc: people("Copied"),
              bcc: people("Blind copied"),
              variables: z.record(z.string(), z.any()).optional().describe('Values for the template\'s {{variables}}, e.g. {"name": "Asha", "order": "1042"}; lists and objects work with Handlebars templates ({{#each items}})'),
            }),
          )
          .optional()
          .describe("One entry per email to send; each to/cc/bcc group gets the same mail with its variables"),
        reply_to: z.array(z.object({ email: z.string().email() })).optional().describe('Where replies go: [{"email": "support@acme.in"}]'),
        attachments: z
          .array(z.object({ fileName: z.string(), filePath: z.string().optional().describe("A public link to the file"), file: z.string().optional().describe("Or the file inline as a data URI: data:application/pdf;base64,…") }))
          .optional()
          .describe("Files to attach, each by public link (filePath) or inline (file)"),
        recipients_csv: z
          .object({ fileName: z.string(), file: z.string().optional().describe("The CSV base64 encoded"), filePath: z.string().optional().describe("Or a public link to the CSV") })
          .optional()
          .describe("Instead of recipients: a CSV of recipients; needs csv_mapping and first_row_header"),
        csv_mapping: z
          .object({ to_email: z.string(), to_name: z.string().optional(), variables: z.record(z.string(), z.string()).optional() })
          .optional()
          .describe('Which CSV column is what: {"to_email": "email", "to_name": "name", "variables": {"order": "order_no"}} (column names, or indexes when there\'s no header row)'),
        first_row_header: z.boolean().optional().describe("With recipients_csv: true when the CSV's first row is column names"),
        variables: z.record(z.string(), z.any()).optional().describe("With recipients_csv: values shared by every recipient"),
      })
      .loose(),
  ),
  validate_email: rest(
    CONTROL,
    "POST",
    "/email/validate",
    "Check whether an email address exists and can receive mail (syntax, domain, mailbox, disposable). Each check costs email validation credits.",
    z.object({ email: z.string().min(3).describe("The address to check") }),
    { readOnly: true },
  ),
  list_email_templates: rest(
    CONTROL,
    "GET",
    "/email/templates",
    "The email templates on the account, with their slugs (the template_id msg91.send_email takes) and versions.",
    z.object({
      keyword: z.string().optional().describe("Search text"),
      search_in: z.string().optional().describe("Field the keyword searches, e.g. name or slug"),
      status_id: z.number().int().optional().describe("Only templates in this state (MSG91's status id, e.g. 2 for active)"),
      with: z.literal("versions").optional().describe("versions to include each template's versions"),
      per_page: z.number().int().min(1).optional().describe("Templates per page (e.g. 25)"),
      page: z.number().int().min(1).optional().describe("Page number from 1"),
    }),
  ),
  get_email_template_version: rest(
    CONTROL,
    "GET",
    "/email/template-versions/{version_id}",
    "One version of an email template: subject, HTML body and variables.",
    z.object({
      version_id: z.string().min(1).describe("The version's id (versions[].id in msg91.list_email_templates with with=versions)"),
      with: z.literal("template").optional().describe("template to include the template it belongs to"),
    }),
  ),
  create_email_template: rest(
    CONTROL,
    "POST",
    "/email/templates",
    "Add an email template. Variables are written {{name}} in the subject and body; Handlebars blocks ({{#each}}, {{#if}}) work too.",
    z.object({
      name: z.string().min(1).describe("A name to know it by"),
      subject: z.string().min(1).describe("The subject line, e.g. 'Welcome {{first_name}}'"),
      body: z.string().min(1).describe("The HTML body"),
      slug: z.string().optional().describe("Its unique id (template_id when sending); made from the name when left out"),
    }),
  ),
  inline_email_css: rest(
    CONTROL,
    "POST",
    "/email/services/inline-css",
    "Move an HTML email's <style> rules into style attributes, so mail apps like Gmail show it as designed. Returns the converted HTML.",
    z.object({ html: z.string().min(1).describe("The HTML to convert") }),
    { readOnly: true },
  ),
  email_logs: rest(CONTROL, "GET", "/report/logs/mail", "Email log: each mail's recipient, template, status (delivered, opened, clicked, bounced…) and times.", z.object(logRange)),
  email_analytics: rest(CONTROL, "GET", "/report/analytics/p/mail", "Email totals per day: sent, delivered, opened, clicked, bounced, unsubscribed.", z.object(analyticsRange)),
};
