# Fly.io coverage

Sources, swept 26 Oct 2026: the Machines API spec (https://docs.machines.dev/openapi.json, 101 operations),
the GraphQL schema (introspected from https://api.fly.io/graphql), flyctl's logs endpoint, and Composio's
Fly toolkit (45 tools) as a cross-check. n8n has no Fly node.

Every Machines API operation is an action except the five below. GraphQL is covered where it adds something
the Machines API lacks (account, members, billing, deploys, add-ons, uptime checks and alerts, WireGuard,
tokens, prices); `graphql_query` and `graphql_mutation` reach the rest of it.

## Deliberately left out

| What | Why |
| --- | --- |
| PUT /apps/{app}/machines/{id}/metadata | Deprecated alias of the PATCH that `update_metadata` uses |
| POST /tokens/authenticate, /tokens/authorize | For services checking someone else's Fly token, not for managing an account |
| POST /tokens/kms, /tokens/oidc | Only work from inside a Fly machine (they mint tokens for that machine) |
| GraphQL app-v1 mutations (scaleApp, setVmCount, setVmSize, restartApp, pauseApp, resumeApp, deployImage…) | Nomad-era apps v1, which Fly retired; machines are managed through the Machines API. Still reachable with `graphql_mutation` |
| GraphQL builds, remote builders, SSH certificates, third-party caveat configs, Heroku import | Developer tooling flyctl drives during a deploy; nothing a business owner asks for. Reachable with `graphql_mutation` |
| Events (triggers) | Fly has no webhooks for machines or deploys, and own apps have no triggers yet. Alerts go out through `set_slack_alerts` / `set_pagerduty_alerts`; an automation can poll `machine_events` or `list_releases` |
| Deploying from source | Needs a Docker build (flyctl's remote builder); `update_machine` with a new image is the deploy |

## Auth

| Method | Status |
| --- | --- |
| Organization or deploy token (`FlyV1 fm2_…`, from `fly tokens create`) | done, sent as is |
| Personal token (`fly auth token`) | done, sent as `Bearer` |
| OAuth | Fly has no public OAuth for third parties |

Values never reach the AI unless someone OKs it: `list_secrets` gives names only; `reveal_secrets`,
`get_secret` and `get_postgres_credentials` ask first.

## Actions

### Machines API (72)

| Action | Asks first | What |
| --- | --- | --- |
| list_apps |  | The apps in a Fly organization: name, status, machine count, network. |
| get_app |  | One app: its organization, status and private network. |
| create_app | yes | Make a new, empty app (machines are added with fly.create_machine). |
| delete_app | yes | Delete an app and everything in it: machines, volumes, IPs, certificates. |
| create_deploy_token | yes | A token that can only deploy this one app, for CI (e.g. |
| list_machines |  | An app's machines (its servers): id, name, region, state, image, last update. |
| get_machine |  | One machine in full: config (image, size, env, services, mounts), state, checks, recent events. |
| create_machine | yes | Start a new machine in an app from an image. |
| update_machine | yes | Change a machine's config (new image, size, env…); it restarts with it. |
| delete_machine | yes | Destroy a machine for good. |
| start_machine | yes | Start a stopped or suspended machine. |
| stop_machine | yes | Stop a running machine (start it again with fly.start_machine). |
| restart_machine | yes | Restart a machine, e.g. |
| suspend_machine | yes | Suspend a machine: freeze its memory to disk, so it resumes in a moment where it left off. |
| signal_machine | yes | Send a Unix signal to a machine's main process (e.g. |
| cordon_machine | yes | Stop sending traffic to a machine without stopping it (e.g. |
| uncordon_machine | yes | Send traffic to a cordoned machine again. |
| wait_for_machine |  | Wait (up to the timeout) until a machine reaches a state, e.g. |
| machine_events |  | What happened to a machine lately: starts, stops, crashes, exits with their codes, OOM kills. |
| list_machine_versions |  | A machine's past configs (one per update), newest first. |
| list_processes |  | The processes running inside a machine, with their CPU and memory. |
| exec | yes | Run a command inside a running machine and get its output (stdout, stderr, exit code). |
| get_machine_memory |  | A machine's memory: its limit and what's in use. |
| set_machine_memory | yes | Change a running machine's memory limit without restarting it (up to its configured size). |
| reclaim_machine_memory | yes | Ask a machine to give back unused memory. |
| get_lease |  | Who holds a machine's lease (lock) and until when. |
| create_lease | yes | Take a machine's lease (lock) so nothing else changes it meanwhile; returns a nonce. |
| release_lease | yes | Give back a machine's lease (lock). |
| get_metadata |  | A machine's metadata (labels like fly_process_group). |
| get_metadata_value |  | One metadata label's value. |
| set_metadata_value | yes | Set one metadata label on a machine. |
| update_metadata | yes | Set or remove several metadata labels at once; a label set to an empty string is removed. |
| delete_metadata_value | yes | Remove one metadata label from a machine. |
| list_volumes |  | An app's volumes (disks): id, name, size, region, which machine uses it, state. |
| get_volume |  | One volume in full. |
| create_volume | yes | Make a new volume (disk) for an app; a machine uses it through a mount in its config. |
| update_volume | yes | Change a volume's backups: daily snapshots on/off and how long they're kept. |
| extend_volume | yes | Grow a volume (it can't shrink). |
| delete_volume | yes | Destroy a volume and its data. |
| list_snapshots |  | A volume's snapshots (backups): id, size, when, status. |
| create_snapshot | yes | Take a snapshot (backup) of a volume now. |
| list_certificates |  | An app's custom domains and their HTTPS certificates: status, DNS still needed. |
| get_certificate |  | One domain's certificate: issued or not, expiry, and the DNS records to add if it isn't working. |
| add_certificate | yes | Add a custom domain to an app; Fly gets a free certificate once its DNS points at the app (fly.get_certificate says which records). |
| upload_certificate | yes | Use your own certificate for a domain instead of Fly's free one. |
| check_certificate | yes | Re-check a domain's DNS and retry its certificate, after fixing DNS. |
| delete_certificate | yes | Remove a custom domain from an app, with all its certificates. |
| delete_acme_certificate | yes | Remove only Fly's free certificate for a domain (keeps an uploaded one). |
| delete_custom_certificate | yes | Remove only the uploaded certificate for a domain (falls back to Fly's free one). |
| list_ip_addresses |  | An app's public and private IP addresses. |
| add_ip_address | yes | Give an app a new IP address. |
| remove_ip_address | yes | Release one of an app's IP addresses. |
| list_secrets |  | The names of an app's secrets and when each changed; not their values (fly.reveal_secrets). |
| reveal_secrets | yes | An app's secrets with their values. |
| get_secret | yes | One secret: when it changed, and its value only when show_value is on. |
| set_secrets | yes | Set or remove several secrets at once (one new secrets version). |
| set_secret | yes | Set one secret. |
| delete_secret | yes | Remove one secret. |
| list_secret_keys |  | An app's secret keys (encryption and signing keys Fly holds): name, type, public key. |
| get_secret_key |  | One secret key: type and public key. |
| set_secret_key | yes | Store a key you already have as one of the app's secret keys. |
| generate_secret_key | yes | Have Fly make a new random secret key of a type. |
| delete_secret_key | yes | Delete one of the app's secret keys. |
| encrypt |  | Encrypt with one of the app's secret keys. |
| decrypt | yes | Decrypt with one of the app's secret keys. |
| sign | yes | Sign a message with one of the app's signing keys; the signature is base64. |
| verify |  | Check a signature made with one of the app's signing keys. |
| list_org_machines |  | Every machine in an organization, across all its apps. |
| list_org_volumes |  | Every volume in an organization, across all its apps. |
| get_regions |  | Fly's regions: code, city, whether a paid plan is needed, and current capacity. |
| get_placements |  | Which regions have room for machines of a size (and a volume), to choose where to run. |
| current_token |  | What the connected token can reach: its organizations and apps. |

### Managed Postgres (25)

| Action | Asks first | What |
| --- | --- | --- |
| list_postgres |  | The organization's managed Postgres clusters: id, name, plan, region, status. |
| list_postgres_plans |  | Managed Postgres plans with their CPU, memory, disk and price. |
| get_postgres |  | One Postgres cluster: plan, region, status, size, connection host. |
| create_postgres | yes | Make a new managed Postgres cluster (billed by plan). |
| delete_postgres | yes | Delete a Postgres cluster and all its data. |
| fork_postgres | yes | Copy a cluster into a new one (e.g. |
| restore_postgres | yes | Restore a backup, or the cluster as it was at a moment, into a new cluster. |
| attach_postgres | yes | Connect an app to a cluster: makes a user and database and sets the app's DATABASE_URL secret. |
| detach_postgres | yes | Disconnect an app from a cluster, revoking its access. |
| list_postgres_backups |  | A cluster's backups: label, type, size, when. |
| create_postgres_backup | yes | Take a backup now. |
| list_postgres_databases |  | The databases in a cluster. |
| create_postgres_database | yes | Make a new database in a cluster. |
| delete_postgres_database | yes | Drop a database and all its tables. |
| list_postgres_extensions |  | Extensions enabled in a database (pgvector, postgis…). |
| enable_postgres_extension | yes | Enable an extension in a database, e.g. |
| disable_postgres_extension | yes | Disable an extension in a database. |
| postgres_active_queries |  | Queries running right now in a database, with how long each has run. |
| postgres_slow_queries |  | The slowest queries lately, to find what to speed up. |
| list_postgres_users |  | A cluster's database users and their roles. |
| create_postgres_user | yes | Make a database user; fly.get_postgres_credentials then gives its password. |
| update_postgres_user | yes | Change a database user's role. |
| delete_postgres_user | yes | Delete a database user. |
| get_postgres_credentials | yes | A database user's password and connection string. |
| rotate_postgres_password | yes | Give a database user a new password (apps using the old one stop connecting). |

### GraphQL, logs (41)

| Action | Asks first | What |
| --- | --- | --- |
| whoami |  | Who the connected token belongs to: name, email, and whether it's a user or an organization token. |
| list_organizations |  | The organizations this token reaches: slug, name, type, your role, plan and billing state. |
| get_organization |  | One organization: plan, billing state (current, past due…), credit balance in cents, card on file, app count, your role. |
| list_members |  | An organization's team: each person's id, name, email, role (ADMIN/MEMBER) and join date. |
| list_invitations |  | Invitations to an organization still waiting, and who sent them. |
| invite_member | yes | Invite someone to an organization by email; they get an email to join. |
| cancel_invitation | yes | Withdraw an invitation that hasn't been accepted. |
| update_member_role | yes | Make a member an admin, or an admin a member. |
| remove_member | yes | Remove someone from an organization; they lose access to all its apps. |
| app_overview |  | An app at a glance: status, whether it's deployed, its address, current release and image, regions, and whether a newer image is out. |
| list_releases |  | An app's deploys, newest first: version, status, who deployed, image, when. |
| app_health_checks |  | The state of an app's health checks (passing, warning, critical) with their latest output. |
| app_name_available |  | Whether an app name is free to use. |
| move_app | yes | Move an app to another organization (its billing moves with it). |
| get_logs |  | An app's recent log lines (all its machines, newest last): time, machine, region, level, message. |
| list_add_ons |  | Add-on services the organizations have (Upstash Redis, Tigris storage, Supabase…): name, type, status, plan, region, app. |
| get_add_on |  | One add-on: status, plan, regions, address, dashboard link, usage stats. |
| list_add_on_plans |  | Plans for add-ons (Upstash Redis and others): name, price per month, limits. |
| reset_add_on_password | yes | Give an add-on (e.g. |
| delete_add_on | yes | Delete an add-on and its data. |
| list_check_jobs |  | Uptime checks: which URLs Fly pings from around the world, how often, and when next. |
| list_check_locations |  | Places uptime checks can run from (name, city, country). |
| create_check_job | yes | Start checking a URL from several places around the world. |
| run_check_job | yes | Run an uptime check now and get its result. |
| list_alert_handlers |  | Where an organization's health-check alerts go (Slack, PagerDuty). |
| set_slack_alerts | yes | Send an organization's health-check alerts to a Slack channel. |
| set_pagerduty_alerts | yes | Send an organization's health-check alerts to PagerDuty. |
| delete_alert_handler | yes | Stop sending health-check alerts to a Slack or PagerDuty route. |
| list_wireguard_peers |  | Devices connected to an organization's private network over WireGuard: name, region, private IP. |
| add_wireguard_peer | yes | Connect a device to an organization's private network: give its WireGuard public key; get its private IP and the gateway to use. |
| remove_wireguard_peer | yes | Disconnect a device from an organization's private network. |
| list_tokens |  | An organization's limited-access tokens (deploy tokens and others): name, kind, who made it, expiry, revoked or not. |
| create_token | yes | Make a limited-access token for an organization (e.g. |
| revoke_token | yes | Revoke a limited-access token; whatever uses it stops working. |
| platform_info |  | Fly's machine sizes with prices per month, and its regions. |
| list_prices |  | Fly's price list by product (compute, volumes, bandwidth, IPs…), with tiers. |
| nearest_region |  | The Fly region closest to our server. |
| latest_image_tag |  | The newest tag of one of Fly's own images, e.g. |
| validate_config |  | Check an app config (fly.toml, as JSON) for mistakes before deploying. |
| graphql_query |  | Read anything Fly's GraphQL API has that the other actions don't (schema: https://api.fly.io/graphql). |
| graphql_mutation | yes | Change anything through Fly's GraphQL API that the other actions don't cover (schema: https://api.fly.io/graphql). |
