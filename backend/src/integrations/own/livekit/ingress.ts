// Ingress: bringing an outside stream into a room, from OBS or a streaming app (RTMP), a browser (WHIP), or a
// media file / HLS URL LiveKit pulls. All of it needs the ingressAdmin grant.
import { z } from "zod";
import type { OwnAction } from "../index";
import { pageToken, twirp } from "./client";

const I = "Ingress";
const admin = { video: { ingressAdmin: true } };
const ingressId = z.string().min(1).describe("The ingress's id, IN_… (livekit.list_ingress shows them)");
const media = z.record(z.string(), z.any()).describe("Advanced: {name, source: CAMERA|MICROPHONE|SCREEN_SHARE, preset: <encoding preset>}; leave out for sensible defaults");
const fields = {
  name: z.string().optional().describe("A label for it, e.g. Sunday stream"),
  room_name: z.string().optional().describe("The room the stream appears in"),
  participant_identity: z.string().optional().describe("Who the stream shows up as in the room (an identity)"),
  participant_name: z.string().optional().describe("That participant's display name"),
  participant_metadata: z.string().optional().describe("That participant's metadata"),
  enable_transcoding: z.boolean().optional().describe("Re-encode the stream for every viewer's connection (WHIP defaults to off, others on)"),
  enabled: z.boolean().optional().describe("false refuses new connections to it (default true)"),
  audio: media.optional(),
  video: media.optional(),
};

export const ingressActions: Record<string, OwnAction> = {
  create_ingress: twirp(I, "CreateIngress", "Make an ingress. For RTMP_INPUT and WHIP_INPUT it answers with url and stream_key to put in OBS (or the streaming app); for URL_INPUT LiveKit starts pulling the url at once.", z.object({
    input_type: z.enum(["RTMP_INPUT", "WHIP_INPUT", "URL_INPUT"]).describe("RTMP_INPUT for OBS and most streaming apps, WHIP_INPUT for browsers/WebRTC, URL_INPUT to pull a media file or HLS link"),
    url: z.string().optional().describe("URL_INPUT only: the http(s) media file or HLS playlist to pull"),
    ...fields,
  }).loose(), admin),
  update_ingress: twirp(I, "UpdateIngress", "Change an ingress's room, participant or settings; only works while it isn't streaming.", z.object({ ingress_id: ingressId, ...fields }).loose(), admin),
  list_ingress: twirp(I, "ListIngress", "The ingresses: id, type, url, stream_key, room, and whether they're streaming now.", z.object({
    room_name: z.string().optional().describe("Only this room's"),
    ingress_id: z.string().optional().describe("Only this one"),
    page_token: pageToken.optional(),
  }), admin, { readOnly: true }),
  delete_ingress: twirp(I, "DeleteIngress", "Delete an ingress; its stream key stops working.", z.object({ ingress_id: ingressId }), admin),
};
