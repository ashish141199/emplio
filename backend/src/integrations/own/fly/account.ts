// What only Fly's GraphQL API has: the account, organizations and their members, billing, deploy history,
// add-ons, health checks and alerts, WireGuard peers, tokens. Plus logs, and raw GraphQL for anything else.
import { z } from "zod";
import { AppsError } from "../../types";
import type { OwnAction } from "../index";
import { graphql, http, LOGS, nodes, orgId } from "./client";

const app = z.string().min(1).describe("The Fly app's name (fly.list_apps shows them)");
const org = z.string().min(1).default("personal").describe("The organization's slug (fly.list_organizations), or 'personal' (the default)");
const first = (n: number, max = 100) => z.number().int().min(1).max(max).default(n).describe(`How many (default ${n}, at most ${max})`);

// a GraphQL action: `query` with variables from `vars`, answered with what `out` picks from the data
function gq(
  description: string,
  input: z.ZodRawShape,
  query: string,
  opts: { vars?: (i: any, key: string) => Promise<Record<string, unknown>> | Record<string, unknown>; out?: (data: any) => unknown; readOnly?: boolean } = {},
): OwnAction {
  return {
    description,
    readOnly: opts.readOnly ?? !query.trimStart().startsWith("mutation"),
    input: z.object(input),
    run: async (i, key) => {
      const data = await graphql(key, query, (await opts.vars?.(i, key)) ?? i);
      return opts.out ? opts.out(data) : data;
    },
  };
}

// mutations take the organization's node id; the input has its slug
const withOrg = (extra: (i: any) => Record<string, unknown>) => async (i: any, key: string) => ({
  input: { organizationId: await orgId(key, i.org), ...extra(i) },
});

const mustFind = <T>(what: string) => (v: T | null | undefined) => {
  if (!v) throw new AppsError(`no such ${what} on this token`);
  return v;
};

export const accountActions: Record<string, OwnAction> = {
  // ── who and where
  whoami: gq("Who the connected token belongs to: name, email, and whether it's a user or an organization token.", {},
    "query { viewer { name email ... on User { username createdAt twoFactorProtection lastRegion } } userOnlyToken }"),
  list_organizations: gq("The organizations this token reaches: slug, name, type, your role, plan and billing state.", {
    admin: z.boolean().optional().describe("Only those you're an admin of"),
    billing_issues_only: z.boolean().optional().describe("Only those with a billing problem"),
  }, "query($admin: Boolean, $billing: Boolean) { organizations(first: 100, admin: $admin, withBillingIssuesOnly: $billing) { nodes { id slug name type viewerRole paidPlan billable billingStatus creditBalance isCreditCardSaved } } }", {
    vars: (i) => ({ admin: i.admin, billing: i.billing_issues_only }),
    out: (d) => nodes(d.organizations),
  }),
  get_organization: gq("One organization: plan, billing state (current, past due…), credit balance in cents, card on file, app count, your role.", { org },
    "query($slug: String) { organization(slug: $slug) { id slug name type viewerRole paidPlan billable billingStatus creditBalance isCreditCardSaved activeDiscountName apps { totalCount } members { totalCount } } }", {
    vars: (i) => ({ slug: i.org }),
    out: (d) => mustFind("organization")(d.organization),
  }),
  list_members: gq("An organization's team: each person's id, name, email, role (ADMIN/MEMBER) and join date.", { org },
    "query($slug: String) { organization(slug: $slug) { members(first: 500) { edges { role joinedAt node { id name email username } } } } }", {
    vars: (i) => ({ slug: i.org }),
    out: (d) => (mustFind("organization")(d.organization) as any).members.edges.map((e: any) => ({ ...e.node, role: e.role, joinedAt: e.joinedAt })),
  }),
  list_invitations: gq("Invitations to an organization still waiting, and who sent them.", { org },
    "query($slug: String) { organization(slug: $slug) { invitations(first: 200) { nodes { id email createdAt redeemed redeemedAt inviter { email } } } } }", {
    vars: (i) => ({ slug: i.org }),
    out: (d) => nodes((mustFind("organization")(d.organization) as any).invitations),
  }),
  invite_member: gq("Invite someone to an organization by email; they get an email to join.", {
    org,
    email: z.string().email().describe("Their email address"),
  }, "mutation($input: CreateOrganizationInvitationInput!) { createOrganizationInvitation(input: $input) { invitation { id email createdAt } } }", {
    vars: withOrg((i) => ({ email: i.email })),
  }),
  cancel_invitation: gq("Withdraw an invitation that hasn't been accepted.", {
    invitation_id: z.string().min(1).describe("The invitation's id from fly.list_invitations"),
  }, "mutation($input: DeleteOrganizationInvitationInput!) { deleteOrganizationInvitation(input: $input) { clientMutationId } }", {
    vars: (i) => ({ input: { invitationId: i.invitation_id } }),
  }),
  update_member_role: gq("Make a member an admin, or an admin a member.", {
    org,
    user_id: z.string().min(1).describe("The person's id from fly.list_members"),
    role: z.enum(["ADMIN", "MEMBER"]),
  }, "mutation($input: UpdateOrganizationMembershipInput!) { updateOrganizationMembership(input: $input) { clientMutationId } }", {
    vars: withOrg((i) => ({ userId: i.user_id, role: i.role })),
  }),
  remove_member: gq("Remove someone from an organization; they lose access to all its apps.", {
    org,
    user_id: z.string().min(1).describe("The person's id from fly.list_members"),
  }, "mutation($input: DeleteOrganizationMembershipInput!) { deleteOrganizationMembership(input: $input) { clientMutationId } }", {
    vars: withOrg((i) => ({ userId: i.user_id })),
  }),

  // ── an app's story: deploys, health, address
  app_overview: gq("An app at a glance: status, whether it's deployed, its address, current release and image, regions, and whether a newer image is out.", { app },
    "query($name: String) { app(name: $name) { name status deployed hostname appUrl platformVersion organization { slug } currentRelease { version status description reason imageRef createdAt user { email } } imageDetails { repository tag version } imageUpgradeAvailable regions { code name } ipAddresses { nodes { address type region } } } }", {
    vars: (i) => ({ name: i.app }),
    out: (d) => mustFind("app")(d.app),
  }),
  list_releases: gq("An app's deploys, newest first: version, status, who deployed, image, when. The first stop when something broke after a deploy.", {
    app,
    first: first(20),
  }, "query($name: String, $first: Int) { app(name: $name) { releases(first: $first) { nodes { version status stable description reason imageRef createdAt user { email } } } } }", {
    vars: (i) => ({ name: i.app, first: i.first }),
    out: (d) => nodes((mustFind("app")(d.app) as any).releases),
  }),
  app_health_checks: gq("The state of an app's health checks (passing, warning, critical) with their latest output.", { app },
    "query($name: String) { app(name: $name) { healthChecks(first: 100) { nodes { name status serviceName type output updatedAt } } } }", {
    vars: (i) => ({ name: i.app }),
    out: (d) => nodes((mustFind("app")(d.app) as any).healthChecks),
  }),
  app_name_available: gq("Whether an app name is free to use.", { name: z.string().min(1).describe("The name to check") },
    "query($name: String!) { appNameAvailable(name: $name) }", { out: (d) => ({ available: d.appNameAvailable }) }),
  move_app: gq("Move an app to another organization (its billing moves with it). The app restarts.", {
    app,
    to_org: z.string().min(1).describe("Slug of the organization to move it to"),
  }, "mutation($input: MoveAppInput!) { moveApp(input: $input) { app { name organization { slug } } } }", {
    vars: async (i, key) => {
      const data = await graphql(key, "query($name: String) { app(name: $name) { id } }", { name: i.app });
      return { input: { appId: (mustFind("app")(data.app) as any).id, organizationId: await orgId(key, i.to_org) } };
    },
  }),
  get_logs: {
    description: "An app's recent log lines (all its machines, newest last): time, machine, region, level, message. Page on with next_token.",
    readOnly: true,
    input: z.object({
      app,
      machine: z.string().optional().describe("Only this machine's id"),
      region: z.string().optional().describe("Only this region, e.g. bom"),
      next_token: z.string().optional().describe("next_token from the previous page, for the lines after it"),
    }),
    run: async (i, key) => {
      const out = (await http(key, "GET", `${LOGS}/${encodeURIComponent(i.app)}/logs`, {
        instance: i.machine,
        region: i.region,
        next_token: i.next_token,
      })) as { data?: { attributes?: Record<string, unknown> }[]; meta?: { next_token?: string } };
      return { lines: (out.data ?? []).map((l) => l.attributes ?? l), next_token: out.meta?.next_token ?? null };
    },
  },

  // ── add-ons (Upstash Redis, Tigris storage, Supabase…)
  list_add_ons: gq("Add-on services the organizations have (Upstash Redis, Tigris storage, Supabase…): name, type, status, plan, region, app.", {
    type: z.enum(["redis", "upstash_redis", "upstash_kafka", "upstash_vector", "kubernetes", "supabase", "tigris", "enveloop", "wafris", "arcjet", "fly_mysql"]).optional().describe("Only this kind"),
  }, "query($type: AddOnType) { addOns(first: 200, type: $type) { nodes { id name status addOnPlanName primaryRegion readRegions hostname publicUrl errorMessage createdAt organization { slug } app { name } addOnProvider { name } } } }", {
    out: (d) => nodes(d.addOns),
  }),
  get_add_on: gq("One add-on: status, plan, regions, address, dashboard link, usage stats. Give its name.", {
    name: z.string().min(1).describe("The add-on's name (fly.list_add_ons)"),
    provider: z.string().optional().describe("Its provider, when names clash, e.g. upstash_redis"),
  }, "query($name: String, $provider: String) { addOn(name: $name, provider: $provider) { id name status addOnPlanName primaryRegion readRegions hostname publicUrl privateIp ssoLink errorMessage options metadata stats createdAt organization { slug } app { name } addOnPlan { displayName pricePerMonth maxDataSize } addOnProvider { name } } }", {
    out: (d) => mustFind("add-on")(d.addOn),
  }),
  list_add_on_plans: gq("Plans for add-ons (Upstash Redis and others): name, price per month, limits.", {},
    "query { addOnPlans(first: 100) { nodes { id name displayName description pricePerMonth maxDataSize maxDailyCommands maxDailyBandwidth maxConcurrentConnections maxRequestSize maxCommandsPerSec } } }", {
    out: (d) => nodes(d.addOnPlans),
  }),
  reset_add_on_password: gq("Give an add-on (e.g. a Redis) a new password; apps using the old one stop connecting until updated.", {
    name: z.string().min(1).describe("The add-on's name"),
  }, "mutation($input: ResetAddOnPasswordInput!) { resetAddOnPassword(input: $input) { addOn { name status } } }", {
    vars: (i) => ({ input: { name: i.name } }),
  }),
  delete_add_on: gq("Delete an add-on and its data. Can't be undone.", {
    name: z.string().min(1).describe("The add-on's name"),
    provider: z.string().optional().describe("Its provider, when names clash"),
  }, "mutation($input: DeleteAddOnInput!) { deleteAddOn(input: $input) { deletedAddOnName } }", {
    vars: (i) => ({ input: { name: i.name, provider: i.provider } }),
  }),

  // ── uptime checks from around the world, and where alerts go
  list_check_jobs: gq("Uptime checks: which URLs Fly pings from around the world, how often, and when next.", {},
    "query { checkJobs(first: 100) { nodes { id url schedule nextRunAt httpOptions { verb headers } locations { nodes { name title } } } } }", {
    out: (d) => nodes(d.checkJobs),
  }),
  list_check_locations: gq("Places uptime checks can run from (name, city, country).", {}, "query { checkLocations { name title locality state country } }", {
    out: (d) => d.checkLocations,
  }),
  create_check_job: gq("Start checking a URL from several places around the world.", {
    org,
    url: z.string().url().describe("The page to check, e.g. https://example.com/health"),
    locations: z.array(z.string()).min(1).describe("Location names from fly.list_check_locations"),
    verb: z.enum(["GET", "HEAD"]).default("GET"),
    headers: z.array(z.string()).optional().describe('Request headers, e.g. ["Authorization: Bearer x"]'),
  }, "mutation($input: CreateCheckJobInput!) { createCheckJob(input: $input) { checkJob { id url schedule nextRunAt } } }", {
    vars: withOrg((i) => ({ url: i.url, locations: i.locations, httpOptions: { verb: i.verb, headers: i.headers } })),
  }),
  run_check_job: gq("Run an uptime check now and get its result.", {
    check_job_id: z.string().min(1).describe("From fly.list_check_jobs"),
  }, "mutation($input: CreateCheckJobRunInput!) { createCheckJobRun(input: $input) { checkJobRun { id state url tests createdAt completedAt } } }", {
    vars: (i) => ({ input: { checkJobId: i.check_job_id } }),
  }),
  list_alert_handlers: gq("Where an organization's health-check alerts go (Slack, PagerDuty).", { org },
    "query($slug: String) { organization(slug: $slug) { healthCheckHandlers(first: 50) { nodes { name type } } } }", {
    vars: (i) => ({ slug: i.org }),
    out: (d) => nodes((mustFind("organization")(d.organization) as any).healthCheckHandlers),
  }),
  set_slack_alerts: gq("Send an organization's health-check alerts to a Slack channel.", {
    org,
    name: z.string().min(1).describe("A name for this alert route"),
    slack_webhook_url: z.string().url().describe("A Slack incoming-webhook URL"),
    slack_channel: z.string().optional().describe("Channel, e.g. #alerts (default #general)"),
    slack_username: z.string().optional().describe("Name the messages show (default Fly)"),
  }, "mutation($input: SetSlackHandlerInput!) { setSlackHandler(input: $input) { handler { name type } } }", {
    vars: withOrg((i) => ({ name: i.name, slackWebhookUrl: i.slack_webhook_url, slackChannel: i.slack_channel, slackUsername: i.slack_username })),
  }),
  set_pagerduty_alerts: gq("Send an organization's health-check alerts to PagerDuty.", {
    org,
    name: z.string().min(1).describe("A name for this alert route"),
    pagerduty_token: z.string().min(1).describe("PagerDuty integration key"),
  }, "mutation($input: SetPagerdutyHandlerInput!) { setPagerdutyHandler(input: $input) { handler { name type } } }", {
    vars: withOrg((i) => ({ name: i.name, pagerdutyToken: i.pagerduty_token })),
  }),
  delete_alert_handler: gq("Stop sending health-check alerts to a Slack or PagerDuty route.", {
    org,
    name: z.string().min(1).describe("The route's name from fly.list_alert_handlers"),
  }, "mutation($input: DeleteHealthCheckHandlerInput!) { deleteHealthCheckHandler(input: $input) { clientMutationId } }", {
    vars: withOrg((i) => ({ name: i.name })),
  }),

  // ── private network (WireGuard)
  list_wireguard_peers: gq("Devices connected to an organization's private network over WireGuard: name, region, private IP.", { org },
    "query($slug: String) { organization(slug: $slug) { wireGuardPeers(first: 200) { nodes { id name region peerip network } } } }", {
    vars: (i) => ({ slug: i.org }),
    out: (d) => nodes((mustFind("organization")(d.organization) as any).wireGuardPeers),
  }),
  add_wireguard_peer: gq("Connect a device to an organization's private network: give its WireGuard public key; get its private IP and the gateway to use.", {
    org,
    name: z.string().min(1).describe("A name for the device, e.g. office-laptop"),
    pubkey: z.string().min(1).describe("The device's WireGuard public key (base64)"),
    region: z.string().optional().describe("Gateway region, e.g. bom"),
    network: z.string().optional().describe("A custom private network; leave out for the default"),
  }, "mutation($input: AddWireGuardPeerInput!) { addWireGuardPeer(input: $input) { peerip endpointip pubkey network } }", {
    vars: withOrg((i) => ({ name: i.name, pubkey: i.pubkey, region: i.region, network: i.network })),
  }),
  remove_wireguard_peer: gq("Disconnect a device from an organization's private network.", {
    org,
    name: z.string().min(1).describe("The device's name from fly.list_wireguard_peers"),
  }, "mutation($input: RemoveWireGuardPeerInput!) { removeWireGuardPeer(input: $input) { clientMutationId } }", {
    vars: withOrg((i) => ({ name: i.name })),
  }),

  // ── tokens
  list_tokens: gq("An organization's limited-access tokens (deploy tokens and others): name, kind, who made it, expiry, revoked or not.", { org },
    "query($slug: String) { organization(slug: $slug) { limitedAccessTokens(first: 200) { nodes { id name profile createdAt expiresAt revokedAt revokedBy user { email } } } } }", {
    vars: (i) => ({ slug: i.org }),
    out: (d) => nodes((mustFind("organization")(d.organization) as any).limitedAccessTokens),
  }),
  create_token: gq("Make a limited-access token for an organization (e.g. read-only, or deploy for one app). The token is shown once.", {
    org,
    name: z.string().min(1).describe("What it's for, e.g. github-actions"),
    profile: z.string().min(1).describe("Kind: deploy, org, readonly_org, machine_exec…"),
    profile_params: z.record(z.string(), z.any()).optional().describe('Kind settings, e.g. {"app_id": "<app id>"} for deploy'),
    expiry: z.string().optional().describe("How long it lasts, e.g. 720h"),
  }, "mutation($input: CreateLimitedAccessTokenInput!) { createLimitedAccessToken(input: $input) { limitedAccessToken { id name profile expiresAt tokenHeader } } }", {
    vars: withOrg((i) => ({ name: i.name, profile: i.profile, profileParams: i.profile_params, expiry: i.expiry })),
  }),
  revoke_token: gq("Revoke a limited-access token; whatever uses it stops working.", {
    token_id: z.string().min(1).describe("The token's id from fly.list_tokens"),
  }, "mutation($input: DeleteLimitedAccessTokenInput!) { deleteLimitedAccessToken(input: $input) { token } }", {
    vars: (i) => ({ input: { id: i.token_id } }),
  }),

  // ── the platform
  platform_info: gq("Fly's machine sizes with prices per month, and its regions.", {},
    "query { platform { requestRegion flyctl { version } vmSizes { name cpuCores memoryMb priceMonth } regions { code name requiresPaidPlan deprecated } } }", {
    out: (d) => d.platform,
  }),
  list_prices: gq("Fly's price list by product (compute, volumes, bandwidth, IPs…), with tiers.", {}, "query { products { name type unitLabel tiers { unitAmount upTo } } }", {
    out: (d) => d.products,
  }),
  nearest_region: gq("The Fly region closest to our server.", {}, "query { nearestRegion { code name } }", { out: (d) => d.nearestRegion }),
  latest_image_tag: gq("The newest tag of one of Fly's own images, e.g. flyio/postgres-flex.", {
    repository: z.string().min(1).describe("Image repository, e.g. flyio/postgres-flex"),
  }, "query($repository: String!) { latestImageTag(repository: $repository) }", { out: (d) => ({ tag: d.latestImageTag }) }),
  validate_config: gq("Check an app config (fly.toml, as JSON) for mistakes before deploying.", {
    definition: z.record(z.string(), z.any()).describe("The fly.toml contents as a JSON object"),
  }, "query($definition: JSON!) { validateConfig(definition: $definition) { valid errors } }", { out: (d) => d.validateConfig }),

  // ── anything else
  graphql_query: {
    description: "Read anything Fly's GraphQL API has that the other actions don't (schema: https://api.fly.io/graphql). Only queries.",
    readOnly: true,
    input: z.object({
      query: z.string().min(1).describe("A GraphQL query, e.g. query { viewer { email } }"),
      variables: z.record(z.string(), z.any()).optional(),
    }),
    run: (i, key) => {
      if (/(^|\})\s*(mutation|subscription)\b/i.test(i.query)) throw new AppsError("that changes things; use fly.graphql_mutation");
      return graphql(key, i.query, i.variables);
    },
  },
  graphql_mutation: {
    description: "Change anything through Fly's GraphQL API that the other actions don't cover (schema: https://api.fly.io/graphql).",
    input: z.object({
      query: z.string().min(1).describe("A GraphQL mutation"),
      variables: z.record(z.string(), z.any()).optional(),
    }),
    run: (i, key) => graphql(key, i.query, i.variables),
  },
};
