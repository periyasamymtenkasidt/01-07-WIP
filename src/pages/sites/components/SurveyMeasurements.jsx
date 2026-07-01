import { useState, useEffect, useRef } from "react";
import {
  FiGrid,
  FiCheckCircle,
  FiSmartphone,
  FiImage,
  FiArrowRight,
  FiLock,
  FiX,
  FiAlertTriangle,
  FiTrash2,
} from "react-icons/fi";
import { DIMENSIONAL_UNITS } from "../../../data/boqStorage";
import {
  elKey,
  getElementMeasurement,
  readDims,
  writeDims,
  qtyFor,
  measuredUnitFor,
  areasForSite,
  getSurveyMeasureState,
  getSurveyVsProposalVariance,
  generateAppSurveyData,
  readCustomItems,
  writeCustomItems,
} from "../../../data/surveyMeasureStorage";
import {
  getDesignFlow,
  startDesign,
  DESIGN_STAGES,
  unfreezeSurvey,
} from "../../../data/designFlowStorage";
import { listMaterials } from "../../../data/materialLibrary";
import { listLibrary } from "../../../data/itemLibrary";
import { collectGrades, computeRecipe, materialsById } from "../../../data/rateBuildup";
import { storeFile, getFile, deleteFile } from "../../../utils/fileStorage";

// Measurements + photos are normally captured on the field app and synced in
// (demo: "Sync from app"). Until a real field app exists, this view also lets
// staff enter both directly here — same dims shape either way.

const formula = (unit, d) => {
  const q = qtyFor(unit, d);
  const info = DIMENSIONAL_UNITS[unit];
  const nos = Number(d?.nos) || 0;
  if (!info) return `${nos} ${unit}`;
  // Dimensional works derive qty straight from L×B/L (no Nos multiplier), so
  // only show "× nos" when an explicit count above 1 was entered.
  const mult = nos > 1 ? ` × ${nos}` : "";
  if (info.kind === "length") {
    return `${Number(d?.length) || 0}${mult} = ${q.toLocaleString("en-IN")} ${unit}`;
  }
  const second = Number(d?.breadth) || Number(d?.height) || 0;
  return `${Number(d?.length) || 0} × ${second}${mult} = ${q.toLocaleString("en-IN")} ${unit}`;
};

const genCustomId = () =>
  `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const SurveyMeasurements = ({ site, onExpandPhoto }) => {
  const siteID = site.siteID;
  const areas = areasForSite(site);
  const [dims, setDims] = useState(() => readDims(siteID));
  const [photoUrls, setPhotoUrls] = useState({});
  const photoUrlCache = useRef({});

  const materialsList = listMaterials();
  const libraryList = listLibrary();
  const materialLookup = materialsById(materialsList);

  const [showAddCustomModal, setShowAddCustomModal] = useState(false);
  const [customItemArea, setCustomItemArea] = useState("");
  const [customItemLibId, setCustomItemLibId] = useState("");
  const [customItemQty, setCustomItemQty] = useState("1");

  // The survey → design handoff. Once design starts, the survey is frozen
  // (read-only, no re-sync) and this record drives the design pipeline.
  const [designFlow, setDesignFlow] = useState(() => getDesignFlow(siteID));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const designStarted = !!designFlow;

  // No survey work can begin until a Site Incharge (supervisor) is assigned.
  const supervisorAssigned = !!(site.supervisor && String(site.supervisor).trim());
  const surveyLocked = !supervisorAssigned;
  // Editing controls are inert when the survey is frozen (design started) OR
  // before a supervisor is assigned. Controls are disabled outright — the
  // banner explains why — so there are no blocking alerts to dismiss.
  const editingLocked = designStarted || surveyLocked;

  useEffect(() => {
    const handler = () => {
      setDims(readDims(siteID));
      setDesignFlow(getDesignFlow(siteID));
    };
    window.addEventListener("siteDataChanged", handler);
    return () => window.removeEventListener("siteDataChanged", handler);
  }, [siteID]);

  useEffect(() => {
    let cancelled = false;
    const refs = Object.values(dims)
      .flatMap((d) => d?.images || [])
      .filter((image) => image?.fileId && !photoUrlCache.current[image.fileId]);
    Promise.all(
      refs.map(async (image) => {
        const blob = await getFile(image.fileId);
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        if (cancelled) return URL.revokeObjectURL(url);
        photoUrlCache.current[image.fileId] = url;
      }),
    ).then(() => {
      if (!cancelled) setPhotoUrls({ ...photoUrlCache.current });
    });
    return () => {
      cancelled = true;
    };
  }, [dims]);

  useEffect(
    () => () => {
      Object.values(photoUrlCache.current).forEach(URL.revokeObjectURL);
    },
    [],
  );

  const photoSrc = (image) =>
    typeof image === "string" ? image : photoUrls[image?.fileId] || "";

  // Quality-grade options for a work, using the Proposal Master grade set (the
  // same grades used there, including any custom grades). Every scope gets the
  // full grade list so the dropdown is always selectable — even works without a
  // rate build-up. Each grade's per-unit rate comes from its recipe when one
  // exists, otherwise it falls back to the work's quoted rate.
  const materialOptionsFor = (el) => {
    const work =
      libraryList.find((item) => item.id === el.masterId) ||
      libraryList.find((item) => item.description === el.name);
    const workId = work?.id || el.masterId || el.scopeItemId || el.name;
    const recipes = work?.recipes || {};
    const fallbackRate = Number(el.rate) || 0;
    return collectGrades(libraryList).map((grade) => {
      const recipe = recipes[grade.key];
      const computed = recipe
        ? Math.round(computeRecipe(recipe, materialLookup).rate || 0)
        : 0;
      const rate = computed > 0 ? computed : fallbackRate;
      return {
        id: `${workId}:${grade.key}`,
        name: grade.label,
        specifications: `${work?.description || el.name} · ${grade.label}`,
        rate,
        unit: work?.unit || el.unit,
        grade: grade.key,
        materials: recipe?.components || [],
      };
    });
  };

  const handleAddCustomItem = () => {
    if (surveyLocked) return;
    const libItem = libraryList.find((it) => it.id === customItemLibId);
    if (!libItem || !customItemArea) return;

    const nextCustomItems = readCustomItems(siteID);
    const newCustomItem = {
      id: genCustomId(),
      masterId: libItem.id,
      area: customItemArea,
      heading: customItemArea,
      itemName: libItem.description,
      description: libItem.description,
      unit: libItem.unit,
      qty: Number(customItemQty) || 1,
      rate: Number(libItem.rate) || 0,
      days: libItem.days,
      materials: libItem.materials || [],
      isCustom: true,
    };
    if (!writeCustomItems(siteID, [...nextCustomItems, newCustomItem])) {
      alert("The custom survey item could not be saved. Please free browser storage and retry.");
      return;
    }
    setShowAddCustomModal(false);
    setCustomItemArea("");
    setCustomItemLibId("");
    setCustomItemQty("1");
    window.dispatchEvent(new Event("siteDataChanged"));
  };

  const handleRemoveCustomItem = (areaName, el) => {
    if (editingLocked) return;
    const next = readCustomItems(siteID).filter(
      (item) => item.id !== el.scopeItemId,
    );
    const key = elKey(areaName, el.name, el.scopeItemId);
    const nextDims = { ...dims };
    const images = nextDims[key]?.images || [];
    images.forEach((image) => {
      if (image?.fileId) deleteFile(image.fileId);
    });
    delete nextDims[key];
    if (!writeDims(siteID, nextDims)) {
      alert("The custom item could not be removed because survey storage failed.");
      return;
    }
    setDims(nextDims);
    if (!writeCustomItems(siteID, next)) {
      alert("The custom item list could not be saved.");
    }
  };

  // Demo: pull the field app's payload (per-work measurements + photos).
  const syncFromApp = () => {
    if (editingLocked) return; // frozen after handoff or no supervisor yet
    const data = generateAppSurveyData(site);
    if (writeDims(siteID, data.dims)) setDims(data.dims);
    else alert("Survey measurements could not be saved. Please free browser storage and try again.");
  };

  const state = getSurveyMeasureState(site);

  // Gate conditions for "Move to Design": every work measured AND every work has
  // at least one survey photo. Counted live from the synced dims.
  const totalWorks = areas.reduce((n, a) => n + a.elements.length, 0);
  const worksWithPhotos = areas.reduce(
    (n, a) =>
      n +
      a.elements.filter(
        (el) => (getElementMeasurement(dims, a.area, el).images?.length || 0) > 0,
      ).length,
    0,
  );
  const photosComplete = totalWorks > 0 && worksWithPhotos === totalWorks;
  const variance = getSurveyVsProposalVariance(site);
  const varianceOk = !variance.amountOverLimit;
  const canMoveToDesign = state.complete && photosComplete && varianceOk;

  const moveToDesign = () => {
    if (surveyLocked) return;
    const flow = startDesign(site, { areas, surveyState: state });
    setDesignFlow(flow);
    setConfirmOpen(false);
  };

  const areaSqft = (a) =>
    a.elements.reduce((s, el) => {
      const d = getElementMeasurement(dims, a.area, el);
      return s + (measuredUnitFor(el.unit, d) === "sqft" ? qtyFor(el.unit, d) : 0);
    }, 0);

  if (!state.hasPreset) {
    return (
      <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100">
        <h3 className="text-lg font-bold text-darkgray flex items-center gap-2 mb-3">
          <span className="w-2.5 h-4 bg-select-blue rounded-xs inline-block"></span>
          Survey Measurements
        </h3>
        <p className="text-[13px] text-text-muted">
          No proposal works are available for this site. Link a client proposal
          or choose a valid Proposal Master preset and property type.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-darkgray flex items-center gap-2">
            <span className="w-2.5 h-4 bg-select-blue rounded-xs inline-block"></span>
            Survey Measurements
          </h3>
          <p className="text-[11px] text-text-muted mt-1">
            Captured on the field app — read-only here.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!designStarted && (
            <button
              type="button"
              onClick={() => setShowAddCustomModal(true)}
              disabled={surveyLocked}
              title={surveyLocked ? "Assign a Site Incharge first" : undefined}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-bg-soft hover:bg-bordergray text-darkgray text-[11px] font-semibold border border-bordergray transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-bg-soft"
            >
              <FiGrid size={11} /> Add Custom Item
            </button>
          )}
          <button
            type="button"
            onClick={syncFromApp}
            disabled={editingLocked}
            title={
              designStarted
                ? "Survey is frozen — design has started"
                : surveyLocked
                  ? "Assign a Site Incharge before syncing survey data"
                  : "Map the field app's survey data (measurements + photos)"
            }
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-select-blue text-white text-[11px] font-semibold hover:bg-blue-950 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-select-blue"
          >
            <FiSmartphone size={11} /> Sync from app
          </button>
          {state.complete ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
              <FiCheckCircle size={13} /> All measured
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-select-blue border border-blue-100">
              {state.measured}/{state.total} measured
            </span>
          )}
          {photosComplete ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
              <FiImage size={12} /> All photographed
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-select-blue border border-blue-100">
              {worksWithPhotos}/{totalWorks} photos
            </span>
          )}
          {(variance.quotedSqft > 0 || variance.quotedAmount > 0) &&
            (varianceOk ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                <FiCheckCircle size={12} /> Matches proposal
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-600 border border-red-200">
                <FiAlertTriangle size={12} />
                Amount exceeds proposal + ₹15,000
              </span>
            ))}
          {designStarted ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-violet-100 text-violet-700 border border-violet-200">
                <FiLock size={12} /> Design in progress
              </span>
              <button
                type="button"
                onClick={() => {
                  if (confirm("Unlock this survey? The site will return to Survey and the current design pipeline will be archived for history.")) {
                    unfreezeSurvey(siteID);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-[11.5px] font-bold transition-colors"
              >
                Unlock Survey
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={surveyLocked}
              title={
                surveyLocked
                  ? "Assign a Site Incharge first"
                  : canMoveToDesign
                    ? "Freeze the survey and start the design pipeline"
                    : "See what's still missing"
              }
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                canMoveToDesign
                  ? "bg-linear-to-br from-violet-600 to-violet-800 text-white"
                  : "bg-bg-soft text-text-muted border border-bordergray"
              }`}
            >
              Move to Design <FiArrowRight size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Supervisor gate — no survey work until a Site Incharge is assigned. */}
      {surveyLocked && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <FiAlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-amber-900">
              Assign a Site Incharge to begin the survey
            </p>
            <p className="text-[11px] text-amber-700/90 mt-0.5">
              A supervisor must be assigned to this site before you can record
              measurements, sync from the field app, add custom items, or move
              to design. All survey actions are disabled until then.
            </p>
          </div>
        </div>
      )}

      {/* Handoff banner — shown once the survey is frozen into design. */}
      {designStarted && (
        <div className="mb-6 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white">
              <FiCheckCircle size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-violet-900">
                Survey frozen — design started
              </p>
              <p className="text-[11px] text-violet-700/90 mt-0.5">
                Measurements &amp; photos are locked as the Site Basis
                {designFlow?.siteBasis?.frozenAt
                  ? ` (frozen ${designFlow.siteBasis.frozenAt})`
                  : ""}
                . The design pipeline below now drives the project.
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {DESIGN_STAGES.map((s, i) => (
                  <span
                    key={s.key}
                    className="flex items-center gap-1.5 rounded-full border border-violet-200 bg-white px-2.5 py-0.5 text-[10.5px] font-semibold text-violet-700"
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-100 text-[9px] font-bold">
                      {i + 1}
                    </span>
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-palewhite border border-bg-soft rounded-[16px] p-4">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
            Areas
          </p>
          <p className="text-2xl font-black text-darkgray">{areas.length}</p>
        </div>
        <div className="bg-palewhite border border-bg-soft rounded-[16px] p-4">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
            Measured
          </p>
          <p className="text-2xl font-black text-darkgray">
            {state.measured}
            <span className="text-sm font-bold text-gray-400">/{state.total}</span>
          </p>
        </div>
        <div className="bg-blue-50/50 border border-blue-100 rounded-[16px] p-4">
          <p className="text-[10px] text-select-blue/70 font-bold uppercase tracking-wider mb-1">
            Total Area
          </p>
          <p className="text-2xl font-black text-select-blue">
            {state.totalSqft.toLocaleString("en-IN")}
            <span className="text-sm font-bold"> sqft</span>
          </p>
        </div>
      </div>

      {/* Areas → works (read-only) → photos */}
      <div className="space-y-5">
        {areas.map((area) => (
          <div
            key={area.area}
            className="border border-bg-soft rounded-[16px] overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-palewhite">
              <div className="flex items-center gap-2 min-w-0">
                <FiGrid size={14} className="text-select-blue shrink-0" />
                <span className="font-bold text-darkgray text-[14px] truncate">
                  {area.area}
                </span>
              </div>
              <span className="text-[11px] font-bold text-select-blue bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                {areaSqft(area).toLocaleString("en-IN")} sqft
              </span>
            </div>

            <div className="p-4">
              {area.elements.length === 0 ? (
                <p className="text-[12px] text-text-subtle italic">
                  No work elements defined for this area.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {area.elements.map((el) => {
                    const key = elKey(area.area, el.name, el.scopeItemId);
                    const d = getElementMeasurement(dims, area.area, el);
                    const imgs = d.images || [];
                    const info = DIMENSIONAL_UNITS[el.unit];
                    const isArea = info?.kind === "area";
                    const isLength = info?.kind === "length";
                    const materialOptions = materialOptionsFor(el);

                    const updateDim = (patch) => {
                      if (editingLocked) return;
                      const nextDims = { ...dims, [key]: { ...d, ...patch } };
                      if (writeDims(siteID, nextDims)) setDims(nextDims);
                      else alert("This survey change could not be saved. Please free browser storage and retry.");
                    };

                    const addPhotos = async (fileList) => {
                      if (editingLocked) return;
                      const files = Array.from(fileList || []);
                      if (files.length === 0) return;
                      const refs = [];
                      for (const file of files) {
                        const fileId = `survey_${siteID}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
                        const saved = await storeFile(fileId, file);
                        if (saved) refs.push({ fileId, name: file.name, type: file.type });
                      }
                      updateDim({ images: [...(d.images || []), ...refs] });
                    };

                    const removePhoto = (idx) => {
                      if (editingLocked) return;
                      const removed = imgs[idx];
                      if (removed?.fileId) deleteFile(removed.fileId);
                      updateDim({ images: imgs.filter((_, i) => i !== idx) });
                    };

                    return (
                      <div
                        key={el.scopeItemId || el.name}
                        className="rounded-xl border border-bg-soft bg-palewhite/40 p-3"
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <span className="flex items-center gap-2 text-[13px] font-semibold text-darkgray">
                            {el.name}
                            {el.isCustom && !editingLocked && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomItem(area.area, el)}
                                className="rounded p-1 text-red-500 hover:bg-red-50"
                                title="Remove custom survey item"
                              >
                                <FiTrash2 size={11} />
                              </button>
                            )}
                          </span>
                          <span className="text-[13px] font-bold text-select-blue tabular-nums whitespace-nowrap">
                            {formula(el.unit, d)}
                          </span>
                        </div>

                        {/* Manual measurement entry — L/B/H captured for every
                            work regardless of unit, since which dimensions
                            actually matter varies (floor area = L×B, wall
                            area = L×H, a one-off item may need all three). */}
                        <div className="flex flex-wrap items-center gap-2 mb-2.5">
                          {info && (
                            <DimInput
                              label="Length"
                              suffix={info.suffix}
                              value={d.length}
                              onChange={(v) => updateDim({ length: v })}
                              disabled={editingLocked}
                            />
                          )}
                          {isArea && (
                            <>
                              <DimInput
                                label="Breadth"
                                suffix={info?.suffix}
                                value={d.breadth}
                                onChange={(v) => updateDim({ breadth: v, height: "" })}
                                disabled={editingLocked}
                              />
                              <DimInput
                                label="Height (instead)"
                                suffix={info?.suffix}
                                value={d.height}
                                onChange={(v) => updateDim({ height: v, breadth: "" })}
                                disabled={editingLocked}
                              />
                            </>
                          )}
                          {/* Count-unit works (nos/ls/…) still need a quantity;
                              dimensional works derive qty from L×B/L, so the
                              "Nos" multiplier is dropped for them. */}
                          {!isArea && !isLength && (
                            <DimInput
                              label="Quantity"
                              value={d.nos}
                              onChange={(v) => updateDim({ nos: v })}
                              disabled={editingLocked}
                            />
                          )}
                        </div>

                        {/* Quality grade selection — grades from Proposal
                            Master, each with its per-unit rate. */}
                        <div className="flex items-center gap-2 mb-3">
                          <label className="text-[11px] text-text-muted flex items-center gap-1.5 w-full">
                            Quality grade:
                            <select
                              value={d.selectedMaterial?.id || ""}
                              disabled={editingLocked}
                              onChange={(e) => {
                                const selectedMat = materialOptions.find((m) => m.id === e.target.value);
                                updateDim({ selectedMaterial: selectedMat || null });
                              }}
                              className="rounded-md border border-bordergray bg-white px-2 py-1.5 text-[12px] text-darkgray focus:outline-none focus:border-select-blue disabled:bg-bg-soft disabled:text-text-subtle w-full max-w-[340px]"
                            >
                              <option value="">-- Original proposal grade --</option>
                              {materialOptions.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} · ₹{m.rate}/{m.unit}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        {/* Photos */}
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {imgs.map((image, i) => {
                            const src = photoSrc(image);
                            return (
                            <div key={i} className="relative group">
                              {src && (
                                <img
                                  src={src}
                                  alt={`${el.name} ${i + 1}`}
                                  onClick={() => onExpandPhoto?.(imgs.map(photoSrc), i, `${area.area} — ${el.name}`)}
                                  className="w-full h-16 object-cover rounded-md border border-bordergray cursor-pointer hover:opacity-90"
                                />
                              )}
                              {!editingLocked && (
                                <button
                                  type="button"
                                  onClick={() => removePhoto(i)}
                                  title="Remove photo"
                                  className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <FiX size={8} />
                                </button>
                              )}
                            </div>
                          );})}
                          {!editingLocked && (
                            <label
                              title="Add photo"
                              className="h-16 rounded-md border border-dashed border-bordergray flex items-center justify-center cursor-pointer text-text-subtle hover:border-select-blue hover:text-select-blue transition-colors"
                            >
                              <FiImage size={14} />
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                  addPhotos(e.target.files);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          )}
                          {imgs.length === 0 && designStarted && (
                            <p className="col-span-full text-[11px] text-text-subtle italic flex items-center gap-1.5">
                              <FiImage size={11} /> No photos synced.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Move-to-Design confirmation — the survey freeze gate. */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h4 className="text-[16px] font-bold text-darkgray">
                  Move to Design?
                </h4>
                <p className="mt-1 text-[12px] text-text-muted">
                  This freezes the survey and opens the design pipeline.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg p-1 text-text-muted hover:bg-bg-soft"
              >
                <FiX size={16} />
              </button>
            </div>

            <div className="space-y-2 rounded-xl border border-bg-soft bg-palewhite/50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">
                Handoff checklist
              </p>
              <ChecklistRow
                ok={state.complete}
                label={`All works measured (${state.measured}/${state.total})`}
              />
              <ChecklistRow
                ok={photosComplete}
                label={`Survey photos received (${worksWithPhotos}/${totalWorks})`}
              />
              {variance.quotedAmount > 0 && (
                <ChecklistRow
                  ok={!variance.amountOverLimit}
                  label={
                    variance.amountOverLimit
                      ? `Measured total is ₹${variance.amountDifference.toLocaleString("en-IN", { maximumFractionDigits: 0 })} above the proposal — maximum allowed increase is ₹${variance.maxVarianceAmount.toLocaleString("en-IN")}`
                      : `Measured total is allowed (difference ${variance.amountDifference >= 0 ? "+" : "−"}₹${Math.abs(variance.amountDifference).toLocaleString("en-IN", { maximumFractionDigits: 0 })}; increases up to ₹${variance.maxVarianceAmount.toLocaleString("en-IN")} are permitted)`
                  }
                />
              )}
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <FiAlertTriangle
                size={14}
                className="mt-0.5 shrink-0 text-amber-600"
              />
              <p className="text-[11px] text-amber-800">
                Measurements &amp; photos become <strong>read-only</strong> and are
                snapshotted as the Site Basis. The design will be built against
                this frozen survey.
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg px-4 py-2 text-[12px] font-semibold text-grey hover:bg-bg-soft"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={moveToDesign}
                disabled={!canMoveToDesign}
                className="flex items-center gap-1.5 rounded-lg bg-linear-to-br from-violet-600 to-violet-800 px-4 py-2 text-[12px] font-bold text-white shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Freeze &amp; Start Design <FiArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add Custom Item Modal */}
      {showAddCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
              <h3 className="text-base font-bold text-darkgray">
                Add Custom Survey Item
              </h3>
              <button
                onClick={() => setShowAddCustomModal(false)}
                className="text-text-muted hover:text-darkgray"
              >
                <FiX size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-text-muted mb-1">
                  Area / Room (e.g. Living Room, Foyer)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Corridor, Balcony"
                  value={customItemArea}
                  onChange={(e) => setCustomItemArea(e.target.value)}
                  className="w-full border border-bordergray rounded-lg px-3 py-2 text-[13px] bg-white text-darkgray focus:outline-none focus:border-select-blue"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-text-muted mb-1">
                  Select Work from Library
                </label>
                <select
                  value={customItemLibId}
                  onChange={(e) => setCustomItemLibId(e.target.value)}
                  className="w-full border border-bordergray rounded-lg px-3 py-2 text-[13px] bg-white text-darkgray focus:outline-none focus:border-select-blue"
                >
                  <option value="">-- Choose library item --</option>
                  {libraryList.map((lib) => (
                    <option key={lib.id} value={lib.id}>
                      {lib.description} ({lib.unit}) — ₹{lib.rate}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-text-muted mb-1">
                  Quoted Assumed Qty
                </label>
                <input
                  type="number"
                  min="1"
                  value={customItemQty}
                  onChange={(e) => setCustomItemQty(e.target.value)}
                  className="w-full border border-bordergray rounded-lg px-3 py-2 text-[13px] bg-white text-darkgray focus:outline-none focus:border-select-blue"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowAddCustomModal(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold text-text-muted hover:bg-bg-soft"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomItem}
                disabled={!customItemArea || !customItemLibId}
                className="px-5 py-2 rounded-lg text-[13px] font-semibold text-white bg-select-blue hover:bg-blue-950 disabled:opacity-40"
              >
                Add Item to Survey
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DimInput = ({ label, suffix, value, onChange, disabled }) => (
  <label className="flex items-center gap-1.5 text-[11px] text-text-muted">
    {label}
    <span className="relative">
      <input
        type="number"
        min="0"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-16 rounded-md border border-bordergray bg-white px-2 py-1 text-[12px] text-darkgray focus:outline-none focus:border-select-blue disabled:bg-bg-soft disabled:text-text-subtle"
      />
      {suffix && (
        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-text-subtle">
          {suffix}
        </span>
      )}
    </span>
  </label>
);

const ChecklistRow = ({ ok, label }) => (
  <div className="flex items-center gap-2 text-[12px]">
    <span
      className={`flex h-4 w-4 items-center justify-center rounded-full ${
        ok ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-400"
      }`}
    >
      {ok ? <FiCheckCircle size={11} /> : <FiX size={10} />}
    </span>
    <span className={ok ? "text-darkgray font-medium" : "text-text-muted"}>
      {label}
    </span>
  </div>
);

export default SurveyMeasurements;
