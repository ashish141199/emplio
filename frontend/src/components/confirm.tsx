"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// safe: an everyday OK (mark done), not a red Delete button
type Ask = { title: string; description?: React.ReactNode; action?: string; safe?: boolean; onConfirm: () => void };

// The app's only way to confirm something: render `dialog` once, call `confirm({...})` from any click
// (menu items included). Never the browser's confirm().
export function useConfirm() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [open, setOpen] = useState(false);

  const dialog = (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{ask?.title}</AlertDialogTitle>
          {ask?.description && <AlertDialogDescription>{ask.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={ask?.safe ? "default" : "destructive"}
            onClick={() => {
              ask?.onConfirm();
              setOpen(false);
            }}
          >
            {ask?.action ?? "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // `ask` stays set after closing so the text doesn't blank out during the close animation
  const confirm = (a: Ask) => {
    setAsk(a);
    setOpen(true);
  };

  return [dialog, confirm] as const;
}
