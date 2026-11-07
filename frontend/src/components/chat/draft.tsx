"use client";

import { uuid } from "@/lib/utils";
import { createContext, useCallback, useContext, useState } from "react";

// Id for the not-yet-saved chat shown at /chat. It becomes the conversation id on first send.
const DraftContext = createContext<{ draftId: string; newDraft: () => void } | null>(null);

export const useDraft = () => useContext(DraftContext)!;

export function DraftProvider({ children }: { children: React.ReactNode }) {
  const [draftId, setDraftId] = useState(() => uuid());
  const newDraft = useCallback(() => setDraftId(uuid()), []);
  return <DraftContext.Provider value={{ draftId, newDraft }}>{children}</DraftContext.Provider>;
}
