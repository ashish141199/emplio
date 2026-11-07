// Fly.io on the business's own token: every Machines API call, plus what only Fly's GraphQL API has
// (organizations, billing, deploys, add-ons, alerts), logs, and raw GraphQL. COVERAGE.md lists what's where.
import type { OwnApp } from "../index";
import { accountActions } from "./account";
import { http, MACHINES } from "./client";
import { machineActions } from "./machines";
import { postgresActions } from "./postgres";

export const fly: OwnApp = {
  app: "fly",
  name: "Fly.io",
  logo: "/logos/fly.svg",
  keyField: {
    label: "API token",
    help: "In a terminal: fly tokens create org (or fly.io/dashboard → Tokens). Paste the whole line, including FlyV1.",
    placeholder: "FlyV1 fm2_…",
  },
  // a dead token gets a 401 here, which marks the connection for reconnecting
  async check(key) {
    await http(key, "GET", `${MACHINES}/tokens/current`);
  },
  actions: { ...machineActions, ...postgresActions, ...accountActions },
};
