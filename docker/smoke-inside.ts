// Run inside the app container by smoke.sh: a real computer and a real browser, through the runner.
import { createBox, findBoxes, wakeBox } from "../backend/src/computer";
import { hostedDownloads, listHosted, startHosted, stopHosted } from "../backend/src/browser-host";

const expect = (ok: unknown, what: string) => {
  if (!ok) throw new Error(`failed: ${what}`);
  console.log(`ok: ${what}`);
};
const person = { employee0User: crypto.randomUUID(), employee0Workspace: crypto.randomUUID() };
const box = await createBox(person, 60_000);
const run = (command: string, timeoutMs = 30_000) => box.run(command, { cwd: "/", timeoutMs });

expect((await run("echo hello")).result.trim() === "hello", "runs a command");
expect((await run("exit 3")).exitCode === 3, "reports the exit code");
expect((await run("sleep 30", 1000)).exitCode === 124, "times a command out");
expect((await box.run("echo $SOME_VALUE", { cwd: "/", env: { SOME_VALUE: "kept" }, timeoutMs: 5000 })).result.trim() === "kept", "passes environment");
expect((await run("sudo mkdir -p /work && sudo chown $(id -un) /work && echo done")).result.includes("done"), "sudo works, for setup");
await box.write("/work/a/b.txt", "contents");
expect((await box.readText("/work/a/b.txt")) === "contents", "writes and reads a file");
await box.remove("/work/a/b.txt");
await box.read("/work/a/b.txt").then(() => expect(false, "removes a file"), () => expect(true, "removes a file"));
expect((await run("command -v libreoffice pdftotext git python3 node ~/.local/bin/agent-browser | wc -l")).result.trim() === "6" || (await run("~/.local/bin/agent-browser --version")).exitCode === 0, "has its tools");
expect((await run("curl -s --max-time 3 -o /dev/null -w '%{http_code}' http://postgres:5432; echo; getent hosts postgres gitea runner | wc -l")).result.trim().endsWith("0"), "can't find Postgres, Gitea or the runner");
expect((await run("curl -fsS --max-time 10 -o /dev/null https://example.com && echo up")).result.includes("up"), "reaches the internet");

const found = await findBoxes(person);
expect(found.length === 1 && found[0]!.id === box.id && !found[0]!.asleep, "finds it, awake");

const owner = { workspaceId: person.employee0Workspace, userId: person.employee0User };
const chat = crypto.randomUUID();
const browser = await startHosted(chat, owner);
const version = await (await fetch(`${browser.cdpUrl}/json/version`)).json() as { webSocketDebuggerUrl: string };
expect(version.webSocketDebuggerUrl, "this server reaches its browser");
expect((await run(`curl -fsS --max-time 5 ${browser.cdpUrl}/json/version`)).exitCode === 0, "the person's computer reaches their browser");
expect((await listHosted(chat)).length === 1, "lists the chat's browser");
expect(Array.isArray(await hostedDownloads(browser.id)), "lists downloads");

const stranger = await createBox({ employee0User: crypto.randomUUID(), employee0Workspace: person.employee0Workspace }, 60_000);
const across = await stranger.run(`curl -sS --max-time 5 ${browser.cdpUrl}/json/version`, { cwd: "/", timeoutMs: 15_000 });
expect(across.exitCode !== 0, "someone else's computer can't reach this browser");
const metadata = await run("curl -sS --max-time 3 -o /dev/null http://169.254.169.254/latest/meta-data/");
expect(metadata.exitCode !== 0, "a computer can't reach the cloud's metadata address");
await stranger.kill();

await stopHosted(browser.id);
expect((await listHosted(chat)).length === 0, "stops the browser");

// sleeps, and comes back with its files
await run("echo kept > /work/kept.txt");
await box.keepAwake(1000);
await Bun.sleep(6000);
expect((await findBoxes(person))[0]!.asleep, "goes to sleep");
await box.keepAwake(60_000).then(() => expect(false, "refuses while asleep"), () => expect(true, "refuses while asleep"));
const woken = await wakeBox(box.id, 60_000);
expect((await woken.readText("/work/kept.txt")).trim() === "kept", "wakes with its files");
await woken.kill();
expect((await findBoxes(person)).length === 0, "removes it");
process.exit(0);
