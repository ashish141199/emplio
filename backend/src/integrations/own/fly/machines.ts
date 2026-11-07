// The Machines API (https://docs.machines.dev): apps, machines, volumes, certificates, IP addresses,
// secrets and secret keys, plus the organization-wide lists and the platform's regions.
import { z } from "zod";
import type { OwnAction } from "../index";
import { b64, bytes, http, MACHINES, rest } from "./client";

const app = z.string().min(1).describe("The Fly app's name (fly.list_apps shows them)");
const machine = z.string().min(1).describe("The machine's id, e.g. 148e21ea7e5389 (fly.list_machines shows them)");
const volume = z.string().min(1).describe("The volume's id, e.g. vol_1234567890abcdef (fly.list_volumes shows them)");
const hostname = z.string().min(1).describe("The domain, e.g. www.example.com (fly.list_certificates shows them)");
const secretName = z.string().min(1).describe("The secret's name, e.g. DATABASE_URL");
const keyName = z.string().min(1).describe("The secret key's name (fly.list_secret_keys shows them)");
const org = z.string().min(1).default("personal").describe("The organization's slug (fly.list_organizations), or 'personal' (the default)");
const region = z.string().describe("A Fly region code, e.g. bom (Mumbai), sin, iad, fra; fly.get_regions lists them");
const limit = (max: number) => z.number().int().min(1).max(max).optional().describe(`How many per page (1-${max}); leave out for all`);
const cursor = z.string().optional().describe("next_cursor from the previous page");
const minVersion = z.string().optional().describe("Wait until the app's secrets are at least this version (the version a secret change returned)");
const signal = z.enum(["SIGHUP", "SIGINT", "SIGQUIT", "SIGKILL", "SIGUSR1", "SIGUSR2", "SIGTERM"]);
const states = z.string().optional().describe("Only these states, comma separated: created, started, stopped, suspended");
const updatedAfter = z.string().optional().describe("Only those changed after this time, RFC 3339 e.g. 2026-10-01T00:00:00Z");
const guest = z
  .object({
    cpu_kind: z.enum(["shared", "performance"]).optional(),
    cpus: z.number().int().optional(),
    memory_mb: z.number().int().optional(),
    gpu_kind: z.string().optional(),
    gpus: z.number().int().optional(),
  })
  .describe("Size: cpu_kind shared|performance, cpus, memory_mb (e.g. {cpu_kind: shared, cpus: 1, memory_mb: 256})");
const config = z
  .record(z.string(), z.any())
  .describe(
    "The machine's whole configuration (Fly's MachineConfig): image (required), guest {cpu_kind, cpus, memory_mb}, env {NAME: value}, " +
      "services [{protocol, internal_port, ports: [{port, handlers}]}], mounts [{volume, path}], restart {policy: always|on-failure|no}, " +
      "auto_destroy, schedule (hourly|daily|weekly|monthly), init {cmd, entrypoint, exec}, processes, checks, metadata. " +
      "On update it replaces the old config, so start from fly.get_machine's config and change what you need.",
  );
const machineFields = {
  name: z.string().optional().describe("A name for the machine; one is made up when left out"),
  region: region.optional(),
  skip_launch: z.boolean().optional().describe("Create it but don't start it"),
  skip_service_registration: z.boolean().optional().describe("Don't route traffic to it until it's started again"),
  skip_secrets: z.boolean().optional().describe("Start without the app's secrets"),
  min_secrets_version: z.number().int().optional().describe("Start only with app secrets at least this version (from a secret change)"),
  lease_ttl: z.number().int().optional().describe("Hold a lease on it for this many seconds, so nobody else changes it meanwhile"),
};

const text = z.string().optional();
const base64 = z.string().optional();

// the secret-key crypto calls answer in byte arrays; give them back as base64 (and text when it's readable)
const cryptoRun = (path: string, body: (i: any) => unknown, field: string) => async (i: any, key: string) => {
  const out = (await http(key, "POST", `${MACHINES}/apps/${encodeURIComponent(i.app)}/secretkeys/${encodeURIComponent(i.name)}/${path}`, { min_version: i.min_version }, body(i))) as any;
  const raw: number[] | undefined = out?.[field];
  if (!raw) return out;
  const asText = Buffer.from(raw).toString("utf8");
  return { [`${field}_base64`]: b64(raw), ...(/^[\P{C}\n\r\t]*$/u.test(asText) && { [field]: asText }) };
};

export const machineActions: Record<string, OwnAction> = {
  // ── apps
  list_apps: rest("GET", "/apps", "The apps in a Fly organization: name, status, machine count, network.", {
    org_slug: org,
    app_role: z.string().optional().describe("Only apps with this role, e.g. postgres_cluster"),
    limit: limit(5000),
    cursor,
  }, { query: ["org_slug", "app_role", "limit", "cursor"] }),
  get_app: rest("GET", "/apps/{app}", "One app: its organization, status and private network.", { app }),
  create_app: rest("POST", "/apps", "Make a new, empty app (machines are added with fly.create_machine). Names are global across Fly; check with fly.app_name_available.", {
    name: z.string().min(1).describe("The app's name, unique across all of Fly; becomes <name>.fly.dev"),
    org_slug: org,
    network: z.string().optional().describe("A private network to put it on (made if missing); leave out for the organization's default"),
    enable_subdomains: z.boolean().optional().describe("Also get a wildcard certificate for *.svc.<name>.fly.dev"),
  }, { body: ["name", "org_slug", "network", "enable_subdomains"] }),
  delete_app: rest("DELETE", "/apps/{app}", "Delete an app and everything in it: machines, volumes, IPs, certificates. Can't be undone.", { app }),
  create_deploy_token: rest("POST", "/apps/{app}/deploy_token", "A token that can only deploy this one app, for CI (e.g. GitHub Actions' FLY_API_TOKEN).", {
    app,
    expiry: z.string().optional().describe("How long it lasts, e.g. 720h (30 days); Fly's default when left out"),
  }, { body: ["expiry"] }),

  // ── machines
  list_machines: rest("GET", "/apps/{app}/machines", "An app's machines (its servers): id, name, region, state, image, last update.", {
    app,
    state: states,
    region: region.optional().describe("Only this region"),
    summary: z.boolean().default(true).describe("Leave out each machine's config and checks (default true); false for everything"),
    include_deleted: z.boolean().optional().describe("Also machines that were destroyed"),
    metadata: z.record(z.string(), z.string()).optional().describe("Only machines with these metadata values, e.g. {fly_process_group: app}"),
    limit: limit(1000),
    cursor,
  }, {
    // metadata filters are metadata.<key>=<value>
    query: (i) => ({
      state: i.state,
      region: i.region,
      summary: i.summary,
      include_deleted: i.include_deleted,
      limit: i.limit,
      cursor: i.cursor,
      ...Object.fromEntries(Object.entries((i.metadata ?? {}) as Record<string, string>).map(([k, v]) => [`metadata.${k}`, v])),
    }),
  }),
  get_machine: rest("GET", "/apps/{app}/machines/{machine}", "One machine in full: config (image, size, env, services, mounts), state, checks, recent events.", {
    app,
    machine,
    version: z.string().optional().describe("An older version's id (from fly.list_machine_versions) to see that version instead"),
  }, { query: ["version"] }),
  create_machine: rest("POST", "/apps/{app}/machines", "Start a new machine in an app from an image.", { app, config, ...machineFields }, {
    body: ["config", "name", "region", "skip_launch", "skip_service_registration", "skip_secrets", "min_secrets_version", "lease_ttl"],
  }),
  update_machine: rest("POST", "/apps/{app}/machines/{machine}", "Change a machine's config (new image, size, env…); it restarts with it. The config replaces the old one whole.", {
    app,
    machine,
    config,
    ...machineFields,
    current_version: z.string().optional().describe("Refuse if the machine changed since this version (its `version` from fly.get_machine)"),
  }, { body: ["config", "name", "region", "skip_launch", "skip_service_registration", "skip_secrets", "min_secrets_version", "lease_ttl", "current_version"] }),
  delete_machine: rest("DELETE", "/apps/{app}/machines/{machine}", "Destroy a machine for good. It must be stopped unless force is on.", {
    app,
    machine,
    force: z.boolean().optional().describe("Kill it first if it's running"),
  }, { query: ["force"] }),
  start_machine: rest("POST", "/apps/{app}/machines/{machine}/start", "Start a stopped or suspended machine.", { app, machine }),
  stop_machine: rest("POST", "/apps/{app}/machines/{machine}/stop", "Stop a running machine (start it again with fly.start_machine).", {
    app,
    machine,
    signal: signal.optional().describe("Signal to send first (default SIGINT, or the app's kill_signal)"),
    timeout: z.string().optional().describe("How long to wait before killing it, e.g. 30s"),
  }, { body: (i) => ({ signal: i.signal, timeout: i.timeout }) }),
  restart_machine: rest("POST", "/apps/{app}/machines/{machine}/restart", "Restart a machine, e.g. when the site is stuck.", {
    app,
    machine,
    signal: signal.optional().describe("Signal to stop it with"),
    timeout: z.string().optional().describe("How long to wait before killing it, e.g. 30s or 30"),
  }, { query: ["signal", "timeout"] }),
  suspend_machine: rest("POST", "/apps/{app}/machines/{machine}/suspend", "Suspend a machine: freeze its memory to disk, so it resumes in a moment where it left off.", { app, machine }),
  signal_machine: rest("POST", "/apps/{app}/machines/{machine}/signal", "Send a Unix signal to a machine's main process (e.g. SIGHUP to reload config).", {
    app,
    machine,
    signal: z.enum(["SIGABRT", "SIGALRM", "SIGFPE", "SIGHUP", "SIGILL", "SIGINT", "SIGKILL", "SIGPIPE", "SIGQUIT", "SIGSEGV", "SIGTERM", "SIGTRAP", "SIGUSR1", "SIGUSR2"]),
  }, { body: ["signal"] }),
  cordon_machine: rest("POST", "/apps/{app}/machines/{machine}/cordon", "Stop sending traffic to a machine without stopping it (e.g. to debug it).", { app, machine }),
  uncordon_machine: rest("POST", "/apps/{app}/machines/{machine}/uncordon", "Send traffic to a cordoned machine again.", { app, machine }),
  wait_for_machine: rest("GET", "/apps/{app}/machines/{machine}/wait", "Wait (up to the timeout) until a machine reaches a state, e.g. started after a restart.", {
    app,
    machine,
    state: z.string().default("started").describe("started, stopped, suspended, destroyed, failed or settled; several comma separated"),
    timeout: z.number().int().min(1).max(60).optional().describe("Seconds to wait, at most 60 (default 60)"),
    version: z.string().optional().describe("Wait for this version of it (from an update)"),
    from_event_id: z.string().optional().describe("Only count events after this one"),
  }, { query: ["state", "timeout", "version", "from_event_id"] }),
  machine_events: rest("GET", "/apps/{app}/machines/{machine}/events", "What happened to a machine lately: starts, stops, crashes, exits with their codes, OOM kills.", {
    app,
    machine,
    limit: z.number().int().min(1).max(50).optional().describe("How many (default 20, at most 50)"),
  }, { query: ["limit"] }),
  list_machine_versions: rest("GET", "/apps/{app}/machines/{machine}/versions", "A machine's past configs (one per update), newest first.", { app, machine }),
  list_processes: rest("GET", "/apps/{app}/machines/{machine}/ps", "The processes running inside a machine, with their CPU and memory.", {
    app,
    machine,
    sort_by: z.string().optional().describe("Field to sort by, e.g. cpu or rss"),
    order: z.enum(["asc", "desc"]).optional(),
  }, { query: ["sort_by", "order"] }),
  exec: {
    description: "Run a command inside a running machine and get its output (stdout, stderr, exit code). For quick checks, not long jobs.",
    input: z.object({
      app,
      machine,
      command: z.union([z.string(), z.array(z.string())]).describe('A shell line ("df -h /data") or the program and its arguments (["ls", "-la"])'),
      stdin: z.string().optional().describe("Text fed to the command's input"),
      timeout: z.number().int().min(1).max(600).optional().describe("Seconds before it's stopped"),
      container: z.string().optional().describe("Which container, when the machine runs several"),
    }),
    run: (i, key) =>
      http(key, "POST", `${MACHINES}/apps/${encodeURIComponent(i.app)}/machines/${encodeURIComponent(i.machine)}/exec`, {}, {
        command: typeof i.command === "string" ? ["sh", "-c", i.command] : i.command,
        stdin: i.stdin,
        timeout: i.timeout,
        container: i.container,
      }),
  },
  get_machine_memory: rest("GET", "/apps/{app}/machines/{machine}/memory", "A machine's memory: its limit and what's in use.", { app, machine }),
  set_machine_memory: rest("PUT", "/apps/{app}/machines/{machine}/memory", "Change a running machine's memory limit without restarting it (up to its configured size).", {
    app,
    machine,
    limit_mb: z.number().int().min(1).describe("New limit in MB"),
  }, { body: ["limit_mb"] }),
  reclaim_machine_memory: rest("POST", "/apps/{app}/machines/{machine}/memory/reclaim", "Ask a machine to give back unused memory.", {
    app,
    machine,
    amount_mb: z.number().int().min(1).describe("How many MB to reclaim"),
  }, { body: ["amount_mb"] }),

  // ── machine leases (a lock: while held, only the holder can change the machine)
  get_lease: rest("GET", "/apps/{app}/machines/{machine}/lease", "Who holds a machine's lease (lock) and until when.", { app, machine }),
  create_lease: rest("POST", "/apps/{app}/machines/{machine}/lease", "Take a machine's lease (lock) so nothing else changes it meanwhile; returns a nonce.", {
    app,
    machine,
    ttl: z.number().int().min(1).optional().describe("Seconds to hold it"),
    description: z.string().optional().describe("Why, shown to others who hit the lock"),
  }, { body: ["ttl", "description"] }),
  release_lease: rest("DELETE", "/apps/{app}/machines/{machine}/lease", "Give back a machine's lease (lock).", {
    app,
    machine,
    nonce: z.string().min(1).describe("The nonce fly.create_lease returned"),
  }, { headers: (i) => ({ "fly-machine-lease-nonce": i.nonce }) }),

  // ── machine metadata (labels)
  get_metadata: rest("GET", "/apps/{app}/machines/{machine}/metadata", "A machine's metadata (labels like fly_process_group).", { app, machine }),
  get_metadata_value: rest("GET", "/apps/{app}/machines/{machine}/metadata/{key}", "One metadata label's value.", {
    app,
    machine,
    key: z.string().min(1).describe("The label's name"),
  }),
  set_metadata_value: rest("POST", "/apps/{app}/machines/{machine}/metadata/{key}", "Set one metadata label on a machine.", {
    app,
    machine,
    key: z.string().min(1).describe("The label's name"),
    value: z.string().describe("Its value"),
  }, { body: ["value"] }),
  update_metadata: rest("PATCH", "/apps/{app}/machines/{machine}/metadata", "Set or remove several metadata labels at once; a label set to an empty string is removed.", {
    app,
    machine,
    metadata: z.record(z.string(), z.string()).describe('Labels to set, e.g. {"role": "worker", "old": ""}'),
    machine_version: z.string().optional().describe("Refuse if the machine changed since this version"),
  }, { body: ["metadata", "machine_version"] }),
  delete_metadata_value: rest("DELETE", "/apps/{app}/machines/{machine}/metadata/{key}", "Remove one metadata label from a machine.", {
    app,
    machine,
    key: z.string().min(1).describe("The label's name"),
  }),

  // ── volumes (disks)
  list_volumes: rest("GET", "/apps/{app}/volumes", "An app's volumes (disks): id, name, size, region, which machine uses it, state.", {
    app,
    summary: z.boolean().optional().describe("Leave out block-level details"),
    limit: limit(1000),
    cursor,
  }, { query: ["summary", "limit", "cursor"] }),
  get_volume: rest("GET", "/apps/{app}/volumes/{volume}", "One volume in full.", { app, volume }),
  create_volume: rest("POST", "/apps/{app}/volumes", "Make a new volume (disk) for an app; a machine uses it through a mount in its config.", {
    app,
    name: z.string().min(1).describe("Name machines mount it by, e.g. data (letters, digits, underscores)"),
    region,
    size_gb: z.number().int().min(1).describe("Size in GB"),
    encrypted: z.boolean().optional().describe("Encrypt at rest (default true)"),
    auto_backup_enabled: z.boolean().optional().describe("Daily snapshots (default true)"),
    snapshot_retention: z.number().int().min(1).optional().describe("Days snapshots are kept (default 5)"),
    snapshot_id: z.string().optional().describe("Start from this snapshot (fly.list_snapshots)"),
    source_volume_id: z.string().optional().describe("Start as a copy of this volume"),
    require_unique_zone: z.boolean().optional().describe("Put it on different hardware from the app's other volumes"),
    unique_zone_app_wide: z.boolean().optional(),
    fstype: z.string().optional().describe("Filesystem, e.g. ext4"),
    compute: guest.optional().describe("The machine size it will be used with, to place it on hardware that has room"),
    compute_image: z.string().optional(),
  }, { body: ["name", "region", "size_gb", "encrypted", "auto_backup_enabled", "snapshot_retention", "snapshot_id", "source_volume_id", "require_unique_zone", "unique_zone_app_wide", "fstype", "compute", "compute_image"] }),
  update_volume: rest("PUT", "/apps/{app}/volumes/{volume}", "Change a volume's backups: daily snapshots on/off and how long they're kept.", {
    app,
    volume,
    auto_backup_enabled: z.boolean().optional(),
    snapshot_retention: z.number().int().min(1).optional().describe("Days snapshots are kept"),
  }, { body: ["auto_backup_enabled", "snapshot_retention"] }),
  extend_volume: rest("PUT", "/apps/{app}/volumes/{volume}/extend", "Grow a volume (it can't shrink). The machine using it may need a restart to see the space.", {
    app,
    volume,
    size_gb: z.number().int().min(1).describe("The new, bigger size in GB"),
  }, { body: ["size_gb"] }),
  delete_volume: rest("DELETE", "/apps/{app}/volumes/{volume}", "Destroy a volume and its data. Snapshots are kept for their retention period.", { app, volume }),
  list_snapshots: rest("GET", "/apps/{app}/volumes/{volume}/snapshots", "A volume's snapshots (backups): id, size, when, status.", { app, volume }),
  create_snapshot: rest("POST", "/apps/{app}/volumes/{volume}/snapshots", "Take a snapshot (backup) of a volume now.", { app, volume }),

  // ── certificates (custom domains)
  list_certificates: rest("GET", "/apps/{app}/certificates", "An app's custom domains and their HTTPS certificates: status, DNS still needed.", {
    app,
    filter: z.string().optional().describe("Only domains containing this text"),
    limit: z.number().int().min(1).max(500).optional().describe("How many per page (default 25)"),
    cursor,
  }, { query: ["filter", "limit", "cursor"] }),
  get_certificate: rest("GET", "/apps/{app}/certificates/{hostname}", "One domain's certificate: issued or not, expiry, and the DNS records to add if it isn't working.", { app, hostname }),
  add_certificate: rest("POST", "/apps/{app}/certificates/acme", "Add a custom domain to an app; Fly gets a free certificate once its DNS points at the app (fly.get_certificate says which records).", {
    app,
    hostname,
  }, { body: ["hostname"] }),
  upload_certificate: rest("POST", "/apps/{app}/certificates/custom", "Use your own certificate for a domain instead of Fly's free one.", {
    app,
    hostname,
    fullchain: z.string().min(1).describe("The certificate chain, PEM"),
    private_key: z.string().min(1).describe("Its private key, PEM"),
  }, { body: ["hostname", "fullchain", "private_key"] }),
  check_certificate: rest("POST", "/apps/{app}/certificates/{hostname}/check", "Re-check a domain's DNS and retry its certificate, after fixing DNS.", { app, hostname }),
  delete_certificate: rest("DELETE", "/apps/{app}/certificates/{hostname}", "Remove a custom domain from an app, with all its certificates.", { app, hostname }),
  delete_acme_certificate: rest("DELETE", "/apps/{app}/certificates/{hostname}/acme", "Remove only Fly's free certificate for a domain (keeps an uploaded one).", { app, hostname }),
  delete_custom_certificate: rest("DELETE", "/apps/{app}/certificates/{hostname}/custom", "Remove only the uploaded certificate for a domain (falls back to Fly's free one).", { app, hostname }),

  // ── IP addresses
  list_ip_addresses: rest("GET", "/apps/{app}/ip_assignments", "An app's public and private IP addresses.", { app }),
  add_ip_address: rest("POST", "/apps/{app}/ip_assignments", "Give an app a new IP address. A dedicated IPv4 is billed monthly; shared IPv4 and IPv6 are free.", {
    app,
    type: z.enum(["v4", "shared_v4", "v6", "private_v6"]).describe("v4: dedicated IPv4 (paid); shared_v4: free shared IPv4; v6: public IPv6; private_v6: Flycast, private network only"),
    region: region.optional().describe("Only for this region (leave out for global)"),
    org_slug: z.string().optional().describe("Organization, for private_v6 on another org's network"),
    network: z.string().optional().describe("Private network, for private_v6"),
    service_name: z.string().optional(),
  }, { body: ["type", "region", "org_slug", "network", "service_name"] }),
  remove_ip_address: rest("DELETE", "/apps/{app}/ip_assignments/{ip}", "Release one of an app's IP addresses.", {
    app,
    ip: z.string().min(1).describe("The address, e.g. 66.241.124.10 (fly.list_ip_addresses)"),
  }),

  // ── secrets (environment variables the app's machines get)
  list_secrets: rest("GET", "/apps/{app}/secrets", "The names of an app's secrets and when each changed; not their values (fly.reveal_secrets).", {
    app,
    min_version: minVersion,
  }, { query: ["min_version"] }),
  reveal_secrets: rest("GET", "/apps/{app}/secrets", "An app's secrets with their values. Only when the person needs a value; never paste them in a chat.", {
    app,
    min_version: minVersion,
  }, { query: (i) => ({ show_secrets: true, min_version: i.min_version }), readOnly: false }),
  get_secret: rest("GET", "/apps/{app}/secrets/{name}", "One secret: when it changed, and its value only when show_value is on.", {
    app,
    name: secretName,
    show_value: z.boolean().default(false).describe("Include the value"),
    min_version: minVersion,
  }, { query: (i) => ({ show_secrets: i.show_value || undefined, min_version: i.min_version }), readOnly: false }),
  set_secrets: rest("POST", "/apps/{app}/secrets", "Set or remove several secrets at once (one new secrets version). Machines pick them up on their next restart or deploy.", {
    app,
    values: z.record(z.string(), z.string().nullable()).describe('Name to value, e.g. {"API_KEY": "abc", "OLD_ONE": null}; null removes it'),
  }, { body: ["values"] }),
  set_secret: rest("POST", "/apps/{app}/secrets/{name}", "Set one secret. Machines pick it up on their next restart or deploy; returns the new secrets version.", {
    app,
    name: secretName,
    value: z.string().describe("Its value"),
  }, { body: ["value"] }),
  delete_secret: rest("DELETE", "/apps/{app}/secrets/{name}", "Remove one secret.", { app, name: secretName }),

  // ── secret keys (keys Fly keeps for the app, to encrypt and sign without ever handing them out)
  list_secret_keys: rest("GET", "/apps/{app}/secretkeys", "An app's secret keys (encryption and signing keys Fly holds): name, type, public key.", {
    app,
    types: z.string().optional().describe("Only these types, comma separated"),
    min_version: minVersion,
  }, { query: ["types", "min_version"] }),
  get_secret_key: rest("GET", "/apps/{app}/secretkeys/{name}", "One secret key: type and public key.", { app, name: keyName, min_version: minVersion }, { query: ["min_version"] }),
  set_secret_key: rest("POST", "/apps/{app}/secretkeys/{name}", "Store a key you already have as one of the app's secret keys.", {
    app,
    name: keyName,
    type: z.string().min(1).describe("Key type, e.g. secret_box, sign_ed25519, hmac_sha256"),
    value_base64: z.string().min(1).describe("The key's bytes, base64"),
  }, { body: (i) => ({ type: i.type, value: bytes(undefined, i.value_base64) }) }),
  generate_secret_key: rest("POST", "/apps/{app}/secretkeys/{name}/generate", "Have Fly make a new random secret key of a type.", {
    app,
    name: keyName,
    type: z.string().min(1).describe("Key type, e.g. secret_box, sign_ed25519, hmac_sha256"),
  }, { body: ["type"] }),
  delete_secret_key: rest("DELETE", "/apps/{app}/secretkeys/{name}", "Delete one of the app's secret keys. What it encrypted can't be decrypted after.", { app, name: keyName }),
  encrypt: {
    description: "Encrypt with one of the app's secret keys. Give text or base64; the result is base64.",
    readOnly: true,
    input: z.object({ app, name: keyName, plaintext: text.describe("Text to encrypt"), plaintext_base64: base64.describe("Or bytes, base64"), associated_data_base64: base64.describe("Extra data bound to it, base64"), min_version: minVersion }),
    run: cryptoRun("encrypt", (i) => ({ plaintext: bytes(i.plaintext, i.plaintext_base64), associated_data: bytes(undefined, i.associated_data_base64) }), "ciphertext"),
  },
  decrypt: {
    description: "Decrypt with one of the app's secret keys. Give the ciphertext as base64; the result is text when readable, and base64.",
    readOnly: false,
    input: z.object({ app, name: keyName, ciphertext_base64: z.string().min(1).describe("What fly.encrypt returned, base64"), associated_data_base64: base64.describe("The extra data it was bound to, base64"), min_version: minVersion }),
    run: cryptoRun("decrypt", (i) => ({ ciphertext: bytes(undefined, i.ciphertext_base64), associated_data: bytes(undefined, i.associated_data_base64) }), "plaintext"),
  },
  sign: {
    description: "Sign a message with one of the app's signing keys; the signature is base64.",
    readOnly: false,
    input: z.object({ app, name: keyName, plaintext: text.describe("Text to sign"), plaintext_base64: base64.describe("Or bytes, base64"), min_version: minVersion }),
    run: cryptoRun("sign", (i) => ({ plaintext: bytes(i.plaintext, i.plaintext_base64) }), "signature"),
  },
  verify: {
    description: "Check a signature made with one of the app's signing keys.",
    readOnly: true,
    input: z.object({ app, name: keyName, plaintext: text.describe("The signed text"), plaintext_base64: base64.describe("Or bytes, base64"), signature_base64: z.string().min(1).describe("The signature, base64"), min_version: minVersion }),
    run: (i, key) =>
      http(key, "POST", `${MACHINES}/apps/${encodeURIComponent(i.app)}/secretkeys/${encodeURIComponent(i.name)}/verify`, { min_version: i.min_version }, {
        plaintext: bytes(i.plaintext, i.plaintext_base64),
        signature: bytes(undefined, i.signature_base64),
      }),
  },

  // ── across an organization, and the platform
  list_org_machines: rest("GET", "/orgs/{org_slug}/machines", "Every machine in an organization, across all its apps.", {
    org_slug: org,
    state: states,
    region: region.optional().describe("Only this region"),
    summary: z.boolean().default(true).describe("Leave out config (default true)"),
    include_deleted: z.boolean().optional(),
    updated_after: updatedAfter,
    limit: limit(1000),
    cursor,
  }, { query: ["state", "region", "summary", "include_deleted", "updated_after", "limit", "cursor"] }),
  list_org_volumes: rest("GET", "/orgs/{org_slug}/volumes", "Every volume in an organization, across all its apps.", {
    org_slug: org,
    state: z.string().optional().describe("Only these states, comma separated"),
    region: region.optional().describe("Only this region"),
    summary: z.boolean().optional(),
    include_deleted: z.boolean().optional(),
    updated_after: updatedAfter,
    limit: limit(1000),
    cursor,
  }, { query: ["state", "region", "summary", "include_deleted", "updated_after", "limit", "cursor"] }),
  get_regions: rest("GET", "/platform/regions", "Fly's regions: code, city, whether a paid plan is needed, and current capacity.", {}),
  get_placements: rest("POST", "/platform/placements", "Which regions have room for machines of a size (and a volume), to choose where to run.", {
    org_slug: org,
    region: z.string().optional().describe('Regions to consider, comma separated, e.g. "bom,sin" or "any"'),
    count: z.number().int().min(0).optional().describe("How many machines (0: the organization's limit per region)"),
    compute: guest.optional(),
    volume_name: z.string().optional(),
    volume_size_bytes: z.number().int().optional(),
    weights: z.record(z.string(), z.number()).optional().describe("Override placement preferences"),
  }, { body: ["org_slug", "region", "count", "compute", "volume_name", "volume_size_bytes", "weights"], readOnly: true }),
  current_token: rest("GET", "/tokens/current", "What the connected token can reach: its organizations and apps.", {}),
};
