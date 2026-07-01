// Colour helper for room/category chips and dots in the item catalog.
// Item `category` is now a room NAME (from Master → Schedule), so we map a
// name → a stable colour. Familiar rooms keep their classic colour; custom
// rooms get a deterministic colour from the palette so the UI stays varied.

export const COLOR_MAP = {
  blue: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", bar: "bg-blue-500", dot: "bg-blue-500" },
  orange: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", bar: "bg-orange-500", dot: "bg-orange-500" },
  purple: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", bar: "bg-purple-500", dot: "bg-purple-500" },
  teal: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200", bar: "bg-teal-500", dot: "bg-teal-500" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", bar: "bg-amber-500", dot: "bg-amber-500" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", bar: "bg-indigo-500", dot: "bg-indigo-500" },
  slate: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200", bar: "bg-slate-500", dot: "bg-slate-500" },
  gray: { bg: "bg-bg-soft", text: "text-text-muted", border: "border-bordergray", bar: "bg-text-subtle", dot: "bg-text-subtle" },
};

const PALETTE = ["blue", "orange", "purple", "teal", "amber", "indigo", "slate"];

// Preferred colours so the classic rooms look the same as before.
const PREFERRED = {
  "Living Room": "blue",
  Dining: "blue",
  Kitchen: "orange",
  Utility: "slate",
  "Master Bedroom": "purple",
  "Bedroom 2": "purple",
  "Bedroom 3": "purple",
  Bathrooms: "teal",
  Foyer: "amber",
  Staircase: "slate",
  Balcony: "amber",
  "Pooja Room": "amber",
  Study: "indigo",
};

export function roomColorKey(name) {
  if (!name) return "gray";
  if (PREFERRED[name]) return PREFERRED[name];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export const roomColor = (name) => COLOR_MAP[roomColorKey(name)] || COLOR_MAP.gray;
