// Fly's managed Postgres (the Machines API's /postgres): clusters, databases, users, backups, extensions.
import { z } from "zod";
import type { OwnAction } from "../index";
import { rest } from "./client";

const cluster = z.string().min(1).describe("The Postgres cluster's id (fly.list_postgres shows them)");
const database = z.string().min(1).describe("The database's name (fly.list_postgres_databases)");
const username = z.string().min(1).describe("The database user's name (fly.list_postgres_users)");
const org = z.string().min(1).default("personal").describe("The organization's slug, or 'personal' (the default)");
const plan = z.enum(["basic", "starter", "launch", "scale", "Performance"]).describe("Size plan; fly.list_postgres_plans shows CPU, memory and price");
const role = z.enum(["schema_admin", "writer", "reader"]).describe("schema_admin: can change tables; writer: read and write rows; reader: read only");

export const postgresActions: Record<string, OwnAction> = {
  list_postgres: rest("GET", "/postgres", "The organization's managed Postgres clusters: id, name, plan, region, status.", {
    org_slug: org,
    include_deleted: z.boolean().optional(),
  }, { query: ["org_slug", "include_deleted"] }),
  list_postgres_plans: rest("GET", "/postgres/plans", "Managed Postgres plans with their CPU, memory, disk and price.", { org_slug: org }, { query: ["org_slug"] }),
  get_postgres: rest("GET", "/postgres/{cluster}", "One Postgres cluster: plan, region, status, size, connection host.", { cluster }),
  create_postgres: rest("POST", "/postgres", "Make a new managed Postgres cluster (billed by plan).", {
    org_slug: org,
    plan,
    region: z.string().min(1).describe("Region code for the primary, e.g. bom, sin, iad"),
    name: z.string().optional().describe("A name; one is made up when left out"),
    disk_size_gb: z.number().int().min(1).optional().describe("Disk in GB"),
    pg_major_version: z.enum(["16", "17"]).optional(),
    pool_mode: z.enum(["session", "transaction"]).optional().describe("Connection pooler mode (transaction suits serverless apps)"),
    postgis_enabled: z.boolean().optional().describe("Allow PostGIS (maps and locations)"),
  }, { body: ["org_slug", "plan", "region", "name", "disk_size_gb", "pg_major_version", "pool_mode", "postgis_enabled"] }),
  delete_postgres: rest("DELETE", "/postgres/{cluster}", "Delete a Postgres cluster and all its data. Can't be undone.", { cluster }),
  fork_postgres: rest("POST", "/postgres/{cluster}/fork", "Copy a cluster into a new one (e.g. to test against real data).", {
    cluster,
    name: z.string().optional().describe("Name for the copy (default: <name>-fork)"),
    plan: plan.optional().describe("Plan for the copy (default: the same)"),
  }, { body: ["name", "plan"] }),
  restore_postgres: rest("POST", "/postgres/{cluster}/restore", "Restore a backup, or the cluster as it was at a moment, into a new cluster. Give backup_id or pitr_time.", {
    cluster,
    backup_id: z.string().optional().describe("A backup's label from fly.list_postgres_backups"),
    pitr_time: z.string().optional().describe("Or a moment, RFC 3339 with offset, e.g. 2026-10-25T14:00:00+05:30"),
    name: z.string().optional().describe("Name for the restored cluster"),
  }, { body: ["backup_id", "pitr_time", "name"] }),
  attach_postgres: rest("POST", "/postgres/{cluster}/attachments", "Connect an app to a cluster: makes a user and database and sets the app's DATABASE_URL secret.", {
    cluster,
    app_name: z.string().min(1).describe("The app to connect"),
  }, { body: ["app_name"] }),
  detach_postgres: rest("DELETE", "/postgres/{cluster}/attachments/{app_name}", "Disconnect an app from a cluster, revoking its access.", {
    cluster,
    app_name: z.string().min(1).describe("The app to disconnect"),
  }),

  list_postgres_backups: rest("GET", "/postgres/{cluster}/backups", "A cluster's backups: label, type, size, when.", { cluster }),
  create_postgres_backup: rest("POST", "/postgres/{cluster}/backups", "Take a backup now.", {
    cluster,
    type: z.enum(["full", "incr", "diff"]).default("full").describe("full: everything; incr: since the last backup; diff: since the last full one"),
  }, { body: ["type"] }),

  list_postgres_databases: rest("GET", "/postgres/{cluster}/databases", "The databases in a cluster.", { cluster }),
  create_postgres_database: rest("POST", "/postgres/{cluster}/databases", "Make a new database in a cluster.", {
    cluster,
    name: z.string().min(1).max(63).describe("Letters, digits, - and _; must start and end with a letter or digit"),
  }, { body: ["name"] }),
  delete_postgres_database: rest("DELETE", "/postgres/{cluster}/databases/{database}", "Drop a database and all its tables. Can't be undone.", { cluster, database }),
  list_postgres_extensions: rest("GET", "/postgres/{cluster}/databases/{database}/extensions", "Extensions enabled in a database (pgvector, postgis…).", { cluster, database }),
  enable_postgres_extension: rest("POST", "/postgres/{cluster}/databases/{database}/extensions", "Enable an extension in a database, e.g. vector or pg_trgm.", {
    cluster,
    database,
    name: z.string().min(1).describe("The extension, e.g. vector"),
    schema: z.string().optional().describe("Schema to put it in (default: the database's)"),
    create_schema: z.boolean().optional().describe("Make that schema if it's missing"),
  }, { body: ["name", "schema", "create_schema"] }),
  disable_postgres_extension: rest("DELETE", "/postgres/{cluster}/databases/{database}/extensions/{extension}", "Disable an extension in a database.", {
    cluster,
    database,
    extension: z.string().min(1).describe("The extension's name"),
    force: z.boolean().optional().describe("Also drop what depends on it"),
  }, { query: ["force"] }),
  postgres_active_queries: rest("GET", "/postgres/{cluster}/queries/active", "Queries running right now in a database, with how long each has run.", {
    cluster,
    database: z.string().min(1).describe("The database to look at"),
  }, { query: ["database"] }),
  postgres_slow_queries: rest("GET", "/postgres/{cluster}/queries/slow", "The slowest queries lately, to find what to speed up.", {
    cluster,
    range: z.number().int().min(60).optional().describe("How far back, in seconds (e.g. 86400 for a day)"),
  }, { query: ["range"] }),

  list_postgres_users: rest("GET", "/postgres/{cluster}/users", "A cluster's database users and their roles.", { cluster }),
  create_postgres_user: rest("POST", "/postgres/{cluster}/users", "Make a database user; fly.get_postgres_credentials then gives its password.", {
    cluster,
    username: z.string().min(1).max(63).describe("Lowercase letters, digits, - and _"),
    role,
  }, { body: ["username", "role"] }),
  update_postgres_user: rest("PATCH", "/postgres/{cluster}/users/{username}", "Change a database user's role.", { cluster, username, role }, { body: ["role"] }),
  delete_postgres_user: rest("DELETE", "/postgres/{cluster}/users/{username}", "Delete a database user.", { cluster, username }),
  get_postgres_credentials: rest("GET", "/postgres/{cluster}/users/{username}/credentials", "A database user's password and connection string. Only when the person needs it; never paste it in a chat.", {
    cluster,
    username,
  }, { readOnly: false }),
  rotate_postgres_password: rest("POST", "/postgres/{cluster}/users/{username}/rotate_password", "Give a database user a new password (apps using the old one stop connecting).", {
    cluster,
    username,
    kill_sessions: z.boolean().optional().describe("Also drop its open connections now"),
  }, { body: ["kill_sessions"] }),
};
