// Limits on how often something may happen, counted per key (an IP address, an email) in a fixed window.
// ponytail: in memory, so one server and a restart forgets the counts; a shared store if there's ever a second server
const hits = new Map<string, { n: number; until: number }>();

// Counts this attempt; true when it's over `max` in the window.
export function tooMany(key: string, max: number, windowMs: number) {
  const now = Date.now();
  if (hits.size > 100_000) for (const [k, h] of hits) if (h.until <= now) hits.delete(k);
  const h = hits.get(key);
  if (!h || h.until <= now) {
    hits.set(key, { n: 1, until: now + windowMs });
    return false;
  }
  h.n++;
  return h.n > max;
}

// Starts over, once the person has proved who they are.
export const clearLimit = (key: string) => void hits.delete(key);
