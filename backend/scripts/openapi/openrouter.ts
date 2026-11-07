// OpenRouter: what the generator (../openapi-actions.ts) can't tell from the spec.
import type { AppConfig } from "../openapi-actions";

export default {
  spec: "https://openrouter.ai/openapi.json",
  out: "src/integrations/own/openrouter/actions.json",
  rename: {
    send_chat_completion_request: "chat_completion",
    list: "list_keys",
    create_keys: "create_key",
    delete_keys: "delete_key",
    update_keys: "update_key",
    create_batches: "create_batch",
    get_batches: "get_batch",
    get_models: "get_all_models",
    list_endpoints: "list_model_endpoints",
    create_messages: "create_message",
    create_responses: "create_response",
    create_videos: "create_video",
    get_videos: "get_video",
    list_videos_content: "download_video",
    create_images: "create_image",
  },
  skip: {
    exchangeAuthCodeForAPIKey: "the second half of OpenRouter's sign-in for other apps; we connect with a pasted key",
    createAuthKeysCode: "the first half of OpenRouter's sign-in for other apps; we connect with a pasted key",
  },
  // answers only (billed like generate, which runs without asking); images and video cost more, so they ask
  reads: [
    "chat_completion",
    "create_message",
    "create_response",
    "create_embeddings",
    "create_rerank",
    "create_audio_speech",
    "create_audio_transcriptions",
    "query_analytics",
  ],
  // attribution headers for apps listed on openrouter.ai's rankings; nothing a business needs
  drop: { "*": ["HTTP-Referer", "X-OpenRouter-Title", "X-OpenRouter-Categories", "X-Title"] },
} satisfies AppConfig;
