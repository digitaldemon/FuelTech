// Contract Desk access list — personal tool, not a member feature.
// Every analysis costs real Anthropic API credits, so only these usernames
// may load the page or hit the /api/desk endpoints.
// Override without a code change by setting DESK_USERS="bill,other" on Vercel.
const DEFAULT_USERS = ["bill"];

export function deskUsers(): string[] {
  const env = process.env.DESK_USERS;
  if (!env) return DEFAULT_USERS;
  return env
    .split(",")
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean);
}

export function isDeskUser(username: string | undefined | null): boolean {
  if (!username) return false;
  return deskUsers().includes(username.toLowerCase());
}
