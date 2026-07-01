// Auth API — login / refresh / me (FRONTEND_API.md §2).
//
// `audience` selects the session type: "staff" (firm users, token carries role)
// or "client" (portal users, token scoped to one clientId). The chosen audience
// is persisted alongside the tokens so the app knows which session is active.

import { api, tokens } from "./client";

// POST /auth/login → { user, accessToken, refreshToken }. Stores the tokens and
// returns the authenticated user/principal.
//
// Login is CREDENTIALS-ONLY: the email alone resolves the tenant server-side, and
// the issued token carries the firm internally (firmId claim). The frontend never
// sends or manages firmId/x-firm-id anywhere — not here, not on later calls.
// See ORG_ONBOARDING_AND_AUTH_CONTRACT.txt — "TENANT RESOLUTION".
export async function loginRequest({ email, password, audience = "staff" } = {}) {
  const data = await api("/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password, audience },
  });
  tokens.set({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    audience,
  });
  return data.user;
}

// GET /auth/me — the authenticated principal's profile.
export const getMe = () => api("/auth/me");

// Local sign-out: drop the tokens (no server call needed for stateless JWTs).
export function logoutRequest() {
  tokens.clear();
}
