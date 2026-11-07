// AI model makers as apps, on the business's own key: scripts and automations can ask a model of their
// choice for text (a second opinion, bulk drafting, classifying rows) and see what models the account has.
// Each runs straight on the maker's own API through the AI SDK; OpenRouter reaches every other maker, and also
// has every other call of its API (keys, credits, usage, embeddings, images, guardrails…), from its OpenAPI spec.
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { APICallError, generateText, type LanguageModel } from "ai";
import { z } from "zod";
import { AppsError } from "../types";
import type { OwnAction, OwnApp } from "./index";
import { specActions } from "./openapi";

type Maker = {
  app: string;
  name: string;
  logo: string;
  help: string;
  placeholder: string;
  example: string;
  model: (key: string, id: string) => LanguageModel;
  // the account's models list: the cheapest call that needs a valid key (keyUrl: when the list itself doesn't)
  models: { url: string; keyUrl?: string; headers: (key: string) => Record<string, string>; pick: (body: any) => { id: string; name?: string }[] };
  // the rest of the maker's API, beside generate and list_models
  more?: Record<string, OwnAction>;
};

// The maker's errors as ours: a rejected key marks the connection for reconnecting
async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AppsError) throw error;
    if (APICallError.isInstance(error)) {
      const bad = error.statusCode === 401 || error.statusCode === 403;
      throw new AppsError(bad ? "the key was rejected; reconnect with a working one" : error.message, bad);
    }
    throw error;
  }
}

async function get(m: Maker, url: string, key: string) {
  const res = await fetch(url, { headers: m.models.headers(key), signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!res) throw new AppsError(`couldn't reach ${m.name}; try again`);
  // Google answers a bad key with 400
  if ([400, 401, 403].includes(res.status)) throw new AppsError("that key didn't work; check it was copied whole", true);
  if (!res.ok) throw new AppsError(`${m.name} answered ${res.status}; try again`);
  return res.json();
}

async function listModels(m: Maker, key: string) {
  if (m.models.keyUrl) await get(m, m.models.keyUrl, key);
  return m.models.pick(await get(m, m.models.url, key));
}

const app = (m: Maker): OwnApp => ({
  app: m.app,
  name: m.name,
  logo: m.logo,
  keyField: { label: "API key", help: m.help, placeholder: m.placeholder },
  async check(key) {
    await listModels(m, key);
  },
  actions: {
    ...m.more,
    generate: {
      // only answers: nothing is sent or changed, so it runs without asking (it is billed to their account)
      readOnly: true,
      description: `Ask a ${m.name} model for text: a draft, a summary, a classification, an answer.`,
      input: z.object({
        model: z.string().min(1).describe(`The model's id, as list_models gives it, e.g. "${m.example}"`),
        prompt: z.string().min(1).describe("What to ask, with everything it needs to know"),
        system: z.string().optional().describe("Standing instructions: its role, tone, the format to answer in"),
        max_tokens: z.number().int().min(1).max(64_000).default(4000).describe("Longest answer, in tokens (about 3/4 of a word each; default 4000)"),
        temperature: z.number().min(0).max(2).optional().describe("0: same answer every time; higher: more varied. Some models ignore it"),
      }),
      run: (i, key) =>
        call(async () => {
          const r = await generateText({
            model: m.model(key, i.model),
            system: i.system,
            prompt: i.prompt,
            maxOutputTokens: i.max_tokens,
            temperature: i.temperature,
            abortSignal: AbortSignal.timeout(5 * 60_000),
          });
          return { text: r.text, finish_reason: r.finishReason, input_tokens: r.usage.inputTokens, output_tokens: r.usage.outputTokens };
        }),
    },
    list_models: {
      readOnly: true,
      description: `The models this ${m.name} account can use, by id (for generate).`,
      input: z.object({ search: z.string().optional().describe('Only ids or names containing this, e.g. "sonnet"') }),
      run: async (i, key) => {
        const all = await listModels(m, key);
        const term = i.search?.toLowerCase();
        return term ? all.filter((x) => `${x.id} ${x.name ?? ""}`.toLowerCase().includes(term)) : all;
      },
    },
  },
});

const bearer = (key: string) => ({ authorization: `Bearer ${key}` });

export const anthropic = app({
  app: "anthropic",
  name: "Anthropic",
  logo: "/logos/anthropic.svg",
  help: "From console.anthropic.com → API keys. Calls are billed to your Anthropic account.",
  placeholder: "sk-ant-…",
  example: "claude-sonnet-5-5",
  model: (apiKey, id) => createAnthropic({ apiKey })(id),
  models: {
    url: "https://api.anthropic.com/v1/models?limit=1000",
    headers: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01" }),
    pick: (b) => b.data.map((x: any) => ({ id: x.id, name: x.display_name })),
  },
});

export const openai = app({
  app: "openai",
  name: "OpenAI",
  logo: "/logos/openai.svg",
  help: "From platform.openai.com → API keys. Calls are billed to your OpenAI account.",
  placeholder: "sk-…",
  example: "gpt-5.6",
  model: (apiKey, id) => createOpenAI({ apiKey })(id),
  models: { url: "https://api.openai.com/v1/models", headers: bearer, pick: (b) => b.data.map((x: any) => ({ id: x.id })) },
});

export const google = app({
  app: "google",
  name: "Google AI Studio",
  logo: "/logos/googlegemini.svg",
  help: "From aistudio.google.com → Get API key. Calls are billed to your Google account.",
  placeholder: "AIza…",
  example: "gemini-3-pro",
  model: (apiKey, id) => createGoogle({ apiKey })(id),
  models: {
    url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
    headers: (key) => ({ "x-goog-api-key": key }),
    // only the ones that write text
    pick: (b) =>
      b.models
        .filter((x: any) => x.supportedGenerationMethods?.includes("generateContent"))
        .map((x: any) => ({ id: x.name.replace(/^models\//, ""), name: x.displayName })),
  },
});

export const openrouter = app({
  app: "openrouter",
  name: "OpenRouter",
  logo: "/logos/openrouter.svg",
  help: "From openrouter.ai → Keys. One key for models from every maker, billed to your OpenRouter credits.",
  placeholder: "sk-or-…",
  example: "anthropic/claude-sonnet-5.5",
  // names Emplio on the business's OpenRouter activity, as models.ts does for replies
  model: (apiKey, id) => createOpenRouter({ apiKey, appName: "Emplio", appUrl: "https://emplio.app" })(id),
  models: {
    url: "https://openrouter.ai/api/v1/models",
    // the catalogue is public, so the key is checked on its own endpoint
    keyUrl: "https://openrouter.ai/api/v1/key",
    headers: bearer,
    pick: (b) => b.data.map((x: any) => ({ id: x.id, name: x.name })),
  },
  // generated by `bun scripts/openapi-actions.ts openrouter`; openrouter/COVERAGE.md says what's left out
  more: await specActions(new URL("./openrouter/actions.json", import.meta.url), {
    name: "OpenRouter",
    base: "https://openrouter.ai/api/v1",
    tokenHelp: "openrouter.ai/settings/keys",
  }),
});
