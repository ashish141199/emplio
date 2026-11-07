// AgentDispatchService: sending an AI agent into a room on demand (agents registered with an agent_name only
// join when dispatched). Each call is scoped to its room.
import { z } from "zod";
import type { OwnAction } from "../index";
import { attributes, room, roomAdmin, twirp } from "./client";

const D = "AgentDispatchService";
const roomOf = (i: { room: string }) => roomAdmin(i.room);
const dispatchId = z.string().min(1).describe("The dispatch's id, AD_… (livekit.list_dispatch shows them)");

export const dispatchActions: Record<string, OwnAction> = {
  create_dispatch: twirp(D, "CreateDispatch", "Send an agent into a room (the room is made if needed). Answers with the dispatch and its id.", z.object({
    room,
    agent_name: z.string().min(1).describe("The agent's name, as it registered with LiveKit"),
    metadata: z.string().optional().describe("Text handed to the agent for this job, often JSON (e.g. who to call, what to say)"),
    attributes: attributes.optional(),
    deployment: z.string().optional().describe("Cloud agents only: which deployment"),
    restart_policy: z.enum(["JRP_ON_FAILURE", "JRP_NEVER"]).optional().describe("Cloud only: restart the job if it fails (default) or not"),
  }), roomOf),
  delete_dispatch: twirp(D, "DeleteDispatch", "Cancel a dispatch: no new agent jobs start for it (an agent already in the room stays until it leaves).", z.object({ room, dispatch_id: dispatchId }), roomOf),
  list_dispatch: twirp(D, "ListDispatch", "The agent dispatches in a room, with the jobs they started.", z.object({
    room,
    dispatch_id: z.string().optional().describe("Only this one"),
  }), roomOf, { readOnly: true }),
};
