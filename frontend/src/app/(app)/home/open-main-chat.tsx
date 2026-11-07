"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useConversations } from "@/lib/api";

// Where the app opens: the person's main chat (the same one as on their phone). The server makes it on first look.

export function OpenMainChat() {
  const router = useRouter();
  const { data } = useConversations();
  const main = data?.find((c) => c.kind === "main");
  useEffect(() => {
    if (data) router.replace(main ? `/chat/${main.id}` : "/chat");
  }, [data, main, router]);
  return null;
}
