// Item Master / Rate Library. A catalog of reusable BOQ line items.
// Stored under `item_library` in localStorage; ships with a curated set
// of common interior fit-out items so the library is useful from day one.

// Schedule Master days mapping commented out — reserved for future use.
// import { getRoomDefaultDays } from "./scheduleConfig";

import { getItems, putItems } from "../api/masters";
import { tokens } from "../api/client";
import { listMaterials } from "./materialLibrary";
import {
  seedRecipeFromMaterials,
  computeRecipe,
  materialsById,
} from "./rateBuildup";

const STORAGE_KEY = "item_library";

// Trade divisions used as the `category` value for architecture BOQ items.
// Mirrors the CSI/NBS division structure. Referenced by CategorySelect and
// LibraryPicker when filtering or grouping architecture catalog items.
export const ARCH_TRADE_DIVISIONS = [
  "Substructure",
  "Superstructure",
  "Masonry",
  "Finishes",
  "Roofing & Waterproofing",
  "Openings",
  "External Works",
  "MEP",
  "Professional Services",
  "Provisional Sums",
];

// Per-grade commercial loadings for a seeded rate build-up. Higher grade = more
// overhead + margin, so the same work costs more at a higher grade.
const GRADE_LOADINGS = {
  economy: { overheadPct: 5, marginPct: 10 },
  premium: { overheadPct: 10, marginPct: 20 },
  luxury: { overheadPct: 15, marginPct: 30 },
};

// Seed a per-grade rate build-up for a work from its free-text materials,
// pricing each against the Material Master (names line up by design). Labour
// backfills the gap so the ECONOMY grade's computed rate lands on the item's
// catalog rate where the materials are cheaper than it (labour is floored at 0
// when the materials alone already exceed the catalog rate). Premium / Luxury
// reuse the same material + labour base with higher overhead/margin. This is the
// same materials + build-up shape Proposal Master consumes via `lib.recipes`.
const buildRecipesForItem = (item, materials, matById) => {
  const base = seedRecipeFromMaterials(
    item.materials || [],
    materials,
    item.unit,
  );
  const materialCost = computeRecipe(base, matById).materialCost;
  const flatRate = Number(item.rate) || 0;
  const { overheadPct, marginPct } = GRADE_LOADINGS.economy;
  // economyRate = (materialCost + labour) × (1 + oh) / (1 − margin) → solve labour.
  const targetBase =
    (flatRate * (1 - marginPct / 100)) / (1 + overheadPct / 100);
  const labourRate = Math.max(0, Math.round(targetBase - materialCost));
  const recipes = {};
  for (const grade of ["economy", "premium", "luxury"]) {
    recipes[grade] = {
      ...base,
      components: base.components.map((c) => ({ ...c })),
      labourRate,
      consumables: 0,
      ...GRADE_LOADINGS[grade],
    };
  }
  return recipes;
};

// Backfill materials + rate build-up onto any stored work that predates the
// seeded recipes, so existing libraries also carry the build-up Proposal Master
// uses. No-op (returns the same array) when every item already has a recipe.
const ensureRecipes = (items) => {
  const missing = items.some(
    (it) => !it.recipes || Object.keys(it.recipes).length === 0,
  );
  if (!missing) return items;
  const materials = listMaterials();
  const matById = materialsById(materials);
  return items.map((it) =>
    it.recipes && Object.keys(it.recipes).length
      ? it
      : {
          ...it,
          defaultGrade: it.defaultGrade || "economy",
          recipes: buildRecipesForItem(it, materials, matById),
        },
  );
};

// Backend write-through helper. Best-effort, fire-and-forget: a failed PUT must
// never break the optimistic local write, so we swallow every error.
const pushMaster = (fn) => {
  try {
    Promise.resolve(fn()).catch(() => {});
  } catch {
    /* ignore */
  }
};

const genId = () =>
  `lib_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

// ── Default catalog ────────────────────────────────────────────────────────
// Categories use the same color keys as BOQ sections so insertion preserves
// visual grouping. Rates are mid-market reference figures — firms typically
// fine-tune these per project.
// Category-FREE work items. Each is a reusable work with its own unit, rate,
// days and materials. The room is chosen later in Proposal Master (Add Scope),
// not on the item. Material names line up with the Material Master so the rate
// build-up can price each work from live material rates.
const RAW_DEFAULT_LIBRARY = [
  {
    description: "False Ceiling — gypsum board with cove groove",
    spec: "Saint-Gobain 12.5 mm gypsum board on GI framework with cove groove profile. Includes GI channels, perimeter sections, anchor fasteners, and two coats of putty & premium emulsion ready for paint finish.",
    hsn: "9405", unit: "sqft", rate: 95, days: 4, gstPercent: 18,
    materials: [
      { name: "Gypsum Board", spec: "Saint-Gobain 12.5mm" },
      { name: "GI Framework", spec: "Channels + sections" },
      { name: "Putty & Paint", spec: "Asian / Dulux" },
    ],
    tags: ["ceiling", "gypsum"],
  },
  {
    description: "TV Unit — paneling with storage",
    spec: "Full-height TV unit with back-paneling in 19 mm BWP plywood, 1 mm laminate shutters with Hettich soft-close hinges. Includes open display shelves, concealed storage cabinets, and integrated cable management channels.",
    hsn: "9403", unit: "sqft", rate: 1300, days: 5, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "BWP 19mm" },
      { name: "Laminate", spec: "Greenply / Century" },
      { name: "Hardware", spec: "Hettich soft-close" },
    ],
    tags: ["tv unit", "living"],
  },
  {
    description: "Accent Wall Paneling — veneer / laminate",
    spec: "Wall paneling on 12 mm MR plywood base with natural/recon veneer or 1 mm laminate finish, panel grooves and flush reveals. Two coats of PU lacquer or paint finish as per design.",
    hsn: "4412", unit: "sqft", rate: 480, days: 3, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "MR 12mm base" },
      { name: "Veneer", spec: "Natural / Recon" },
      { name: "Putty & Paint", spec: "Asian / Dulux" },
    ],
    tags: ["accent", "wall", "panel"],
  },
  {
    description: "Cove / Profile Lighting",
    spec: "24 V Philips/Wipro LED strip in concealed GI/aluminium cove profile. Includes concealed wiring, power driver unit, and dimmer provision. Rate per running metre of installed cove.",
    hsn: "9405", unit: "rmt", rate: 320, days: 2, gstPercent: 18,
    materials: [{ name: "LED Lighting", spec: "Philips / Wipro 24V" }],
    tags: ["lighting", "cove", "led"],
  },
  {
    description: "Crockery Unit — glass shutters + lighting",
    spec: "Crockery unit in 18 mm MR plywood with 1 mm laminate finish, 5 mm clear toughened glass shutters with Hafele SS fittings, and LED strip lighting inside display compartments.",
    hsn: "9403", unit: "sqft", rate: 1400, days: 5, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "MR 18mm" },
      { name: "Toughened Glass", spec: "5mm clear" },
      { name: "LED Lighting", spec: "LED strip" },
      { name: "Hardware", spec: "Hafele" },
    ],
    tags: ["crockery", "dining"],
  },
  {
    description: "Modular Kitchen Base Unit",
    spec: "Modular kitchen base carcass in 19 mm BWP plywood with 1 mm laminate shutters, Hettich soft-close drawer channels and hinges, plinth, kickboard, and all internal fittings. Rate per running metre.",
    hsn: "9403", unit: "rmt", rate: 6500, days: 6, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "BWP 19mm" },
      { name: "Laminate", spec: "1mm" },
      { name: "Hardware", spec: "Hettich soft-close" },
    ],
    tags: ["kitchen", "base", "modular"],
  },
  {
    description: "Modular Kitchen Wall Unit",
    spec: "Modular kitchen wall-hung carcass in 18 mm BWP plywood with 1 mm laminate shutters, Hafele lift-up or swing hinges, internal adjustable shelves, and concealed mounting brackets. Rate per running metre.",
    hsn: "9403", unit: "rmt", rate: 4800, days: 5, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "BWP 18mm" },
      { name: "Laminate", spec: "1mm" },
      { name: "Hardware", spec: "Hafele lift-up" },
    ],
    tags: ["kitchen", "wall", "modular"],
  },
  {
    description: "Kitchen Counter — granite / quartz",
    spec: "20 mm polished granite or engineered quartz counter slab on kitchen base units with 150 mm upstand. Includes sink/hob cut-outs, edge profiling, and silicone sealing. Rate per running metre.",
    hsn: "6802", unit: "rmt", rate: 1200, days: 2, gstPercent: 18,
    materials: [{ name: "Granite", spec: "20mm polished" }],
    tags: ["kitchen", "counter", "granite"],
  },
  {
    description: "Wardrobe — laminate, soft-close",
    spec: "Floor-to-ceiling wardrobe in 18 mm MR plywood with 1 mm matte laminate shutters, Hettich soft-close hinges, internal shelves, hanging rods, and 5 mm mirror panel on one shutter. Rate per sq ft of wardrobe face.",
    hsn: "9403", unit: "sqft", rate: 1250, days: 6, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "MR 18mm" },
      { name: "Laminate", spec: "1mm" },
      { name: "Hardware", spec: "Hettich soft-close" },
      { name: "Mirror", spec: "5mm" },
    ],
    tags: ["wardrobe", "bedroom"],
  },
  {
    description: "Wardrobe — premium veneer finish",
    spec: "Floor-to-ceiling wardrobe in 19 mm BWP plywood with natural veneer shutters and multi-coat PU lacquer, Hafele soft-close hinges, internal organiser trays, hanging rail, and tie-rack. Rate per sq ft of wardrobe face.",
    hsn: "9403", unit: "sqft", rate: 1750, days: 6, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "BWP 19mm" },
      { name: "Veneer", spec: "Natural + PU coat" },
      { name: "Hardware", spec: "Hafele soft-close" },
    ],
    tags: ["wardrobe", "premium", "bedroom"],
  },
  {
    description: "Bed Back Panel — upholstered",
    spec: "Headboard-style bed back panel in 18 mm MR plywood base with high-density foam padding and fabric/leatherette upholstery. Button tufting or channel-quilted pattern as per design. Rate per sq ft.",
    hsn: "9403", unit: "sqft", rate: 650, days: 4, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "MR 18mm base" },
      { name: "Upholstery", spec: "Foam + fabric" },
      { name: "Laminate", spec: "1mm" },
    ],
    tags: ["bed", "back panel", "bedroom"],
  },
  {
    description: "Dresser Unit — with mirror",
    spec: "Dresser unit in 18 mm MR plywood with 1 mm laminate finish, 5 mm bevelled mirror panel, Hettich soft-close drawer slides, and integrated power point provision. Rate per sq ft.",
    hsn: "9403", unit: "sqft", rate: 900, days: 3, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "MR 18mm" },
      { name: "Laminate", spec: "1mm" },
      { name: "Mirror", spec: "5mm" },
      { name: "Hardware", spec: "Hettich" },
    ],
    tags: ["dresser", "bedroom"],
  },
  {
    description: "Study / Work Desk — built-in",
    spec: "Built-in study desk in 18 mm BWR plywood with 1 mm laminate top and front finish, Hettich drawer channels, cable management grommet, knee-space panel, and wall-mounted overhead shelving. Rate per running metre.",
    hsn: "9403", unit: "rmt", rate: 3500, days: 4, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "BWR 18mm" },
      { name: "Laminate", spec: "1mm" },
      { name: "Hardware", spec: "Hettich" },
    ],
    tags: ["desk", "study", "office"],
  },
  {
    description: "Shoe Rack — with bench top",
    spec: "Shoe rack in 18 mm MR plywood with 1 mm matte laminate finish, angled open footwear shelves, and padded bench top for seating. Hettich hinges on enclosed lower compartments. Rate per sq ft.",
    hsn: "9403", unit: "sqft", rate: 950, days: 3, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "MR 18mm" },
      { name: "Laminate", spec: "1mm matte" },
      { name: "Hardware", spec: "Hettich" },
    ],
    tags: ["shoe rack", "foyer"],
  },
  {
    description: "Bathroom Vanity — marine ply + counter",
    spec: "Bathroom vanity carcass in marine plywood with 1 mm laminate shutters, 20 mm granite counter slab with wash basin cut-out, silicone sealing, and plumbing connection allowance. Rate per running metre.",
    hsn: "9403", unit: "rmt", rate: 3200, days: 3, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "Marine ply" },
      { name: "Laminate", spec: "1mm" },
      { name: "Granite", spec: "20mm counter" },
    ],
    tags: ["vanity", "bath"],
  },
  {
    description: "Shower Glass Partition — 8mm toughened",
    spec: "8 mm clear toughened glass shower enclosure with SS patch fittings, aluminium wall channels, pivot or sliding door hardware, and waterproof silicone sealing at all joints. Rate per sq ft of glass area.",
    hsn: "7610", unit: "sqft", rate: 580, days: 2, gstPercent: 18,
    materials: [{ name: "Toughened Glass", spec: "8mm + SS fittings" }],
    tags: ["shower", "partition", "bath"],
  },
  {
    description: "Foyer Console — with mirror",
    spec: "Foyer console table in 18 mm MR plywood with 1 mm laminate finish, 6 mm antique or plain mirror panel above, and decorative metal legs or solid plinth base as per design. Rate per sq ft.",
    hsn: "9403", unit: "sqft", rate: 1100, days: 2, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "MR 18mm" },
      { name: "Laminate", spec: "1mm" },
      { name: "Mirror", spec: "Antique 6mm" },
    ],
    tags: ["console", "foyer"],
  },
  {
    description: "Wall Mirror Panel",
    spec: "5 mm Saint-Gobain plain or antique mirror panel with bevelled edges, fixed using mirror adhesive and concealed SS mirror clips. Perimeter finished with chrome or SS beading as per design. Rate per sq ft.",
    hsn: "7009", unit: "sqft", rate: 650, days: 1, gstPercent: 18,
    materials: [{ name: "Mirror", spec: "Saint-Gobain 5mm" }],
    tags: ["mirror", "wall"],
  },
  {
    description: "Site Supervision & Project Management",
    spec: "Dedicated site supervisor and project manager for the full fit-out duration, covering daily progress monitoring, subcontractor coordination, quality and safety checks, client reporting, and snagging/close-out. Lump sum per project.",
    hsn: "9954", unit: "ls", rate: 50000, days: 0, gstPercent: 18,
    materials: [],
    tags: ["service", "pm"],
  },
  {
    description: "Design & 3D Visualization",
    spec: "Full conceptual design, space planning, material board, and photorealistic 3D visualization for all project areas. Includes up to three design revision rounds, client presentation, and final working drawings. Lump sum per project.",
    hsn: "9983", unit: "ls", rate: 35000, days: 0, gstPercent: 18,
    materials: [],
    tags: ["service", "design"],
  },

  // ── Sample / dummy catalog works (demo data) ───────────────────────────────
  // Extra static sample items so the Item Master shows a fuller catalog out of
  // the box. Their rate build-up is generated by the same dynamic flow as the
  // rest (materials line up with the Material Master), so nothing special is
  // needed here — they are just additional static seed entries.
  {
    description: "Sample — Wooden Laminate Flooring",
    spec: "8 mm AC4-grade laminate plank flooring on MR ply underlay with click-lock joints, perimeter floor beading, and threshold strips at door openings. Rate per sq ft of floor area.",
    hsn: "4411", unit: "sqft", rate: 180, days: 3, gstPercent: 18,
    materials: [
      { name: "Laminate", spec: "8mm AC4 plank" },
      { name: "Plywood", spec: "MR ply underlay" },
    ],
    tags: ["sample", "flooring"],
  },
  {
    description: "Sample — Pooja Unit with carving",
    spec: "Dedicated pooja unit in 19 mm BWP plywood with teak veneer and multi-coat PU lacquer finish, CNC-routed or hand-carved decorative motifs, brass fittings, and concealed LED lighting inside the niche. Rate per sq ft.",
    hsn: "9403", unit: "sqft", rate: 1600, days: 5, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "BWP 19mm" },
      { name: "Veneer", spec: "Teak veneer + PU" },
      { name: "Hardware", spec: "Brass fittings" },
    ],
    tags: ["sample", "pooja"],
  },
  {
    description: "Sample — Glass Partition with frame",
    spec: "10 mm clear toughened glass partition panels in SS/aluminium top-and-bottom track framing with SS patch fittings, concealed glass door pivot, and floor spring. Rate per sq ft of glass area.",
    hsn: "7610", unit: "sqft", rate: 720, days: 2, gstPercent: 18,
    materials: [
      { name: "Toughened Glass", spec: "10mm clear" },
      { name: "Hardware", spec: "SS patch fittings" },
    ],
    tags: ["sample", "partition"],
  },
  {
    description: "Sample — Wall Painting (premium emulsion)",
    spec: "Surface preparation including two coats of wall putty, sanding, one coat of primer, and two coats of premium acrylic emulsion in client-selected colour. Includes masking and drop-sheet protection. Rate per sq ft of painted area.",
    hsn: "3209", unit: "sqft", rate: 42, days: 2, gstPercent: 18,
    materials: [
      { name: "Putty & Paint", spec: "Putty + 2 coats premium emulsion" },
    ],
    tags: ["sample", "paint"],
  },

  // ── Extended catalog works (static seed) ───────────────────────────────────
  // Additional interior fit-out works so the Item Master ships with a fuller
  // catalog. Materials line up with the Material Master, so the dynamic rate
  // build-up prices each one automatically — same as the core catalog.
  {
    description: "Wall Cladding — natural stone veneer",
    spec: "10 mm natural stone veneer or slate cladding tiles adhered to wall surface using specialised tile adhesive and cladding clips, with pointed/grouted joints and protective sealant finish. Rate per sq ft.",
    hsn: "6802", unit: "sqft", rate: 420, days: 3, gstPercent: 18,
    materials: [
      { name: "Granite", spec: "Stone veneer 10mm" },
      { name: "Hardware", spec: "Cladding clips / adhesive" },
    ],
    tags: ["cladding", "stone", "wall"],
  },
  {
    description: "POP Cornice & Molding",
    spec: "POP plaster cornice and decorative molding profile at ceiling-to-wall junction, applied over backing coat with finish plaster and putty ready for painting. Rate per running metre.",
    hsn: "6809", unit: "rmt", rate: 180, days: 2, gstPercent: 18,
    materials: [
      { name: "Gypsum Board", spec: "POP cornice profile" },
      { name: "Putty & Paint", spec: "Finish coat" },
    ],
    tags: ["pop", "cornice", "ceiling"],
  },
  {
    description: "Kitchen Tall Unit — pantry storage",
    spec: "Floor-to-ceiling kitchen pantry tall unit in 19 mm BWP plywood with 1 mm laminate shutters, Hettich tandem pull-out baskets, soft-close hinges, and adjustable internal shelves. Rate per running metre.",
    hsn: "9403", unit: "rmt", rate: 7200, days: 6, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "BWP 19mm" },
      { name: "Laminate", spec: "1mm" },
      { name: "Hardware", spec: "Tandem pull-out (Hettich)" },
    ],
    tags: ["kitchen", "tall unit", "pantry"],
  },
  {
    description: "Bar Unit — with bottle storage",
    spec: "Bar unit in 19 mm BWP plywood with dark veneer and multi-coat PU lacquer, toughened glass display shelves with SS brackets, LED strip shelf lighting, and open wine/bottle-storage rack. Rate per sq ft.",
    hsn: "9403", unit: "sqft", rate: 1500, days: 5, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "BWP 19mm" },
      { name: "Veneer", spec: "Dark veneer + PU" },
      { name: "Toughened Glass", spec: "Glass shelves" },
      { name: "LED Lighting", spec: "Shelf LED" },
    ],
    tags: ["bar", "living", "dining"],
  },
  {
    description: "Bookshelf — open + closed storage",
    spec: "Bookshelf in 18 mm MR plywood with 1 mm laminate finish: open display shelves in the upper section and Hettich soft-close hinged cabinets in the lower half. Rate per sq ft.",
    hsn: "9403", unit: "sqft", rate: 1050, days: 4, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "MR 18mm" },
      { name: "Laminate", spec: "1mm" },
      { name: "Hardware", spec: "Hettich" },
    ],
    tags: ["bookshelf", "study"],
  },
  {
    description: "Loft / Overhead Storage Unit",
    spec: "Overhead loft storage unit in 18 mm MR plywood with 1 mm laminate finish and soft-close lift-up or hinged shutters. Concealed wall-mounting bracket system. Rate per sq ft of shutter face.",
    hsn: "9403", unit: "sqft", rate: 900, days: 3, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "MR 18mm" },
      { name: "Laminate", spec: "1mm" },
      { name: "Hardware", spec: "Soft-close hinges" },
    ],
    tags: ["loft", "storage", "bedroom"],
  },
  {
    description: "Wallpaper — premium textured",
    spec: "Supply and installation of premium textured or 3D wallpaper on primer-coated wall surface, with pattern matching, flush seam finishing, and border trim as per design. Rate per sq ft of covered wall area.",
    hsn: "4814", unit: "sqft", rate: 120, days: 1, gstPercent: 18,
    materials: [{ name: "Putty & Paint", spec: "Primer base" }],
    tags: ["wallpaper", "wall"],
  },
  {
    description: "Modular Office Workstation",
    spec: "Modular workstation in prelam board/MR plywood frame with 1 mm laminate top, modesty panel, partition privacy screen, cable management channels, and under-desk pedestal unit with soft-close drawers. Rate per workstation.",
    hsn: "9403", unit: "nos", rate: 18000, days: 4, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "Prelam board" },
      { name: "Laminate", spec: "1mm" },
      { name: "Hardware", spec: "Cable manager + channels" },
    ],
    tags: ["office", "workstation"],
  },
  {
    description: "Reception Desk — with branding panel",
    spec: "Custom reception counter in 19 mm BWP plywood with veneer/PU lacquer front cladding, backlit LED logo or branding panel, laminate counter top with edge banding, and concealed cable routing. Rate per running metre.",
    hsn: "9403", unit: "rmt", rate: 9500, days: 6, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "BWP 19mm" },
      { name: "Veneer", spec: "Branding veneer + PU" },
      { name: "LED Lighting", spec: "Backlit logo" },
    ],
    tags: ["office", "reception"],
  },
  {
    description: "Glass Office Partition — framed",
    spec: "10 mm clear toughened glass panels in powder-coated aluminium top-and-bottom track framing with SS patch fittings, full-height glass swing door, and floor spring. Rate per sq ft of glass area.",
    hsn: "7610", unit: "sqft", rate: 850, days: 3, gstPercent: 18,
    materials: [
      { name: "Toughened Glass", spec: "10mm" },
      { name: "Hardware", spec: "Aluminium frame + fittings" },
    ],
    tags: ["office", "partition", "glass"],
  },
  {
    description: "Sofa — upholstered 3-seater",
    spec: "3-seater sofa on seasoned plywood and hardwood frame with high-density foam cushioning, rubberised webbing base support, and client-selected fabric or leatherette upholstery. Solid wood or metal legs as per design. Rate per unit.",
    hsn: "9401", unit: "nos", rate: 42000, days: 7, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "Seasoned frame ply" },
      { name: "Upholstery", spec: "High-density foam + fabric" },
    ],
    tags: ["sofa", "living", "furniture"],
  },
  {
    description: "Engineered Wooden Flooring",
    spec: "Engineered oak or walnut wood flooring with HDF core underlay, tongue-and-groove locking planks, perimeter expansion gap, matching timber beading, and threshold strips at door openings. Rate per sq ft of floor area.",
    hsn: "4411", unit: "sqft", rate: 260, days: 3, gstPercent: 18,
    materials: [
      { name: "Veneer", spec: "Engineered oak top layer" },
      { name: "Plywood", spec: "HDF core underlay" },
    ],
    tags: ["flooring", "wood"],
  },
];

// ── Architecture seed catalog ──────────────────────────────────────────────
// Work items for architecture (civil/structural) projects. Each item carries:
//   • `workCode`  — CSI/NBS-style two-level code (e.g. "01.01")
//   • `category`  — one of ARCH_TRADE_DIVISIONS
//   • `discipline` — set to "architecture" in ARCH_DEFAULT_LIBRARY below
// Material names line up with the Material Master so the rate build-up can
// price each work from live material rates (same mechanism as interior items).
const ARCH_RAW_DEFAULT_LIBRARY = [
  // 01 – Substructure
  {
    workCode: "01.01",
    description: "Earthwork Excavation",
    spec: "Excavation in all types of soil including hard murrum and soft rock for foundations, trenches, pits and drains to required depth and profile. Includes shoring, dewatering, refilling with excavated earth in layers and disposing of surplus earth up to 50 m lead. Rate per cum of excavation.",
    hsn: "9954", unit: "cum", rate: 380, days: 3, gstPercent: 18,
    category: "Substructure", materials: [],
    tags: ["earthwork", "excavation", "foundation"],
  },
  {
    workCode: "01.02",
    description: "Plain Cement Concrete (PCC) M10",
    spec: "Plain cement concrete M10 grade (1:3:6 nominal mix) using 40mm HBG metal, river sand and 43-grade OPC cement, laid as bed concrete for foundations, footings and floor areas, including curing for 7 days. Rate per cum.",
    hsn: "9954", unit: "cum", rate: 4800, days: 2, gstPercent: 18,
    category: "Substructure",
    materials: [
      { name: "Cement (OPC 43)", spec: "43-grade OPC" },
      { name: "Aggregate", spec: "40mm HBG metal" },
      { name: "Sand", spec: "River sand" },
    ],
    tags: ["pcc", "concrete", "foundation"],
  },
  {
    workCode: "01.03",
    description: "RCC Foundation — M20 with Fe500 steel",
    spec: "Reinforced cement concrete M20 grade (1:1.5:3) for footings, raft, combined and isolated foundations with Fe500 TMT rebar as per structural drawings. Includes formwork, concrete, steel, curing and dewatering. Rate per cum of concrete in place.",
    hsn: "9954", unit: "cum", rate: 7500, days: 5, gstPercent: 18,
    category: "Substructure",
    materials: [
      { name: "Cement (OPC 53)", spec: "53-grade OPC" },
      { name: "Aggregate", spec: "20mm HBG metal" },
      { name: "Sand", spec: "River sand" },
      { name: "Steel", spec: "Fe500 TMT rebar" },
    ],
    tags: ["rcc", "foundation", "concrete"],
  },
  // 02 – Superstructure
  {
    workCode: "02.01",
    description: "RCC Columns — M25 with Fe500 steel",
    spec: "Reinforced cement concrete M25 grade columns of all shapes and sizes as per structural drawings, including plywood formwork, Fe500 TMT steel, casting, vibrating, curing and stripping. Rate per cum of concrete placed.",
    hsn: "9954", unit: "cum", rate: 9200, days: 4, gstPercent: 18,
    category: "Superstructure",
    materials: [
      { name: "Cement (OPC 53)", spec: "53-grade OPC" },
      { name: "Aggregate", spec: "20mm HBG metal" },
      { name: "Steel", spec: "Fe500 TMT rebar" },
    ],
    tags: ["columns", "rcc", "structure"],
  },
  {
    workCode: "02.02",
    description: "RCC Beams & Slabs — M25 with Fe500 steel",
    spec: "Reinforced cement concrete M25 grade beams, lintels and flat slabs as per structural drawings. Includes bottom and side plywood formwork (with staging and props), Fe500 TMT steel, casting, vibrating, curing and stripping. Rate per cum of concrete placed.",
    hsn: "9954", unit: "cum", rate: 8800, days: 6, gstPercent: 18,
    category: "Superstructure",
    materials: [
      { name: "Cement (OPC 53)", spec: "53-grade OPC" },
      { name: "Aggregate", spec: "20mm HBG metal" },
      { name: "Steel", spec: "Fe500 TMT rebar" },
    ],
    tags: ["beams", "slabs", "rcc", "structure"],
  },
  {
    workCode: "02.03",
    description: "RCC Staircase — M25 with Fe500 steel",
    spec: "Reinforced cement concrete M25 staircases including inclined slab, landings, steps and newel posts. Includes formwork, Fe500 TMT steel, casting, curing and striking of shuttering. Rate per cum of concrete placed.",
    hsn: "9954", unit: "cum", rate: 10500, days: 4, gstPercent: 18,
    category: "Superstructure",
    materials: [
      { name: "Cement (OPC 53)", spec: "53-grade OPC" },
      { name: "Steel", spec: "Fe500 TMT rebar" },
    ],
    tags: ["staircase", "rcc"],
  },
  // 03 – Masonry
  {
    workCode: "03.01",
    description: "Brick Masonry — CM 1:5",
    spec: "230mm / 115mm thick first-class red brick masonry in cement mortar 1:5 for external/internal walls as per approved drawings. Includes raking joints, scaffolding, curing and cleaning. Rate per cum of masonry in position.",
    hsn: "9954", unit: "cum", rate: 4500, days: 4, gstPercent: 18,
    category: "Masonry",
    materials: [
      { name: "Cement (OPC 43)", spec: "43-grade OPC" },
      { name: "Sand", spec: "River sand" },
    ],
    tags: ["brickwork", "masonry", "wall"],
  },
  {
    workCode: "03.02",
    description: "AAC Block Masonry — 200mm / 100mm",
    spec: "200mm or 100mm thick Autoclaved Aerated Concrete (AAC) block masonry in cement mortar 1:6 or block adhesive for partition and infill walls. Includes lintel bands at every course junction and curing. Rate per sqm of wall in position.",
    hsn: "9954", unit: "sqm", rate: 1350, days: 3, gstPercent: 18,
    category: "Masonry",
    materials: [
      { name: "Cement (OPC 43)", spec: "43-grade OPC" },
      { name: "Sand", spec: "M-sand" },
    ],
    tags: ["aac", "blockwork", "masonry"],
  },
  // 04 – Finishes
  {
    workCode: "04.01",
    description: "Internal Cement Plaster — 12mm CM 1:4",
    spec: "12mm thick single-coat cement plaster in CM 1:4 on brick/block walls including screeding to straight surface, curing, scaffolding and incidental work. Rate per sqm of plastered surface.",
    hsn: "9954", unit: "sqm", rate: 240, days: 2, gstPercent: 18,
    category: "Finishes",
    materials: [
      { name: "Cement (OPC 43)", spec: "43-grade OPC" },
      { name: "Sand", spec: "M-sand" },
    ],
    tags: ["plaster", "finishes", "internal"],
  },
  {
    workCode: "04.02",
    description: "External Cement Plaster — 15mm CM 1:5 (two-coat)",
    spec: "15mm thick two-coat cement plaster in CM 1:5 on external brick/block walls with sponge/sand finish, including scaffolding, curing and making good around openings. Rate per sqm of plastered surface.",
    hsn: "9954", unit: "sqm", rate: 310, days: 3, gstPercent: 18,
    category: "Finishes",
    materials: [
      { name: "Cement (OPC 43)", spec: "43-grade OPC" },
      { name: "Sand", spec: "M-sand / river sand" },
    ],
    tags: ["plaster", "finishes", "external"],
  },
  {
    workCode: "04.03",
    description: "Vitrified Tile Flooring — 600×600",
    spec: "600×600mm double-charged or full-body vitrified tiles in CM mortar bed 1:4 over the PCC base, with 3mm joints grouted in matching colour grout. Includes minor cuts, threshold strips and finishing. Rate per sqft of tile laid.",
    hsn: "6907", unit: "sqft", rate: 185, days: 2, gstPercent: 18,
    category: "Finishes",
    materials: [
      { name: "Cement (OPC 43)", spec: "43-grade OPC" },
      { name: "Sand", spec: "River sand" },
    ],
    tags: ["flooring", "vitrified", "tiles"],
  },
  {
    workCode: "04.04",
    description: "Exterior Painting — weather-shield emulsion",
    spec: "Exterior painting on plastered surface: one coat alkali-resistant primer + two coats Dulux Weathershield or Asian Apex exterior emulsion. Includes surface preparation (patching, sanding), scaffolding and masking. Rate per sqft of painted area.",
    hsn: "3209", unit: "sqft", rate: 55, days: 2, gstPercent: 18,
    category: "Finishes",
    materials: [
      { name: "Putty & Paint", spec: "Dulux Weathershield / Asian Apex" },
    ],
    tags: ["exterior", "painting", "finishes"],
  },
  // 05 – Roofing & Waterproofing
  {
    workCode: "05.01",
    description: "Terrace Waterproofing — DR system",
    spec: "Dual-component cementitious or APP modified bitumen DR waterproofing system on terrace slab: surface preparation, primer coat, two membrane layers, protection screed, and sunken bed/drain formation. Rate per sqft of treated area.",
    hsn: "9954", unit: "sqft", rate: 110, days: 3, gstPercent: 18,
    category: "Roofing & Waterproofing",
    materials: [], tags: ["waterproofing", "terrace", "roofing"],
  },
  {
    workCode: "05.02",
    description: "Roof Screed — 75mm average",
    spec: "75mm average thickness lean concrete screed (M7.5) laid to falls on terrace slab for drainage, including surface finish and curing for 7 days. Rate per sqm of screed laid.",
    hsn: "9954", unit: "sqm", rate: 380, days: 2, gstPercent: 18,
    category: "Roofing & Waterproofing",
    materials: [
      { name: "Cement (OPC 43)", spec: "43-grade OPC" },
      { name: "Sand", spec: "M-sand" },
    ],
    tags: ["screed", "roofing"],
  },
  // 06 – Openings
  {
    workCode: "06.01",
    description: "Main Entrance Door — solid core flush",
    spec: "Main entrance door: 45mm thick solid core flush shutter in 19mm BWP plywood and veneer/laminate facing, with SS/gold mortise lock set, 3-way hinge, tower bolt and rubber stopper. Door frame in seasoned hardwood with OBD finish. Rate per set (frame + shutter + fittings).",
    hsn: "4418", unit: "nos", rate: 38000, days: 2, gstPercent: 18,
    category: "Openings",
    materials: [
      { name: "Plywood", spec: "BWP solid core" },
      { name: "Hardware", spec: "Mortise lock + SS hinges" },
    ],
    tags: ["door", "main", "entrance"],
  },
  {
    workCode: "06.02",
    description: "Internal Door — hollow core flush",
    spec: "Internal door: 35mm thick hollow core flush shutter in 19mm MR plywood facing with laminate or paint finish, with cylindrical latch set, butt hinges and rubber stopper. Door frame in seasoned wood. Rate per set (frame + shutter + fittings).",
    hsn: "4418", unit: "nos", rate: 13500, days: 1, gstPercent: 18,
    category: "Openings",
    materials: [
      { name: "Plywood", spec: "MR plywood hollow core" },
      { name: "Hardware", spec: "Cylindrical latch + hinges" },
    ],
    tags: ["door", "internal"],
  },
  {
    workCode: "06.03",
    description: "uPVC Window — single / double glazed",
    spec: "uPVC sliding or casement window with 5mm toughened clear glass, weather seals, stainless steel hardware and factory-finished profiles. Includes lintel, sill, installation and grouting. Rate per sqft of window opening.",
    hsn: "3925", unit: "sqft", rate: 520, days: 2, gstPercent: 18,
    category: "Openings",
    materials: [
      { name: "Toughened Glass", spec: "5mm clear" },
      { name: "Hardware", spec: "SS handles + locks" },
    ],
    tags: ["window", "upvc", "glazing"],
  },
  // 07 – External Works
  {
    workCode: "07.01",
    description: "Compound Wall — brick with plaster & coping",
    spec: "230mm thick compound wall in first-class brick masonry in CM 1:5 to specified height, with 12mm internal + 15mm external plaster, pre-cast or tile coping cap, and painting on both faces. Rate per rmt of wall length.",
    hsn: "9954", unit: "rmt", rate: 3200, days: 4, gstPercent: 18,
    category: "External Works",
    materials: [
      { name: "Cement (OPC 43)", spec: "43-grade OPC" },
      { name: "Sand", spec: "River sand" },
    ],
    tags: ["compound wall", "boundary", "external"],
  },
  {
    workCode: "07.02",
    description: "Paving — concrete block / natural stone",
    spec: "60mm thick interlocking concrete paver blocks or natural stone slab on 50mm sand bed, with edge restraints and jointing sand. Includes sub-base compaction and edging. Rate per sqm of paved area.",
    hsn: "9954", unit: "sqm", rate: 950, days: 2, gstPercent: 18,
    category: "External Works",
    materials: [], tags: ["paving", "landscape", "external"],
  },
  // 08 – MEP
  {
    workCode: "08.01",
    description: "Plumbing — CPVC/UPVC rough-in",
    spec: "Complete hot and cold water supply rough-in in CPVC pipe and drainage rough-in in UPVC SWR pipe, including all fittings, fixtures, testing and commissioning. Rate as lump sum per project.",
    hsn: "9954", unit: "ls", rate: 95000, days: 14, gstPercent: 18,
    category: "MEP",
    materials: [], tags: ["plumbing", "mep"],
  },
  {
    workCode: "08.02",
    description: "Electrical — conduit & wiring rough-in",
    spec: "Complete electrical conduit (rigid PVC ISI-marked) and Finolex/Polycab copper wiring rough-in including MCB distribution board, earthing, testing and commissioning. Rate as lump sum per project.",
    hsn: "9954", unit: "ls", rate: 120000, days: 14, gstPercent: 18,
    category: "MEP",
    materials: [], tags: ["electrical", "mep"],
  },
  // 09 – Professional Services
  {
    workCode: "09.01",
    description: "Structural Design & GFC Drawings",
    spec: "Structural design, analysis and preparation of Good-for-Construction (GFC) drawings by licensed Structural Engineer, including soil investigation review, foundation and superstructure design, bar-bending schedules and coordination with the architectural team. Lump sum per project.",
    hsn: "9983", unit: "ls", rate: 90000, days: 0, gstPercent: 18,
    category: "Professional Services",
    materials: [], tags: ["structural", "design", "gfc"],
  },
  {
    workCode: "09.02",
    description: "Architecture Project Management",
    spec: "Dedicated site architect and project manager for the full construction duration, covering site supervision, contractor coordination, quality and safety checks, client reporting, contractor payment certification and defect-liability tracking. Lump sum per project.",
    hsn: "9954", unit: "ls", rate: 75000, days: 0, gstPercent: 18,
    category: "Professional Services",
    materials: [], tags: ["pm", "supervision", "architecture"],
  },
];

// Lookup map: description (lowercase) → spec text, built from the catalog.
// Used by ensureSpecs to backfill the spec field onto previously-stored items.
const DEFAULT_SPECS = Object.fromEntries(
  [...RAW_DEFAULT_LIBRARY, ...ARCH_RAW_DEFAULT_LIBRARY]
    .filter((it) => it.spec)
    .map((it) => [(it.description || "").trim().toLowerCase(), it.spec]),
);

// Backfill `spec` onto any stored item that matches a default catalog entry by
// description but has no spec yet. No-op when every item already has a spec.
const ensureSpecs = (items) => {
  const needsSpec = items.some(
    (it) => !it.spec && DEFAULT_SPECS[(it.description || "").trim().toLowerCase()],
  );
  if (!needsSpec) return items;
  return items.map((it) => {
    if (it.spec) return it;
    const defaultSpec = DEFAULT_SPECS[(it.description || "").trim().toLowerCase()];
    return defaultSpec ? { ...it, spec: defaultSpec } : it;
  });
};

// Interior items tagged with discipline "interior"; architecture with "architecture".
// Split so ARCH_DEFAULT_LIBRARY is exportable for filtering in LibraryPicker.
const INTERIOR_DEFAULT_LIBRARY = RAW_DEFAULT_LIBRARY.map((it) => ({
  ...it,
  id: genId(),
  discipline: "interior",
  usage: 0,
  defaultGrade: it.defaultGrade || "economy",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));

export const ARCH_DEFAULT_LIBRARY = ARCH_RAW_DEFAULT_LIBRARY.map((it) => ({
  ...it,
  id: genId(),
  discipline: "architecture",
  usage: 0,
  defaultGrade: it.defaultGrade || "economy",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));

// DEFAULT_LIBRARY is interior-only — what gets seeded into localStorage.
// ARCH_DEFAULT_LIBRARY is served in-memory by LibraryPicker (never persisted)
// so it never adds to the localStorage quota.
export const DEFAULT_LIBRARY = INTERIOR_DEFAULT_LIBRARY;

// ── Category migration ─────────────────────────────────────────────────────
// `category` used to be a colour key; it's now a room/category NAME (from
// Master → Schedule). Map the old colour keys to room names on read so saved
// libraries self-heal. Names that are already room names pass through.
const LEGACY_CATEGORY_MAP = {
  orange: "Kitchen",
  blue: "Living Room",
  purple: "Master Bedroom",
  teal: "Bathrooms",
  amber: "Foyer",
  indigo: "Study",
  slate: "Utility",
  gray: "",
};

const normalizeCategory = (cat) =>
  cat in LEGACY_CATEGORY_MAP ? LEGACY_CATEGORY_MAP[cat] : cat || "";

// Normalize category, and seed a per-item `days` (schedule duration). The
// item's own value is used directly. The Schedule Master fallback (room
// category → default days) is commented out — reserved for future use.
const normalizeItem = (it) => {
  const category = normalizeCategory(it.category);
  // const defaultDays = getRoomDefaultDays(category);
  // const days =
  //   defaultDays !== "" && defaultDays != null ? defaultDays : (it.days ?? "");
  const days = it.days ?? "";
  let recipes = it.recipes;
  // Older rate build-ups initialized all three standard grades as exact
  // clones, so changing grade could never change the quote. Migrate only that
  // legacy default signature; genuinely configured recipes are untouched.
  if (recipes?.economy && recipes?.premium && recipes?.luxury) {
    const economy = JSON.stringify(recipes.economy);
    const premium = JSON.stringify(recipes.premium);
    const luxury = JSON.stringify(recipes.luxury);
    const legacyDefaults =
      economy === premium &&
      premium === luxury &&
      Number(recipes.premium.overheadPct) === 10 &&
      Number(recipes.premium.marginPct) === 20;
    if (legacyDefaults) {
      recipes = {
        ...recipes,
        economy: { ...recipes.economy, overheadPct: 5, marginPct: 10 },
        premium: { ...recipes.premium, overheadPct: 10, marginPct: 20 },
        luxury: { ...recipes.luxury, overheadPct: 15, marginPct: 30 },
      };
    }
  }
  return { ...it, category, days, recipes, discipline: it.discipline || "interior" };
};

// ── Default-catalog merge ──────────────────────────────────────────────────
// A stored library that only holds a few items (an early backend sync, a
// partial import, an older seed) hid the full default catalog, since a
// non-empty stored list is authoritative. This one-time merge (guarded by a
// seed-version flag) folds any MISSING default works into the stored list — by
// description, so it never duplicates — without removing the user's own items.
// It runs once per SEED_VERSION, so items deleted afterwards stay deleted.
const SEED_VERSION = "scopes-v5";
const SEED_VERSION_KEY = "item_library_seed_version";

const readSeedVersion = () => {
  try {
    return localStorage.getItem(SEED_VERSION_KEY);
  } catch {
    return null;
  }
};
const writeSeedVersion = () => {
  try {
    localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION);
  } catch {
    /* ignore */
  }
};

// Merge any default catalog works missing from `items` (matched by description,
// so nothing duplicates). Pure — returns a new array only when it adds works.
const mergeMissingDefaults = (items) => {
  const have = new Set(
    items.map((it) => (it.description || "").trim().toLowerCase()),
  );
  const additions = ensureRecipes(
    DEFAULT_LIBRARY.map(normalizeItem).filter(
      (d) => !have.has((d.description || "").trim().toLowerCase()),
    ),
  );
  return additions.length ? [...items, ...additions] : items;
};

// One-time (per SEED_VERSION) local merge for the stored library.
const mergeDefaultCatalog = (items) => {
  if (readSeedVersion() === SEED_VERSION) return items;
  writeSeedVersion();
  return mergeMissingDefaults(items);
};

// ── Read / Write ──────────────────────────────────────────────────────────
export const listLibrary = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // A non-empty stored list is authoritative. An EMPTY array is treated as
      // "not seeded yet" and falls through to re-seed the defaults — otherwise a
      // one-time blank (an empty backend sync, a bulk delete, a migration) would
      // leave the library permanently empty, so "Pick from Library" shows nothing.
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = parsed.map(normalizeItem);
        // Backfill recipes + specs, then one-time merge the full default catalog
        // so a partial stored library gains every default work + sample.
        const withRecipes = ensureRecipes(normalized);
        const withSpecs = ensureSpecs(withRecipes);
        const items = mergeDefaultCatalog(withSpecs);
        if (withRecipes !== normalized || withSpecs !== withRecipes || items !== withSpecs) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        }
        return items;
      }
    }
  } catch {
    // fall through
  }
  // First read (or recovered-from-empty) — seed the static catalog + rate
  // build-ups so the library is usable and Proposal Master prices from it.
  const seeded = ensureSpecs(ensureRecipes(DEFAULT_LIBRARY.map(normalizeItem)));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  // A fresh seed already holds the full catalog — mark the merge done so it
  // doesn't re-add works the user later deletes.
  writeSeedVersion();
  return seeded;
};

export const saveLibrary = (items) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("itemLibraryChanged"));
  }
  // Backend write-through: push the whole collection in the background.
  pushMaster(() => putItems(items));
};

// Backend hydration: pull the server copy into the local cache, then fire the
// existing change event so listeners refresh. No-op when logged out; on any
// error or empty/invalid response it leaves the seeded localStorage untouched.
// Writes localStorage directly (not via saveLibrary) to avoid an echo PUT.
//
// The default catalog is MERGED into the backend response (by description) so
// the full scope catalog + samples always show even when the backend only has a
// few items. Backend items win on a name clash; missing default works are added.
export async function hydrateItemLibrary() {
  if (!tokens.access()) return;
  let data;
  try {
    data = await getItems();
  } catch (e) {
    console.warn("hydrateItemLibrary: failed to fetch items", e);
    return;
  }
  // Tolerate bare array or { items: [...] } wrapper.
  const items = Array.isArray(data) ? data : data?.items;
  if (!Array.isArray(items) || items.length === 0) return;
  const merged = mergeMissingDefaults(items.map(normalizeItem));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("itemLibraryChanged"));
  }
}

export const addLibraryItem = (item) => {
  const items = listLibrary();
  const next = {
    ...item,
    id: item.id || genId(),
    usage: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const updated = [next, ...items];
  saveLibrary(updated);
  return next;
};

export const updateLibraryItem = (id, changes) => {
  const items = listLibrary();
  const updated = items.map((it) =>
    it.id === id ? { ...it, ...changes, updatedAt: new Date().toISOString() } : it,
  );
  saveLibrary(updated);
};

export const deleteLibraryItem = (id) => {
  const items = listLibrary().filter((it) => it.id !== id);
  saveLibrary(items);
};

export const incrementUsage = (id) => {
  const items = listLibrary();
  const updated = items.map((it) =>
    it.id === id ? { ...it, usage: (it.usage || 0) + 1 } : it,
  );
  saveLibrary(updated);
};

export const resetLibrary = () => {
  localStorage.removeItem(STORAGE_KEY);
  return listLibrary();
};

// Convert a library record into a BOQ line-item shape so the editor can
// drop it straight into a section without rewiring fields. The `masterId`
// keeps a back-reference to the catalog item so the BOQ row can show a
// "Linked to Library" badge and offer compact rendering. Template
// dimensions (L/W/H/qty) flow through so the BOQ row starts pre-filled.
export const libraryToItem = (lib) => {
  const L = Number(lib.length) || 0;
  const B = Number(lib.breadth) || 0;
  const H = Number(lib.height) || 0;
  return {
    masterId: lib.id,
    description: lib.description || "",
    spec: lib.spec || "",
    hsn: lib.hsn || "",
    qty: Number(lib.qty) || 1,
    unit: lib.unit || "nos",
    rate: Number(lib.rate) || 0,
    gstPercent: Number(lib.gstPercent) || 18,
    discount: { type: "percent", value: 0 },
    dimensions: {
      enabled: L > 0 || B > 0 || H > 0,
      length: L,
      breadth: B,
      height: H,
      nos: 1,
    },
    materials: lib.materials ? JSON.parse(JSON.stringify(lib.materials)) : [],
  };
};

export const blankLibraryItem = () => ({
  description: "",
  spec: "",
  category: "",
  discipline: "interior",
  workCode: "",
  days: "",
  hsn: "",
  unit: "sqft",
  length: 0,
  breadth: 0,
  height: 0,
  qty: 0,
  rate: 0,
  gstPercent: 18,
  // Estimating coefficient: the assumed quantity for a package = carpet area ×
  // areaFactor (e.g. flooring 1.0, false ceiling 0.65, wall paint 3.5). For
  // count (nos) works it's used as the default count. Defaults to 1.
  areaFactor: 1,
  materials: [],
  tags: [],
});

// Area = L × W for area units, just L for length units. Used as a display
// helper in the form (read-only) and as a fallback when the user hasn't
// entered a separate Qty.
const AREA_UNITS = new Set(["sqft", "sqm"]);
const LENGTH_UNITS = new Set(["rmt", "mm"]);

export const computeLibraryItemArea = (item) => {
  const L = Number(item.length) || 0;
  const B = Number(item.breadth) || 0;
  if (L > 0 && B > 0) return L * B;
  if (AREA_UNITS.has(item.unit) && L > 0 && B > 0) return L * B;
  if (LENGTH_UNITS.has(item.unit) && L > 0) return L;
  return 0;
};

// Effective qty for amount calculation. User-entered qty takes priority so
// it can capture wastage / counts that differ from the raw L×W area
// (e.g. 224 sqft area but 246.4 sqft ordered with 10% wastage). Falls back
// to area when qty isn't entered.
export const computeLibraryItemQty = (item) => {
  const userQty = Number(item.qty) || 0;
  if (userQty > 0) return userQty;
  return computeLibraryItemArea(item);
};

export const computeLibraryItemAmount = (item) =>
  computeLibraryItemQty(item) * (Number(item.rate) || 0);
