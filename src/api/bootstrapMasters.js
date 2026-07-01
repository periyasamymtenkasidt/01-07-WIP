// Masters bootstrap — pulls the backend's master config into the local
// write-through cache once a staff session exists.
//
// The masters modules (item/material library, schedule config, proposal rooms,
// property types, org profile, quote presets) are read SYNCHRONOUSLY in ~30
// places. To avoid rewriting every consumer, each module keeps its synchronous
// getters reading localStorage; this bootstrap refreshes that localStorage from
// the API after login, and each module's write pushes back to the API. Every
// hydrate is individually guarded and falls back to seeded local data on error,
// so a missing/slow backend never blocks the app.

import { tokens } from "./client";
import { hydrateItemLibrary } from "../data/itemLibrary";
import { hydrateMaterialLibrary } from "../data/materialLibrary";
import { hydrateOrgProfile } from "../data/orgProfile";
import { hydratePropertyTypes } from "../data/propertyTypeStorage";
import { hydrateScheduleConfig } from "../data/scheduleConfig";
import { hydrateProposalRooms } from "../data/proposalRooms";
import { hydrateQuotePresets } from "../data/QuotePresets";

// NOTE: termsStorage is intentionally NOT hydrated yet — the /masters/terms
// "upsert per category" shape is unverified, so terms stays on local seed data
// until the wire shape is confirmed.

let started = false;

// Hydrate all masters in parallel. Runs at most once per session unless `force`d
// (e.g. right after a fresh login). Safe to call eagerly — no-op when logged out.
export async function hydrateAllMasters({ force = false } = {}) {
  if (!tokens.access()) return;
  if (started && !force) return;
  started = true;
  await Promise.allSettled([
    hydrateItemLibrary(),
    hydrateMaterialLibrary(),
    hydrateOrgProfile(),
    hydratePropertyTypes(),
    hydrateScheduleConfig(),
    hydrateProposalRooms(),
    hydrateQuotePresets(),
  ]);
}

// Reset the once-per-session guard (call on logout so the next login re-hydrates).
export function resetMastersBootstrap() {
  started = false;
}
