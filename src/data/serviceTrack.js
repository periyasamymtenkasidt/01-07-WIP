// Service track — the single top-level branch that splits a project into two
// delivery pipelines from the lead onward:
//   • Interiors    — fit out an existing space (measured survey → design → BOQ → execute)
//   • Architecture — build from land (site appraisal → schematic/DD → approvals → tender → CA)
//
// This is the ONE field the system branches on. Residential vs Commercial is not a
// separate driving field — it's implied by what comes next (property type for
// interiors, project intent for architecture), so the lead asks only this.

export const SERVICE_TRACKS = ["Interiors", "Architecture"];

// Plain-language options for the lead picker.
export const SERVICE_TRACK_OPTIONS = [
  {
    value: "Interiors",
    title: "Interiors",
    desc: "Fit out an existing space (apartment, office, villa)",
  },
  {
    value: "Architecture",
    title: "Architecture",
    desc: "Design & build from land (new construction)",
  },
];

// Architecture-only lead intake options (Interiors uses property preset instead).
export const PROJECT_INTENTS = [
  "Residential Building",
  "Commercial",
  "Mixed-use",
  "Institutional",
  "Industrial",
];
export const LAND_OWNERSHIP = ["Owned", "Under purchase", "Disputed / Unknown"];

export const resolveServiceTrack = (record) =>
  record?.serviceTrack || "Interiors";

export const isArchitecture = (record) =>
  resolveServiceTrack(record) === "Architecture";
