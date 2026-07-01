// Rate build-up (composite rate) engine — the answer to "per-sqft rate differs
// totally". A work's per-unit rate is NOT a typed number; it is DERIVED from the
// materials it consumes (priced live from the Material Master) + labour, with
// overhead and margin on top. Each work keeps a recipe per quality GRADE so the
// same work can be Economy / Premium / Luxury just by swapping materials.
//
//   rate(grade) = [ Σ component(qty × (1+wastage) × materialRate) + labour ]
//                 × (1 + overhead%) × (1 + margin%)
//
//   line cost  = measured qty (sqft from survey) × rate(grade)
//
// Stored on the Item Master item as `recipes: { economy, premium, luxury }`
// plus `defaultGrade`. The item's flat `rate` is set to the default grade's
// computed rate so existing BOQ/quote code keeps working unchanged.

export const GRADES = [
  { key: "economy", label: "Economy" },
  { key: "premium", label: "Premium" },
  { key: "luxury", label: "Luxury" },
];

const labelFromKey = (key = "") =>
  key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

// Quality grades available across the Item Master. Standard grades always
// remain visible; custom grades created in Rate Build-up are appended.
export const collectGrades = (library = []) => {
  const keys = new Set(GRADES.map((grade) => grade.key));
  library.forEach((item) => {
    Object.keys(item.recipes || {}).forEach((key) => keys.add(key));
  });
  return [...keys].map((key) => ({
    key,
    label: GRADES.find((grade) => grade.key === key)?.label || labelFromKey(key),
  }));
};

export const gradeLabel = (key = "premium") =>
  GRADES.find((grade) => grade.key === key)?.label || labelFromKey(key);

export const blankComponent = () => ({
  materialId: "",
  name: "",
  unit: "",
  qty: 1,
  wastagePct: 0,
  rate: 0, // cached fallback if the material is later deleted
});

export const blankRecipe = () => ({
  components: [],
  labourRate: 0,
  overheadPct: 10,
  marginPct: 20,
});

export const blankRecipes = () => ({
  economy: blankRecipe(),
  premium: blankRecipe(),
  luxury: blankRecipe(),
});

// Compute one recipe against a {id → material} lookup. Returns the full
// breakdown so the UI can show every line of the build-up.
export const computeRecipe = (recipe, materialsById = {}) => {
  const r = recipe || blankRecipe();
  let materialCost = 0;
  const lines = (r.components || []).map((c) => {
    const mat = materialsById[c.materialId];
    const rate = Math.max(0, mat ? Number(mat.rate) || 0 : Number(c.rate) || 0);
    const qty = Math.max(0, Number(c.qty) || 0);
    const waste = 1 + Math.max(0, Number(c.wastagePct) || 0) / 100;
    const amount = qty * waste * rate;
    // Input GST on the material purchase — recoverable via ITC, NOT part of the
    // work rate. Tracked here only so the build-up can show what's reclaimable.
    const gstPercent = mat ? Number(mat.gstPercent) || 0 : 0;
    const inputGst = (amount * gstPercent) / 100;
    materialCost += amount;
    return {
      ...c,
      name: mat?.name || c.name || "—",
      unit: mat?.unit || c.unit || "",
      rate,
      amount,
      gstPercent,
      inputGst,
      missing: !mat && !!c.materialId,
    };
  });
  const labour = Math.max(0, Number(r.labourRate) || 0);
  const base = materialCost + labour;
  const overhead = (base * Math.max(0, Number(r.overheadPct) || 0)) / 100;
  const margin = ((base + overhead) * Math.max(0, Number(r.marginPct) || 0)) / 100;
  const rate = base + overhead + margin;
  const inputGst = lines.reduce((s, l) => s + l.inputGst, 0);
  return { lines, materialCost, labour, base, overhead, margin, rate, inputGst };
};

// Computed rate for every grade — for the comparison chips.
export const computeAllGrades = (recipes, materialsById = {}) =>
  GRADES.reduce((acc, g) => {
    acc[g.key] = computeRecipe(recipes?.[g.key], materialsById).rate;
    return acc;
  }, {});

export const materialsById = (materials = []) =>
  materials.reduce((acc, m) => {
    acc[m.id] = m;
    return acc;
  }, {});

export const recipeToMaterials = (recipe, materialLookup = {}) =>
  computeRecipe(recipe, materialLookup).lines.map((line) => {
    const material = materialLookup[line.materialId];
    return {
      id: line.materialId || null,
      materialId: line.materialId || null,
      name: line.name,
      spec: material?.specifications || "",
      unit: line.unit,
      rate: line.rate,
      qty: line.qty,
      wastagePct: line.wastagePct,
      hsn: material?.hsn || "",
      gstPercent: Number(material?.gstPercent) || 0,
    };
  });

const AREA_UNITS = new Set(["sqft", "sqm"]);
const LENGTH_UNITS = new Set(["rmt", "rft", "mm"]);
const COUNT_UNITS = new Set(["nos", "set", "pair", "lot", "ls"]);

// Typical fit-out wastage by material type — gives a seeded build-up realistic
// Waste% values instead of a flat 0. Tunable per project afterwards.
const defaultWastageFor = (name = "") => {
  const n = name.toLowerCase();
  if (/(putty|paint|primer|polish|adhesive|cement|mortar)/.test(n)) return 10;
  if (/(glass|mirror)/.test(n)) return 12;
  if (/(ply|plywood|board|laminate|veneer|mdf|hdf|wpc|gypsum)/.test(n)) return 8;
  if (/(granite|marble|stone|quartz|tile)/.test(n)) return 7;
  if (/(upholstery|foam|fabric)/.test(n)) return 6;
  if (/(led|light|wire|cable)/.test(n)) return 4;
  if (/(hardware|hinge|channel|handle|fitting|screw|fastener)/.test(n)) return 2;
  return 5;
};

// Assumed consumption of a material per 1 unit of the work. Same-unit materials
// (e.g. sqft board for a sqft ceiling) are ~1; count/length items consumed by an
// area/length work are a small fraction so the seeded rate stays sane.
const defaultQtyFor = (matUnit = "", workUnit = "") => {
  if (!matUnit || !workUnit || matUnit === workUnit) return 1;
  if (COUNT_UNITS.has(matUnit) && !COUNT_UNITS.has(workUnit)) return 0.1;
  if (LENGTH_UNITS.has(matUnit) && AREA_UNITS.has(workUnit)) return 0.4;
  if (AREA_UNITS.has(matUnit) && LENGTH_UNITS.has(workUnit)) return 2;
  return 1;
};

// Seed a recipe from a work's existing free-text materials ({name, spec}) by
// matching each name to a Material Master entry — gives a starting point instead
// of a blank build-up. Unmatched names become components with a 0 cached rate.
// `workUnit` lets the seed pick realistic per-unit quantities for materials
// measured in a different unit than the work.
export const seedRecipeFromMaterials = (
  workMaterials = [],
  materials = [],
  workUnit = "",
) => {
  const findMat = (name) => {
    const n = (name || "").trim().toLowerCase();
    if (!n) return undefined;
    const exact = materials.find((m) => m.name.trim().toLowerCase() === n);
    if (exact) return exact;
    // Whole-word match only — a plain substring check would let short names
    // (e.g. "MR") falsely match unrelated materials (e.g. "Mirror").
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wordBoundary = new RegExp(`\\b${escaped}\\b`);
    return materials.find((m) => wordBoundary.test(m.name.toLowerCase()));
  };
  return {
    ...blankRecipe(),
    components: workMaterials.map((wm) => {
      const mat = findMat(wm.name);
      const name = mat?.name || wm.name || "";
      const unit = mat?.unit || "";
      return {
        ...blankComponent(),
        materialId: mat?.id || "",
        name,
        unit,
        rate: mat ? Number(mat.rate) || 0 : 0,
        qty: defaultQtyFor(unit, workUnit),
        wastagePct: defaultWastageFor(name),
      };
    }),
  };
};
