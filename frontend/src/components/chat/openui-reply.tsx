"use client";

import { BuiltinActionType, Renderer, type ActionEvent } from "@openuidev/react-lang";
import { ThemeProvider } from "@openuidev/react-ui";
import { library } from "@/lib/openui";
import { openuiTheme } from "@/lib/openui-theme";
import { useDark } from "@/lib/theme";
import { CLICK_PREFIX } from "@/components/chat/assistant-reply";

// A click in generated UI becomes the next user message; the model also needs any form values.
function toModelMessage(event: ActionEvent) {
  const lines = [CLICK_PREFIX + event.humanFriendlyMessage];
  if (event.formState) lines.push(`Form values: ${JSON.stringify(event.formState)}`);
  return lines.join("\n");
}

// Its own file so OpenUI's components (charts, code highlighting) load only once a reply uses them.
export default function OpenUIReply({ text, streaming, onSend }: { text: string; streaming: boolean; onSend: (text: string) => void }) {
  const dark = useDark();
  return (
    <ThemeProvider mode={dark ? "dark" : "light"} lightTheme={openuiTheme}>
      <Renderer
        response={text}
        library={library}
        isStreaming={streaming}
        onAction={(event) => {
          if (event.type === BuiltinActionType.ContinueConversation) onSend(toModelMessage(event));
          else if (event.type === BuiltinActionType.OpenUrl)
            window.open(String(event.params?.url), "_blank", "noopener,noreferrer");
        }}
      />
    </ThemeProvider>
  );
}
