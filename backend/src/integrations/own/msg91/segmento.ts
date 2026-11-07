// Segmento, MSG91's contact store: phonebooks of contacts with custom fields, the events they do, and the
// product catalog those events build. Campaigns send to a phonebook or one of its segments.
import { z } from "zod";
import { rest } from "../openapi";
import type { OwnAction } from "../index";
import { CONTROL, send } from "./client";

const SEG = "/segmento/api/v1";
const phonebook = z.string().min(1).describe("The phonebook's id, from MSG91 → Segmento (in the phonebook's URL)");
const page = {
  pageNo: z.number().int().min(1).default(1).describe("Page number from 1"),
  itemsPerPage: z.number().int().min(1).max(1000).default(100).describe("Rows per page (default 100)"),
};
const range = {
  start_date: z.string().optional().describe("From this day, YYYY-MM-DD"),
  end_date: z.string().optional().describe("To this day, YYYY-MM-DD"),
};

export const segmentoActions: Record<string, OwnAction> = {
  get_phonebook_fields: rest(CONTROL, "GET", `${SEG}/phonebooks/{phonebook_id}/fields`, "A phonebook's fields (built-in and custom) with their types; check before adding or searching contacts.", z.object({ phonebook_id: phonebook })),
  upsert_contact: rest(
    CONTROL,
    "POST",
    `${SEG}/phonebooks/{phonebook_id}/contacts`,
    "Add a contact to a phonebook, or update the one with the same contact_id.",
    z.object({
      phonebook_id: phonebook,
      input: z
        .object({
          contact_id: z.string().optional().describe("Your id for the contact; a contact with this id is updated, otherwise one is made"),
          name: z.string().optional(),
          email: z.string().optional(),
          phonenumber: z.string().optional().describe("With country code, no +, e.g. 919876543210 (the field name as msg91.get_phonebook_fields shows it)"),
        })
        .loose()
        .describe('The contact\'s fields by name, e.g. {"contact_id": "c-42", "name": "Asha", "email": "asha@example.com", "phonenumber": "919876543210", "city": "Pune"}. Dates as "YYYY-MM-DD HH:MM:SS"; nested objects allowed'),
      fields: z.boolean().optional().describe("false to ignore fields the phonebook doesn't have yet; true or left out makes them"),
    }),
  ),
  search_contacts: rest(
    CONTROL,
    "POST",
    `${SEG}/phonebooks/{phonebook_id}/contacts/filters`,
    "Find contacts in a phonebook by free text and/or field rules, with paging and sorting.",
    z.object({
      phonebook_id: phonebook,
      ...page,
      search: z.string().optional().describe("Free-text search"),
      columns: z.array(z.string()).optional().describe("Only these fields, e.g. [\"Contact_id\", \"Name\", \"Email\", \"Phonenumber\"]"),
      query: z
        .object({ condition: z.enum(["and", "or"]), rules: z.array(z.record(z.string(), z.any())) })
        .optional()
        .describe(
          'Field rules, nestable: {"condition": "and", "rules": [{"condition": "and", "rules": [{"field": "Name", "operator": "=", "type": "Text", "value": "Asha"}, {"field": "City", "operator": "=", "type": "Text", "value": "Pune"}]}]}',
        ),
      sortBy: z.string().optional().describe("Field to sort by"),
      sortOrder: z.enum(["asc", "desc"]).optional().describe("asc or desc"),
    }),
    { readOnly: true },
  ),
  delete_contacts: send(
    CONTROL,
    "DELETE",
    `${SEG}/phonebooks/{phonebook_id}/contacts`,
    "Delete contacts from a phonebook (for opt-outs and erasure requests).",
    z.object({ phonebook_id: phonebook, contact_Ids: z.array(z.string().min(1)).min(1).describe("The contacts' ids (the id field from msg91.search_contacts)") }),
  ),
  track_events: rest(
    CONTROL,
    "POST",
    `${SEG}/event/{phonebook_id}`,
    "Record things contacts did (viewed a product, added to cart, ordered…) so segments and journeys can use them.",
    z.object({
      phonebook_id: phonebook,
      data: z
        .array(
          z
            .object({
              event_name: z.string().min(1).describe("e.g. product-clicked, add-to-cart, order-completed"),
              visitor_id: z.string().min(1).describe("The contact's contact_id"),
              event_properties: z.record(z.string(), z.any()).optional().describe('Details, e.g. {"product_id": "P003", "name": "Jacket", "price": 2499}; a new product_id adds to the catalog'),
              event_timestamp: z.string().optional().describe("When, YYYY-MM-DD HH:MM:SS"),
              context: z.object({ userAgent: z.string().optional(), ipAddress: z.string().optional() }).optional(),
            })
            .loose(),
        )
        .min(1)
        .describe("The events"),
    }),
  ),
  get_user_journey: rest(
    CONTROL,
    "POST",
    `${SEG}/userEvents/{phonebook_id}`,
    "One contact's events in time order.",
    z.object({ phonebook_id: phonebook, contact_id: z.string().min(1).describe("The contact's contact_id"), ...page, ...range }),
    { readOnly: true },
  ),
  list_event_types: rest(CONTROL, "GET", `${SEG}/eventTypes/{phonebook_id}`, "The event names recorded for a phonebook and the properties each carries.", z.object({ phonebook_id: phonebook })),
  list_failed_events: rest(
    CONTROL,
    "POST",
    `${SEG}/failedEvents/{phonebook_id}`,
    "Events that were rejected (unknown visitor_id, bad fields…) with the reason.",
    z.object({ phonebook_id: phonebook, ...page, ...range }),
    { readOnly: true },
  ),
  get_product_catalog: rest(CONTROL, "GET", `${SEG}/products/{phonebook_id}`, "The products Segmento learned from events (by product_id) with their details.", z.object({ phonebook_id: phonebook })),
};
