import { z } from "zod";
import type { PollTrigger } from "./index";

export const indiamart: Record<string, PollTrigger> = {
  new_lead: {
    description: "A buyer enquiry (lead) arrives on IndiaMART (checked every 5 minutes, IndiaMART's limit).",
    config: z.object({}),
    output: [
      {
        name: "lead",
        type: "object",
        required: true,
        description: "The IndiaMART lead: UNIQUE_QUERY_ID, SENDER_NAME, SENDER_MOBILE, SENDER_EMAIL, SUBJECT, QUERY_MESSAGE, QUERY_PRODUCT_NAME, QUERY_TIME",
      },
    ],
    every: 5,
    min: 5,
    async poll(_config, run) {
      const out = (await run("indiamart.get_recent_leads", { minutes: 60 })) as { leads?: any[] };
      return (out.leads ?? []).map((lead) => ({ id: String(lead.UNIQUE_QUERY_ID), item: { lead } }));
    },
  },
};
