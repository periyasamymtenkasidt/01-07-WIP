// Masters (config) API — FRONTEND_API.md §6.
//
// Each master is GET (read, any staff) + PUT (replace/upsert, needs
// MANAGE_MASTERS — a 403 means the role lacks it). PUT accepts a raw array or a
// wrapped object ({ items }, { presets }, …); org-profile & schedule-config take
// a plain object.

import { api } from "./client";

const get = (path) => () => api(path);
const put = (path) => (payload) => api(path, { method: "PUT", body: payload });

export const getQuotePresets = get("/masters/quote-presets");
export const putQuotePresets = put("/masters/quote-presets");

export const getItems = get("/masters/items");
export const putItems = put("/masters/items");

export const getMaterials = get("/masters/materials");
export const putMaterials = put("/masters/materials");

export const getTerms = get("/masters/terms");
export const putTerms = put("/masters/terms");

export const getOrgProfile = get("/masters/org-profile");
export const putOrgProfile = put("/masters/org-profile");

export const getPropertyTypes = get("/masters/property-types");
export const putPropertyTypes = put("/masters/property-types");

export const getScheduleConfig = get("/masters/schedule-config");
export const putScheduleConfig = put("/masters/schedule-config");

export const getProposalRooms = get("/masters/proposal-rooms");
export const putProposalRooms = put("/masters/proposal-rooms");
