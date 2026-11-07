// The Knowledge page: the notes (.md files) in the business's git repos, to read in the app. Everyone sees the
// company's and their own; owners and admins also see restricted/. Read only: changes go through the AI employee,
// so they're made (and, for staff on company files, proposed) the way the rest of its files are.
import type { KnowledgeFolder } from "@emplio/shared";
import type { FastifyInstance } from "fastify";
import { type Ctx, context } from "./auth";
import { searchFiles } from "./file-index";
import { listPaths, readFile } from "./gitea";

const foldersFor = (ctx: Ctx): KnowledgeFolder[] => [
  { repo: "company", label: "Company", files: [] },
  ...(ctx.role !== "member" ? [{ repo: "restricted", label: "Restricted", files: [] }] : []),
  { repo: `me-${ctx.userId}`, label: "Mine", files: [] },
];

// a note's path: folders and a name of plain characters, ending in .md
const PATH = /^(?:[\w .-]+\/)*[\w .-]+\.md$/;

export async function knowledgeRoutes(app: FastifyInstance) {
  app.get("/knowledge", async (req, reply) => {
    const ctx = await context(req, reply);
    if (!ctx) return;
    return Promise.all(
      foldersFor(ctx).map(async (f): Promise<KnowledgeFolder> => ({
        ...f,
        files: (await listPaths(ctx.workspaceId, f.repo)).filter((p) => p.path.endsWith(".md")).map((p) => p.path).sort(),
      })),
    );
  });

  // notes with these words in them, best first, each once with its first matching line
  app.get<{ Querystring: { q?: string } }>("/knowledge/search", async (req, reply) => {
    const ctx = await context(req, reply);
    if (!ctx) return;
    const hits = await searchFiles(ctx.workspaceId, foldersFor(ctx).map((f) => f.repo), (req.query.q ?? "").slice(0, 100), 100);
    const seen = new Set<string>();
    return hits.filter((h) => h.path.endsWith(".md") && !seen.has(`${h.repo}/${h.path}`) && seen.add(`${h.repo}/${h.path}`)).slice(0, 30)
      .map((h) => ({ repo: h.repo, path: h.path, line: h.text.trim().slice(0, 160) }));
  });

  app.get<{ Querystring: { repo: string; path: string } }>("/knowledge/file", async (req, reply) => {
    const ctx = await context(req, reply);
    if (!ctx) return;
    const { repo, path } = req.query;
    if (!foldersFor(ctx).some((f) => f.repo === repo)) return reply.code(400).send({ error: "No such folder." });
    if (!PATH.test(path ?? "") || path.split("/").some((p) => p.trim() === "" || p.startsWith("."))) return reply.code(400).send({ error: "No such note." });
    const text = await readFile(ctx.workspaceId, repo, path);
    if (text === null) return reply.code(404).send({ error: "That note isn't there any more." });
    return { text };
  });
}
