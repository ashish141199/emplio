import { Suspense } from "react";
import { FilesPage } from "@/components/files/files-page";

// The app layout renders nothing until the login check finishes, so there is no static shell to validate.
export const instant = false;

export default function Page() {
  // FilesPage reads ?open= on the client, so it needs a Suspense boundary for the static shell.
  return (
    <Suspense>
      <FilesPage />
    </Suspense>
  );
}
