import { afterEach, expect, test } from "bun:test";
import { AppsError } from "../../types";
import { own } from "../index";
import { hostinger } from "./index";

type Call = { method: string; url: URL; headers: Record<string, string>; body: any };
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

// records every request and answers with reply(call); anything unanswered is a test bug, not a trip to Hostinger
function stub(reply: (c: Call) => Response | undefined) {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const c = { method: init.method!, url: new URL(url), headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(c);
    const r = reply(c);
    if (!r) throw new Error(`unexpected ${c.method} ${c.url}`);
    return r;
  }) as typeof fetch;
  return calls;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const run = (action: string, input: unknown) => own.run(`hostinger.${action}`, input, { externalId: "", secret: "tok" }, "owner");
const fails = (p: Promise<unknown>) =>
  p.then(
    () => {
      throw new Error("expected it to fail");
    },
    (e: AppsError) => e,
  );

test("a call with no body sends none, with the token as a bearer", async () => {
  const calls = stub(() => json({ id: 7 }));
  await run("vps_create_snapshot", { virtualMachineId: 42 });
  expect(calls[0]!.method).toBe("POST");
  expect(calls[0]!.url.href).toBe("https://developers.hostinger.com/api/vps/v1/virtual-machines/42/snapshot");
  expect(calls[0]!.headers.Authorization).toBe("Bearer tok");
  expect(calls[0]!.body).toBeUndefined();
});

test("body fields go in the body, the domain in the path", async () => {
  const calls = stub(() => json({ message: "ok" }));
  const zone = [{ name: "www", type: "CNAME", ttl: 300, records: [{ content: "example.com." }] }];
  await run("dns_update_dns_records", { domain: "example.com", overwrite: false, zone });
  expect(calls[0]!.method).toBe("PUT");
  expect(calls[0]!.url.pathname).toBe("/api/dns/v1/zones/example.com");
  expect(calls[0]!.body).toEqual({ overwrite: false, zone });
});

test("array filters are comma separated where the spec says so, and repeat their key otherwise", async () => {
  const calls = stub(() => json({ data: [] }));
  await run("hosting_list_websites", { website_types: ["wordpress", "nodejs"], per_page: 10 });
  expect(calls[0]!.url.searchParams.getAll("website_types")).toEqual(["wordpress,nodejs"]);
  expect(calls[0]!.url.searchParams.get("per_page")).toBe("10");
});

test("reading, buying and secrets each get the right OK", async () => {
  expect(hostinger.actions.vps_get_virtual_machines!.readOnly).toBe(true);
  expect(hostinger.actions.domains_check_domain_availability!.readOnly).toBe(true);
  expect(hostinger.actions.domains_purchase_new_domain!.readOnly).toBe(false);
  expect(hostinger.actions.vps_purchase_new_virtual_machine!.readOnly).toBe(false);
  expect(hostinger.actions.domains_get_domain_authorization_code!.readOnly).toBe(false);
  expect(hostinger.actions.hosting_get_phpmyadmin_link!.readOnly).toBe(false);
});

test("a rejected token asks for reconnecting; validation errors name the fields", async () => {
  stub(() => json({ message: "Unauthenticated.", correlation_id: "c1" }, 401));
  expect((await fails(run("vps_get_virtual_machines", {}))).expired).toBe(true);
  stub(() => json({ message: "The given data was invalid.", errors: { domain: ["The domain is not available."] } }, 422));
  const e = await fails(run("domains_purchase_new_domain", { domain: "taken.com", item_id: "x" }));
  expect(e.message).toBe("Hostinger: The given data was invalid. (domain: The domain is not available.) (422)");
  expect(e.expired).toBe(false);
});

test("bad input is refused before any request", async () => {
  const calls = stub(() => json({}));
  expect(await fails(run("vps_create_snapshot", { virtualMachineId: "not a number" }))).toBeInstanceOf(AppsError);
  expect(calls).toHaveLength(0);
});
