// Fireflies.ai on the business's own API key: meetings and their transcripts, summaries and action items,
// AskFred (questions across meetings), soundbites, channels, team and groups, live meetings, uploads,
// analytics and audit logs. Fireflies' API is GraphQL (https://docs.fireflies.ai); COVERAGE.md says what's where.
//
// Its schema can't be read without a key, so arguments are written into the query as literals rather than
// typed variables: a wrong guess at a type name (ID or String, Int or Float) can't break a call that way.
import { z } from "zod";
import { AppsError } from "../../types";
import type { OwnAction, OwnApp } from "../index";

const API = "https://api.fireflies.ai/graphql";

// a GraphQL enum value, written bare
class Enum {
  constructor(readonly value: string) {}
}

// a JSON value as a GraphQL literal: {key: "x", list: [1, 2], state: active}
export function lit(v: unknown): string {
  if (v instanceof Enum) return v.value;
  if (Array.isArray(v)) return `[${v.map(lit).join(", ")}]`;
  if (v && typeof v === "object")
    return `{${Object.entries(v)
      .filter(([, x]) => x !== undefined)
      .map(([k, x]) => `${k}: ${lit(x)}`)
      .join(", ")}}`;
  return JSON.stringify(v ?? null);
}

// field(args) with the given arguments, leaving out the ones not given
const call = (field: string, args: Record<string, unknown>) => {
  const given = Object.entries(args).filter(([, v]) => v !== undefined);
  return given.length ? `${field}(${given.map(([k, v]) => `${k}: ${lit(v)}`).join(", ")})` : field;
};

// enum fields of an input object, as bare values
const enums = (o: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(
    Object.entries(o).map(([k, v]) => [k, keys.includes(k) && v !== undefined ? (Array.isArray(v) ? v.map((x) => new Enum(String(x))) : new Enum(String(v))) : v]),
  );

export async function graphql(key: string, query: string) {
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  let out: { data?: any; errors?: { message: string; code?: string; extensions?: { code?: string } }[] };
  try {
    out = JSON.parse(text);
  } catch {
    throw new AppsError(`Fireflies: ${text || res.statusText} (${res.status})`);
  }
  const errors = out.errors ?? [];
  if (res.status === 401 || errors.some((e) => (e.code ?? e.extensions?.code) === "auth_failed"))
    throw new AppsError("Fireflies rejected the API key; copy it again from app.fireflies.ai → Integrations → Fireflies API and reconnect", true);
  if (errors.length) throw new AppsError(`Fireflies: ${errors.map((e) => e.message).join("; ")}`);
  if (!res.ok) throw new AppsError(`Fireflies: ${res.statusText} (${res.status})`);
  return out.data;
}

// one action: `build` makes the operation from the input; the answer is the data under its field
function op(description: string, input: z.ZodRawShape, build: (i: any) => string, opts: { readOnly?: boolean } = {}): OwnAction {
  return {
    description,
    readOnly: opts.readOnly ?? !build({}).startsWith("mutation"),
    input: z.object(input),
    run: async (i, key) => {
      const data = await graphql(key, build(i));
      const values = Object.values(data ?? {});
      return values.length === 1 ? values[0] : data;
    },
  };
}

// ── what comes back
const USER = "user_id email name num_transcripts recent_transcript recent_meeting minutes_consumed is_admin integrations user_groups { id name handle }";
const GROUP = "id name handle members { user_id first_name last_name email }";
const APP_OUTPUT = "transcript_id user_id app_id created_at title prompt response";
const SUMMARY =
  "keywords action_items outline shorthand_bullet overview bullet_gist gist short_summary short_overview meeting_type topics_discussed transcript_chapters";
const MEETING =
  "id title dateString date duration privacy organizer_email participants fireflies_users transcript_url audio_url video_url meeting_link calendar_id cal_id calendar_type is_live " +
  "meeting_attendees { displayName email phoneNumber name location } meeting_attendance { name join_time leave_time } channels { id } " +
  "meeting_info { fred_joined silent_meeting summary_status }";
const ANALYTICS =
  "analytics { sentiments { negative_pct neutral_pct positive_pct } categories { questions date_times metrics tasks } " +
  "speakers { speaker_id name duration word_count longest_monologue monologues_count filler_words questions duration_pct words_per_minute } }";
const SENTENCES = "speakers { id name } sentences { index speaker_name speaker_id text start_time end_time ai_filters { task pricing metric question date_and_time sentiment } }";
const BITE =
  "id transcript_id name status summary summary_status media_type start_time end_time thumbnail preview privacies created_at user_id " +
  "captions { index speaker_name start_time end_time text } sources { src type } user { id name }";
const ASKFRED_MESSAGE = "message { id thread_id query answer suggested_queries status created_at }";
const THREAD = "id title transcript_id user_id created_at";

// ── shared inputs
const meetingId = z.string().min(1).describe("The meeting's id (transcript id), from fireflies.list_meetings");
const liveMeetingId = z.string().min(1).describe("The live meeting's id, from fireflies.active_meetings");
const emails = (what: string) => z.array(z.string()).optional().describe(`Only meetings with any of these emails as ${what}`);
const attendees = z
  .array(z.object({ displayName: z.string().optional(), email: z.string().optional(), phoneNumber: z.string().optional() }))
  .optional()
  .describe("Who's expected, so Fireflies can match speakers and CRM contacts");
const language = z.string().max(5).optional().describe("Language code, e.g. en, hi, es (default English)");
const askfredOptions = {
  response_language: z.string().optional().describe("Answer in this language code, e.g. en, hi"),
  format_mode: z.enum(["markdown", "plaintext"]).optional(),
  generate_suggestions: z.boolean().optional().describe("Also suggest follow-up questions"),
};
const askfredInput = (i: any, extra: Record<string, unknown>) =>
  enums({ ...extra, response_language: i.response_language, format_mode: i.format_mode, generate_suggestions: i.generate_suggestions }, ["response_language", "format_mode"]);

const actions: Record<string, OwnAction> = {
  // ── meetings
  list_meetings: op(
    "Recorded meetings, newest first: title, date, length, who was there, links. Search by words in the title or what was said; page with skip.",
    {
      keyword: z.string().optional().describe("Words in the title or spoken in the meeting"),
      scope: z.enum(["title", "sentences", "all"]).optional().describe("Where keyword looks (default title)"),
      from_date: z.string().optional().describe("Only meetings after this, ISO 8601, e.g. 2026-10-01T00:00:00Z"),
      to_date: z.string().optional().describe("Only meetings before this, ISO 8601"),
      organizers: emails("organizer"),
      participants: emails("attendee"),
      user_id: z.string().optional().describe("Only meetings this teammate organized or attended (fireflies.list_users)"),
      channel_id: z.string().optional().describe("Only meetings in this channel (fireflies.list_channels)"),
      mine: z.boolean().optional().describe("Only meetings the key's owner organized"),
      limit: z.number().int().min(1).max(50).default(20).describe("How many (at most 50)"),
      skip: z.number().int().min(0).optional().describe("Skip this many, to page on"),
      with_summary: z.boolean().default(true).describe("Include each meeting's AI summary and action items"),
    },
    (i) =>
      `query { ${call("transcripts", {
        keyword: i.keyword,
        scope: i.scope,
        fromDate: i.from_date,
        toDate: i.to_date,
        organizers: i.organizers,
        participants: i.participants,
        user_id: i.user_id,
        channel_id: i.channel_id,
        mine: i.mine,
        limit: i.limit,
        skip: i.skip,
      })} { ${MEETING}${i.with_summary ? ` summary { ${SUMMARY} }` : ""} } }`,
  ),
  get_meeting: op(
    "One meeting in full: who was there and when they joined, the AI summary (overview, action items, outline, topics), AI app outputs, and talk analytics. Add include_transcript for every sentence said.",
    {
      id: meetingId,
      include_transcript: z.boolean().default(false).describe("Also every sentence, with speaker and time (long)"),
    },
    (i) =>
      `query { ${call("transcript", { id: i.id })} { ${MEETING} summary { ${SUMMARY} } ${ANALYTICS} apps_preview { outputs { ${APP_OUTPUT} } } user { user_id email name }${
        i.include_transcript ? ` ${SENTENCES}` : ""
      } } }`,
  ),
  get_meeting_transcript: op(
    "Everything said in a meeting, sentence by sentence, with speaker and time in seconds.",
    { id: meetingId },
    (i) => `query { ${call("transcript", { id: i.id })} { id title ${SENTENCES} } }`,
  ),
  rename_meeting: op(
    "Change a meeting's title.",
    { id: meetingId, title: z.string().min(1).max(256) },
    (i) => `mutation { ${call("updateMeetingTitle", { input: { id: i.id, title: i.title } })} { title } }`,
  ),
  set_meeting_privacy: op(
    "Change who can open a meeting: owner, participants, teammates, teammatesandparticipants, participatingteammates (beta) or link (anyone with it).",
    {
      id: meetingId,
      privacy: z.enum(["owner", "participants", "teammates", "teammatesandparticipants", "participatingteammates", "link"]),
    },
    (i) => `mutation { ${call("updateMeetingPrivacy", { input: { id: i.id, privacy: new Enum(i.privacy) } })} { id title privacy } }`,
  ),
  move_meetings_to_channel: op(
    "Put meetings in a channel (a folder teammates share).",
    {
      meeting_ids: z.array(z.string()).min(1).describe("The meetings' ids"),
      channel_id: z.string().min(1).describe("The channel's id from fireflies.list_channels"),
    },
    (i) => `mutation { ${call("updateMeetingChannel", { input: { transcript_ids: i.meeting_ids, channel_id: i.channel_id } })} { id title channels { id } } }`,
  ),
  share_meeting: op(
    "Share a meeting with people outside the team: by email, or as a password-protected link (https://app.fireflies.ai/view/p/<share_slug>).",
    {
      meeting_id: meetingId,
      emails: z.array(z.string().email()).min(1).describe("Who to share it with"),
      share_type: z.enum(["EMAIL", "PASSWORD_LINK"]).default("EMAIL"),
      password: z.string().optional().describe("For PASSWORD_LINK: the link's password"),
      expiry_days: z.number().int().min(1).optional().describe("Access ends after this many days"),
    },
    (i) =>
      `mutation { ${call("shareMeeting", {
        input: { meeting_id: i.meeting_id, emails: i.emails, share_type: new Enum(i.share_type), password: i.password, expiry_days: i.expiry_days },
      })} { success message share_slug } }`,
  ),
  unshare_meeting: op(
    "Take back someone's access to a shared meeting.",
    { meeting_id: meetingId, email: z.string().email().describe("Whose access to remove") },
    (i) => `mutation { ${call("revokeSharedMeetingAccess", { input: { meeting_id: i.meeting_id, email: i.email } })} { success message } }`,
  ),
  delete_meeting: op(
    "Delete a meeting and its recording and transcript. Can't be undone.",
    { id: meetingId },
    (i) => `mutation { ${call("deleteTranscript", { id: i.id })} { id title date } }`,
  ),

  // ── AskFred: questions answered from meetings
  ask: op(
    "Ask a question about one meeting, or across meetings (filtered by date, people, channel); starts an AskFred thread. Follow up with fireflies.ask_followup.",
    {
      query: z.string().min(1).max(2000).describe('The question, e.g. "What did we promise Acme about delivery dates?"'),
      meeting_id: z.string().optional().describe("Answer from this meeting only"),
      start_time: z.string().optional().describe("Across meetings from this time, ISO 8601 (at most a year back; default 30 days)"),
      end_time: z.string().optional().describe("Across meetings until this time, ISO 8601 (default today)"),
      organizers: z.array(z.string()).optional().describe("Only meetings organized by these emails"),
      participants: z.array(z.string()).optional().describe("Only meetings with these emails attending"),
      channel_ids: z.array(z.string()).optional().describe("Only meetings in these channels"),
      meeting_ids: z.array(z.string()).optional().describe("Only these meetings"),
      ...askfredOptions,
    },
    (i) => {
      const filters =
        i.meeting_id || ![i.start_time, i.end_time, i.organizers, i.participants, i.channel_ids, i.meeting_ids].some((v) => v !== undefined)
          ? undefined
          : {
              start_time: i.start_time,
              end_time: i.end_time,
              organizers: i.organizers,
              participants: i.participants,
              channel_ids: i.channel_ids,
              transcript_ids: i.meeting_ids,
            };
      return `mutation { ${call("createAskFredThread", { input: askfredInput(i, { query: i.query, transcript_id: i.meeting_id, filters }) })} { ${ASKFRED_MESSAGE} } }`;
    },
    { readOnly: true },
  ),
  ask_followup: op(
    "Ask a follow-up question in an AskFred thread.",
    {
      thread_id: z.string().min(1).describe("The thread_id fireflies.ask returned"),
      query: z.string().min(1).max(2000).describe("The follow-up question"),
      ...askfredOptions,
    },
    (i) => `mutation { ${call("continueAskFredThread", { input: askfredInput(i, { thread_id: i.thread_id, query: i.query }) })} { ${ASKFRED_MESSAGE} } }`,
    { readOnly: true },
  ),
  list_askfred_threads: op(
    "Past AskFred threads (questions asked about meetings).",
    { meeting_id: z.string().optional().describe("Only threads about this meeting") },
    (i) => `query { ${call("askfred_threads", { transcript_id: i.meeting_id })} { ${THREAD} } }`,
  ),
  get_askfred_thread: op(
    "One AskFred thread with every question and answer.",
    { id: z.string().min(1).describe("The thread's id") },
    (i) => `query { ${call("askfred_thread", { id: i.id })} { ${THREAD} messages { id thread_id query answer suggested_queries status created_at updated_at } } }`,
  ),
  delete_askfred_thread: op(
    "Delete an AskFred thread and its messages.",
    { id: z.string().min(1).describe("The thread's id") },
    (i) => `mutation { ${call("deleteAskFredThread", { id: i.id })} { ${THREAD} } }`,
  ),

  // ── AI apps and soundbites
  list_app_outputs: op(
    "What Fireflies' AI apps produced for meetings (e.g. a sales scorecard, interview notes): app, meeting, prompt, response.",
    {
      app_id: z.string().optional().describe("Only this AI app's outputs"),
      meeting_id: z.string().optional().describe("Only this meeting's outputs"),
      limit: z.number().int().min(1).max(10).optional().describe("How many (at most 10)"),
      skip: z.number().int().min(0).optional(),
    },
    (i) => `query { ${call("apps", { app_id: i.app_id, transcript_id: i.meeting_id, limit: i.limit, skip: i.skip })} { outputs { ${APP_OUTPUT} } } }`,
  ),
  list_soundbites: op(
    "Soundbites (short clips cut from meetings): name, meeting, times, summary, links.",
    {
      mine: z.boolean().default(true).describe("Only the key owner's (default true)"),
      my_team: z.boolean().optional().describe("The whole team's"),
      meeting_id: z.string().optional().describe("Only from this meeting"),
      limit: z.number().int().min(1).max(50).optional().describe("How many (at most 50)"),
      skip: z.number().int().min(0).optional(),
    },
    (i) => `query { ${call("bites", { mine: i.mine, my_team: i.my_team, transcript_id: i.meeting_id, limit: i.limit, skip: i.skip })} { ${BITE} } }`,
  ),
  get_soundbite: op(
    "One soundbite: captions, summary, media links.",
    { id: z.string().min(1).describe("The soundbite's id") },
    (i) => `query { ${call("bite", { id: i.id })} { ${BITE} created_from { id name type description duration } } }`,
  ),
  create_soundbite: op(
    "Cut a soundbite from a meeting, between two times in seconds.",
    {
      meeting_id: meetingId,
      start_time: z.number().min(0).describe("Start, in seconds from the meeting's start"),
      end_time: z.number().min(0).describe("End, in seconds"),
      name: z.string().optional(),
      summary: z.string().optional(),
      media_type: z.enum(["video", "audio"]).optional(),
      privacies: z.array(z.enum(["public", "team", "participants"])).optional().describe('Who can see it, e.g. ["team"]'),
    },
    (i) =>
      `mutation { ${call("createBite", {
        transcript_id: i.meeting_id,
        start_time: i.start_time,
        end_time: i.end_time,
        name: i.name,
        summary: i.summary,
        media_type: i.media_type,
        privacies: i.privacies?.map((p: string) => new Enum(p)),
      })} { id name status } }`,
  ),

  // ── live meetings
  join_meeting: op(
    "Send the Fireflies notetaker into a meeting happening now (Zoom, Google Meet, Teams link). Limited to about 3 a person per 20 minutes.",
    {
      meeting_link: z.string().url().describe("The meeting's link"),
      title: z.string().max(256).optional(),
      meeting_password: z.string().max(32).optional(),
      duration: z.number().int().min(15).max(120).optional().describe("Minutes to stay (15-120, default 60)"),
      language,
      attendees,
    },
    (i) =>
      `mutation { ${call("addToLiveMeeting", {
        meeting_link: i.meeting_link,
        title: i.title,
        meeting_password: i.meeting_password,
        duration: i.duration,
        language: i.language,
        attendees: i.attendees,
      })} { success } }`,
  ),
  active_meetings: op(
    "Meetings the notetaker is in right now: title, organizer, link, state (active or paused).",
    {
      email: z.string().optional().describe("Only this person's"),
      states: z.array(z.enum(["active", "paused"])).optional(),
    },
    (i) =>
      `query { ${call("active_meetings", {
        input: i.email || i.states ? enums({ email: i.email, states: i.states }, ["states"]) : undefined,
      })} { id title organizer_email meeting_link start_time end_time privacy state } }`,
  ),
  pause_recording: op(
    "Pause or resume recording in a live meeting.",
    { meeting_id: liveMeetingId, action: z.enum(["pause_recording", "resume_recording"]) },
    (i) => `mutation { ${call("updateMeetingState", { input: { meeting_id: i.meeting_id, action: new Enum(i.action) } })} { success action } }`,
  ),
  live_action_items: op(
    "Action items noted so far in a live meeting.",
    { meeting_id: liveMeetingId },
    (i) => `query { ${call("live_action_items", { meeting_id: i.meeting_id })} { name action_item } }`,
  ),
  add_live_action_item: op(
    "Add an action item to a live meeting, described in words.",
    { meeting_id: liveMeetingId, prompt: z.string().min(1).describe('What to note, e.g. "Ravi to send the quote by Friday"') },
    (i) => `mutation { ${call("createLiveActionItem", { input: { meeting_id: i.meeting_id, prompt: i.prompt } })} { success } }`,
  ),
  add_live_soundbite: op(
    "Clip a moment of a live meeting as a soundbite, described in words.",
    { meeting_id: liveMeetingId, prompt: z.string().min(1).describe('Which moment, e.g. "the pricing discussion"') },
    (i) => `mutation { ${call("createLiveSoundbite", { input: { meeting_id: i.meeting_id, prompt: i.prompt } })} { success } }`,
  ),

  // ── uploads
  upload_recording: op(
    "Have Fireflies transcribe a recording at a public https link (mp3, mp4, wav, m4a, ogg…).",
    {
      url: z.string().url().describe("Where the file is; must be https and reachable by Fireflies"),
      title: z.string().optional(),
      custom_language: language,
      meeting_date: z.string().optional().describe("When the meeting happened, ISO 8601 (default now)"),
      attendees,
      save_video: z.boolean().optional().describe("Keep the video, not only the audio"),
      client_reference_id: z.string().optional().describe("Our own id for it"),
      bypass_size_check: z.boolean().optional().describe("Accept files under 50 KB"),
      webhook: z.string().url().optional().describe("A URL told when the transcript is ready"),
      download_auth: z
        .object({
          type: z.enum(["none", "bearer_token", "basic_auth"]),
          bearer: z.object({ token: z.string() }).optional(),
          basic: z.object({ username: z.string(), password: z.string() }).optional(),
        })
        .optional()
        .describe("When the link needs a login: {type: bearer_token, bearer: {token}} or {type: basic_auth, basic: {username, password}}"),
    },
    (i) =>
      `mutation { ${call("uploadAudio", {
        input: {
          url: i.url,
          title: i.title,
          custom_language: i.custom_language,
          meeting_date: i.meeting_date,
          attendees: i.attendees,
          save_video: i.save_video,
          client_reference_id: i.client_reference_id,
          bypass_size_check: i.bypass_size_check,
          webhook: i.webhook,
          download_auth: i.download_auth && enums(i.download_auth, ["type"]),
        },
      })} { success title message } }`,
  ),
  create_upload_url: op(
    "Get a link to upload a recording file straight to Fireflies (for files with no public link): PUT the file there, then fireflies.confirm_upload.",
    {
      content_type: z.string().min(1).describe("The file's type, e.g. audio/mpeg, audio/x-m4a, video/mp4"),
      file_size: z.number().int().min(1).describe("Size in bytes"),
      title: z.string().optional(),
      custom_language: language,
      meeting_date: z.string().optional().describe("When the meeting happened, ISO 8601"),
      attendees,
    },
    (i) =>
      `mutation { ${call("createUploadUrl", {
        input: {
          content_type: i.content_type,
          file_size: i.file_size,
          title: i.title,
          custom_language: i.custom_language,
          meeting_date: i.meeting_date,
          attendees: i.attendees,
        },
      })} { upload_url meeting_id expires_at } }`,
  ),
  confirm_upload: op(
    "Tell Fireflies a file uploaded to fireflies.create_upload_url's link is there, so it transcribes it.",
    { meeting_id: z.string().min(1).describe("The meeting_id fireflies.create_upload_url returned") },
    (i) => `mutation { ${call("confirmUpload", { input: { meeting_id: i.meeting_id } })} { success meeting_id message } }`,
  ),

  // ── team
  me: op("Who the API key belongs to, with their meeting counts and minutes used.", {}, () => `query { user { ${USER} } }`),
  list_users: op("Everyone on the Fireflies team: id, name, email, admin or not, meetings, minutes used, groups.", {}, () => `query { users { ${USER} } }`),
  get_user: op(
    "One teammate.",
    { id: z.string().min(1).describe("The user's id from fireflies.list_users") },
    (i) => `query { ${call("user", { id: i.id })} { ${USER} } }`,
  ),
  set_user_role: op(
    "Make a teammate an admin, or a regular user.",
    { user_id: z.string().min(1).describe("From fireflies.list_users"), role: z.enum(["admin", "user"]) },
    (i) => `mutation { ${call("setUserRole", { user_id: i.user_id, role: new Enum(i.role) })} { id name email role } }`,
  ),
  list_user_groups: op(
    "The team's user groups and who is in each.",
    { mine: z.boolean().optional().describe("Only groups the key's owner is in") },
    (i) => `query { ${call("user_groups", { mine: i.mine })} { ${GROUP} } }`,
  ),
  add_to_user_group: op(
    "Add a teammate to a user group.",
    { group_id: z.string().min(1).describe("From fireflies.list_user_groups"), user_email: z.string().email() },
    (i) => `mutation { ${call("addUserToUserGroup", { group_id: i.group_id, user_email: i.user_email })} { ${GROUP} } }`,
  ),
  remove_from_user_group: op(
    "Remove a teammate from a user group.",
    { group_id: z.string().min(1).describe("From fireflies.list_user_groups"), user_email: z.string().email() },
    (i) => `mutation { ${call("removeUserFromUserGroup", { group_id: i.group_id, user_email: i.user_email })} { ${GROUP} } }`,
  ),
  list_channels: op("Channels (shared folders of meetings) and their members.", {}, () => `query { channels { id title is_private created_by created_at updated_at members { user_id email name } } }`),
  get_channel: op(
    "One channel and its members.",
    { id: z.string().min(1).describe("From fireflies.list_channels") },
    (i) => `query { ${call("channel", { id: i.id })} { id title is_private created_by created_at updated_at members { user_id email name } } }`,
  ),
  list_contacts: op("People the team has met with: name, email, last meeting.", {}, () => `query { contacts { email name picture last_meeting_date } }`),

  // ── reports
  analytics: op(
    "Meeting and conversation numbers for the team and each person over a period: meetings, hours, talk-listen ratio, questions, filler words, sentiment, with change against the period before.",
    {
      start_time: z.string().optional().describe("From, ISO 8601"),
      end_time: z.string().optional().describe("To, ISO 8601"),
    },
    (i) => {
      const conversation =
        "conversation { average_filler_words average_monologues_count average_questions average_sentiments { negative_pct neutral_pct positive_pct } " +
        "average_silence_duration average_talk_listen_ratio average_words_per_minute longest_monologue_duration_sec total_filler_words total_meeting_notes_count " +
        "total_meetings_count total_monologues_count teammates_count total_questions total_silence_duration }";
      const meeting =
        "meeting { count count_diff_pct duration duration_diff_pct average_count average_count_diff_pct average_duration average_duration_diff_pct }";
      return `query { ${call("analytics", { start_time: i.start_time, end_time: i.end_time })} { team { ${conversation} ${meeting} } users { user_id user_name user_email ${conversation} ${meeting} } } }`;
    },
  ),
  audit_events: op(
    "The team's audit log (Enterprise): who deleted meetings, added teammates, changed settings, signed in.",
    {
      category: z.enum(["MEETING_OPERATIONS", "TEAM_OPERATIONS", "USER_OPERATIONS", "AUTHENTICATION"]),
      action: z.string().optional().describe("Only this action, e.g. MEETING_DELETED, TEAMMATE_ADDED"),
      date_from: z.string().optional().describe("ISO 8601"),
      date_to: z.string().optional().describe("ISO 8601"),
      actor_email: z.string().optional().describe("Only what this person did"),
      limit: z.number().int().min(1).max(50).optional(),
      cursor: z.string().optional().describe("next_cursor from the previous page"),
    },
    (i) =>
      `query { ${call("auditEvents", {
        limit: i.limit,
        cursor: i.cursor,
        filters: enums({ category: i.category, action: i.action, date_from: i.date_from, date_to: i.date_to, actor_email: i.actor_email }, ["category", "action"]),
      })} { events { id time category action severity status message actor { user_id email full_name ip_address } resource { type id } metadata } has_more next_cursor } }`,
  ),
  rule_executions: op(
    "What the team's automation rules did to meetings (shared with groups, moved to channels, privacy changed).",
    {
      rule_id: z.string().optional(),
      meeting_id: z.string().optional(),
      date_from: z.string().optional().describe("ISO 8601"),
      date_to: z.string().optional().describe("ISO 8601"),
      is_test: z.boolean().optional().describe("true: only test runs; false: only real ones"),
      limit: z.number().int().min(1).max(50).optional(),
      logs_per_meeting: z.number().int().min(1).max(20).optional(),
      cursor: z.string().optional(),
    },
    (i) => {
      const filters = { rule_id: i.rule_id, meeting_id: i.meeting_id, date_from: i.date_from, date_to: i.date_to, is_test: i.is_test };
      return `query { ${call("rule_executions_by_meeting", {
        limit: i.limit,
        cursor: i.cursor,
        logs_per_meeting: i.logs_per_meeting,
        filters: Object.values(filters).some((v) => v !== undefined) ? filters : undefined,
      })} { meetings { meeting_id meeting { id title organizer_email } executions { extension_id extension_title stopped_at user_name share { group_ids } channel { channel_id } meeting_privacy { privacy } } } has_more next_cursor } }`;
    },
  ),

  // ── anything else
  graphql_query: {
    description: "Read anything Fireflies' GraphQL API has that the other actions don't (https://docs.fireflies.ai). Only queries.",
    readOnly: true,
    input: z.object({ query: z.string().min(1).describe("A GraphQL query, e.g. query { user { email } }") }),
    run: (i, key) => {
      if (/(^|\})\s*(mutation|subscription)\b/i.test(i.query)) throw new AppsError("that changes things; use fireflies.graphql_mutation");
      return graphql(key, i.query);
    },
  },
  graphql_mutation: {
    description: "Change anything through Fireflies' GraphQL API that the other actions don't cover (https://docs.fireflies.ai).",
    input: z.object({ query: z.string().min(1).describe("A GraphQL mutation") }),
    run: (i, key) => graphql(key, i.query),
  },
};

export const fireflies: OwnApp = {
  app: "fireflies",
  name: "Fireflies.ai",
  logo: "/logos/fireflies.png",
  keyField: {
    label: "API key",
    help: "In Fireflies: Integrations → Fireflies API (app.fireflies.ai/integrations/custom/fireflies) → copy the key.",
    placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  },
  async check(key) {
    await graphql(key, "query { user { user_id } }");
  },
  actions,
};
