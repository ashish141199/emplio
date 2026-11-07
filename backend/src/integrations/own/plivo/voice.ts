// Voice: calls (make, list, live, queued, transfer, hang up, record, play, speak, DTMF, audio streams),
// conferences, multi-party calls, recordings and transcriptions, call feedback, number masking and PHLOs.
import { z } from "zod";
import type { OwnAction } from "../index";
import { method, page, phloApi, phloRunApi, r, range, statsApi, subaccount } from "./client";

const callUuid = z.string().min(1).describe("The call's call_uuid (from plivo.make_call, plivo.list_calls or plivo.list_live_calls)");
const legs = z.enum(["aleg", "bleg", "both"]).optional().describe("Which side hears it: aleg (the first party called, default), bleg (the one connected later) or both");
const conf = z.string().min(1).describe("The conference's name (plivo.list_conferences)");
const member = z.string().min(1).describe("The member_id (plivo.get_conference), several comma separated, or 'all'");
const mpc = z.string().min(1).describe("The multi-party call: name_<friendly name> (e.g. name_support_room) or uuid_<mpc uuid> (needed once it has ended)");
const participant = z.string().min(1).describe("The participant's member_id (plivo.list_mpc_participants), several comma separated, or 'all'");
const recordingId = z.string().min(1).describe("The recording_id (plivo.list_recordings)");
const phloId = z.string().min(1).describe("The PHLO's id (from the PHLO console URL)");
const sessionUuid = z.string().min(1).describe("The masking session's session_uuid (plivo.list_masking_sessions)");
const format = z.enum(["mp3", "wav"]).optional().describe("Recording format (default mp3)");
const voice = z.string().optional().describe("WOMAN (default) or MAN, or an Amazon Polly voice like Polly.Aditi or Polly.Joanna-Neural");
const language = z.string().optional().describe("Language/accent, e.g. en-US (default), en-IN, hi-IN, es-ES");

const recordFields = {
  file_format: format,
  transcription_type: z.enum(["auto", "hybrid"]).optional().describe("Also transcribe (paid): auto is machine, hybrid adds human review"),
  transcription_url: z.string().optional().describe("URL the transcription is sent to"),
  transcription_method: method("transcription_url"),
  callback_url: z.string().optional().describe("URL told when the recording is ready, with its URL"),
  callback_method: method("callback_url"),
};

const mpcRecordFields = {
  file_format: format,
  recording_callback_url: z.string().optional().describe("URL told when the recording is ready"),
  recording_callback_method: method("recording_callback_url"),
  transcript: z.boolean().optional().describe("Also transcribe it (default false)"),
  transcription_url: z.string().optional().describe("URL the transcript is sent to"),
};
const trackType = z.enum(["participant", "all", "both"]).optional().describe("participant: only their voice; all: the whole call (default); both: two files");

const sessionFields = {
  session_expiry: z.number().int().optional().describe("Seconds the masked number keeps working (default 3600, 0 for never)"),
  call_time_limit: z.number().int().optional().describe("Longest call in seconds (default 14400)"),
  record: z.boolean().optional().describe("Record the calls (default false)"),
  record_file_format: format,
  recording_callback_url: z.string().optional(),
  recording_callback_method: method("recording_callback_url"),
  callback_url: z.string().optional().describe("URL told about calls on the session"),
  callback_method: method("callback_url"),
  ring_timeout: z.number().int().optional().describe("Seconds to ring the other party (default 45)"),
  first_party_play_url: z.string().optional().describe("Audio URL played to the first party before connecting"),
  second_party_play_url: z.string().optional().describe("Audio URL played to the second party before connecting"),
  subaccount,
  geomatch: z.boolean().optional().describe("Pick a virtual number from the parties' country (default true)"),
  create_session_with_single_party: z.boolean().optional().describe("Allow a session with only first_party for now"),
};

export const voiceActions: Record<string, OwnAction> = {
  // ── calls
  make_call: r(
    "POST",
    "/Call/",
    "Place an outbound phone call. When it's answered Plivo fetches answer_url for XML saying what to do (speak, play, connect, record…). Answers with request_uuid; the call_uuid comes in callbacks or plivo.list_live_calls.",
    {
      from: z.string().min(1).describe("Caller id: a Plivo number (or verified caller id) in E.164, e.g. +14155551234"),
      to: z.string().min(1).describe("Who to call: E.164 number, or sip:user@phone.plivo.com; several separated by < (up to 1000) to call all at once"),
      answer_url: z.string().min(1).describe("URL returning Plivo XML for when the call is answered, e.g. <Response><Speak>Hello</Speak></Response>"),
      answer_method: method("answer_url"),
      ring_url: z.string().optional().describe("URL told when it starts ringing"),
      ring_method: method("ring_url"),
      hangup_url: z.string().optional().describe("URL told when the call ends (defaults to answer_url)"),
      hangup_method: method("hangup_url"),
      fallback_url: z.string().optional().describe("URL used if answer_url fails"),
      fallback_method: method("fallback_url"),
      caller_name: z.string().max(50).optional().describe("Caller name shown, for SIP calls"),
      send_digits: z.string().optional().describe("Keys pressed once answered, e.g. 1w2 (w waits 0.5 s, W 1 s)"),
      send_on_preanswer: z.boolean().optional().describe("Press send_digits before answer (default false)"),
      time_limit: z.number().int().optional().describe("Hang up after this many seconds (default 14400)"),
      hangup_on_ring: z.number().int().optional().describe("Hang up this many seconds after it starts ringing"),
      ring_timeout: z.number().int().optional().describe("Give up if not answered in this many seconds (default 120)"),
      machine_detection: z.enum(["true", "hangup"]).optional().describe("Detect answering machines: true reports it, hangup hangs up on one"),
      machine_detection_time: z.number().int().min(2000).max(10000).optional().describe("Milliseconds to decide (default 5000)"),
      machine_detection_url: z.string().optional().describe("URL told the result, when given the detection runs in the background"),
      machine_detection_method: method("machine_detection_url"),
      sip_headers: z.string().optional().describe("Extra SIP headers as key=value,key2=value2 (sent as X-PH-key)"),
      parent_call_uuid: z.string().optional().describe("Call this one belongs to, for call grouping"),
      error_if_parent_not_found: z.boolean().optional(),
      call_type: z.enum(["voice", "whatsapp_voice"]).optional().describe("whatsapp_voice places a WhatsApp call (default voice)"),
    },
    { loose: true },
  ),
  list_calls: r("GET", "/Call/", "Finished calls (call detail records) of the last 90 days, newest first: from, to, duration, bill, hangup cause.", {
    subaccount,
    call_direction: z.enum(["inbound", "outbound"]).optional(),
    from_number: z.string().optional().describe("Only from this number or prefix"),
    to_number: z.string().optional().describe("Only to this number or prefix"),
    parent_call_uuid: z.string().optional(),
    hangup_cause_code: z.number().int().optional(),
    hangup_source: z.string().optional().describe("Who hung up: Caller, Callee, Plivo, API Request, Answer XML, Error, Unknown"),
    bill_duration: z.number().int().optional().describe("Billed seconds exactly (bill_duration__gt etc. also work)"),
    ...range("end_time", "Ended"),
    ...page(),
  }, { loose: true }),
  get_call: r("GET", "/Call/{call_uuid}/", "One finished call's record: duration, cost, hangup cause, who hung up.", { call_uuid: callUuid }),
  list_live_calls: r("GET", "/Call/", "The call_uuids of calls going on right now.", {
    status: z.literal("live").default("live").describe("Always live"),
    call_direction: z.enum(["inbound", "outbound"]).optional(),
    from_number: z.string().optional(),
    to_number: z.string().optional(),
  }),
  get_live_call: r("GET", "/Call/{call_uuid}/", "A call in progress: from, to, state, how long it's been going.", {
    call_uuid: callUuid,
    status: z.literal("live").default("live").describe("Always live"),
  }),
  list_queued_calls: r("GET", "/Call/", "The call_uuids of outbound calls waiting to be placed.", { status: z.literal("queued").default("queued").describe("Always queued") }),
  get_queued_call: r("GET", "/Call/{call_uuid}/", "A queued outbound call.", { call_uuid: callUuid, status: z.literal("queued").default("queued").describe("Always queued") }),
  transfer_call: r("POST", "/Call/{call_uuid}/", "Send a live call to new XML: Plivo fetches aleg_url / bleg_url and does what it says (e.g. connect elsewhere, play a message).", {
    call_uuid: callUuid,
    legs,
    aleg_url: z.string().optional().describe("XML URL for the A leg (needed when legs is aleg or both)"),
    aleg_method: method("aleg_url"),
    bleg_url: z.string().optional().describe("XML URL for the B leg (needed when legs is bleg or both)"),
    bleg_method: method("bleg_url"),
  }),
  hangup_call: r("DELETE", "/Call/{call_uuid}/", "Hang up a live call.", { call_uuid: callUuid }),
  cancel_call_request: r("DELETE", "/Request/{request_uuid}/", "Cancel an outbound call that hasn't been answered yet (it stops ringing).", {
    request_uuid: z.string().min(1).describe("The request_uuid plivo.make_call answered with"),
  }),
  start_call_recording: r("POST", "/Call/{call_uuid}/Record/", "Start recording a live call. Answers with the recording URL.", {
    call_uuid: callUuid,
    time_limit: z.number().int().optional().describe("Stop after this many seconds (default 60)"),
    ...recordFields,
    transcription_report_type: z.enum(["full", "compact"]).optional().describe("How detailed the transcription is (default compact)"),
    record_channel_type: z.enum(["mono", "stereo"]).optional().describe("stereo puts each side on its own channel (default mono)"),
  }),
  stop_call_recording: r("DELETE", "/Call/{call_uuid}/Record/", "Stop recording a live call.", {
    call_uuid: callUuid,
    URL: z.string().optional().describe("Stop only the recording with this URL (default: all of the call's recordings)"),
  }),
  start_call_play: r("POST", "/Call/{call_uuid}/Play/", "Play audio files into a live call.", {
    call_uuid: callUuid,
    urls: z.string().min(1).describe("Public .mp3/.wav URLs, comma separated"),
    length: z.number().int().optional().describe("Stop after this many seconds"),
    legs,
    loop: z.boolean().optional().describe("Repeat until stopped (default false)"),
    mix: z.boolean().optional().describe("Mix with the conversation so both can still talk (default true)"),
  }),
  stop_call_play: r("DELETE", "/Call/{call_uuid}/Play/", "Stop audio playing into a call.", { call_uuid: callUuid }),
  start_call_speak: r("POST", "/Call/{call_uuid}/Speak/", "Say text (text-to-speech) into a live call.", {
    call_uuid: callUuid,
    text: z.string().min(1).describe("What to say (or SSML with type ssml)"),
    voice,
    language,
    legs,
    loop: z.boolean().optional().describe("Repeat until stopped (default false)"),
    mix: z.boolean().optional().describe("Mix with the conversation (default true)"),
    type: z.enum(["text", "ssml"]).optional().describe("Default text"),
  }),
  stop_call_speak: r("DELETE", "/Call/{call_uuid}/Speak/", "Stop text-to-speech in a call.", { call_uuid: callUuid }),
  send_call_digits: r("POST", "/Call/{call_uuid}/DTMF/", "Press keys (DTMF) on a live call, e.g. to work an IVR.", {
    call_uuid: callUuid,
    digits: z.string().min(1).describe("Keys: 0-9, *, #; w waits 0.5 s, W 1 s, e.g. 1w2w#"),
    leg: z.enum(["aleg", "bleg"]).optional().describe("Which side the keys are sent on (default aleg)"),
  }),

  // ── audio streams (live call audio to a websocket, e.g. a voice AI)
  start_call_stream: r("POST", "/Call/{call_uuid}/Stream/", "Stream a live call's audio to a websocket (e.g. a speech/AI service); bidirectional lets it talk back.", {
    call_uuid: callUuid,
    service_url: z.string().min(1).describe("wss:// URL to stream to"),
    bidirectional: z.boolean().optional().describe("Let the service send audio back into the call (default false; then audio_track must be inbound)"),
    audio_track: z.enum(["inbound", "outbound", "both"]).optional().describe("Whose audio: inbound (the caller, default), outbound, both"),
    stream_timeout: z.number().int().optional().describe("Stop after this many seconds (default 86400)"),
    content_type: z.enum(["audio/x-l16;rate=8000", "audio/x-l16;rate=16000", "audio/x-l16;rate=24000", "audio/x-mulaw;rate=8000"]).optional().describe("Audio encoding (default audio/x-l16;rate=8000)"),
    status_callback_url: z.string().optional(),
    status_callback_method: method("status_callback_url"),
    extra_headers: z.string().optional().describe("Sent to the websocket, as key1=val1,key2=val2"),
    noise_cancellation: z.enum(["true", "false"]).optional().describe("Clean background noise (default false)"),
    noise_cancellation_level: z.number().int().min(60).max(100).optional().describe("How strongly (default 85)"),
  }),
  list_call_streams: r("GET", "/Call/{call_uuid}/Stream/", "Audio streams on a call.", { call_uuid: callUuid }),
  get_call_stream: r("GET", "/Call/{call_uuid}/Stream/{stream_id}/", "One audio stream.", { call_uuid: callUuid, stream_id: z.string().min(1) }),
  stop_call_stream: r("DELETE", "/Call/{call_uuid}/Stream/{stream_id}/", "Stop one audio stream.", { call_uuid: callUuid, stream_id: z.string().min(1) }),
  stop_all_call_streams: r("DELETE", "/Call/{call_uuid}/Stream/", "Stop every audio stream on a call.", { call_uuid: callUuid }),

  // ── call quality feedback (stats.plivo.com)
  send_call_feedback: r("POST", "/v1/Call/{call_uuid}/Feedback/", "Rate a finished call's quality, for Plivo's call-quality team.", {
    call_uuid: callUuid,
    rating: z.number().min(1).max(5).describe("1 (bad) to 5 (perfect)"),
    issues: z.array(z.string()).optional().describe("Needed when rating < 5: AUDIO_LAG, BROKEN_AUDIO, CALL_DROPPED, CALLERID_ISSUES, DIGITS_NOT_CAPTURED, ECHO, HIGH_CONNECT_TIME, LOW_AUDIO_LEVEL, ONE_WAY_AUDIO, ROBOTIC_AUDIO, OTHERS"),
    notes: z.string().optional(),
  }, { api: statsApi }),

  // ── conferences
  list_conferences: r("GET", "/Conference/", "Names of conferences going on now."),
  get_conference: r("GET", "/Conference/{conference_name}/", "A live conference: its members (member_id, muted, deaf) and how long it has run.", { conference_name: conf }),
  hangup_conference: r("DELETE", "/Conference/{conference_name}/", "End a conference, hanging up everyone in it.", { conference_name: conf }),
  hangup_all_conferences: r("DELETE", "/Conference/", "End every live conference."),
  hangup_conference_member: r("DELETE", "/Conference/{conference_name}/Member/{member_id}/", "Hang up a member's call.", { conference_name: conf, member_id: member }),
  kick_conference_member: r("POST", "/Conference/{conference_name}/Member/{member_id}/Kick/", "Remove a member from the conference; their call goes on to the next XML.", { conference_name: conf, member_id: member }),
  mute_conference_member: r("POST", "/Conference/{conference_name}/Member/{member_id}/Mute/", "Mute a member (others stop hearing them).", { conference_name: conf, member_id: member }),
  unmute_conference_member: r("DELETE", "/Conference/{conference_name}/Member/{member_id}/Mute/", "Unmute a member.", { conference_name: conf, member_id: member }),
  deaf_conference_member: r("POST", "/Conference/{conference_name}/Member/{member_id}/Deaf/", "Make a member deaf (they stop hearing the conference).", { conference_name: conf, member_id: member }),
  undeaf_conference_member: r("DELETE", "/Conference/{conference_name}/Member/{member_id}/Deaf/", "Let a deafened member hear again.", { conference_name: conf, member_id: member }),
  play_to_conference_member: r("POST", "/Conference/{conference_name}/Member/{member_id}/Play/", "Play an audio file to members ('all' plays to everyone).", {
    conference_name: conf,
    member_id: member,
    url: z.string().min(1).describe("Public .mp3/.wav URL"),
  }),
  stop_conference_member_play: r("DELETE", "/Conference/{conference_name}/Member/{member_id}/Play/", "Stop audio playing to members.", { conference_name: conf, member_id: member }),
  speak_to_conference_member: r("POST", "/Conference/{conference_name}/Member/{member_id}/Speak/", "Say text (text-to-speech) to members.", {
    conference_name: conf,
    member_id: member,
    text: z.string().min(1),
    voice,
    language,
  }),
  stop_conference_member_speak: r("DELETE", "/Conference/{conference_name}/Member/{member_id}/Speak/", "Stop text-to-speech to members.", { conference_name: conf, member_id: member }),
  start_conference_recording: r("POST", "/Conference/{conference_name}/Record/", "Start recording a conference.", { conference_name: conf, ...recordFields }),
  stop_conference_recording: r("DELETE", "/Conference/{conference_name}/Record/", "Stop recording a conference.", { conference_name: conf }),

  // ── multi-party calls (agent/customer/supervisor rooms)
  list_mpcs: r("GET", "/MultiPartyCall/", "Multi-party calls (rooms with agents, customers, supervisors), newest first.", {
    sub_account: z.string().optional().describe("A subaccount's auth_id"),
    friendly_name: z.string().optional(),
    status: z.enum(["initialized", "active", "ended"]).optional(),
    termination_cause_code: z.number().int().optional().describe("1000, 1010, 2000 or 3000"),
    ...range("end_time", "Ended"),
    ...range("creation_time", "Created"),
    ...page(),
  }),
  get_mpc: r("GET", "/MultiPartyCall/{mpc}/", "One multi-party call: status, participants count, recording.", { mpc }),
  start_mpc: r("POST", "/MultiPartyCall/{mpc}/", "Start a multi-party call that is waiting (initialized).", { mpc, status: z.literal("active").default("active").describe("Always active") }),
  end_mpc: r("DELETE", "/MultiPartyCall/{mpc}/", "End a multi-party call, hanging up everyone.", { mpc }),
  add_mpc_participant: r(
    "POST",
    "/MultiPartyCall/{mpc}/Participant/",
    "Call someone into a multi-party call (made when the name is new), as agent, customer, supervisor or AI agent.",
    {
      mpc,
      role: z.enum(["agent", "supervisor", "customer", "ai-agent"]).describe("Their role; supervisors can coach agents"),
      from: z.string().optional().describe("Caller id for the call out, E.164"),
      to: z.string().optional().describe("Who to call: E.164 number or sip: URI (or give call_uuid to bring in a live call)"),
      call_uuid: z.string().optional().describe("Bring in an existing live call instead of calling from/to"),
      caller_name: z.string().optional(),
      mute: z.boolean().optional().describe("Join muted (default false)"),
      hold: z.boolean().optional().describe("Join on hold (default false)"),
      coach_mode: z.boolean().optional().describe("Supervisor heard only by agents (default true)"),
      start_mpc_on_enter: z.boolean().optional().describe("Their joining starts the call (default true)"),
      end_mpc_on_exit: z.boolean().optional().describe("Their leaving ends the call (default false)"),
      max_participants: z.number().int().min(2).max(10).optional().describe("Room size (default 10)"),
      max_duration: z.number().int().optional().describe("Longest call in seconds (default 14400)"),
      ring_timeout: z.number().int().optional().describe("Seconds to ring them (default 45)"),
      record: z.boolean().optional().describe("Record the whole call (default false)"),
      record_file_format: format,
      wait_music_url: z.string().optional().describe("Music while waiting for others"),
      status_callback_url: z.string().optional().describe("URL told about call and participant changes"),
      status_callback_events: z.string().optional().describe("Which events, comma separated (default mpc-state-changes,participant-state-changes)"),
      sip_headers: z.string().optional().describe("key=value,key2=value2"),
      transcript: z.boolean().optional().describe("Transcribe the call (default false)"),
      ai_agent_stream_service_url: z.string().optional().describe("role ai-agent: wss:// URL of the AI service"),
    },
    { loose: true },
  ),
  list_mpc_participants: r("GET", "/MultiPartyCall/{mpc}/Participant/", "Who's in a multi-party call.", { mpc, call_uuid: z.string().optional() }),
  get_mpc_participant: r("GET", "/MultiPartyCall/{mpc}/Participant/{participant_id}/", "One participant.", { mpc, participant_id: participant }),
  update_mpc_participant: r("POST", "/MultiPartyCall/{mpc}/Participant/{participant_id}/", "Mute/unmute, hold/unhold or coach a participant.", {
    mpc,
    participant_id: participant,
    mute: z.boolean().optional(),
    hold: z.boolean().optional(),
    coach_mode: z.boolean().optional().describe("Only for one participant id, not 'all'"),
  }),
  kick_mpc_participant: r("DELETE", "/MultiPartyCall/{mpc}/Participant/{participant_id}/", "Remove participants from a multi-party call.", { mpc, participant_id: participant }),
  start_mpc_recording: r("POST", "/MultiPartyCall/{mpc}/Record/", "Start recording a multi-party call.", { mpc, ...mpcRecordFields }),
  stop_mpc_recording: r("DELETE", "/MultiPartyCall/{mpc}/Record/", "Stop recording a multi-party call.", { mpc }),
  pause_mpc_recording: r("POST", "/MultiPartyCall/{mpc}/Record/Pause/", "Pause a multi-party call's recording (e.g. while a card number is read out).", { mpc }),
  resume_mpc_recording: r("POST", "/MultiPartyCall/{mpc}/Record/Resume/", "Resume a paused multi-party call recording.", { mpc }),
  start_mpc_participant_recording: r("POST", "/MultiPartyCall/{mpc}/Participant/{participant_id}/Record/", "Record one participant.", {
    mpc,
    participant_id: participant,
    ...mpcRecordFields,
    record_track_type: trackType,
  }),
  stop_mpc_participant_recording: r("DELETE", "/MultiPartyCall/{mpc}/Participant/{participant_id}/Record/", "Stop recording a participant.", { mpc, participant_id: participant, record_track_type: trackType }),
  pause_mpc_participant_recording: r("POST", "/MultiPartyCall/{mpc}/Participant/{participant_id}/Record/Pause/", "Pause a participant's recording.", { mpc, participant_id: participant, record_track_type: trackType }),
  resume_mpc_participant_recording: r("POST", "/MultiPartyCall/{mpc}/Participant/{participant_id}/Record/Resume/", "Resume a participant's recording.", { mpc, participant_id: participant, record_track_type: trackType }),
  start_mpc_member_play: r("POST", "/MultiPartyCall/{mpc}/Member/{participant_id}/Play/", "Play an audio file to participants.", {
    mpc,
    participant_id: participant,
    url: z.string().min(1).describe("Public .mp3/.wav URL"),
  }),
  stop_mpc_member_play: r("DELETE", "/MultiPartyCall/{mpc}/Member/{participant_id}/Play/", "Stop audio playing to participants.", { mpc, participant_id: participant }),

  // ── recordings and transcriptions
  list_recordings: r("GET", "/Recording/", "Call/conference recordings, newest first, with their URLs.", {
    subaccount,
    call_uuid: z.string().optional(),
    from_number: z.string().optional(),
    to_number: z.string().optional(),
    conference_name: z.string().optional(),
    mpc_name: z.string().optional(),
    conference_uuid: z.string().optional(),
    mpc_uuid: z.string().optional(),
    ...range("add_time", "Recorded"),
    ...page(),
  }, { loose: true }),
  get_recording: r("GET", "/Recording/{recording_id}/", "One recording: URL, duration, format, the call it came from.", { recording_id: recordingId }),
  delete_recording: r("DELETE", "/Recording/{recording_id}/", "Delete a recording for good.", { recording_id: recordingId }),
  create_transcription: r("POST", "/Transcription/{recording_id}/", "Transcribe a recording (paid). The text arrives at the callback or via plivo.get_transcription.", {
    recording_id: recordingId,
    transcription_callback_url: z.string().optional().describe("URL the transcription is sent to"),
  }),
  get_transcription: r("GET", "/Transcription/{transcription_id}/", "A recording's transcription (the transcription_id is the recording_id).", {
    transcription_id: z.string().min(1),
    type: z.enum(["raw"]).optional().describe("raw gives the full detail, with timings"),
  }),
  delete_transcription: r("DELETE", "/Transcription/{transcription_id}/", "Delete a transcription.", { transcription_id: z.string().min(1) }),

  // ── number masking (two parties call each other through a virtual number)
  list_masking_sessions: r("GET", "/Masking/Session/", "Number-masking sessions: pairs of people who reach each other through a virtual number.", {
    first_party: z.string().optional(),
    second_party: z.string().optional(),
    virtual_number: z.string().optional(),
    status: z.enum(["active", "expired"]).optional(),
    ...range("created_time", "Created"),
    ...range("expiry_time", "Expiring"),
    subaccount,
    ...page(),
  }, { loose: true }),
  get_masking_session: r("GET", "/Masking/Session/{session_uuid}/", "One masking session: the parties, the virtual number, expiry.", { session_uuid: sessionUuid }),
  create_masking_session: r("POST", "/Masking/Session/", "Connect two people through a masked virtual number so neither sees the other's real number (e.g. driver and rider).", {
    first_party: z.string().min(1).describe("First person's number, E.164"),
    second_party: z.string().optional().describe("Second person's number, E.164"),
    initiate_call_to_first_party: z.boolean().optional().describe("Call the first party right away and connect them (default false)"),
    is_pin_authentication_required: z.boolean().optional().describe("Callers must enter a PIN"),
    generate_pin: z.boolean().optional(),
    generate_pin_length: z.number().int().optional(),
    first_party_pin: z.string().optional(),
    second_party_pin: z.string().optional(),
    ...sessionFields,
  }, { loose: true }),
  update_masking_session: r("POST", "/Masking/Session/{session_uuid}/", "Change a masking session (parties, expiry, recording…).", {
    session_uuid: sessionUuid,
    first_party: z.string().optional(),
    second_party: z.string().optional(),
    ...sessionFields,
  }, { loose: true }),
  delete_masking_session: r("DELETE", "/Masking/Session/{session_uuid}/", "End a masking session.", { session_uuid: sessionUuid }),

  // ── PHLO (visual call/message flows)
  get_phlo: r("GET", "/phlo/{phlo_id}/", "A PHLO (flow built in Plivo's visual builder).", { phlo_id: phloId }, { api: phloApi }),
  run_phlo: r("POST", "/phlo/{phlo_id}/", "Start a PHLO with an API trigger. Any extra fields become variables the flow can use.", {
    phlo_id: phloId,
    from: z.string().optional().describe("Caller id / sender, E.164"),
    to: z.string().optional().describe("Who to call or message, E.164"),
  }, { api: phloRunApi, loose: true }),
  get_phlo_node: r("GET", "/phlo/{phlo_id}/{node_type}/{node_id}/", "One node of a PHLO (e.g. a multi-party call or conference bridge).", {
    phlo_id: phloId,
    node_type: z.enum(["multi_party_call", "conference_bridge"]),
    node_id: z.string().min(1),
  }, { api: phloApi }),
  phlo_node_action: r("POST", "/phlo/{phlo_id}/{node_type}/{node_id}/", "Act on a PHLO call node: call someone in, transfer.", {
    phlo_id: phloId,
    node_type: z.enum(["multi_party_call", "conference_bridge"]),
    node_id: z.string().min(1),
    action: z.enum(["call", "warm_transfer", "cold_transfer"]),
    trigger_source: z.string().describe("Number the call comes from, E.164"),
    to: z.string().describe("Who to call, E.164"),
    role: z.enum(["agent", "customer", "supervisor"]).optional().describe("Default agent"),
  }, { api: phloApi }),
  phlo_member_action: r("POST", "/phlo/{phlo_id}/{node_type}/{node_id}/members/{member_id}/", "Act on someone in a PHLO call: hold, mute, hang up, drop voicemail…", {
    phlo_id: phloId,
    node_type: z.enum(["multi_party_call", "conference_bridge"]),
    node_id: z.string().min(1),
    member_id: z.string().min(1).describe("The member's number or id"),
    action: z.enum(["abort_transfer", "resume_call", "voicemail_drop", "hangup", "hold", "unhold", "mute", "unmute"]),
  }, { api: phloApi }),
};
