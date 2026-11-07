// MSG91 on the business's own Auth Key: every call in MSG91's API docs (docs.msg91.com) across SMS, OTP,
// WhatsApp, email, voice, RCS, Segmento contacts, campaigns, OneAPI and the Hello help desk. COVERAGE.md lists what's where.
import type { OwnApp } from "../index";
import { call } from "../openapi";
import { campaignActions } from "./campaigns";
import { CONTROL } from "./client";
import { emailActions } from "./email";
import { helloActions } from "./hello";
import { otpActions } from "./otp";
import { rcsActions } from "./rcs";
import { segmentoActions } from "./segmento";
import { smsActions } from "./sms";
import { voiceActions } from "./voice";
import { whatsappActions } from "./whatsapp";

export const msg91: OwnApp = {
  app: "msg91",
  name: "MSG91",
  logo: "/logos/msg91.svg",
  keyField: {
    label: "Auth Key",
    help: "In MSG91 (control.msg91.com): click your name at the top right → Authkey, then copy a key (or make one).",
    placeholder: "123456AbCdEfGhIjKlMnOp12",
  },
  // today's SMS totals: free, works on every account, and a bad key gets a 401 (marked for reconnecting)
  async check(key) {
    const today = new Date().toISOString().slice(0, 10);
    await call(CONTROL, key, { method: "GET", path: "/report/analytics/p/sms", query: ["startDate", "endDate"], headers: [] }, { startDate: today, endDate: today });
  },
  actions: {
    ...smsActions,
    ...otpActions,
    ...whatsappActions,
    ...emailActions,
    ...voiceActions,
    ...rcsActions,
    ...segmentoActions,
    ...campaignActions,
    ...helloActions,
  },
};
