-- close spellings for emplio search (search.ts similarWords)
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TABLE "action_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid,
	"connection_id" uuid,
	"action" text NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"ok" boolean NOT NULL,
	"error" text,
	"ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"conversation_id" uuid,
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"automation_id" uuid,
	"name" text NOT NULL,
	"reason" text NOT NULL,
	"conversation_id" uuid,
	"status" text DEFAULT 'running' NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sha" text NOT NULL,
	"user_id" uuid,
	"when" text NOT NULL,
	"trigger" text,
	"trigger_config" jsonb,
	"schedule" text,
	"timezone" text,
	"enabled" boolean NOT NULL,
	"prompt" text NOT NULL,
	"agent" text,
	"actions" text[] DEFAULT '{}' NOT NULL,
	"allowed" text[] DEFAULT '{}' NOT NULL,
	"account" text,
	"error" text,
	"provider" text,
	"external_id" text,
	"next_run_at" timestamp with time zone,
	"poll_state" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_links" (
	"channel" text NOT NULL,
	"address" text NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"conversation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_links_channel_address_pk" PRIMARY KEY("channel","address")
);
--> statement-breakpoint
CREATE TABLE "chat_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"conversation_id" uuid,
	"user_id" uuid,
	"text" text NOT NULL,
	"urgent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"app" text NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"label" text,
	"secret" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"summary_upto" text,
	"context_tokens" integer,
	"unread" boolean DEFAULT false NOT NULL,
	"read_due_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"channel" text DEFAULT 'web' NOT NULL,
	"wrote_from" text DEFAULT 'web' NOT NULL,
	"kind" text DEFAULT 'chat' NOT NULL,
	"archived_at" timestamp with time zone,
	"head_id" text,
	"plan" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "db_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"conversation_id" uuid,
	"kind" text NOT NULL,
	"sql" text NOT NULL,
	"ok" boolean NOT NULL,
	"error" text,
	"rows" integer,
	"ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_index" (
	"workspace_id" uuid NOT NULL,
	"repo" text NOT NULL,
	"path" text NOT NULL,
	"sha" text NOT NULL,
	"text" text NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', translate(path, '/._-', '    ') || ' ' || text)) STORED,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_index_workspace_id_repo_path_pk" PRIMARY KEY("workspace_id","repo","path")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"parent_id" uuid,
	"depth" integer DEFAULT 1 NOT NULL,
	"chat_id" uuid,
	"name" text NOT NULL,
	"agent" text,
	"level" text,
	"status" text DEFAULT 'working' NOT NULL,
	"summary" text,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"report" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"opened_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "login_codes" (
	"email" text PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"tries" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"site" text NOT NULL,
	"username" text,
	"fields" text[] DEFAULT '{}' NOT NULL,
	"value" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "made_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"conversation_id" uuid,
	"name" text NOT NULL,
	"media_type" text NOT NULL,
	"url" text NOT NULL,
	"size" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"source" text DEFAULT 'made' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"preview_url" text,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', translate(name, '/._-', '    ') || ' ' || text)) STORED,
	"share_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "made_files_shareToken_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "mcp_auth" (
	"server_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"data" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_auth_server_id_user_id_pk" PRIMARY KEY("server_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "mcp_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"headers" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"parts" jsonb NOT NULL,
	"parent_id" text,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', regexp_replace(jsonb_path_query_array(parts, '$[*] ? (@.type == "text").text')::text || ' ' || jsonb_path_query_array(parts, '$[*].input.command')::text || ' ' || jsonb_path_query_array(parts, '$[*].output.output')::text, '\\[nrt"]', ' ', 'g'))) STORED
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_calls" (
	"workspace_id" uuid NOT NULL,
	"site" text NOT NULL,
	"host" text NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"op" text DEFAULT '' NOT NULL,
	"query" text DEFAULT '' NOT NULL,
	"sends" text DEFAULT '' NOT NULL,
	"returns" text DEFAULT '' NOT NULL,
	"keys" jsonb,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_calls_workspace_id_host_method_path_op_pk" PRIMARY KEY("workspace_id","host","method","path","op")
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"workspace_id" uuid NOT NULL,
	"repo" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"sha" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skills_workspace_id_repo_name_pk" PRIMARY KEY("workspace_id","repo","name")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"assignee_id" uuid,
	"requester_id" uuid,
	"status" text DEFAULT 'todo' NOT NULL,
	"waiting_on" text,
	"due_at" timestamp with time zone,
	"conversation_id" uuid,
	"work_conversation_id" uuid,
	"chased_at" timestamp with time zone,
	"chases" integer DEFAULT 0 NOT NULL,
	"escalated_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"reports_to" uuid,
	"always_allowed" text[] DEFAULT '{}' NOT NULL,
	"browser_profile_id" text,
	"browser_state" text,
	"brief_at" timestamp with time zone,
	"report_at" timestamp with time zone,
	"brief_chat_id" uuid,
	"main_chat_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"data_db" text,
	"db_access" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"heartbeat_chat_id" uuid,
	"heartbeat_at" timestamp with time zone,
	"report_at" timestamp with time zone,
	"setup_offered_at" timestamp with time zone,
	"setup_done_at" timestamp with time zone,
	"setup_skipped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "action_runs" ADD CONSTRAINT "action_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_runs" ADD CONSTRAINT "action_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_runs" ADD CONSTRAINT "action_runs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_runs" ADD CONSTRAINT "action_runs_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_links" ADD CONSTRAINT "channel_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_links" ADD CONSTRAINT "channel_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_links" ADD CONSTRAINT "channel_links_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_notes" ADD CONSTRAINT "chat_notes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_notes" ADD CONSTRAINT "chat_notes_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_notes" ADD CONSTRAINT "chat_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "db_queries" ADD CONSTRAINT "db_queries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "db_queries" ADD CONSTRAINT "db_queries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "db_queries" ADD CONSTRAINT "db_queries_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_index" ADD CONSTRAINT "file_index_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_parent_id_jobs_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_chat_id_conversations_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logins" ADD CONSTRAINT "logins_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logins" ADD CONSTRAINT "logins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "made_files" ADD CONSTRAINT "made_files_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "made_files" ADD CONSTRAINT "made_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "made_files" ADD CONSTRAINT "made_files_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_auth" ADD CONSTRAINT "mcp_auth_server_id_mcp_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."mcp_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_auth" ADD CONSTRAINT "mcp_auth_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_calls" ADD CONSTRAINT "site_calls_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_work_conversation_id_conversations_id_fk" FOREIGN KEY ("work_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_reports_to_users_id_fk" FOREIGN KEY ("reports_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_runs_workspace_id_created_at_index" ON "action_runs" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_workspace_id_created_at_index" ON "activity" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_workspace_id_user_id_created_at_index" ON "activity" USING btree ("workspace_id","user_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_kind_created_at_index" ON "activity" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "automation_runs_workspace_id_started_at_index" ON "automation_runs" USING btree ("workspace_id","started_at");--> statement-breakpoint
CREATE INDEX "automation_runs_status_started_at_index" ON "automation_runs" USING btree ("status","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "automations_workspace_id_name_index" ON "automations" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "automations_external_id_index" ON "automations" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "channel_links_user_id_index" ON "channel_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_notes_workspace_id_created_at_index" ON "chat_notes" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "connections_workspace_id_user_id_app_index" ON "connections" USING btree ("workspace_id","user_id","app");--> statement-breakpoint
CREATE INDEX "conversations_user_id_workspace_id_updated_at_index" ON "conversations" USING btree ("user_id","workspace_id","updated_at");--> statement-breakpoint
CREATE INDEX "conversations_workspace_id_updated_at_index" ON "conversations" USING btree ("workspace_id","updated_at");--> statement-breakpoint
CREATE INDEX "db_queries_workspace_id_created_at_index" ON "db_queries" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "file_index_search_index" ON "file_index" USING gin ("search");--> statement-breakpoint
CREATE INDEX "jobs_conversation_id_created_at_index" ON "jobs" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "jobs_created_at_index" ON "jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jobs_status_created_at_index" ON "jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "logins_workspace_id_user_id_name_index" ON "logins" USING btree ("workspace_id","user_id","name");--> statement-breakpoint
CREATE INDEX "made_files_workspace_id_updated_at_index" ON "made_files" USING btree ("workspace_id","updated_at");--> statement-breakpoint
CREATE INDEX "made_files_conversation_id_name_index" ON "made_files" USING btree ("conversation_id","name");--> statement-breakpoint
CREATE INDEX "made_files_search_index" ON "made_files" USING gin ("search");--> statement-breakpoint
CREATE UNIQUE INDEX "made_files_url_index" ON "made_files" USING btree ("url");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_servers_workspace_id_name_index" ON "mcp_servers" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "messages_conversation_id_created_at_index" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_search_index" ON "messages" USING gin ("search");--> statement-breakpoint
CREATE INDEX "site_calls_workspace_id_site_seen_at_index" ON "site_calls" USING btree ("workspace_id","site","seen_at");--> statement-breakpoint
CREATE INDEX "tasks_workspace_id_status_due_at_index" ON "tasks" USING btree ("workspace_id","status","due_at");--> statement-breakpoint
CREATE INDEX "users_last_active_at_created_at_index" ON "users" USING btree ("last_active_at" DESC NULLS LAST,"created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "users_name_sort_index" ON "users" USING btree ("name");--> statement-breakpoint
CREATE INDEX "users_created_at_index" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "users_email_index" ON "users" USING gin ("email" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "users_name_index" ON "users" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "users_phone_index" ON "users" USING gin ("phone" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "workspace_members_user_id_index" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspaces_last_active_at_created_at_index" ON "workspaces" USING btree ("last_active_at" DESC NULLS LAST,"created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "workspaces_name_sort_index" ON "workspaces" USING btree ("name");--> statement-breakpoint
CREATE INDEX "workspaces_created_at_index" ON "workspaces" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "workspaces_name_index" ON "workspaces" USING gin ("name" gin_trgm_ops);