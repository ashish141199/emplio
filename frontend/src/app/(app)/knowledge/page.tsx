import { Suspense } from "react";
import { KnowledgePage } from "@/components/knowledge/knowledge-page";

// The app layout renders nothing until the login check finishes, so there is no static shell to validate.
export const instant = false;

export default function Page() {
  // KnowledgePage reads the URL on the client, so it needs a Suspense boundary for the static shell.
  return (
    <Suspense>
      <KnowledgePage />
    </Suspense>
  );
}
