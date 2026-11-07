// Stored files live in a folder on this machine (FILE_DIR). Links to them are signed, short-lived addresses on this
// server, so the app doesn't need a separate file service.
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { FastifyInstance } from "fastify";

const ROOT = resolve(process.env.FILE_DIR ?? "./data/files");
const LINK_MS = 600_000;

// keys come from our own paths, but a stray ".." must never read outside the folder
function pathOf(key: string) {
  const path = resolve(join(ROOT, key));
  if (!path.startsWith(`${ROOT}/`)) throw new Error("bad file key");
  return path;
}

// every stored file's key starts with this
export const keyPrefix: string = "employee0/";
export const readKey = (key: string) => Bun.file(pathOf(key)).bytes();
export const sizeOfKey = async (key: string) => (await stat(pathOf(key))).size;
export const removeKey = (key: string) => rm(pathOf(key), { force: true });
export async function writeKey(key: string, body: Uint8Array, _type: string) {
  await mkdir(dirname(pathOf(key)), { recursive: true });
  await Bun.write(pathOf(key), body);
}

const signature = (key: string, expires: string, name: string) =>
  createHmac("sha256", process.env.ENCRYPTION_KEY!).update(`file:${key}\n${expires}\n${name}`).digest("base64url");

// relative when no address is set: the browser stays on this server's own address
export function linkToKey(key: string, download?: string) {
  const expires = String(Date.now() + LINK_MS);
  const name = download ?? "";
  return `${process.env.PUBLIC_API_URL ?? ""}/stored?${new URLSearchParams({ key, expires, name, sig: signature(key, expires, name) })}`;
}

export async function storageRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { key?: string; expires?: string; name?: string; sig?: string } }>("/stored", async (req, reply) => {
    const { key = "", expires = "", name = "", sig = "" } = req.query;
    const want = Buffer.from(signature(key, expires, name));
    const given = Buffer.from(sig);
    if (given.length !== want.length || !timingSafeEqual(given, want) || Number(expires) < Date.now()) return reply.code(403).send({ error: "This link has expired." });
    const file = Bun.file(pathOf(key));
    if (!(await file.exists())) return reply.code(404).send({ error: "Not found" });
    if (name) reply.header("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
    // the same as a bucket would: never run a stored page on this server's own address
    return reply
      .header("x-content-type-options", "nosniff")
      .header("content-security-policy", "sandbox")
      .type(file.type || "application/octet-stream")
      .send(Buffer.from(await file.arrayBuffer()));
  });
}
