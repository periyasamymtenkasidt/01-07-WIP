import assert from "node:assert/strict";
import { createServer } from "vite";

class MemoryStorage {
  #data = new Map();

  get length() {
    return this.#data.size;
  }

  key(index) {
    return [...this.#data.keys()][index] ?? null;
  }

  getItem(key) {
    return this.#data.has(String(key)) ? this.#data.get(String(key)) : null;
  }

  setItem(key, value) {
    this.#data.set(String(key), String(value));
  }

  removeItem(key) {
    this.#data.delete(String(key));
  }

  clear() {
    this.#data.clear();
  }
}

globalThis.localStorage = new MemoryStorage();
globalThis.Event = class Event {
  constructor(type) {
    this.type = type;
  }
};
globalThis.window = { dispatchEvent() {} };

const checks = [];
const check = (name, fn) => {
  fn();
  checks.push(name);
  process.stdout.write(`PASS  ${name}\n`);
};

const almostEqual = (actual, expected, tolerance = 0.01) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const survey = await server.ssrLoadModule("/src/data/surveyMeasureStorage.js");
  const design = await server.ssrLoadModule("/src/data/designFlowStorage.js");
  const boqStore = await server.ssrLoadModule("/src/data/boqStorage.js");
  const gradeMapping = await server.ssrLoadModule("/src/data/gradeMapping.js");
  const rateBuildup = await server.ssrLoadModule("/src/data/rateBuildup.js");

  const clientID = "CL-ACCEPT-001";
  const leadID = "LD-ACCEPT-001";
  const siteID = "ST-ACCEPT-001";
  const scopeItem = {
    id: "SCOPE-PAINT-001",
    scopeItemId: "SCOPE-PAINT-001",
    heading: "LIVING ROOM",
    area: "LIVING ROOM",
    itemName: "Wall Painting",
    description: "Premium interior wall painting",
    qty: 100,
    unit: "sqft",
    rate: 100,
    amount: 10000,
    gstPercent: 18,
    materials: [{ id: "MAT-PAINT", name: "Interior Paint", spec: "Premium" }],
  };
  const proposal = {
    quoteId: "QT-ACCEPT-001",
    parentId: leadID,
    presetKey: "2 BHK",
    propertyType: "Apartment",
    scopeItems: [scopeItem],
    subtotal: 10000,
    gst: 1800,
    grandTotal: 11800,
    status: "sent",
  };
  const site = {
    siteID,
    clientID,
    clientName: "Acceptance Client",
    propertyPreset: "2 BHK",
    siteType: "Apartment",
    status: "Survey",
  };

  localStorage.setItem(
    "newClientsData",
    JSON.stringify([
      {
        clientID,
        clientName: site.clientName,
        sourceLeadId: leadID,
        location: "Apartment",
      },
    ]),
  );
  localStorage.setItem(
    "newLeadsData",
    JSON.stringify([
      {
        proposalId: leadID,
        clientName: site.clientName,
        scope: "Interior",
        serviceTrack: "Interiors",
        quotePreset: "2 BHK",
        propertyType: "Apartment",
      },
    ]),
  );
  localStorage.setItem(`quotes_${leadID}`, JSON.stringify([proposal]));
  localStorage.setItem("newSitesData", JSON.stringify({ [siteID]: site }));

  const initialAreas = survey.areasForSite(site);
  const initialElement = initialAreas[0].elements[0];
  const measurementKey = survey.elKey(
    initialAreas[0].area,
    initialElement.name,
    initialElement.scopeItemId,
  );

  check("approved proposal grand total is the immutable quoted baseline", () => {
    const baseline = survey.getProposalBaselineForSite(site);
    assert.equal(baseline.quoteId, proposal.quoteId);
    assert.equal(baseline.subtotal, proposal.subtotal);
    assert.equal(baseline.grandTotal, proposal.grandTotal);
  });

  survey.writeDims(siteID, {
    [measurementKey]: { length: 10, breadth: 10, nos: 1, images: ["photo-1"] },
  });
  check("matching measurement produces the proposal total", () => {
    const variance = survey.getSurveyVsProposalVariance(site);
    assert.equal(variance.quotedAmount, 11800);
    almostEqual(variance.measuredAmount, 11800);
    almostEqual(variance.amountDifference, 0);
    assert.equal(variance.amountOverLimit, false);
  });

  const qtyAtLimit = 100 + 15000 / 118;
  survey.writeDims(siteID, {
    [measurementKey]: {
      length: qtyAtLimit,
      breadth: 1,
      nos: 1,
      images: ["photo-1"],
    },
  });
  check("proposal plus exactly ₹15,000 is allowed", () => {
    const variance = survey.getSurveyVsProposalVariance(site);
    almostEqual(variance.amountDifference, 15000);
    assert.equal(variance.amountOverLimit, false);
  });

  const qtyOverLimit = 100 + 15001 / 118;
  survey.writeDims(siteID, {
    [measurementKey]: {
      length: qtyOverLimit,
      breadth: 1,
      nos: 1,
      images: ["photo-1"],
    },
  });
  check("proposal plus ₹15,001 is blocked", () => {
    const variance = survey.getSurveyVsProposalVariance(site);
    assert.ok(variance.amountDifference > 15000);
    assert.equal(variance.amountOverLimit, true);
  });

  survey.writeCustomItems(siteID, [
    {
      id: "CUSTOM-001",
      scopeItemId: "CUSTOM-001",
      heading: "LIVING ROOM",
      area: "LIVING ROOM",
      itemName: "Site Repair",
      description: "Site Repair",
      qty: 1,
      unit: "nos",
      rate: 500,
      amount: 0,
      isCustom: true,
      materials: [],
    },
  ]);
  const areas = survey.areasForSite(site);
  const customElement = areas[0].elements.find((item) => item.isCustom);
  const customKey = survey.elKey(
    areas[0].area,
    customElement.name,
    customElement.scopeItemId,
  );
  survey.writeDims(siteID, {
    [measurementKey]: {
      length: 10,
      breadth: 10,
      nos: 1,
      images: ["photo-1"],
      selectedMaterial: {
        id: "GRADE-PREMIUM",
        grade: "premium",
        name: "Premium Paint System",
        rate: 120,
        materials: [{ materialId: "MAT-PREMIUM", name: "Premium Paint" }],
      },
    },
    [customKey]: { nos: 1, images: ["photo-2"] },
  });

  check("selected material rate changes measured value but not quoted value", () => {
    const variance = survey.getSurveyVsProposalVariance(site);
    assert.equal(variance.quotedAmount, 11800);
    almostEqual(variance.measuredAmount, 14750);
    almostEqual(variance.amountDifference, 2950);
  });

  const surveyState = survey.getSurveyMeasureState(site);
  check("survey completeness recognizes measurements for every work", () => {
    assert.equal(surveyState.complete, true);
    assert.equal(surveyState.measured, 2);
    assert.equal(surveyState.total, 2);
  });

  const flow = design.startDesign(site, { areas, surveyState });
  check("freezing creates an immutable Design site basis", () => {
    assert.equal(flow.siteBasis.proposalBaseline.grandTotal, 11800);
    assert.equal(flow.siteBasis.areas.length, 1);
    assert.ok(flow.siteBasis.frozenAt);
    assert.equal(design.getDesignFlow(siteID).stage.startsWith("DESIGN_"), true);
  });

  const calculatedBoq = design.buildBoq(flow);
  check("pipeline BOQ uses GST-inclusive variance and tags site custom work", () => {
    assert.equal(calculatedBoq.quotedTotal, 11800);
    almostEqual(calculatedBoq.total, 14750);
    almostEqual(calculatedBoq.variance, 2950);
    assert.equal(calculatedBoq.withinTolerance, true);
    const customRow = calculatedBoq.areas[0].rows.find((row) => row.isCustom);
    assert.equal(customRow.quotedAmount, 0);
    assert.equal(customRow.measuredAmount, 500);
  });

  design.generateStageBoq(siteID);
  const boqID = `BOQ-${siteID}`;
  let editorBoq = boqStore.getBoq(boqID);
  check("generation registers one first-class BOQ editor record", () => {
    assert.ok(editorBoq);
    assert.equal(editorBoq.id, boqID);
    assert.equal(editorBoq.quotedTotal, 11800);
    assert.equal(editorBoq.measuredTotal, 14750);
    assert.equal(boqStore.listBoqs().filter((item) => item.id === boqID).length, 1);
  });

  check("generated lines preserve identities, quote values, materials and variation tags", () => {
    const items = editorBoq.sections.flatMap((section) => section.items);
    const proposalItem = items.find((item) => item.scopeItemId === scopeItem.id);
    const customItem = items.find((item) => item.scopeItemId === "CUSTOM-001");
    assert.equal(proposalItem.quotedQty, 100);
    assert.equal(proposalItem.quotedAmount, 10000);
    assert.equal(proposalItem.measuredRate, 120);
    assert.equal(proposalItem.materials[0].id, "MAT-PREMIUM");
    assert.equal(customItem.source, "site-custom");
    assert.equal(customItem.isVariation, true);
  });

  editorBoq.sections[0].items.push({
    ...boqStore.blankItem(),
    description: "Manual BOQ variation",
    qty: 1,
    rate: 250,
    source: "manual",
    isVariation: true,
  });
  editorBoq.status = "approved";
  boqStore.saveBoq(editorBoq);
  design.generateStageBoq(siteID);
  editorBoq = boqStore.getBoq(boqID);
  check("regeneration preserves manual lines and returns revised BOQ to draft", () => {
    assert.equal(editorBoq.status, "draft");
    assert.equal(editorBoq.revision, 2);
    assert.ok(
      editorBoq.sections.flatMap((section) => section.items).some(
        (item) => item.description === "Manual BOQ variation",
      ),
    );
    assert.equal(boqStore.listBoqs().filter((item) => item.id === boqID).length, 1);
  });

  design.unfreezeSurvey(siteID);
  check("unlock archives Design, returns the site to Survey and marks BOQ stale", () => {
    assert.equal(design.getDesignFlow(siteID), null);
    assert.equal(boqStore.getBoq(boqID).surveyStale, true);
    const archives = JSON.parse(
      localStorage.getItem(`designFlowArchive_${siteID}`) || "[]",
    );
    assert.equal(archives.length, 1);
    const siteOverrides = JSON.parse(localStorage.getItem("newSitesData"));
    assert.equal(siteOverrides[siteID].status, "Survey");
  });

  const refreshedAreas = survey.areasForSite(site);
  const refreshedState = survey.getSurveyMeasureState(site);
  design.startDesign(site, { areas: refreshedAreas, surveyState: refreshedState });
  design.generateStageBoq(siteID);
  check("refreeze regenerates the same BOQ and clears its stale marker", () => {
    const refreshedBoq = boqStore.getBoq(boqID);
    assert.equal(refreshedBoq.surveyStale, false);
    assert.equal(boqStore.listBoqs().filter((item) => item.id === boqID).length, 1);
  });

  localStorage.setItem(
    "material_library",
    JSON.stringify([
      { id: "MAT-GRADE-001", name: "Grade Material", unit: "sqft", rate: 200 },
    ]),
  );
  localStorage.setItem(
    "item_library",
    JSON.stringify([
      {
        id: "LIB-GRADE-001",
        description: "Grade-mapped Work",
        unit: "sqft",
        recipes: {
          premium: {
            components: [],
            labourRate: 100,
            overheadPct: 10,
            marginPct: 20,
          },
          luxury_plus: {
            components: [
              {
                materialId: "MAT-GRADE-001",
                name: "Grade Material",
                unit: "sqft",
                qty: 1,
                wastagePct: 0,
                rate: 200,
              },
            ],
            labourRate: 100,
            overheadPct: 10,
            marginPct: 20,
          },
        },
      },
    ]),
  );
  check("quality grade maps Item Master rate/materials without changing scope identity", () => {
    const grades = rateBuildup.collectGrades(
      JSON.parse(localStorage.getItem("item_library")),
    );
    assert.ok(grades.some((grade) => grade.key === "luxury_plus"));
    const [mapped] = gradeMapping.mapScopeItemsToGrade(
      [
        {
          scopeItemId: "SCOPE-GRADE-001",
          masterId: "LIB-GRADE-001",
          heading: "LIVING ROOM",
          area: "LIVING ROOM",
          itemName: "Grade-mapped Work",
          qty: 10,
          rate: 100,
          amount: 1000,
        },
      ],
      "luxury_plus",
    );
    assert.equal(mapped.scopeItemId, "SCOPE-GRADE-001");
    assert.equal(mapped.heading, "LIVING ROOM");
    assert.equal(mapped.grade, "luxury_plus");
    assert.equal(mapped.rate, 396);
    assert.equal(mapped.amount, 3960);
    assert.equal(mapped.materials[0].materialId, "MAT-GRADE-001");
  });

  const legacyRecipe = {
    components: [
      {
        materialId: "MAT-GRADE-001",
        name: "Grade Material",
        unit: "sqft",
        qty: 1,
        wastagePct: 0,
        rate: 200,
      },
    ],
    labourRate: 100,
    overheadPct: 10,
    marginPct: 20,
  };
  localStorage.setItem(
    "item_library",
    JSON.stringify([
      {
        id: "LIB-LEGACY-GRADES",
        description: "Legacy Grade Work",
        unit: "sqft",
        recipes: {
          economy: structuredClone(legacyRecipe),
          premium: structuredClone(legacyRecipe),
          luxury: structuredClone(legacyRecipe),
        },
      },
    ]),
  );
  check("legacy identical grade recipes migrate to increasing quality rates", () => {
    const scope = {
      masterId: "LIB-LEGACY-GRADES",
      itemName: "Legacy Grade Work",
      qty: 10,
    };
    const economy = gradeMapping.mapScopeItemsToGrade([scope], "economy")[0];
    const premium = gradeMapping.mapScopeItemsToGrade([scope], "premium")[0];
    const luxury = gradeMapping.mapScopeItemsToGrade([scope], "luxury")[0];
    assert.ok(economy.amount < premium.amount);
    assert.ok(premium.amount < luxury.amount);
  });

  process.stdout.write(`\n${checks.length} BOQ acceptance checks passed.\n`);
} finally {
  await server.close();
}
