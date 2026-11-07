// CloudAgent (LiveKit Cloud only, on agents.<domain>): agents LiveKit hosts for the business — their versions,
// secrets, restarts, rollbacks, and private links to the business's own network. Grant: agent admin.
// Creating and deploying an agent uploads its source code, which `lk agent deploy` does; see COVERAGE.md.
import { z } from "zod";
import type { OwnAction } from "../index";
import { twirp } from "./client";

const A = "CloudAgent";
const admin = { agent: { admin: true } };
const agentId = z.string().min(1).describe("The agent's id, CA_… (livekit.list_agents shows them)");
const secrets = z
  .array(z.object({
    name: z.string().min(1).describe("e.g. OPENAI_API_KEY"),
    value: z.string().describe("The secret's value, as text"),
    kind: z.enum(["AGENT_SECRET_KIND_ENVIRONMENT", "AGENT_SECRET_KIND_FILE"]).optional().describe("An environment variable (default) or a file"),
  }))
  .describe("Secrets the agent reads as environment variables");
// AgentSecret.value is bytes, which protobuf JSON sends as base64
const encode = (i: any) => ({ ...i, ...(i.secrets && { secrets: i.secrets.map((s: any) => ({ ...s, value: Buffer.from(s.value).toString("base64") })) }) });
const run = (method: string, description: string, input: z.ZodObject, opts: { readOnly?: boolean; body?: (i: any) => Record<string, unknown> } = {}) =>
  twirp(A, method, description, input, admin, { ...opts, agents: true });
const linkId = z.string().min(1).describe("The private link's id (livekit.list_private_links shows them)");

export const cloudAgentActions: Record<string, OwnAction> = {
  list_agents: run("ListAgents", "The agents LiveKit Cloud runs for this project: id, name, version, and each deployment's region, status, replicas, CPU and memory, recent crashes.", z.object({
    agent_id: z.string().optional().describe("Only this one"),
    agent_name: z.string().optional().describe("Only the one with this name"),
  }), { readOnly: true }),
  list_agent_versions: run("ListAgentVersions", "An agent's deployed versions: which is current, when each was made and deployed. A version can be brought back with livekit.rollback_agent.", z.object({ agent_id: agentId }), { readOnly: true }),
  list_agent_secrets: run("ListAgentSecrets", "The names of an agent's secrets and when they changed (not their values).", z.object({ agent_id: agentId }), { readOnly: true }),
  update_agent_secrets: run("UpdateAgentSecrets", "Set or remove an agent's secrets (API keys it uses). The agent restarts to pick them up.", z.object({
    agent_id: agentId,
    secrets: secrets.optional(),
    remove: z.array(z.string()).optional().describe("Names of secrets to delete"),
    overwrite: z.boolean().optional().describe("Replace all secrets with the ones given, instead of adding to them"),
  }), { body: encode }),
  update_agent: run("UpdateAgent", "Change where an agent runs, or its secrets.", z.object({
    agent_id: agentId,
    regions: z.array(z.string()).optional().describe("LiveKit Cloud regions to run in, e.g. us-east, eu-central, ap-south"),
    secrets: secrets.optional(),
  }), { body: encode }),
  restart_agent: run("RestartAgent", "Restart an agent's running copies (calls in progress are cut off).", z.object({ agent_id: agentId })),
  rollback_agent: run("RollbackAgent", "Go back to an earlier version of an agent.", z.object({
    agent_id: agentId,
    version: z.string().min(1).describe("The version to go back to (livekit.list_agent_versions)"),
  })),
  promote_agent: run("PromoteAgent", "Move the version running in one deployment to another, e.g. from staging to production.", z.object({
    agent_id: agentId,
    src_deployment: z.string().min(1).describe("The deployment to take the version from"),
    dst_deployment: z.string().min(1).describe("The deployment to put it in"),
  })),
  delete_agent: run("DeleteAgent", "Delete a hosted agent (or one deployment of it); it stops answering at once.", z.object({
    agent_id: agentId,
    deployment: z.string().optional().describe("Only this deployment; leave out to delete the whole agent"),
  })),
  get_client_settings: run("GetClientSettings", "LiveKit Cloud's settings for agent tooling (limits and defaults the CLI reads).", z.object({}), { readOnly: true }),
  create_private_link: run("CreatePrivateLink", "Connect hosted agents privately to a service in the business's own cloud network (e.g. an AWS PrivateLink endpoint service).", z.object({
    name: z.string().min(1).describe("A label"),
    region: z.string().min(1).describe("The business's cloud region, e.g. us-east-1"),
    port: z.number().int().describe("The service's port"),
    endpoint: z.string().min(1).describe("The endpoint service name, e.g. com.amazonaws.vpce.us-east-1.vpce-svc-…"),
    cloud_region: z.string().optional().describe("The LiveKit Cloud region the agents run in"),
  })),
  destroy_private_link: run("DestroyPrivateLink", "Remove a private link.", z.object({ private_link_id: linkId })),
  list_private_links: run("ListPrivateLinks", "The private links: id, name, region, endpoint, and the address agents connect to.", z.object({}), { readOnly: true }),
  get_private_link_status: run("GetPrivateLinkStatus", "Whether a private link works yet: PROVISIONING, PENDING_APPROVAL, HEALTHY, UNHEALTHY…", z.object({ private_link_id: linkId }), { readOnly: true }),
};
