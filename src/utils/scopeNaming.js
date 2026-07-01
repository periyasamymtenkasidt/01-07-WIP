import { listLibrary } from "../data/itemLibrary";

/**
 * Fetch Detailed Description from item library by Item Name.
 * Mapped: Item Name -> Detailed Description
 */
export const getDetailedDescription = (itemName) => {
  if (!itemName) return "";
  try {
    const libItems = listLibrary();
    const matched = libItems.find(
      (it) => it.description.toLowerCase().trim() === itemName.toLowerCase().trim()
    );
    if (matched) {
      if (matched.spec) return matched.spec;
    }
  } catch {
    // fall through
  }
  return "";
};

/**
 * Normalizes a scope item to guarantee the presence of heading, itemName, and description.
 */
export const normalizeScopeItem = (item) => {
  if (!item) return item;

  // Assign stable unique ID if not present
  const id = item.id || `scope_${Math.random().toString(36).substring(2, 9)}`;

  // 1. heading / area
  let area = item.area || item.heading || "Unassigned";
  let heading = item.heading || item.area || "Unassigned";
  heading = heading.trim().toUpperCase();
  area = area.trim().toUpperCase();

  // 2. itemName
  let itemName = item.itemName || "";
  if (!itemName) {
    // Fallback: under the old system, item.area was category name and item.description was the item name
    itemName = item.description || item.area || "Untitled Item";
  }

  // 3. description (Detailed Description)
  // Only populate when actual data exists — don't auto-fill placeholder values
  // or copy values from other fields (Req 6)
  let description = item.description || "";
  if (!item.isDescriptionCustom) {
    const syncDesc = getDetailedDescription(itemName);
    if (syncDesc && syncDesc !== itemName) {
      description = syncDesc;
    } else {
      if (description === itemName) {
        description = "";
      }
    }
  }

  return {
    ...item,
    id,
    heading,
    area,
    itemName,
    description,
  };
};

/**
 * Add scope items to an existing list with duplicate check logic.
 * The duplicate validation / heading assignment prompt is handled in the UI layer.
 * This function simply ensures headings are normalized to uppercase.
 */
export const addScopeItemsWithDuplicateCheck = (existingItems, newItemsToAdd) => {
  const result = [...(existingItems || [])];

  (newItemsToAdd || []).forEach((newItem) => {
    const normItem = normalizeScopeItem(newItem);
    const targetHeading = (normItem.heading || normItem.area || "Unassigned").trim().toUpperCase();
    normItem.heading = targetHeading;
    normItem.area = targetHeading;
    result.push(normItem);
  });

  return result;
};

export function getCategoryKey(str) {
  if (!str) return "gray";
  const s = str.toLowerCase();
  if (s.includes("kitchen")) return "kitchen";
  if (s.includes("living") || s.includes("lounge") || s.includes("tv")) return "living";
  if (s.includes("dining")) return "living";
  if (s.includes("bedroom") || s.includes("bed") || s.includes("wardrobe")) return "bedroom";
  if (s.includes("bath") || s.includes("toilet") || s.includes("wash") || s.includes("vanity") || s.includes("restroom")) return "bath";
  if (s.includes("foyer") || s.includes("passage") || s.includes("lobby") || s.includes("entrance")) return "foyer";
  if (s.includes("study") || s.includes("office") || s.includes("desk") || s.includes("work")) return "study";
  if (s.includes("stair")) return "stair";
  if (s.includes("utility") || s.includes("service")) return "utility";
  return "gray";
}

export const getCategoryFromItemName = (itemName) => {
  if (!itemName) return "";
  try {
    const libItems = listLibrary();
    const matched = libItems.find(
      (it) => it.description.toLowerCase().trim() === itemName.toLowerCase().trim()
    );
    if (matched && matched.category) {
      return matched.category;
    }
  } catch {
    // Optional Item Master lookup; use the empty category fallback.
  }
  return "";
};

export const getHeadingCategoryKey = (headingName, allItems) => {
  const keyByName = getCategoryKey(headingName);
  if (keyByName !== "gray") return keyByName;

  const itemsInHeading = (allItems || []).filter(
    (item) => (item.area || item.heading || "").trim().toUpperCase() === headingName.trim().toUpperCase()
  );
  
  for (const item of itemsInHeading) {
    const cat = item.category || getCategoryFromItemName(item.itemName || item.description);
    if (cat) {
      const keyByItem = getCategoryKey(cat);
      if (keyByItem !== "gray") return keyByItem;
    }
  }
  
  return "gray";
};

/**
 * Refresh scope items from Master Configuration, updating heading, item name,
 * and description unless customized.
 */
export const refreshScopeItemsFromMaster = (scopeItems, presetKey, propertyType) => {
  if (!Array.isArray(scopeItems)) return scopeItems;
  if (!presetKey) return scopeItems;

  try {
    const raw = localStorage.getItem("quoteMaster");
    if (!raw) return scopeItems;
    const master = JSON.parse(raw);
    if (!master || !master[presetKey]) return scopeItems;

    const preset = master[presetKey];
    const configs = preset.configurations || [];
    const cfg = configs.find((c) => c.propertyType === propertyType) || configs[0];
    if (!cfg || !Array.isArray(cfg.scopeItems)) return scopeItems;

    const masterItems = cfg.scopeItems;

    const nameOf = (x) => (x.itemName || "").toLowerCase().trim();
    const areaOf = (x) => (x.area || x.heading || "").toLowerCase().trim();

    // Locate the master scope item that corresponds to a saved scope row, and
    // report whether the match agrees on category. Only a category-safe match
    // is allowed to move the row into the master's heading; a name-only match
    // must not, otherwise an item gets pulled into the wrong category.
    const findMasterMatch = (item) => {
      let masterItem = null;
      let categorySafeMatch = false;

      if (item.id) {
        masterItem = masterItems.find((m) => m.id === item.id);
        // An id match is authoritative on category.
        if (masterItem) categorySafeMatch = true;
      }
      if (!masterItem && item.itemName) {
        // 1. Match by both itemName and area/heading.
        masterItem = masterItems.find(
          (m) => nameOf(m) === nameOf(item) && areaOf(m) === areaOf(item)
        );
        if (masterItem) categorySafeMatch = true;

        // 2. Match by itemName and category key.
        if (!masterItem) {
          const itemCatKey = getCategoryKey(item.area || item.heading);
          masterItem = masterItems.find(
            (m) =>
              nameOf(m) === nameOf(item) &&
              getCategoryKey(m.area || m.heading) === itemCatKey
          );
          if (masterItem) categorySafeMatch = true;
        }

        // 3. Fallback to matching only itemName. NOT category-safe: sync the
        // item's data but never relocate it to the master's heading.
        if (!masterItem) {
          masterItem = masterItems.find((m) => nameOf(m) === nameOf(item));
        }
      }
      return { masterItem, categorySafeMatch };
    };

    // Merge a saved scope row with its master counterpart, keeping user edits.
    const syncFromMaster = (item, masterItem, categorySafeMatch) => {
      const id = item.id || masterItem.id;

      // Heading Name propagation — only when the match agrees on category, so
      // the scope of work always matches the master's category exactly.
      let area = item.area;
      if (!item.isAreaCustom && categorySafeMatch) {
        area = masterItem.heading || masterItem.area || area;
      }

      let itemName = item.itemName;
      if (!item.isItemNameCustom) {
        itemName = masterItem.itemName || itemName;
      }

      let description = item.description;
      if (!item.isDescriptionCustom) {
        description = masterItem.description || masterItem.spec || description;
      }

      return {
        ...item,
        id,
        masterId: item.masterId || masterItem.masterId || masterItem.itemId || null,
        recipes: item.recipes || masterItem.recipes,
        defaultGrade: item.defaultGrade || masterItem.defaultGrade,
        area,
        heading: area,
        itemName,
        description,
      };
    };

    // Reconcile the saved scope against the current master so EVERY master
    // change is reflected: existing rows are re-synced, rows added to the master
    // are appended, and rows deleted from the master are dropped. Rows the user
    // added inside the proposal (or customized) are always kept.
    const consumed = new Set();
    const result = [];

    scopeItems.forEach((item) => {
      const { masterItem, categorySafeMatch } = findMasterMatch(item);
      if (masterItem) {
        consumed.add(masterItems.indexOf(masterItem));
        result.push(syncFromMaster(item, masterItem, categorySafeMatch));
      } else if (item._userAdded || item.isAreaCustom || item.isItemNameCustom) {
        // User-added or user-customized rows have no master origin to remove.
        result.push(item);
      }
      // Otherwise the row came from the master and no longer exists there →
      // drop it, mirroring the deletion.
    });

    // Append rows added to the master after this scope was last saved.
    masterItems.forEach((m, idx) => {
      if (consumed.has(idx)) return;
      result.push(
        normalizeScopeItem({
          ...m,
          materials: m.materials ? m.materials.map((mat) => ({ ...mat })) : [],
        })
      );
    });

    return result;
  } catch (e) {
    console.error("Error refreshing scope items from master:", e);
    return scopeItems;
  }
};

/**
 * Assign sequential display names per category.
 * Updated to match the new rules: no auto numbering, uses itemName as the object/display name.
 */
export const assignCategoryNames = (scopeItems) => {
  if (!Array.isArray(scopeItems)) return [];
  return scopeItems.map((item) => {
    const norm = normalizeScopeItem(item);
    return {
      ...norm,
      _displayCategory: norm.itemName,
    };
  });
};
