# LiveKit coverage

Sources, swept 26 Oct 2026: every `service` in github.com/livekit/protocol/protobufs (and its agent/, rpc/
subfolders), the grants each call signs with in livekit/node-sdks `*Client.ts` and livekit/server-sdk-go
(`roomclient.go`, `sipclient.go`, `phonenumberclient.go`, `agent_client.go`…), and the server's own permission
checks (livekit/livekit `pkg/service/roomservice.go`) for PerformRpc, which no SDK wraps yet.

All calls: `POST <project>/twirp/livekit.<Service>/<Method>`, protobuf JSON body, a 10-minute HS256 JWT
(iss = API key) with only the grants below. CloudAgent is on `agents.<domain>` (the Go SDK's rule).
72 actions: 71 rpcs + `create_token`.

## RoomService (14) — video grants

| rpc | action | grant |
| --- | --- | --- |
| CreateRoom | `create_room` | roomCreate |
| ListRooms | `list_rooms` (read-only; also `check`) | roomList |
| DeleteRoom | `delete_room` | roomCreate |
| ListParticipants | `list_participants` (read-only) | roomAdmin + room |
| GetParticipant | `get_participant` (read-only) | roomAdmin + room |
| RemoveParticipant | `remove_participant` | roomAdmin + room |
| MutePublishedTrack | `mute_published_track` | roomAdmin + room |
| UpdateParticipant | `update_participant` | roomAdmin + room |
| UpdateSubscriptions | `update_subscriptions` | roomAdmin + room |
| SendData | `send_data` (text in, base64 bytes on the wire) | roomAdmin + room |
| UpdateRoomMetadata | `update_room_metadata` | roomAdmin + room |
| ForwardParticipant | `forward_participant` | roomAdmin + room + destinationRoom |
| MoveParticipant | `move_participant` | roomAdmin + room + destinationRoom |
| PerformRpc | `perform_rpc` | roomAdmin + room |
| (local) | `create_token` — join token + meet.livekit.io link; returns a secret, so it asks first | roomJoin + room, as asked |

## Egress (10) — roomRecord

| rpc | action |
| --- | --- |
| StartEgress | `start_egress` |
| StartRoomCompositeEgress | `start_room_composite_egress` |
| StartWebEgress | `start_web_egress` |
| StartParticipantEgress | `start_participant_egress` |
| StartTrackCompositeEgress | `start_track_composite_egress` |
| StartTrackEgress | `start_track_egress` |
| UpdateLayout | `update_layout` |
| UpdateStream | `update_stream` |
| ListEgress | `list_egress` (read-only) |
| StopEgress | `stop_egress` |

## Ingress (4) — ingressAdmin

| rpc | action |
| --- | --- |
| CreateIngress | `create_ingress` |
| UpdateIngress | `update_ingress` |
| ListIngress | `list_ingress` (read-only) |
| DeleteIngress | `delete_ingress` |

## SIP (16) — sip admin, except calls

| rpc | action |
| --- | --- |
| CreateSIPInboundTrunk | `create_sip_inbound_trunk` (flat fields, sent as `trunk`) |
| CreateSIPOutboundTrunk | `create_sip_outbound_trunk` (flat fields, sent as `trunk`) |
| UpdateSIPInboundTrunk | `update_sip_inbound_trunk` (fields → `update`, or `replace`) |
| UpdateSIPOutboundTrunk | `update_sip_outbound_trunk` (fields → `update`, or `replace`) |
| GetSIPInboundTrunk | `get_sip_inbound_trunk` (read-only) |
| GetSIPOutboundTrunk | `get_sip_outbound_trunk` (read-only) |
| ListSIPInboundTrunk | `list_sip_inbound_trunks` (read-only) |
| ListSIPOutboundTrunk | `list_sip_outbound_trunks` (read-only) |
| DeleteSIPTrunk | `delete_sip_trunk` |
| CreateSIPDispatchRule | `create_sip_dispatch_rule` (flat fields, sent as `dispatch_rule`) |
| UpdateSIPDispatchRule | `update_sip_dispatch_rule` (fields → `update`, or `replace`) |
| ListSIPDispatchRule | `list_sip_dispatch_rules` (read-only) |
| DeleteSIPDispatchRule | `delete_sip_dispatch_rule` |
| CreateSIPParticipant | `create_sip_participant` — sip call |
| TransferSIPParticipant | `transfer_sip_participant` — sip call + roomAdmin + room |
| ListSIPTrunk | skipped: deprecated in the proto; returns the same trunks `list_sip_inbound_trunks` / `list_sip_outbound_trunks` do |

## PhoneNumberService (6, Cloud) — sip admin

| rpc | action |
| --- | --- |
| SearchPhoneNumbers | `search_phone_numbers` (read-only) |
| PurchasePhoneNumber | `purchase_phone_number` |
| ListPhoneNumbers | `list_phone_numbers` (read-only) |
| GetPhoneNumber | `get_phone_number` (read-only) |
| UpdatePhoneNumber | `update_phone_number` |
| ReleasePhoneNumbers | `release_phone_numbers` |

## Connector (5, Cloud) — roomCreate (+ room when given)

| rpc | action |
| --- | --- |
| DialWhatsAppCall | `dial_whatsapp_call` |
| AcceptWhatsAppCall | `accept_whatsapp_call` |
| ConnectWhatsAppCall | `connect_whatsapp_call` |
| DisconnectWhatsAppCall | `disconnect_whatsapp_call` |
| ConnectTwilioCall | `connect_twilio_call` |

## AgentDispatchService (3) — roomAdmin + room

| rpc | action |
| --- | --- |
| CreateDispatch | `create_dispatch` |
| DeleteDispatch | `delete_dispatch` |
| ListDispatch | `list_dispatch` (read-only; with `dispatch_id` it's the SDKs' getDispatch) |

## CloudAgent (18, Cloud, agents.<domain>) — agent admin

| rpc | action |
| --- | --- |
| ListAgents | `list_agents` (read-only) |
| ListAgentVersions | `list_agent_versions` (read-only) |
| ListAgentSecrets | `list_agent_secrets` (read-only; names, not values) |
| UpdateAgentSecrets | `update_agent_secrets` (text in, base64 bytes on the wire) |
| UpdateAgent | `update_agent` |
| RestartAgent | `restart_agent` |
| RollbackAgent | `rollback_agent` |
| PromoteAgent | `promote_agent` |
| DeleteAgent | `delete_agent` |
| GetClientSettings | `get_client_settings` (read-only) |
| CreatePrivateLink | `create_private_link` |
| DestroyPrivateLink | `destroy_private_link` |
| ListPrivateLinks | `list_private_links` (read-only) |
| GetPrivateLinkStatus | `get_private_link_status` (read-only) |
| CreateAgent, CreateAgentV2, DeployAgent, DeployAgentV2 | skipped: they answer with a presigned upload URL for a tarball of the agent's source code, which `lk agent deploy` builds and uploads; an action can't supply source code, and an agent made without it never runs |

## Services left out

| service | why |
| --- | --- |
| AgentSimulation (cloud agent test runs) | Developer test tooling driven by `lk agent simulate`: runs need the agent's source uploaded (ConfirmSimulationSourceUpload) and live on LiveKit's separate cloud API host; several calls are user-auth only in the CLI |
| Replay (`cloud_replay.proto`) | Marked "experimental (not yet available)" and hidden in the CLI; no SDK client |
| `protobufs/rpc/*`, `roomrpc/*` | Internal psrpc between LiveKit's own servers, not reachable by a project key |
| `livekit_rtc.proto` (signal) | The WebSocket protocol a client joins a room with, not a server API |

## Auth

| Method | Status |
| --- | --- |
| API key + secret (with the project URL), pasted as one line | done; a fresh JWT per call, scoped to that call's grants |
| OAuth | LiveKit has none |

## Events

Not done: LiveKit's webhooks (room started/finished, participant joined/left, egress ended, …) need a URL set in
the project's settings and a receiver that checks the signed JWT; own apps have no triggers yet.
