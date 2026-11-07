# Fireflies.ai coverage

Sources, swept 26 Oct 2026: the API reference at https://docs.fireflies.ai (llms-full.txt), including the
changelog. Fireflies' GraphQL schema can't be introspected without a key, so every query was written from the
docs and checked to parse; none has run against a real account yet. Composio's Fireflies toolkit has 10 tools;
n8n has no Fireflies node.

## Every documented operation

| Fireflies operation | Action |
| --- | --- |
| transcripts | list_meetings |
| transcript | get_meeting, get_meeting_transcript |
| updateMeetingTitle / updateMeetingPrivacy / updateMeetingChannel | rename_meeting, set_meeting_privacy, move_meetings_to_channel |
| shareMeeting / revokeSharedMeetingAccess | share_meeting, unshare_meeting |
| deleteTranscript | delete_meeting |
| createAskFredThread / continueAskFredThread | ask, ask_followup |
| askfred_threads / askfred_thread / deleteAskFredThread | list_askfred_threads, get_askfred_thread, delete_askfred_thread |
| apps | list_app_outputs |
| bites / bite / createBite | list_soundbites, get_soundbite, create_soundbite |
| addToLiveMeeting | join_meeting |
| active_meetings / updateMeetingState | active_meetings, pause_recording |
| live_action_items / createLiveActionItem / createLiveSoundbite | live_action_items, add_live_action_item, add_live_soundbite |
| uploadAudio / createUploadUrl / confirmUpload | upload_recording, create_upload_url, confirm_upload |
| user / users / setUserRole | me, get_user, list_users, set_user_role |
| user_groups / addUserToUserGroup / removeUserFromUserGroup | list_user_groups, add_to_user_group, remove_from_user_group |
| channels / channel | list_channels, get_channel |
| contacts | list_contacts |
| analytics | analytics |
| auditEvents | audit_events |
| rule_executions_by_meeting | rule_executions |
| anything else | graphql_query, graphql_mutation |

AskFred questions (ask, ask_followup) are mutations in Fireflies' API but only read meetings, so they run
without asking. Everything else that changes something asks first.

## Left out

| What | Why |
| --- | --- |
| Deprecated arguments (transcripts' date, organizer_email, participant_email; transcript.host_email; createBite's transcript_Id) | Replaced by from_date/to_date, organizers/participants, organizer_email, transcript_id |
| Webhooks V1/V2 (meeting transcribed, summarized) | Set up on Fireflies' webhook page, not through the API; and own apps have no triggers yet. upload_recording takes a one-off webhook URL |
| Realtime API (live transcript over a socket) | A stream, not a call; nothing an action can return |

## Auth

| Method | Status |
| --- | --- |
| API key (Integrations → Fireflies API), sent as Bearer | done |
