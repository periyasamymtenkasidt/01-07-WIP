// Units of measure and HSN references used in interior/architect BOQs.
// These are the dropdown sources for the BOQ line-item editor.

export const UNITS = [
  { code: "sqft", label: "Sq Ft" },
  { code: "sqm", label: "Sq M" },
  { code: "rmt", label: "Rmt" },
  { code: "mm", label: "MM" },
  { code: "nos", label: "Nos" },
  { code: "set", label: "Set" },
  { code: "pair", label: "Pair" },
  { code: "ltr", label: "Litre" },
  { code: "kg", label: "Kg" },
  { code: "lot", label: "Lot" },
  { code: "ls", label: "Lump Sum" },
  { code: "day", label: "Day" },
];

// Common HSN codes that show up in interior fit-out BOQs. Acts as suggestions
// in the autocomplete; not exhaustive — users can type any code.
export const HSN_SUGGESTIONS = [
  { code: "4410", desc: "Particle / MDF board" },
  { code: "4412", desc: "Plywood / veneer" },
  { code: "4418", desc: "Builders' joinery & carpentry" },
  { code: "4823", desc: "Paper / laminate" },
  { code: "9403", desc: "Furniture (modular, built-in)" },
  { code: "9405", desc: "Lighting fixtures" },
  { code: "6802", desc: "Stone — granite / marble" },
  { code: "6907", desc: "Ceramic tiles" },
  { code: "7610", desc: "Aluminium structures" },
  { code: "7308", desc: "Iron / steel structures" },
  { code: "3208", desc: "Paint & coatings" },
  { code: "8424", desc: "Mechanical appliances (sprays)" },
  { code: "8528", desc: "TV & display units" },
  { code: "9954", desc: "Construction services" },
  { code: "9983", desc: "Other professional services (design)" },
];

export const GST_OPTIONS = [0, 5, 12, 18, 28];

export const DEFAULT_PAYMENT_TERMS = [
  { label: "On signing", percent: 30 },
  { label: "On 50% completion", percent: 40 },
  { label: "On handover", percent: 30 },
];
