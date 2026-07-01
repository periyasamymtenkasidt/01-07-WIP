// Centralised read/write for the global Terms & Conditions data.
//
// Storage shape (v2):
//   { inclusions: [ { text: string, isDefault: boolean }, … ],
//     exclusions: [ { text: string, isDefault: boolean }, … ] }
//
// Legacy shape (v1 — plain string arrays) is auto-migrated on first read.

const STORAGE_KEY = "globalTerms";

/** Migrate a legacy string[] to the new { text, isDefault }[] format. */
const migrateList = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.map((entry) => {
    if (typeof entry === "string") {
      return { text: entry, isDefault: true };
    }
    // Already an object — normalise fields
    return {
      text: entry.text || "",
      isDefault: typeof entry.isDefault === "boolean" ? entry.isDefault : true,
    };
  });
};

export const getTermsCategories = () => {
  try {
    const raw = localStorage.getItem("globalTerms_categories");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Error reading terms categories", e);
  }
  return [
    { id: "STATUATORY", label: "Statutory", desc: "Legal & regulatory compliance" },
    { id: "DELIVERY", label: "Delivery", desc: "Logistics, carriage & schedule" },
    { id: "PAYMENTS", label: "Payments", desc: "Deposits, milestones & invoicing" },
    { id: "TECHNICAL", label: "Technical", desc: "Drawings, dimensions & specs" },
    { id: "GENERAL", label: "General", desc: "Validity, taxes & standard terms" },
  ];
};

export const saveTermsCategories = (categories) => {
  try {
    localStorage.setItem("globalTerms_categories", JSON.stringify(categories));
  } catch (e) {
    console.error("Error saving terms categories", e);
  }
};

export const addTermsCategory = (label, desc = "Custom Terms & Conditions category") => {
  const categories = getTermsCategories();
  const id = label.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  if (categories.some((c) => c.id === id)) {
    throw new Error(`Category "${label}" already exists.`);
  }
  const newCat = {
    id,
    label,
    desc,
  };
  categories.push(newCat);
  saveTermsCategories(categories);
  saveGlobalTerms(id, { inclusions: [], exclusions: [] });
  return newCat;
};

export const deleteTermsCategory = (id) => {
  const categories = getTermsCategories();
  const filtered = categories.filter((c) => c.id !== id);
  saveTermsCategories(filtered);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        delete parsed[id];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
    }
  } catch (e) {
    console.error("Error deleting global terms for category", id, e);
  }
};

export const renameTermsCategory = (id, newLabel, newDesc) => {
  const categories = getTermsCategories();
  const updated = categories.map((c) => {
    if (c.id === id) {
      return { ...c, label: newLabel, desc: newDesc !== undefined ? newDesc : c.desc };
    }
    return c;
  });
  saveTermsCategories(updated);
};

/** Read the global terms from localStorage. Auto-migrates v1 → v2 & category structure. */
export const getGlobalTerms = (category = "STATUATORY") => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        // If it's a legacy flat structure (having inclusions/exclusions directly)
        if (Array.isArray(parsed.inclusions) || Array.isArray(parsed.exclusions)) {
          if (category === "STATUATORY") {
            return {
              inclusions: migrateList(parsed.inclusions),
              exclusions: migrateList(parsed.exclusions),
            };
          }
          return { inclusions: [], exclusions: [] };
        }
        // Otherwise, it is the new category-based structure
        const catData = parsed[category] || {};
        return {
          inclusions: migrateList(catData.inclusions),
          exclusions: migrateList(catData.exclusions),
        };
      }
    }
  } catch {
    // fall through
  }
  return { inclusions: [], exclusions: [] };
};

/** Persist global terms per category. */
export const saveGlobalTerms = (category, data) => {
  try {
    let activeCategory = category;
    let activeData = data;
    // Fallback if called with legacy signature
    if (typeof category === "object" && data === undefined) {
      activeCategory = "STATUATORY";
      activeData = category;
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    let parsed = {};
    if (raw) {
      try {
        parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          // If legacy structure, convert to category-based
          if (Array.isArray(parsed.inclusions) || Array.isArray(parsed.exclusions)) {
            parsed = {
              STATUATORY: {
                inclusions: migrateList(parsed.inclusions),
                exclusions: migrateList(parsed.exclusions),
              }
            };
          }
        } else {
          parsed = {};
        }
      } catch {
        parsed = {};
      }
    }
    parsed[activeCategory] = activeData;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch (e) {
    console.error("Error saving global terms", e);
  }
};

/** Convenience: return only items where isDefault === true, as plain strings, aggregated across categories. */
export const getDefaultTermStrings = () => {
  const inclusions = [];
  const exclusions = [];
  const categories = getTermsCategories();
  
  categories.forEach((catObj) => {
    const category = catObj.id;
    const terms = getGlobalTerms(category);
    terms.inclusions
      .filter((t) => t.isDefault)
      .forEach((t) => {
        if (!inclusions.includes(t.text)) inclusions.push(t.text);
      });
    terms.exclusions
      .filter((t) => t.isDefault)
      .forEach((t) => {
        if (!exclusions.includes(t.text)) exclusions.push(t.text);
      });
  });

  return { inclusions, exclusions };
};

/** Convenience: return only non-default items, as plain strings, aggregated across categories. */
export const getNonDefaultTermStrings = () => {
  const inclusions = [];
  const exclusions = [];
  const categories = getTermsCategories();
  
  categories.forEach((catObj) => {
    const category = catObj.id;
    const terms = getGlobalTerms(category);
    terms.inclusions
      .filter((t) => !t.isDefault)
      .forEach((t) => {
        if (!inclusions.includes(t.text)) inclusions.push(t.text);
      });
    terms.exclusions
      .filter((t) => !t.isDefault)
      .forEach((t) => {
        if (!exclusions.includes(t.text)) exclusions.push(t.text);
      });
  });

  return { inclusions, exclusions };
};

// ── Default Seed Data ─────────────────────────────────────────────────────
// Pre-defined terms that are inserted into the master table on first run.
// Each entry is { text, isDefault: true } so it auto-flows into quotes.

const SEED_TERMS = {
  STATUATORY: {
    inclusions: [
      { text: "GST calculations shall be applied as per prevailing Government norms.", isDefault: true },
      { text: "Statutory compliance documentation shall be provided wherever applicable.", isDefault: true },
      { text: "Tax details shall be reflected in billing documents.", isDefault: true },
    ],
    exclusions: [
      { text: "GST: Extra @ 18%, if any additional or difference in tax rate at the time of billing, it will be applicable as per Government norms.", isDefault: true },
      { text: "Design Fees: Default statutory term.", isDefault: true },
      { text: "Site Travel Expenses by Architects: Default statutory term.", isDefault: true },
    ],
  },
  DELIVERY: {
    inclusions: [
      { text: "Work completion schedule shall be communicated after order confirmation.", isDefault: true },
      { text: "Delivery planning shall be coordinated through project scheduling.", isDefault: true },
      { text: "Installation dates shall be finalized with client approval.", isDefault: true },
    ],
    exclusions: [
      { text: "Delays caused by site readiness issues are excluded.", isDefault: true },
      { text: "Delays due to pending client approvals are excluded.", isDefault: true },
      { text: "Force majeure related schedule changes are excluded.", isDefault: true },
    ],
  },
  PAYMENTS: {
    inclusions: [
      { text: "Payment milestones shall be communicated along with project approval.", isDefault: true },
      { text: "Work status updates shall be provided against received payments.", isDefault: true },
      { text: "Account statements and due payment updates shall be shared periodically.", isDefault: true },
    ],
    exclusions: [
      { text: "Delayed client payments affecting project timelines are excluded.", isDefault: true },
      { text: "Banking and transaction charges are excluded.", isDefault: true },
      { text: "Additional scope changes are excluded from approved payment milestones.", isDefault: true },
    ],
  },
  TECHNICAL: {
    inclusions: [
      { text: "Fabrication shall be executed as per approved drawings and specifications.", isDefault: true },
      { text: "Site work and installation activities are included as per project scope.", isDefault: true },
      { text: "Standard priming and finishing processes are included.", isDefault: true },
    ],
    exclusions: [
      { text: "Wood, glass, upholstery and specialty finishes are excluded unless specifically mentioned.", isDefault: true },
      { text: "Worker accommodation arrangements at site are excluded.", isDefault: true },
      { text: "Client-requested modifications after fabrication completion are excluded.", isDefault: true },
    ],
  },
  GENERAL: {
    inclusions: [
      { text: "Quotation validity shall be as specified in the quotation document.", isDefault: true },
      { text: "Applicable warranty coverage shall be provided as per company policy.", isDefault: true },
      { text: "Clerical errors may be corrected through revised documentation.", isDefault: true },
    ],
    exclusions: [
      { text: "Cancellation recovery charges after project commencement are excluded from refunds.", isDefault: true },
      { text: "Warranty does not cover negligence, misuse or accidental damages.", isDefault: true },
      { text: "Disputes outside the agreed jurisdiction are excluded.", isDefault: true },
    ],
  },
};

const SEED_FLAG = "globalTerms_seeded";

/**
 * Insert default terms into the master table exactly once.
 *
 * Rules:
 *  - Runs only when the SEED_FLAG is absent from localStorage.
 *  - For each category, seeds only if the category currently has zero entries
 *    (preserves any user-created records).
 *  - After seeding, sets the flag so it never runs again.
 */
export const seedDefaultTerms = () => {
  try {
    // Explicitly check if the new statutory items are seeded. If not, seed them.
    const statSeededFlag = "statutoryTerms_seeded_v4";
    if (!localStorage.getItem(statSeededFlag)) {
      saveGlobalTerms("STATUATORY", {
        inclusions: SEED_TERMS.STATUATORY.inclusions.map((t) => ({ ...t })),
        exclusions: SEED_TERMS.STATUATORY.exclusions.map((t) => ({ ...t })),
      });
      localStorage.setItem(statSeededFlag, "1");
    }

    if (localStorage.getItem(SEED_FLAG)) return; // already seeded

    const categories = getTermsCategories();
    categories.forEach((catObj) => {
      const cat = catObj.id;
      const existing = getGlobalTerms(cat);
      const hasData =
        (existing.inclusions && existing.inclusions.length > 0) ||
        (existing.exclusions && existing.exclusions.length > 0);

      if (!hasData && SEED_TERMS[cat]) {
        saveGlobalTerms(cat, {
          inclusions: SEED_TERMS[cat].inclusions.map((t) => ({ ...t })),
          exclusions: SEED_TERMS[cat].exclusions.map((t) => ({ ...t })),
        });
      }
    });

    localStorage.setItem(SEED_FLAG, "1");
  } catch (e) {
    console.error("Error seeding default terms", e);
  }
};