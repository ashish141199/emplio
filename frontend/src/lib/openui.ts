// The components the model may use in replies. `bun run openui:generate` turns this into the
// system prompt the backend sends (shared/openui/system-prompt.txt); rerun it after changing this file.
// From the package's main entry, not "/genui-lib": that bundle has its own copy of the theme, so ThemeProvider's
// chart colours never reach its charts and they all come out in its built-in shades of blue.
export {
  openuiChatLibrary as library,
  openuiChatPromptOptions as promptOptions,
} from "@openuidev/react-ui";
