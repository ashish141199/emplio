// No billing in the open-source version: nothing is metered and Emplio is never paused. You pay your AI and other
// providers directly, with your own keys.
export const appUrl = (path = "") => `${process.env.FRONTEND_URL ?? "http://localhost:3000"}${path}`;

export type Bill = { workspaceId: string; userId?: string | null; conversationId?: string | null; agent?: string };
export type UsageKind = "ai" | "computer" | "browser" | "search";

export const chargeQuietly = (_bill: Bill, _kind: UsageKind, _costUsd: number, _what: string, _o: { ownKey?: boolean; ref?: string } = {}) => {};
export const pausedReason = async (_workspaceId: string): Promise<string | null> => null;
