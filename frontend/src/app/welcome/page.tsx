"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WelcomePage } from "@/components/welcome/welcome-page";
import { useMe } from "@/lib/api";

// outside the app's sidebar layout, full screen; the same login check as it
export default function Page() {
  const router = useRouter();
  const { data: me, isPending } = useMe();
  useEffect(() => {
    if (!isPending && !me?.user.name) router.replace("/login?next=/welcome");
  }, [isPending, me, router]);
  if (!me?.user.name) return null;
  return (
    <TooltipProvider>
      <WelcomePage />
    </TooltipProvider>
  );
}
