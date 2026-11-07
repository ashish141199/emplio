import { Suspense } from "react";
import { ChatPage } from "@/components/chat/chat-page";

// The chat layout renders nothing until the login check finishes, so there is no static shell to validate.
export const instant = false;

// ChatPage reads the URL on the client, so it needs a Suspense boundary for the static shell.
export default function Page() {
  return (
    <Suspense>
      <ChatPage />
    </Suspense>
  );
}
