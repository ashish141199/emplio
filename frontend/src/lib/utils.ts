export { cn } from "cn"

// crypto.randomUUID only exists on https/localhost; plain-http LAN (phone testing) needs the fallback
export const uuid = (): string =>
  crypto.randomUUID?.() ??
  "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0]! & (15 >> (+c / 4)))).toString(16),
  );

// navigator.clipboard too only exists on https/localhost: plain-http LAN (phone testing) copies the old way
export const copyText = async (text: string): Promise<void> => {
  if (navigator.clipboard) return navigator.clipboard.writeText(text);
  const box = document.createElement("textarea");
  box.value = text;
  box.readOnly = true;
  // 16px: a phone zooms the page into a smaller field. Off screen, without scrolling the page to it.
  box.style.cssText = "position:fixed;top:0;left:-9999px;font-size:16px";
  document.body.append(box);
  box.select();
  box.setSelectionRange(0, text.length);
  const copied = document.execCommand("copy");
  box.remove();
  if (!copied) throw new Error("Couldn't copy");
};
