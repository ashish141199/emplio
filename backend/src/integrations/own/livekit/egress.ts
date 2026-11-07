// Egress: recording a room, a web page, a person or a track to a file, a live stream (RTMP/SRT), HLS segments
// or images, and the controls of a running one. All of it needs the roomRecord grant.
import { z } from "zod";
import type { OwnAction } from "../index";
import { pageToken, twirp } from "./client";

const E = "Egress";
const rec = { video: { roomRecord: true } };
const egressId = z.string().min(1).describe("The egress's id, EG_… (the start_* actions answer with it; livekit.list_egress shows them)");
const roomName = z.string().min(1).describe("The room's name (livekit.list_rooms shows them)");

const storage =
  "Where the file goes: one of s3 {access_key, secret, region, bucket, endpoint (for S3-compatible stores like R2), force_path_style}, " +
  "gcp {credentials (the service account JSON as text), bucket}, azure {account_name, account_key, container_name}, aliOSS {access_key, secret, region, endpoint, bucket}. " +
  "Leave out on LiveKit Cloud to keep it in LiveKit's storage.";
const file = z.object({
  filepath: z.string().optional().describe("The file's path in the bucket; may use {room_name}, {time}, {room_id}, e.g. recordings/{room_name}-{time}.mp4"),
  file_type: z.enum(["DEFAULT_FILETYPE", "MP4", "OGG", "MP3"]).optional().describe("MP4 for video, OGG or MP3 for audio only; default picks from the codecs"),
  disable_manifest: z.boolean().optional().describe("Don't also upload the JSON manifest"),
}).loose().describe(`A file: {filepath, file_type}, plus storage. ${storage}`);
const stream = z.object({
  protocol: z.enum(["DEFAULT_PROTOCOL", "RTMP", "SRT", "WEBSOCKET"]).optional().describe("Default picks from the URLs"),
  urls: z.array(z.string()).describe("Where to stream, e.g. rtmps://a.rtmp.youtube.com/live2/<stream key>"),
}).loose().describe("A live stream to one or more RTMP/SRT URLs");
const segments = z.object({
  filename_prefix: z.string().optional().describe("Path prefix for the segment files"),
  playlist_name: z.string().optional().describe("The playlist file, e.g. index.m3u8"),
  live_playlist_name: z.string().optional().describe("Also keep a live playlist of the last few segments"),
  segment_duration: z.number().int().optional().describe("Length of each segment, in seconds (default 4)"),
  protocol: z.enum(["DEFAULT_SEGMENTED_FILE_PROTOCOL", "HLS_PROTOCOL", "HLS_FMP4_PROTOCOL"]).optional(),
}).loose().describe(`HLS: a playlist and its segment files, plus storage. ${storage}`);
const images = z.object({
  capture_interval: z.number().int().min(1).describe("Take an image every this many seconds"),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  filename_prefix: z.string().optional(),
  image_codec: z.enum(["IC_DEFAULT", "IC_JPEG"]).optional(),
}).loose().describe(`Still images (thumbnails) at an interval, plus storage. ${storage}`);
const preset = z
  .enum(["H264_720P_30", "H264_720P_60", "H264_1080P_30", "H264_1080P_60", "PORTRAIT_H264_720P_30", "PORTRAIT_H264_720P_60", "PORTRAIT_H264_1080P_30", "PORTRAIT_H264_1080P_60"])
  .describe("Video size and frame rate (default H264_720P_30); PORTRAIT_ ones are vertical, for phones");
const advanced = z.record(z.string(), z.any()).describe("Exact encoding instead of a preset: {width, height, framerate, video_codec, video_bitrate (kbps), audio_codec, audio_bitrate, key_frame_interval}");
const webhooks = z.array(z.object({ url: z.string(), signing_key: z.string().optional() })).describe("Extra URLs told when this egress starts and ends");
// the outputs every v1 start_* request takes; at least one is needed
const outputs = {
  file_outputs: z.array(file).optional().describe("Save to files (MP4/OGG/MP3)"),
  stream_outputs: z.array(stream).optional().describe("Stream live to RTMP/SRT URLs, e.g. YouTube or Facebook Live"),
  segment_outputs: z.array(segments).optional().describe("Save as HLS (a playlist and segments), for playback on the web"),
  image_outputs: z.array(images).optional().describe("Save still images at an interval"),
  preset: preset.optional(),
  advanced: advanced.optional(),
  webhooks: webhooks.optional(),
};
const outputsNote = " Give at least one of file_outputs, stream_outputs, segment_outputs, image_outputs. Answers with the egress (its egress_id and status).";

export const egressActions: Record<string, OwnAction> = {
  start_room_composite_egress: twirp(E, "StartRoomCompositeEgress", "Record (or live stream) a whole room as one video, laid out like a meeting." + outputsNote, z.object({
    room_name: roomName,
    layout: z.string().optional().describe("grid (default), speaker, or single-speaker; append -light for a light background, e.g. grid-light"),
    audio_only: z.boolean().optional().describe("Record sound only"),
    video_only: z.boolean().optional().describe("Record picture only"),
    audio_mixing: z.enum(["DEFAULT_MIXING", "DUAL_CHANNEL_AGENT", "DUAL_CHANNEL_ALTERNATE"]).optional().describe("DUAL_CHANNEL_AGENT puts agents on the left channel and everyone else on the right"),
    custom_base_url: z.string().optional().describe("Your own layout page, instead of LiveKit's templates"),
    ...outputs,
  }).loose(), rec),
  start_web_egress: twirp(E, "StartWebEgress", "Record (or live stream) any web page, as a browser would show it." + outputsNote, z.object({
    url: z.string().min(1).describe("The page to record"),
    audio_only: z.boolean().optional().describe("Record sound only"),
    video_only: z.boolean().optional().describe("Record picture only"),
    await_start_signal: z.boolean().optional().describe("Wait until the page logs START_RECORDING before recording"),
    ...outputs,
  }).loose(), rec),
  start_participant_egress: twirp(E, "StartParticipantEgress", "Record (or stream) one participant's camera and mic together." + outputsNote, z.object({
    room_name: roomName,
    identity: z.string().min(1).describe("Whose audio and video (livekit.list_participants)"),
    screen_share: z.boolean().optional().describe("Their screen share instead of their camera"),
    ...outputs,
  }).loose(), rec),
  start_track_composite_egress: twirp(E, "StartTrackCompositeEgress", "Record (or stream) one audio track and one video track together." + outputsNote, z.object({
    room_name: roomName,
    audio_track_id: z.string().optional().describe("The audio track's sid, TR_… (livekit.get_participant lists tracks)"),
    video_track_id: z.string().optional().describe("The video track's sid, TR_…"),
    ...outputs,
  }).loose(), rec),
  start_track_egress: twirp(E, "StartTrackEgress", "Save one track as it is (no re-encoding) to a file, or send it to a websocket. Answers with the egress.", z.object({
    room_name: roomName,
    track_id: z.string().min(1).describe("The track's sid, TR_… (livekit.get_participant lists tracks)"),
    file: z.object({ filepath: z.string().optional().describe("Path in the bucket, may use {track_id}, {time}") }).loose().optional().describe(`Save to a file, plus storage. ${storage}`),
    websocket_url: z.string().optional().describe("Or send the raw audio to this websocket URL"),
    webhooks: webhooks.optional(),
  }).loose(), rec),
  start_egress: twirp(E, "StartEgress", "The newer, unified way to start any egress: a source (template = room layout, web = a page, media = one person's tracks), an encoding and outputs. Answers with the egress.", z.object({
    room_name: z.string().optional().describe("The room (needed for template and media sources)"),
    template: z.object({ layout: z.string().optional(), audio_only: z.boolean().optional(), video_only: z.boolean().optional(), custom_base_url: z.string().optional() }).optional().describe("Record the room with a layout: grid, speaker, single-speaker"),
    web: z.object({ url: z.string(), audio_only: z.boolean().optional(), video_only: z.boolean().optional(), await_start_signal: z.boolean().optional() }).optional().describe("Record a web page"),
    media: z.record(z.string(), z.any()).optional().describe("Record tracks directly: {participant_video: {identity, prefer_screen_share}, audio: {capture_all, routes: [{participant_identity, channel: AUDIO_CHANNEL_BOTH|LEFT|RIGHT}]}}"),
    preset: preset.optional(),
    advanced: advanced.optional(),
    outputs: z.array(z.record(z.string(), z.any())).describe("Each one of {file: {filepath, file_type}}, {stream: {protocol, urls}}, {segments: {...}}, {images: {...}}, optionally with its own storage"),
    storage: z.record(z.string(), z.any()).optional().describe(storage),
    webhooks: webhooks.optional(),
  }).loose(), rec),
  update_layout: twirp(E, "UpdateLayout", "Change the layout of a running room recording.", z.object({
    egress_id: egressId,
    layout: z.string().min(1).describe("grid, speaker or single-speaker"),
  }), rec),
  update_stream: twirp(E, "UpdateStream", "Add or remove live stream destinations of a running egress.", z.object({
    egress_id: egressId,
    add_output_urls: z.array(z.string()).optional().describe("RTMP/SRT URLs to start streaming to"),
    remove_output_urls: z.array(z.string()).optional().describe("URLs to stop streaming to"),
  }).loose(), rec),
  list_egress: twirp(E, "ListEgress", "Recordings and streams, running and past: id, room, status (EGRESS_ACTIVE, EGRESS_COMPLETE, EGRESS_FAILED…), files and where they went.", z.object({
    room_name: z.string().optional().describe("Only this room's"),
    egress_id: z.string().optional().describe("Only this one"),
    active: z.boolean().optional().describe("Only those still running"),
    page_token: pageToken.optional(),
  }), rec, { readOnly: true }),
  stop_egress: twirp(E, "StopEgress", "Stop a recording or stream; the file is finished and uploaded.", z.object({ egress_id: egressId }), rec),
};
