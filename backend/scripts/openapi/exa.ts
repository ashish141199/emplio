// Exa: what the generator (../openapi-actions.ts) can't tell from the specs (search, then websets).
import type { AppConfig } from "../openapi-actions";

const VERBS = ["create", "list", "get", "update", "delete", "cancel", "preview"];

export default {
  spec: [
    "https://raw.githubusercontent.com/exa-labs/openapi-spec/master/exa-openapi-spec.yaml",
    "https://raw.githubusercontent.com/exa-labs/openapi-spec/master/exa-websets-spec.yaml",
  ],
  out: "src/integrations/own/exa/actions.json",
  // websets-items-get → get_webset_item, monitors-runs-list → list_monitor_runs
  name: (id) => {
    const words = id.split("_");
    const verb = words.pop()!;
    if (!VERBS.includes(verb)) return id;
    const things = words.map((w) => w.replace(/(ch|sh)es$/, "$1").replace(/s$/, ""));
    if (verb === "list") things.push(things.pop()!.replace(/(ch|sh)$/, "$1e") + "s");
    return [verb, ...things].join("_");
  },
  // search, find_similar, get_contents and answer are written by hand (own/exa/index.ts) with friendlier
  // inputs; these take every option the API has
  rename: {
    search: "search_advanced",
    find_similar: "find_similar_advanced",
    get_contents: "get_contents_advanced",
    answer: "answer_advanced",
    research_controller_v0_get_research_task: "get_research_task",
  },
  reads: ["search_advanced", "find_similar_advanced", "get_contents_advanced", "answer_advanced", "preview_webset"],
} satisfies AppConfig;
