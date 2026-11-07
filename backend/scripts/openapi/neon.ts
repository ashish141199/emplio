// Neon: what the generator (../openapi-actions.ts) can't tell from the spec.
import type { AppConfig } from "../openapi-actions";

export default {
  spec: "https://neon.com/api_spec/release/v2.json",
  out: "src/integrations/own/neon/actions.json",
  // OAuth splits as o_auth
  name: (id) => id.replace(/o_auth/g, "oauth"),
  // POSTs that only read
  reads: ["query_project_branch_logs"],
  // GETs that hand back a password, a connection string with one in it, or a signing secret
  secrets: ["get_project_branch_role_password", "get_connection_uri", "get_project_branch_realtime_secret"],
} satisfies AppConfig;
