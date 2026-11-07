// RoomService: rooms, the people in them, and messages to them; plus create_token, which signs a join token
// here without calling LiveKit.
import { z } from "zod";
import type { OwnAction } from "../index";
import { agentDispatch, attributes, identity, metadata, parseKey, room, roomAdmin, sign, twirp } from "./client";

const R = "RoomService";
const roomOf = (i: { room: string }) => roomAdmin(i.room);
const moveTo = (i: { room: string; destination_room: string }) => ({ video: { roomAdmin: true, room: i.room, destinationRoom: i.destination_room } });
const sources = z
  .array(z.enum(["CAMERA", "MICROPHONE", "SCREEN_SHARE", "SCREEN_SHARE_AUDIO"]))
  .describe("Which kinds of track they may publish; leave out for any");
const seconds = (what: string) => z.number().int().min(0).describe(`${what}, in seconds`);

export const roomActions: Record<string, OwnAction> = {
  create_room: twirp(R, "CreateRoom", "Make a room ahead of time with its settings (rooms are otherwise made when the first person joins). Answers with the room, including its sid.", z.object({
    name: z.string().min(1).describe("The room's name, unique in the project; people join by this name"),
    empty_timeout: seconds("How long to keep the room open if nobody joins").optional(),
    departure_timeout: seconds("How long to keep the room open after the last person leaves").optional(),
    max_participants: z.number().int().min(0).optional().describe("Most people allowed in at once (0 = no limit)"),
    metadata: metadata.optional(),
    tags: attributes.optional().describe("Key/value labels for finding the room later"),
    room_preset: z.string().optional().describe("Cloud only: a room configuration preset's name, made in the LiveKit dashboard"),
    agents: z.array(agentDispatch).optional().describe("Agents to send into the room as soon as it starts"),
    egress: z.record(z.string(), z.any()).optional().describe("Record automatically: {room: <like start_room_composite_egress>, participant: {...}, tracks: {filepath, s3|gcp|azure}}"),
    min_playout_delay: z.number().int().optional().describe("Smallest playback delay for listeners, in milliseconds"),
    max_playout_delay: z.number().int().optional().describe("Largest playback delay for listeners, in milliseconds"),
    sync_streams: z.boolean().optional().describe("Keep audio and video tightly in sync (useful with a playout delay over 200 ms)"),
  }).loose(), { video: { roomCreate: true } }),
  list_rooms: twirp(R, "ListRooms", "The rooms open right now: name, sid, how many people, metadata, when made.", z.object({
    names: z.array(z.string()).optional().describe("Only these rooms, by name; leave out for all"),
  }), { video: { roomList: true } }, { readOnly: true }),
  delete_room: twirp(R, "DeleteRoom", "Close a room: everyone in it is disconnected at once.", z.object({ room }), { video: { roomCreate: true } }),
  update_room_metadata: twirp(R, "UpdateRoomMetadata", "Replace a room's metadata; everyone in the room is told.", z.object({ room, metadata }), roomOf),
  list_participants: twirp(R, "ListParticipants", "The people (and agents, recorders, phone callers) in a room: identity, name, state, their tracks, metadata, attributes.", z.object({ room }), roomOf, { readOnly: true }),
  get_participant: twirp(R, "GetParticipant", "One participant in a room, with their tracks and permissions.", z.object({ room, identity }), roomOf, { readOnly: true }),
  remove_participant: twirp(R, "RemoveParticipant", "Kick someone out of a room. Their current token stops working, so they can't rejoin with it.", z.object({
    room,
    identity,
    revoke_token_ts: z.number().int().optional().describe("Tokens issued before this Unix time (seconds) stop working; default: now plus a minute"),
  }), roomOf),
  mute_published_track: twirp(R, "MutePublishedTrack", "Mute or unmute one of a participant's tracks (their mic or camera).", z.object({
    room,
    identity,
    track_sid: z.string().min(1).describe("The track's sid, e.g. TR_abc (livekit.get_participant lists a participant's tracks)"),
    muted: z.boolean().describe("true mutes, false unmutes"),
  }), roomOf),
  update_participant: twirp(R, "UpdateParticipant", "Change a participant's name, metadata, attributes or permissions while they're in the room.", z.object({
    room,
    identity,
    name: z.string().optional().describe("New display name"),
    metadata: metadata.optional(),
    attributes: attributes.optional().describe('Attributes to set; only the keys given change, and "" deletes a key'),
    permission: z.object({
      can_subscribe: z.boolean().optional().describe("May hear/see others"),
      can_publish: z.boolean().optional().describe("May send audio/video"),
      can_publish_data: z.boolean().optional().describe("May send data messages"),
      can_publish_sources: sources.optional(),
      hidden: z.boolean().optional().describe("Invisible to the others"),
      can_update_metadata: z.boolean().optional().describe("May change their own name, metadata and attributes"),
      can_subscribe_metrics: z.boolean().optional(),
    }).loose().optional().describe("New permissions; this replaces all of them, so give every one that should be true"),
  }), roomOf),
  update_subscriptions: twirp(R, "UpdateSubscriptions", "Make a participant start or stop receiving certain tracks.", z.object({
    room,
    identity,
    track_sids: z.array(z.string()).optional().describe("The tracks' sids (from livekit.list_participants)"),
    participant_tracks: z.array(z.object({ participant_sid: z.string(), track_sids: z.array(z.string()) })).optional().describe("Or tracks grouped by whose they are"),
    subscribe: z.boolean().describe("true to start receiving them, false to stop"),
  }), roomOf),
  send_data: twirp(R, "SendData", "Send a data message to everyone in a room (or some of them); apps in the room get it as a data packet.", z.object({
    room,
    data: z.string().describe("The message text (sent as bytes)"),
    kind: z.enum(["RELIABLE", "LOSSY"]).optional().describe("RELIABLE (the default) is delivered in order, LOSSY may drop for speed"),
    destination_identities: z.array(z.string()).optional().describe("Only to these participants; leave out for everyone"),
    topic: z.string().optional().describe("A topic the receiving apps filter on, e.g. chat"),
  }), roomOf, { body: (i) => ({ ...i, data: Buffer.from(i.data).toString("base64") }) }),
  forward_participant: twirp(R, "ForwardParticipant", "Also put a participant into another room: they stay in this one and appear in the other too (Cloud only).", z.object({
    room,
    identity,
    destination_room: z.string().min(1).describe("The room to also put them in"),
  }), moveTo),
  move_participant: twirp(R, "MoveParticipant", "Move a participant to another room without them reconnecting (Cloud only).", z.object({
    room,
    identity,
    destination_room: z.string().min(1).describe("The room to move them to"),
  }), moveTo),
  perform_rpc: twirp(R, "PerformRpc", "Call a method an app or agent in the room registered (an RPC), and get its answer.", z.object({
    room,
    destination_identity: z.string().min(1).describe("Whose method to call: the participant's identity"),
    method: z.string().min(1).describe("The method's name, as the app registered it"),
    payload: z.string().describe("What to send it, usually JSON text"),
    response_timeout_ms: z.number().int().optional().describe("How long to wait for the answer, in milliseconds (default 15000)"),
  }), roomOf),

  create_token: {
    description:
      "Make a join token so someone (or a device) can enter a room, signed here without calling LiveKit. RETURNS A SECRET: anyone holding the token can join " +
      "as that identity until it expires, so share it only with that person. Also gives join_link, a ready link to LiveKit's hosted meeting page.",
    input: z.object({
      identity: z.string().min(1).describe("Who they'll be in the room: a unique id, e.g. their user id or phone number"),
      room: z.string().min(1).describe("The room they may join (made when the first person joins)"),
      name: z.string().optional().describe("Their display name"),
      ttl: z.number().int().min(60).max(30 * 86400).default(6 * 3600).describe("How long the token works, in seconds (default 6 hours, at most 30 days)"),
      metadata: metadata.optional(),
      attributes: attributes.optional(),
      can_publish: z.boolean().optional().describe("May send audio/video (default yes)"),
      can_subscribe: z.boolean().optional().describe("May hear/see others (default yes)"),
      can_publish_data: z.boolean().optional().describe("May send data/chat messages (default yes)"),
      can_publish_sources: sources.optional(),
      can_update_own_metadata: z.boolean().optional().describe("May change their own name, metadata and attributes"),
      hidden: z.boolean().optional().describe("Invisible to the others in the room"),
      room_admin: z.boolean().optional().describe("Also lets them manage this room (kick, mute others); rarely wanted"),
      agents: z.array(agentDispatch).optional().describe("Agents to send into the room when they join (if the room isn't already open)"),
    }),
    async run(i, key) {
      const p = parseKey(key);
      const video = Object.fromEntries(
        Object.entries({
          roomJoin: true,
          room: i.room,
          roomAdmin: i.room_admin,
          canPublish: i.can_publish,
          canSubscribe: i.can_subscribe,
          canPublishData: i.can_publish_data,
          canPublishSources: i.can_publish_sources?.map((s: string) => s.toLowerCase()),
          canUpdateOwnMetadata: i.can_update_own_metadata,
          hidden: i.hidden,
        }).filter(([, v]) => v !== undefined),
      );
      const claims = {
        sub: i.identity,
        video,
        ...(i.name && { name: i.name }),
        ...(i.metadata && { metadata: i.metadata }),
        ...(i.attributes && { attributes: i.attributes }),
        ...(i.agents && { roomConfig: { agents: i.agents } }),
      };
      const token = sign(p, claims, i.ttl);
      return {
        token,
        url: p.url,
        identity: i.identity,
        room: i.room,
        expires_at: new Date(Date.now() + i.ttl * 1000).toISOString(),
        join_link: `https://meet.livekit.io/custom?liveKitUrl=${encodeURIComponent(p.url)}&token=${token}`,
      };
    },
  },
};
