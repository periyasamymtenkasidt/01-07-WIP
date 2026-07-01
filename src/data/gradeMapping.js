import {
  computeLibraryItemAmount,
  listLibrary,
} from "./itemLibrary";
import { listMaterials } from "./materialLibrary";
import { computeRecipe, materialsById, recipeToMaterials } from "./rateBuildup";

const normalized = (value) => (value || "").trim().toLowerCase();

const findLibraryItem = (scope, library) => {
  const masterId = scope.masterId || scope.itemId;
  if (masterId) {
    const byId = library.find((item) => item.id === masterId);
    if (byId) return byId;
  }

  const scopeName = normalized(scope.itemName || scope.name);
  if (!scopeName) return null;
  return (
    library.find((item) => normalized(item.description) === scopeName) || null
  );
};

// Apply an Item Master's composite grade rate to a single proposal row without
// changing its room, description, dimensions, assumed quantity, or identity.
export const mapScopeItemToGrade = (scope, grade = "economy") => {
  const library = listLibrary();
  const materialLookup = materialsById(listMaterials());

  const libraryItem = findLibraryItem(scope, library);
  const recipes = libraryItem?.recipes || scope.recipes;
  const recipe = recipes?.[grade];
  if (!recipe) {
    return { ...scope, grade };
  }

  const calculation = computeRecipe(recipe, materialLookup);
  const rate = Math.round(calculation.rate || 0);
  if (rate <= 0) return { ...scope, grade };

  const mappedMaterials = recipeToMaterials(recipe, materialLookup);
  const updated = {
    ...scope,
    masterId: scope.masterId || libraryItem?.id || null,
    recipes,
    grade,
    rate,
    materials: mappedMaterials,
  };

  return {
    ...updated,
    amount: computeLibraryItemAmount(updated),
  };
};

// Apply an Item Master's composite grade rate to proposal rows without
// changing their room, description, dimensions, assumed quantity, or identity.
// When `grade` is null/undefined, each row keeps its own `grade` (falling back
// to "economy"), so a quote can carry a different grade per scope item.
export const mapScopeItemsToGrade = (scopeItems = [], grade = "economy") => {
  return scopeItems.map((scope) =>
    mapScopeItemToGrade(scope, grade ?? scope.grade ?? "economy"),
  );
};

// Pull the non-grade descriptive fields (work name, spec, HSN, unit, GST, days)
// of each proposal row from its linked Item Master item, so edits made in Item
// Master flow into existing scopes in the Scope of Work. Rate, materials and
// amount are handled separately by the grade mapping (mapScopeItemsToGrade), so
// they're intentionally left untouched here. A row whose spec has been hand-
// edited (isDescriptionCustom) keeps its custom text; everything else tracks the
// master. Rows with no library match are returned unchanged.
export const syncScopeItemsToLibrary = (scopeItems = [], opts = {}) => {
  const library = opts.library || listLibrary();
  return scopeItems.map((scope) => {
    const lib = findLibraryItem(scope, library);
    if (!lib) return scope;
    const next = {
      ...scope,
      masterId: scope.masterId || lib.id,
      // A row whose name was hand-edited keeps it; everything else tracks master.
      itemName: scope.isItemNameCustom
        ? scope.itemName
        : (lib.description ?? lib.itemName ?? scope.itemName),
      hsn: lib.hsn ?? scope.hsn,
      unit: lib.unit || scope.unit,
      gstPercent: lib.gstPercent ?? scope.gstPercent,
      days: lib.days ?? scope.days,
    };
    // Only refresh the spec/description when the row hasn't been hand-edited and
    // the master carries an explicit spec — so per-scope wording isn't clobbered
    // and we never overwrite a real spec with the bare item name.
    if (!scope.isDescriptionCustom && lib.spec) {
      next.spec = lib.spec;
      next.description = lib.spec;
    }
    return next;
  });
};

// Whether a scope row carries a usable value for the given grade — i.e. its
// linked Item Master item (by masterId or name) has a recipe for that grade
// that computes to a rate > 0. Used by the proposal forms to hide grade
// options that hold no value for a particular row. Pass precomputed `library`
// and `materialLookup` to avoid re-reading storage per call.
export const gradeHasValue = (scope, grade, opts = {}) => {
  if (!grade) return false;
  const library = opts.library || listLibrary();
  const materialLookup = opts.materialLookup || materialsById(listMaterials());

  const libraryItem = findLibraryItem(scope, library);
  const recipes = libraryItem?.recipes || scope.recipes;
  const recipe = recipes?.[grade];
  if (!recipe) return false;

  const calculation = computeRecipe(recipe, materialLookup);
  return (calculation?.rate || 0) > 0;
};
