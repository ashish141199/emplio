# Neon coverage

Source: Neon's OpenAPI spec (https://neon.com/api_spec/release/v2.json), generated 2026-10-26 by
`bun scripts/openapi-actions.ts neon`. 178 actions: every live operation (177) plus run_sql.

## By hand (index.ts)

run_sql: looks up the connection string (get_connection_uri), then posts the query to the compute's HTTP SQL
endpoint (`https://api.<region host>/sql`, header `Neon-Connection-String`), the way Neon's serverless driver does.
One statement per call, with $1… params. Defaults to the neondb database and neondb_owner role a new project gets.

## Deliberately left out

| What | Why |
| --- | --- |
| POST /projects/auth/create (createNeonAuthIntegration) | Deprecated by Neon (the branch-level Neon Auth calls replace them) |
| GET /projects/{project_id}/auth/domains (listNeonAuthRedirectURIWhitelistDomains) | Deprecated by Neon (the branch-level Neon Auth calls replace them) |
| POST /projects/{project_id}/auth/domains (addNeonAuthDomainToRedirectURIWhitelist) | Deprecated by Neon (the branch-level Neon Auth calls replace them) |
| DELETE /projects/{project_id}/auth/domains (deleteNeonAuthDomainFromRedirectURIWhitelist) | Deprecated by Neon (the branch-level Neon Auth calls replace them) |
| POST /projects/auth/user (createNeonAuthNewUser) | Deprecated by Neon (the branch-level Neon Auth calls replace them) |
| DELETE /projects/{project_id}/auth/users/{auth_user_id} (deleteNeonAuthUser) | Deprecated by Neon (the branch-level Neon Auth calls replace them) |
| GET /projects/{project_id}/auth/integrations (listNeonAuthIntegrations) | Deprecated by Neon (the branch-level Neon Auth calls replace them) |
| GET /projects/{project_id}/auth/oauth_providers (listNeonAuthOauthProviders) | Deprecated by Neon (the branch-level Neon Auth calls replace them) |
| POST /projects/{project_id}/auth/oauth_providers (addNeonAuthOauthProvider) | Deprecated by Neon (the branch-level Neon Auth calls replace them) |
| PATCH /projects/{project_id}/auth/oauth_providers/{oauth_provider_id} (updateNeonAuthOauthProvider) | Deprecated by Neon (the branch-level Neon Auth calls replace them) |
| DELETE /projects/{project_id}/auth/oauth_providers/{oauth_provider_id} (deleteNeonAuthOauthProvider) | Deprecated by Neon (the branch-level Neon Auth calls replace them) |
| GET /projects/{project_id}/auth/email_server (getNeonAuthEmailServer) | Deprecated by Neon (the branch-level Neon Auth calls replace them) |
| PATCH /projects/{project_id}/auth/email_server (updateNeonAuthEmailServer) | Deprecated by Neon (the branch-level Neon Auth calls replace them) |
| POST /projects/{project_id}/branches/{branch_id}/auth/send_test_email (sendNeonAuthTestEmail) | Deprecated by Neon (the branch-level Neon Auth calls replace them) |
| DELETE /projects/{project_id}/auth/integration/{auth_provider} (deleteNeonAuthIntegration) | Deprecated by Neon (the branch-level Neon Auth calls replace them) |
| POST /users/me/projects/transfer (transferProjectsFromUserToOrg) | Deprecated by Neon (the branch-level Neon Auth calls replace them) |
| Multi-statement transactions in run_sql | One statement per call covers it; Neon's batch mode is the upgrade |
| Events (triggers) | Own apps have no triggers yet |
| OAuth | Neon's OAuth is for partners; API keys (personal, organization or project) are what a business has |

Secrets (ask first, never pasted in chat): get_project_branch_role_password, get_connection_uri,
get_project_branch_realtime_secret. Not verified against the live API: no Neon key.
