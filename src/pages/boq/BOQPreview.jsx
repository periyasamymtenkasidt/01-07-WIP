import { Fragment, useMemo, useState } from "react";
import {
  X,
  Check,
  Printer,
  Download,
  FileText,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Building2,
  ShieldCheck,
  Ruler,
  Package,
} from "lucide-react";
import {
  computeBoqTotals,
  computeItemAmount,
  computeItemQty,
  computeRateAnalysis,
  resolveGstTreatment,
  DIMENSIONAL_UNITS,
  BOQ_TYPES,
} from "../../data/boqStorage";
import {
  buildTakeoffFromBoq,
  computeMaterialTakeoff,
} from "../../data/procurementStorage";
import { getOrgProfile } from "../../data/orgProfile";
import { UNITS } from "../../data/boqUnits";
import { inrToWords } from "../../utils/numberToWords";
import { formatSizeRange } from "../../utils/sizeRangeValidation";

// Sent/approved/signed BOQs carry a frozen `orgSnapshot` (stamped at send
// time) so the issued document never silently changes if the firm later
// edits its profile. Drafts always read the live profile.
const resolveCompany = (boq) => {
  const profile = boq.orgSnapshot || getOrgProfile();
  return {
    ...profile,
    address: [profile.addressLine, profile.city, profile.state]
      .filter(Boolean)
      .join(", "),
  };
};

const unitLabelOf = (code) => UNITS.find((u) => u.code === code)?.label || code;
const boqTypeLabelOf = (value) =>
  BOQ_TYPES.find((type) => type.value === value)?.label || "Client BOQ";

const compactJoin = (values) => values.filter(Boolean).join(" - ");

const DEFAULT_APPROVAL = {
  preparedBy: "",
  reviewedBy: "",
  approvedBy: "",
  clientAcceptedBy: "",
  preparedAt: "",
  reviewedAt: "",
  approvedAt: "",
  clientAcceptedAt: "",
  checklist: {},
  remarks: "",
};

const mergeApproval = (approval = {}) => ({
  ...DEFAULT_APPROVAL,
  ...approval,
  checklist: {
    ...(approval.checklist || {}),
  },
});

const formatINR = (n) =>
  `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const BOQPreview = ({ boq, onClose }) => {
  const totals = useMemo(() => computeBoqTotals(boq), [boq]);
  const company = useMemo(() => resolveCompany(boq), [boq]);
  const gst = useMemo(() => resolveGstTreatment(boq), [boq]);

  // One IGST line per GST rate when inter-state, otherwise split into
  // CGST + SGST halves — same per-rate amount either way, just the
  // labelling/split changes.
  const gstSplits = useMemo(() => {
    return Object.entries(totals.gstByRate || {})
      .filter(([, v]) => v > 0)
      .map(([rate, amt]) => ({
        rate: Number(rate),
        amount: amt,
        igst: amt,
        cgst: amt / 2,
        sgst: amt / 2,
      }));
  }, [totals]);

  const itemCount = boq.sections.reduce(
    (s, sec) => s + (sec.items?.length || 0),
    0,
  );
  const [groupMode, setGroupMode] = useState("section");

  return (
    <div className="fixed inset-0 z-50 bg-slate-800/60 overflow-y-auto modal-no-print">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-white border-b border-bordergray shadow-sm">
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-select-blue" />
            <h2 className="text-[14px] font-bold text-textcolor">
              BOQ Preview
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-select-blue bg-select-blue/10 px-2 py-0.5 rounded border border-select-blue/20">
              {boq.id}
            </span>
            <span className="text-[10.5px] text-text-muted ml-2">
              {boq.sections.length} sections · {itemCount} items
            </span>
            <div className="flex items-center gap-0.5 bg-bg-soft border border-bordergray rounded-lg p-0.5 ml-2">
              {[
                { mode: "section", label: "Section" },
                { mode: "room", label: "Room" },
                { mode: "work", label: "Work" },
              ].map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setGroupMode(mode)}
                  title={`Group by ${label}`}
                  className={`px-2.5 py-1 rounded-md text-[10.5px] font-semibold transition-all ${
                    groupMode === mode
                      ? "bg-white text-textcolor shadow-sm"
                      : "text-text-muted hover:text-textcolor"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-bordergray rounded-lg text-[11.5px] font-semibold text-textcolor hover:bg-bg-soft"
              title="Save as PDF via print dialog"
            >
              <Download size={12} /> Save as PDF
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-linear-to-br from-select-blue to-primary text-white rounded-lg text-[11.5px] font-semibold shadow-md hover:scale-[1.02] transition-all"
            >
              <Printer size={12} /> Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
              title="Close preview"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Document */}
      <div className="py-8 px-4 flex justify-center">
        <div className="boq-print-area bg-white shadow-xl w-full max-w-[210mm] text-textcolor">
          <BOQDocument
            boq={boq}
            totals={totals}
            gstSplits={gstSplits}
            company={company}
            gst={gst}
            groupMode={groupMode}
          />
        </div>
      </div>
    </div>
  );
};

// ── Document body — print-friendly markup, A4-friendly layout. ─────────────
const BOQDocument = ({ boq, totals, gstSplits, company, gst, groupMode = "section" }) => {
  const approval = mergeApproval(boq.approval);
  const initials = (company.name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const displaySections = useMemo(() => {
    if (groupMode === "room") {
      const groups = [];
      const map = {};
      for (const sec of boq.sections) {
        for (const item of sec.items || []) {
          const key =
            item.hierarchy?.roomArea ||
            sec.category ||
            sec.name ||
            "Uncategorized";
          if (!map[key]) {
            map[key] = { id: `room_${key}`, name: key, items: [] };
            groups.push(map[key]);
          }
          map[key].items.push({ ...item, _from: sec.name });
        }
      }
      return groups;
    }
    if (groupMode === "work") {
      const groups = [];
      const map = {};
      for (const sec of boq.sections) {
        for (const item of sec.items || []) {
          const key =
            item.hierarchy?.workCategory ||
            sec.category ||
            item.description ||
            "Uncategorized";
          if (!map[key]) {
            map[key] = { id: `work_${key}`, name: key, items: [] };
            groups.push(map[key]);
          }
          map[key].items.push({ ...item, _from: sec.category || sec.name });
        }
      }
      return groups;
    }
    return boq.sections;
  }, [boq.sections, groupMode]);

  return (
    <div className="p-10 text-[11px] leading-relaxed">
      {/* ── Header band ─────────────────────────────────────────────────── */}
      <div className="border-b-2 border-select-blue pb-4 mb-5 flex items-start justify-between">
        <div className="flex items-start gap-3">
          {company.logoDataUrl ? (
            <img
              src={company.logoDataUrl}
              alt={company.name}
              className="h-12 w-12 rounded-md object-contain border border-bordergray"
            />
          ) : (
            <div className="h-12 w-12 rounded-md bg-select-blue text-white flex items-center justify-center font-bold text-[20px]">
              {initials || "—"}
            </div>
          )}
          <div>
            <h1 className="text-[18px] font-bold text-textcolor leading-tight">
              {company.name}
            </h1>
            <p className="text-[10px] text-text-muted">{company.tagline}</p>
            <p className="text-[10px] text-text-muted mt-1">
              {company.address} · {company.phone}
            </p>
            <p className="text-[10px] text-text-muted">
              {company.email}
              {company.gstin && ` · GSTIN: ${company.gstin}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            {boqTypeLabelOf(boq.boqType)}
          </p>
          <p className="text-[16px] font-bold text-select-blue tabular-nums mt-1">
            {boq.id}
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">
            Rev {boq.revision || 1} ·{" "}
            <span className="uppercase font-bold text-textcolor">
              {boq.status}
            </span>
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">
            Issued {formatDate(boq.updatedAt || boq.createdAt)}
          </p>
        </div>
      </div>

      {/* ── Title + client/project block ────────────────────────────────── */}
      <h2 className="text-[14px] font-bold text-textcolor mb-3">{boq.title}</h2>
      {compactJoin([
        boq.hierarchy?.blockTower || boq.hierarchy?.block || boq.hierarchy?.tower,
        boq.hierarchy?.floor,
        boq.hierarchy?.roomArea,
        boq.hierarchy?.workCategory,
        boq.hierarchy?.subCategory,
      ]) && (
        <p className="text-[10px] text-text-muted -mt-2 mb-3">
          Hierarchy:{" "}
          <span className="font-semibold text-textcolor">
            {compactJoin([
              boq.hierarchy?.blockTower || boq.hierarchy?.block || boq.hierarchy?.tower,
              boq.hierarchy?.floor,
              boq.hierarchy?.roomArea,
              boq.hierarchy?.workCategory,
              boq.hierarchy?.subCategory,
            ])}
          </span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6 print-avoid-break">
        <div className="border border-bordergray rounded p-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-2">
            Bill To
          </p>
          <p className="text-[12px] font-bold text-textcolor">
            {boq.client?.name || "—"}
          </p>
          {boq.client?.phone && (
            <p className="text-[10.5px] text-text-muted mt-0.5 flex items-center gap-1">
              <Phone size={9} /> {boq.client.phone}
            </p>
          )}
          {boq.client?.email && (
            <p className="text-[10.5px] text-text-muted mt-0.5 flex items-center gap-1">
              <Mail size={9} /> {boq.client.email}
            </p>
          )}
          {boq.client?.address && (
            <p className="text-[10.5px] text-text-muted mt-0.5 flex items-center gap-1">
              <MapPin size={9} /> {boq.client.address}
            </p>
          )}
          {boq.client?.gstin && (
            <p className="text-[10.5px] text-text-muted mt-1">
              GSTIN:{" "}
              <span className="font-semibold text-textcolor">
                {boq.client.gstin}
              </span>
            </p>
          )}
        </div>

        <div className="border border-bordergray rounded p-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-2">
            Project
          </p>
          <p className="text-[12px] font-bold text-textcolor">
            {boq.project?.name || boq.title || "—"}
          </p>
          {boq.project?.propertyType && (
            <p className="text-[10.5px] text-text-muted mt-0.5 flex items-center gap-1">
              <Building2 size={9} /> {boq.project.propertyType}
            </p>
          )}
          {boq.project?.address && (
            <p className="text-[10.5px] text-text-muted mt-0.5 flex items-center gap-1">
              <MapPin size={9} /> {boq.project.address}
            </p>
          )}
          {boq.project?.sizeRange && (
            <p className="text-[10.5px] text-text-muted mt-0.5">
              Size:{" "}
              <span className="font-semibold text-textcolor">
                {formatSizeRange(boq.project.sizeRange)}
              </span>
            </p>
          )}
          {boq.validity && (
            <p className="text-[10.5px] text-text-muted mt-1 flex items-center gap-1">
              <Calendar size={9} /> Validity: {boq.validity}
            </p>
          )}
          {boq.warrantyText && (
            <p className="text-[10.5px] text-text-muted mt-0.5 flex items-center gap-1">
              <ShieldCheck size={9} /> Warranty: {boq.warrantyText}
            </p>
          )}
        </div>
      </div>

      {/* ── Sections + line items ───────────────────────────────────────── */}
      {groupMode !== "section" && (
        <p className="text-[9px] text-text-muted italic mb-3">
          Items grouped {groupMode === "room" ? "by room / area" : "by work type"}
        </p>
      )}
      {displaySections.map((section, sIdx) => {
        const sectionTotal = (section.items || []).reduce(
          (s, it) => s + computeItemAmount(it).net,
          0,
        );
        return (
          <div key={section.id} className="mb-5 print-avoid-break">
            <div className="bg-select-blue/8 border-l-4 border-select-blue px-3 py-2 mb-1 flex items-center justify-between">
              <p className="text-[12px] font-bold text-textcolor">
                {String(sIdx + 1).padStart(2, "0")} · {section.name}
              </p>
              <p className="text-[11px] font-bold text-textcolor tabular-nums">
                {formatINR(sectionTotal)}
              </p>
            </div>

            {section.items.length === 0 ? (
              <p className="text-[10.5px] text-text-muted italic px-3 py-2">
                (No items)
              </p>
            ) : (
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="border-b-2 border-text-muted/40 text-[9px] font-bold uppercase tracking-wider text-text-muted">
                    <th className="px-1.5 py-1.5 text-left w-7">#</th>
                    <th className="px-1.5 py-1.5 text-left">Description</th>
                    <th className="px-1.5 py-1.5 text-left w-12">HSN</th>
                    <th className="px-1.5 py-1.5 text-right w-14">Qty</th>
                    <th className="px-1.5 py-1.5 text-left w-12">Unit</th>
                    <th className="px-1.5 py-1.5 text-right w-16">Rate</th>
                    <th className="px-1.5 py-1.5 text-right w-10">GST</th>
                    <th className="px-1.5 py-1.5 text-right w-20">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item, iIdx) => {
                    const r = computeItemAmount(item);
                    const qty = computeItemQty(item);
                    const rateAnalysis = computeRateAnalysis(
                      item.rateAnalysis,
                      item.unit,
                    );
                    const effectiveRate =
                      item.rateAnalysis?.enabled && item.rateAnalysis?.useFinalRate
                        ? rateAnalysis.roundedFinalRate
                        : Number(item.rate) || 0;
                    const hierarchyText = compactJoin([
                      item.hierarchy?.blockTower ||
                        item.hierarchy?.block ||
                        item.hierarchy?.tower,
                      item.hierarchy?.floor,
                      item.hierarchy?.roomArea,
                      item.hierarchy?.workCategory,
                      item.hierarchy?.subCategory,
                    ]);
                    const detailText = compactJoin([
                      item.details?.drawingRefNo &&
                        `Drawing ${item.details.drawingRefNo}`,
                      item.details?.drawingRevision &&
                        `Rev ${item.details.drawingRevision}`,
                      item.details?.specificationCode &&
                        `Spec ${item.details.specificationCode}`,
                      item.details?.brandMakeModel,
                      item.details?.finishColorGrade,
                    ]);
                    const scopeText = compactJoin([
                      item.details?.itemType,
                      item.details?.billingType,
                      item.details?.scopeType,
                      item.details?.executionBy &&
                        `By ${item.details.executionBy}`,
                    ]);
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-bordergray align-top"
                      >
                        <td className="px-1.5 py-1.5 tabular-nums text-text-muted">
                          {sIdx + 1}.{iIdx + 1}
                        </td>
                        <td className="px-1.5 py-1.5">
                          <p className="text-textcolor leading-snug">
                            {item.description || "—"}
                          </p>
                          {item.spec && (
                            <p className="text-[9px] text-text-subtle italic mt-0.5 leading-snug">
                              {item.spec}
                            </p>
                          )}
                          {hierarchyText && (
                            <p className="text-[8.5px] text-text-muted mt-0.5 leading-snug">
                              {hierarchyText}
                            </p>
                          )}
                          {detailText && (
                            <p className="text-[8.5px] text-text-muted mt-0.5 leading-snug">
                              {detailText}
                            </p>
                          )}
                          {scopeText && (
                            <p className="text-[8.5px] text-text-subtle mt-0.5 leading-snug">
                              {scopeText}
                            </p>
                          )}
                          {item.details?.remarks && (
                            <p className="text-[8.5px] text-text-subtle mt-0.5 leading-snug">
                              Remarks: {item.details.remarks}
                            </p>
                          )}
                          {(item.materials || []).length > 0 && (
                            <p className="text-[9px] text-text-muted mt-0.5 leading-snug">
                              {item.materials
                                .map(
                                  (m) =>
                                    `${m.name}${m.spec ? ` — ${m.spec}` : ""}`,
                                )
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                          {item.dimensions?.enabled && (
                            <p className="text-[9px] text-text-subtle mt-0.5 tabular-nums">
                              [
                              {[
                                item.dimensions.length,
                                item.dimensions.breadth,
                                item.dimensions.height,
                              ]
                                .filter((v) => Number(v) > 0)
                                .join(" × ")}
                              ]
                            </p>
                          )}
                          {(item.measurementRows || []).length > 0 && (
                            <p className="text-[8.5px] text-text-subtle mt-0.5">
                              Measurement rows: {item.measurementRows.length}
                            </p>
                          )}
                          {item.rateAnalysis?.enabled && (
                            <p className="text-[8.5px] text-text-subtle mt-0.5">
                              RA final rate: {formatINR(rateAnalysis.roundedFinalRate)}
                              {item.rateAnalysis?.useFinalRate && " used"}
                            </p>
                          )}
                          {(item.vendorComparisons || []).some((v) => v.selected) && (
                            <p className="text-[8.5px] text-text-subtle mt-0.5">
                              Vendor:{" "}
                              {(item.vendorComparisons || []).find((v) => v.selected)
                                ?.vendorName || "Selected"}
                            </p>
                          )}
                          {groupMode !== "section" && item._from && (
                            <p className="text-[8px] text-text-subtle italic mt-0.5">
                              {groupMode === "work"
                                ? `Room: ${item._from}`
                                : `Section: ${item._from}`}
                            </p>
                          )}
                        </td>
                        <td className="px-1.5 py-1.5 tabular-nums text-text-muted">
                          {item.hsn || "—"}
                        </td>
                        <td className="px-1.5 py-1.5 text-right tabular-nums">
                          {qty.toFixed(2).replace(/\.00$/, "")}
                        </td>
                        <td className="px-1.5 py-1.5 text-text-muted">
                          {unitLabelOf(item.unit)}
                        </td>
                        <td className="px-1.5 py-1.5 text-right tabular-nums">
                          {formatINR(effectiveRate)}
                        </td>
                        <td className="px-1.5 py-1.5 text-right tabular-nums text-text-muted">
                          {item.gstPercent || 0}%
                        </td>
                        <td className="px-1.5 py-1.5 text-right tabular-nums font-bold">
                          {formatINR(r.net)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {/* ── Totals summary ──────────────────────────────────────────────── */}
      <div className="flex justify-end mt-6 print-avoid-break">
        <div className="w-[280px] border border-bordergray">
          <Row label="Gross Subtotal" value={formatINR(totals.subtotal)} />
          {totals.lineDiscounts > 0 && (
            <Row
              label="Less: Line discounts"
              value={`- ${formatINR(totals.lineDiscounts)}`}
            />
          )}
          <Row label="Taxable Amount" value={formatINR(totals.taxable)} />
          {totals.boqDiscountAmt > 0 && (
            <Row
              label="Less: BOQ Discount"
              value={`- ${formatINR(totals.boqDiscountAmt)}`}
            />
          )}
          {totals.boqDiscountAmt > 0 && (
            <Row
              label="After Discount"
              value={formatINR(totals.afterBoqDiscount)}
            />
          )}
          {totals.contingencyAmt > 0 && (
            <Row
              label={`Add: Contingency (${totals.contingencyPercent}%)`}
              value={formatINR(totals.contingencyAmt)}
            />
          )}
          {totals.freightTransport > 0 && (
            <Row
              label="Freight / Transport"
              value={formatINR(totals.freightTransport)}
            />
          )}
          {totals.loadingUnloading > 0 && (
            <Row
              label="Loading / Unloading"
              value={formatINR(totals.loadingUnloading)}
            />
          )}
          {boq.commercial?.taxInclusive && (
            <Row label="Tax Mode" value="Tax inclusive" subtle />
          )}
          {gstSplits.map((g) =>
            gst.interState ? (
              <Row
                key={g.rate}
                label={`IGST @ ${g.rate}%`}
                value={formatINR(g.igst)}
                subtle
              />
            ) : (
              <div key={g.rate}>
                <Row
                  label={`CGST @ ${g.rate / 2}%`}
                  value={formatINR(g.cgst)}
                  subtle
                />
                <Row
                  label={`SGST @ ${g.rate / 2}%`}
                  value={formatINR(g.sgst)}
                  subtle
                />
              </div>
            ),
          )}
          {Number(totals.roundOff || 0) !== 0 && (
            <Row label="Round-off" value={formatINR(totals.roundOff)} />
          )}
          <Row label="GRAND TOTAL" value={formatINR(totals.grandTotal)} bold />
          {totals.retentionAmt > 0 && (
            <Row
              label={`Retention (${totals.retentionPercent}%)`}
              value={formatINR(totals.retentionAmt)}
              subtle
            />
          )}
          {totals.mobilizationAdvanceAmt > 0 && (
            <Row
              label="Mobilization Advance"
              value={formatINR(totals.mobilizationAdvanceAmt)}
              subtle
            />
          )}
          {totals.mobilizationAdvanceAmt > 0 && (
            <Row
              label="Net after advance"
              value={formatINR(totals.netPayableAfterAdvance)}
              subtle
            />
          )}
        </div>
      </div>

      {boq.commercial?.priceEscalationClause && (
        <p className="text-[9px] text-text-subtle mt-1.5 text-right print-avoid-break">
          Price escalation: {boq.commercial.priceEscalationClause}
        </p>
      )}

      {totals.totalGst > 0 && (
        <p className="text-[9px] text-text-subtle mt-1.5 text-right print-avoid-break">
          {gst.interState ? "Inter-state supply — IGST applies" : "Intra-state supply — CGST + SGST apply"}
          {gst.assumed && " (client state not on file — assumed intra-state)"}
        </p>
      )}

      <p className="text-[10px] text-text-muted mt-2 mb-6">
        <span className="font-bold text-textcolor">Amount in words:</span>{" "}
        {inrToWords(totals.grandTotal)}
      </p>

      {/* ── Payment milestones (standard 5-stage schedule) ──────────────── */}
      {(boq.paymentTerms || []).length > 0 && (
        <div className="mb-6 print-avoid-break">
          <p className="text-[11px] font-bold text-textcolor mb-2 border-b border-bordergray pb-1">
            Payment Schedule
          </p>
          <table className="w-full border-collapse text-[10.5px]">
            <thead>
              <tr className="text-[9px] font-bold uppercase tracking-wider text-text-muted border-b border-bordergray">
                <th className="px-2 py-1.5 text-left w-10">Stage</th>
                <th className="px-2 py-1.5 text-left">Milestone</th>
                <th className="px-2 py-1.5 text-right w-16">%</th>
                <th className="px-2 py-1.5 text-right w-28">Amount</th>
              </tr>
            </thead>
            <tbody>
              {boq.paymentTerms.map((m, idx) => {
                const amt =
                  (totals.grandTotal * (Number(m.percent) || 0)) / 100;
                return (
                  <tr key={idx} className="border-b border-bordergray">
                    <td className="px-2 py-1.5 tabular-nums text-text-muted">
                      {m.id ? `S${m.id}` : `${idx + 1}`}
                    </td>
                    <td className="px-2 py-1.5">{m.label || "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {m.percent || 0}%
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-semibold">
                      {formatINR(amt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Bank details ─────────────────────────────────────────────────── */}
      {(company.bankName || company.bankAccount || company.upi) && (
        <div className="mb-6 print-avoid-break border border-bordergray rounded p-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted mb-1.5">
            Payment To
          </p>
          <div className="grid grid-cols-2 gap-1 text-[10.5px] text-text-muted">
            {company.bankName && (
              <span>
                Bank: <span className="text-textcolor font-semibold">{company.bankName}</span>
              </span>
            )}
            {company.bankAccount && (
              <span>
                A/C: <span className="text-textcolor font-semibold tabular-nums">{company.bankAccount}</span>
              </span>
            )}
            {company.bankIfsc && (
              <span>
                IFSC: <span className="text-textcolor font-semibold tabular-nums">{company.bankIfsc}</span>
              </span>
            )}
            {company.bankBranch && (
              <span>
                Branch: <span className="text-textcolor font-semibold">{company.bankBranch}</span>
              </span>
            )}
            {company.upi && (
              <span>
                UPI: <span className="text-textcolor font-semibold">{company.upi}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Inclusions / Exclusions ─────────────────────────────────────── */}
      {((boq.inclusions || []).filter(Boolean).length > 0 ||
        (boq.exclusions || []).filter(Boolean).length > 0) && (
        <div className="mb-6 print-avoid-break grid grid-cols-2 gap-4">
          {(boq.inclusions || []).filter(Boolean).length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-textcolor mb-1 border-b-2 border-emerald-500 pb-1">
                Included
              </p>
              <ul className="text-[10.5px] text-text-muted space-y-0.5 mt-1.5 leading-snug">
                {(boq.inclusions || []).filter(Boolean).map((it, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="inline-flex shrink-0 h-3.5 w-3.5 rounded-full bg-emerald-100 text-emerald-700 items-center justify-center mt-0.5">
                      <Check size={8} strokeWidth={3} />
                    </span>
                    <span className="flex-1 text-textcolor">{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(boq.exclusions || []).filter(Boolean).length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-textcolor mb-1 border-b-2 border-red-500 pb-1">
                Not Included
              </p>
              <ul className="text-[10.5px] text-text-muted space-y-0.5 mt-1.5 leading-snug">
                {(boq.exclusions || []).filter(Boolean).map((it, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="inline-flex shrink-0 h-3.5 w-3.5 rounded-full bg-red-100 text-red-600 items-center justify-center mt-0.5">
                      <X size={8} strokeWidth={3} />
                    </span>
                    <span className="flex-1 text-textcolor">{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Notes / Terms ───────────────────────────────────────────────── */}
      {boq.notes && (
        <div className="mb-6 print-avoid-break">
          <p className="text-[11px] font-bold text-textcolor mb-1 border-b border-bordergray pb-1">
            Notes &amp; Terms
          </p>
          <p className="text-[10.5px] text-text-muted whitespace-pre-line leading-relaxed">
            {boq.notes}
          </p>
        </div>
      )}

      <div className="mb-6 print-avoid-break">
        <p className="text-[11px] font-bold text-textcolor mb-1 border-b border-bordergray pb-1">
          Standard Terms
        </p>
        <ul className="text-[10px] text-text-muted space-y-0.5 list-disc list-inside leading-snug">
          <li>Quotation valid for {boq.validity || "30 days from issue"}.</li>
          <li>
            All rates are inclusive of material, labour, and installation unless
            otherwise specified.
          </li>
          <li>GST as applicable, payable by the client at prevailing rates.</li>
          <li>
            Variations / change orders will be billed separately as per agreed
            rates.
          </li>
          <li>
            Civil work, electrical rough-in, and plumbing are excluded unless
            explicitly listed.
          </li>
          <li>
            Project timelines commence on receipt of advance and approved
            drawings.
          </li>
        </ul>
      </div>

      {/* ── Signatures ──────────────────────────────────────────────────── */}
      <div className="mt-10 pt-6 print-avoid-break">
        <p className="text-[11px] font-bold text-textcolor mb-3 border-b border-bordergray pb-1">
          Approval &amp; Acceptance
        </p>
        <div className="grid grid-cols-4 gap-4">
          <SignatureBox
            title="Prepared by"
            name={approval.preparedBy}
            date={approval.preparedAt}
          />
          <SignatureBox
            title="Reviewed by"
            name={approval.reviewedBy}
            date={approval.reviewedAt}
          />
          <SignatureBox
            title="Approved by"
            name={approval.approvedBy || "Authorized Signatory"}
            date={approval.approvedAt}
          />
          <SignatureBox
            title="Client acceptance"
            name={approval.clientAcceptedBy || boq.client?.name}
            date={approval.clientAcceptedAt}
          />
        </div>
        {approval.remarks && (
          <p className="mt-3 rounded border border-bordergray bg-bg-soft/50 px-3 py-2 text-[9.5px] text-text-muted">
            <span className="font-bold text-textcolor">Approval remarks:</span>{" "}
            {approval.remarks}
          </p>
        )}
        {(boq.auditTrail || []).length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
              Workflow History
            </p>
            <table className="w-full border-collapse text-[9.5px]">
              <tbody>
                {(boq.auditTrail || []).map((entry) => (
                  <tr key={entry.id} className="border-b border-bordergray">
                    <td className="py-1 pr-2 font-bold text-textcolor">
                      {entry.label}
                    </td>
                    <td className="py-1 px-2 text-text-muted">
                      {entry.actor}
                    </td>
                    <td className="py-1 px-2 text-text-muted">
                      Rev {entry.revision} · {entry.status}
                    </td>
                    <td className="py-1 pl-2 text-right text-text-muted">
                      {formatDate(entry.at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="mt-8 pt-3 border-t border-bordergray text-center">
        <p className="text-[9px] text-text-subtle">
          {company.name} · {company.email} · {company.phone}
        </p>
        <p className="text-[9px] text-text-subtle mt-0.5">
          This is a computer-generated document. {boq.id} · Rev{" "}
          {boq.revision || 1}
        </p>
      </div>
    </div>
  );
};

const SignatureBox = ({ title, name, date }) => (
  <div>
    <p className="text-[10px] text-text-muted mb-10">{title}</p>
    <div className="border-t border-textcolor pt-1">
      <p className="text-[10px] font-bold text-textcolor">
        {name || "___________________"}
      </p>
      <p className="text-[9px] text-text-muted">
        Date: {date ? formatDate(date) : "________________"}
      </p>
    </div>
  </div>
);

const Row = ({ label, value, bold, subtle }) => (
  <div
    className={`flex items-center justify-between px-3 py-1.5 border-b border-bordergray last:border-b-0 ${
      bold
        ? "bg-select-blue text-white"
        : subtle
          ? "text-text-muted"
          : "text-textcolor"
    }`}
  >
    <span
      className={`text-[10.5px] ${bold ? "font-bold uppercase tracking-wider" : "font-semibold"}`}
    >
      {label}
    </span>
    <span className={`text-[11.5px] tabular-nums ${bold ? "font-bold" : ""}`}>
      {value}
    </span>
  </div>
);

// ── Measurement Sheet ────────────────────────────────────────────────────────

const fmtDim = (v) => (Number(v) > 0 ? Number(v).toFixed(2) : "—");
const fmtQty = (v) => Number(v).toFixed(2);
const measurementNetQty = (row, unit) => {
  const explicitQty = Number(row.netQuantity ?? row.qty) || 0;
  if (explicitQty > 0) return explicitQty;
  const nos = Number(row.nos) || 1;
  const L = Number(row.length) || 0;
  const B = Number(row.breadth ?? row.width) || 0;
  const H = Number(row.height) || 0;
  const deduction = Number(row.deduction) || 0;
  let qty = 0;
  if (DIMENSIONAL_UNITS[unit]?.kind === "length") {
    qty = L;
  } else {
    const factors = [L, B, H].filter((value) => value > 0);
    qty = factors.length > 0 ? factors.reduce((p, value) => p * value, 1) : 0;
  }
  return Math.max(0, qty * nos - deduction);
};

const MeasurementDocument = ({ boq, company }) => {
  const initials = (company.name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  // Group sections by room (section.category), preserving order of first appearance
  const roomGroups = useMemo(() => {
    const groups = [];
    const map = {};
    for (const sec of boq.sections || []) {
      const key = sec.category || sec.name || "General";
      if (!map[key]) {
        map[key] = { label: key, sections: [] };
        groups.push(map[key]);
      }
      map[key].sections.push(sec);
    }
    return groups;
  }, [boq.sections]);

  // Per-room stats for summary
  const roomStats = roomGroups.map(({ sections }) => {
    let sqftTotal = 0;
    let measuredCount = 0;
    let total = 0;
    for (const sec of sections) {
      for (const item of sec.items || []) {
        total++;
        const info = DIMENSIONAL_UNITS[item.unit];
        if ((item.measurementRows || []).length > 0 || (item.dimensions?.enabled && info)) {
          measuredCount++;
          if (info?.kind === "area") sqftTotal += computeItemQty(item);
        }
      }
    }
    return { total, measuredCount, sqftTotal };
  });

  const grandSqft = roomStats.reduce((s, r) => s + r.sqftTotal, 0);
  const grandItems = roomStats.reduce((s, r) => s + r.total, 0);
  const grandMeasured = roomStats.reduce((s, r) => s + r.measuredCount, 0);

  return (
    <div className="p-10 text-[11px] leading-relaxed">
      {/* Header */}
      <div className="border-b-2 border-select-blue pb-4 mb-5 flex items-start justify-between">
        <div className="flex items-start gap-3">
          {company.logoDataUrl ? (
            <img
              src={company.logoDataUrl}
              alt={company.name}
              className="h-12 w-12 rounded-md object-contain border border-bordergray"
            />
          ) : (
            <div className="h-12 w-12 rounded-md bg-select-blue text-white flex items-center justify-center font-bold text-[20px]">
              {initials || "—"}
            </div>
          )}
          <div>
            <h1 className="text-[18px] font-bold text-textcolor leading-tight">{company.name}</h1>
            <p className="text-[10px] text-text-muted">{company.tagline}</p>
            <p className="text-[10px] text-text-muted mt-1">
              {company.address}
              {company.phone && ` · ${company.phone}`}
            </p>
            <p className="text-[10px] text-text-muted">
              {company.email}
              {company.gstin && ` · GSTIN: ${company.gstin}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Measurement Sheet
          </p>
          <p className="text-[16px] font-bold text-select-blue tabular-nums mt-1">{boq.id}</p>
          <p className="text-[10px] text-text-muted mt-0.5">
            Rev {boq.revision || 1} ·{" "}
            <span className="uppercase font-bold text-textcolor">{boq.status}</span>
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">
            {formatDate(boq.updatedAt || boq.createdAt)}
          </p>
        </div>
      </div>

      {/* Project line */}
      <h2 className="text-[14px] font-bold text-textcolor mb-1">{boq.title}</h2>
      <p className="text-[10.5px] text-text-muted mb-5">
        Client:{" "}
        <span className="font-semibold text-textcolor">{boq.client?.name || "—"}</span>
        {boq.project?.address && <> · {boq.project.address}</>}
      </p>

      {/* Per-room measurement tables */}
      {roomGroups.map(({ label, sections }, rIdx) => {
        const stat = roomStats[rIdx];
        // Running item counter within this room
        let itemCounter = 0;
        return (
          <div key={label} className="mb-8 print-avoid-break">
            {/* Room heading */}
            <div className="flex items-center justify-between bg-primary px-4 py-2.5 mb-0">
              <p className="text-[13px] font-bold text-white tracking-wide">
                {String(rIdx + 1).padStart(2, "0")}. {label}
              </p>
              <p className="text-[10px] text-white/70">
                {stat.total} item{stat.total !== 1 ? "s" : ""}
                {stat.sqftTotal > 0 && ` · ${fmtQty(stat.sqftTotal)} sqft`}
              </p>
            </div>

            {stat.total === 0 ? (
              <p className="text-[10.5px] text-text-muted italic px-3 py-2 border border-t-0 border-bordergray">
                (No items)
              </p>
            ) : (
              <table className="w-full border-collapse text-[9px] border border-t-0 border-bordergray">
                <thead>
                  <tr className="border-b border-bordergray bg-bg-soft text-[8px] font-bold uppercase tracking-wider text-text-muted">
                    <th className="px-1 py-1.5 text-left w-7">#</th>
                    <th className="px-1 py-1.5 text-left w-20">Location</th>
                    <th className="px-1 py-1.5 text-left">Scope / Description</th>
                    <th className="px-1 py-1.5 text-right w-10">Nos</th>
                    <th className="px-1 py-1.5 text-right w-10">L</th>
                    <th className="px-1 py-1.5 text-right w-10">B</th>
                    <th className="px-1 py-1.5 text-right w-10">H</th>
                    <th className="px-1 py-1.5 text-right w-12">Ded.</th>
                    <th className="px-1 py-1.5 text-right w-14">Net Qty</th>
                    <th className="px-1 py-1.5 text-left w-10">Unit</th>
                    <th className="px-1 py-1.5 text-left w-16">Ref</th>
                    <th className="px-1 py-1.5 text-left w-16">By / Check</th>
                    <th className="px-1 py-1.5 text-left w-16">Date / Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((sec) => (
                    <Fragment key={sec.id}>
                      {/* Section sub-header within the room */}
                      {sections.length > 1 && (
                        <tr className="bg-active-bg/60">
                          <td
                            colSpan={13}
                            className="px-2 py-1 text-[9.5px] font-semibold text-select-blue italic border-b border-bordergray"
                          >
                            {sec.name}
                          </td>
                        </tr>
                      )}
                      {(sec.items || []).map((item) => {
                        itemCounter++;
                        const info = DIMENSIONAL_UNITS[item.unit];
                        const hasDims = item.dimensions?.enabled && !!info;
                        const isLength = info?.kind === "length";
                        const d = item.dimensions;
                        const qty = computeItemQty(item);
                        const measurementRows = item.measurementRows || [];
                        if (measurementRows.length > 0) {
                          return (
                            <Fragment key={item.id}>
                              {measurementRows.map((row, rowIdx) => (
                                <tr
                                  key={row.id || `${item.id}_${rowIdx}`}
                                  className="border-b border-bordergray/60 align-top hover:bg-bg-soft/30"
                                >
                                  <td className="px-1 py-1.5 tabular-nums text-text-muted">
                                    {itemCounter}.{rowIdx + 1}
                                  </td>
                                  <td className="px-1 py-1.5 text-text-muted">
                                    {row.location ||
                                      item.hierarchy?.roomArea ||
                                      "—"}
                                  </td>
                                  <td className="px-1 py-1.5">
                                    <p className="text-textcolor leading-snug">
                                      {item.description || "—"}
                                    </p>
                                    {(row.description || item.spec) && (
                                      <p className="text-[8.5px] text-text-subtle mt-0.5 leading-snug">
                                        {row.description || item.spec}
                                      </p>
                                    )}
                                  </td>
                                  <td className="px-1 py-1.5 text-right tabular-nums text-text-muted">
                                    {Number(row.nos || 0) > 0 ? row.nos : "—"}
                                  </td>
                                  <td className="px-1 py-1.5 text-right tabular-nums text-text-muted">
                                    {fmtDim(row.length)}
                                  </td>
                                  <td className="px-1 py-1.5 text-right tabular-nums text-text-muted">
                                    {fmtDim(row.breadth ?? row.width)}
                                  </td>
                                  <td className="px-1 py-1.5 text-right tabular-nums text-text-muted">
                                    {fmtDim(row.height)}
                                  </td>
                                  <td className="px-1 py-1.5 text-right tabular-nums text-text-muted">
                                    {Number(row.deduction || 0) > 0
                                      ? fmtQty(row.deduction)
                                      : "—"}
                                  </td>
                                  <td className="px-1 py-1.5 text-right tabular-nums font-semibold text-textcolor">
                                    {fmtQty(measurementNetQty(row, item.unit))}
                                  </td>
                                  <td className="px-1 py-1.5 text-text-muted">
                                    {unitLabelOf(row.unit || item.unit)}
                                  </td>
                                  <td className="px-1 py-1.5 text-text-muted">
                                    {row.drawingPhotoRef || "—"}
                                  </td>
                                  <td className="px-1 py-1.5 text-text-muted">
                                    {compactJoin([row.measuredBy, row.checkedBy]) ||
                                      "—"}
                                  </td>
                                  <td className="px-1 py-1.5 text-text-muted">
                                    {compactJoin([
                                      row.measurementDate &&
                                        formatDate(row.measurementDate),
                                      row.remarks,
                                    ]) || "—"}
                                  </td>
                                </tr>
                              ))}
                            </Fragment>
                          );
                        }
                        return (
                          <tr
                            key={item.id}
                            className="border-b border-bordergray/60 align-top hover:bg-bg-soft/30"
                          >
                            <td className="px-2 py-1.5 tabular-nums text-text-muted">
                              {itemCounter}
                            </td>
                            <td className="px-1 py-1.5 text-text-muted">
                              {item.hierarchy?.roomArea || label || "—"}
                            </td>
                            <td className="px-2 py-1.5">
                              <p className="text-textcolor leading-snug">{item.description || "—"}</p>
                              {item.spec && (
                                <p className="text-[9px] text-text-subtle italic mt-0.5 leading-snug">
                                  {item.spec}
                                </p>
                              )}
                            </td>
                            <td className="px-1 py-1.5 text-right tabular-nums text-text-muted">
                              —
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-text-muted">
                              {hasDims ? fmtDim(d.length) : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-text-muted">
                              {hasDims && !isLength ? fmtDim(d.breadth ?? d.width) : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-text-muted">
                              {hasDims && !isLength ? fmtDim(d.height) : "—"}
                            </td>
                            <td className="px-1 py-1.5 text-right tabular-nums text-text-muted">
                              —
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-textcolor">
                              {fmtQty(qty)}
                            </td>
                            <td className="px-2 py-1.5 text-text-muted">
                              {unitLabelOf(item.unit)}
                            </td>
                            <td className="px-1 py-1.5 text-text-muted">
                              {item.details?.drawingRefNo || "—"}
                            </td>
                            <td className="px-1 py-1.5 text-text-muted">—</td>
                            <td className="px-1 py-1.5 text-text-muted">
                              {item.details?.remarks || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {/* Summary */}
      <div className="mt-6 print-avoid-break">
        <p className="text-[11px] font-bold text-textcolor mb-2 border-b border-bordergray pb-1">
          Measurement Summary
        </p>
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b-2 border-text-muted/40 text-[9px] font-bold uppercase tracking-wider text-text-muted">
              <th className="px-1.5 py-1.5 text-left">Room / Area</th>
              <th className="px-1.5 py-1.5 text-right w-16">Items</th>
              <th className="px-1.5 py-1.5 text-right w-20">Measured</th>
              <th className="px-1.5 py-1.5 text-right w-24">Area (sqft)</th>
            </tr>
          </thead>
          <tbody>
            {roomGroups.map(({ label }, rIdx) => {
              const s = roomStats[rIdx];
              return (
                <tr key={label} className="border-b border-bordergray">
                  <td className="px-1.5 py-1.5 font-semibold">{label}</td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums">{s.total}</td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums">{s.measuredCount}</td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums">
                    {s.sqftTotal > 0 ? fmtQty(s.sqftTotal) : "—"}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-textcolor font-bold">
              <td className="px-1.5 py-1.5">Total</td>
              <td className="px-1.5 py-1.5 text-right tabular-nums">{grandItems}</td>
              <td className="px-1.5 py-1.5 text-right tabular-nums">{grandMeasured}</td>
              <td className="px-1.5 py-1.5 text-right tabular-nums">
                {grandSqft > 0 ? fmtQty(grandSqft) : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-10 pt-4 border-t border-bordergray text-center text-[9px] text-text-subtle print-avoid-break">
        <p>
          For internal reference and quantity verification only. Rates and commercial
          totals are in the accompanying Bill of Quantities.
        </p>
        <p className="mt-1">
          {company.name} · Generated {formatDate(new Date().toISOString())}
        </p>
      </div>
    </div>
  );
};

export const MeasurementSheetPreview = ({ boq, onClose }) => {
  const company = useMemo(() => resolveCompany(boq), [boq]);
  const itemCount = (boq.sections || []).reduce(
    (s, sec) => s + (sec.items?.length || 0),
    0,
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-800/60 overflow-y-auto modal-no-print">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-white border-b border-bordergray shadow-sm">
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ruler size={16} className="text-select-blue" />
            <h2 className="text-[14px] font-bold text-textcolor">Measurement Sheet</h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-select-blue bg-select-blue/10 px-2 py-0.5 rounded border border-select-blue/20">
              {boq.id}
            </span>
            <span className="text-[10.5px] text-text-muted ml-2">
              {boq.sections?.length || 0} sections · {itemCount} items
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-bordergray rounded-lg text-[11.5px] font-semibold text-textcolor hover:bg-bg-soft"
              title="Save as PDF via print dialog"
            >
              <Download size={12} /> Save as PDF
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-linear-to-br from-select-blue to-primary text-white rounded-lg text-[11.5px] font-semibold shadow-md hover:scale-[1.02] transition-all"
            >
              <Printer size={12} /> Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Document */}
      <div className="py-8 px-4 flex justify-center">
        <div className="boq-print-area bg-white shadow-xl w-full max-w-[210mm] text-textcolor">
          <MeasurementDocument boq={boq} company={company} />
        </div>
      </div>
    </div>
  );
};

const buildMaterialDetailRows = (boq) => {
  const rows = [];
  for (const section of boq?.sections || []) {
    for (const item of section.items || []) {
      for (const mat of item.materials || []) {
        if (!mat.name && !mat.spec) continue;
        const takeoff = computeMaterialTakeoff(item, mat);
        rows.push({
          room: section.category || section.name || "General",
          section: section.name || "",
          item: item.description || "Untitled item",
          name: mat.name || "",
          spec: mat.spec || "",
          itemQty: takeoff.itemQty,
          itemUnit: item.unit || "",
          perUnitQty: takeoff.perUnitQty,
          wastagePct: takeoff.wastagePct,
          qty: takeoff.takeoffQty,
          unit: takeoff.unit,
          rate: takeoff.rate,
          amount: takeoff.amount,
          hsn: item.hsn || "",
          gstPercent: item.gstPercent ?? "",
        });
      }
    }
  }
  return rows;
};

const MaterialDocument = ({ boq, company }) => {
  const initials = (company.name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const takeoff = useMemo(
    () =>
      buildTakeoffFromBoq(boq).filter(
        (row) => row.name || row.spec || Number(row.estimatedQty) > 0,
      ),
    [boq],
  );
  const detailRows = useMemo(() => buildMaterialDetailRows(boq), [boq]);
  const totalReferences = detailRows.length;
  const totalMaterialValue = takeoff.reduce(
    (sum, row) => sum + (Number(row.estimatedAmount) || 0),
    0,
  );

  return (
    <div className="p-10 text-[11px] leading-relaxed">
      <div className="border-b-2 border-select-blue pb-4 mb-5 flex items-start justify-between">
        <div className="flex items-start gap-3">
          {company.logoDataUrl ? (
            <img
              src={company.logoDataUrl}
              alt={company.name}
              className="h-12 w-12 rounded-md object-contain border border-bordergray"
            />
          ) : (
            <div className="h-12 w-12 rounded-md bg-select-blue text-white flex items-center justify-center font-bold text-[20px]">
              {initials || "-"}
            </div>
          )}
          <div>
            <h1 className="text-[18px] font-bold text-textcolor leading-tight">{company.name}</h1>
            <p className="text-[10px] text-text-muted">{company.tagline}</p>
            <p className="text-[10px] text-text-muted mt-1">
              {company.address}
              {company.phone && ` - ${company.phone}`}
            </p>
            <p className="text-[10px] text-text-muted">
              {company.email}
              {company.gstin && ` - GSTIN: ${company.gstin}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Material Sheet
          </p>
          <p className="text-[16px] font-bold text-select-blue tabular-nums mt-1">{boq.id}</p>
          <p className="text-[10px] text-text-muted mt-0.5">
            Rev {boq.revision || 1} -{" "}
            <span className="uppercase font-bold text-textcolor">{boq.status}</span>
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">
            {formatDate(boq.updatedAt || boq.createdAt)}
          </p>
        </div>
      </div>

      <h2 className="text-[14px] font-bold text-textcolor mb-1">{boq.title}</h2>
      <p className="text-[10.5px] text-text-muted mb-5">
        Client:{" "}
        <span className="font-semibold text-textcolor">{boq.client?.name || "-"}</span>
        {boq.project?.address && <> - {boq.project.address}</>}
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6 print-avoid-break">
        <div className="border border-bordergray rounded-md px-3 py-2">
          <p className="text-[9px] uppercase tracking-wider text-text-muted font-bold">
            Unique Materials
          </p>
          <p className="text-[16px] font-bold text-textcolor tabular-nums">{takeoff.length}</p>
        </div>
        <div className="border border-bordergray rounded-md px-3 py-2">
          <p className="text-[9px] uppercase tracking-wider text-text-muted font-bold">
            Material References
          </p>
          <p className="text-[16px] font-bold text-textcolor tabular-nums">{totalReferences}</p>
        </div>
        <div className="border border-bordergray rounded-md px-3 py-2">
          <p className="text-[9px] uppercase tracking-wider text-text-muted font-bold">
            Estimated Value
          </p>
          <p className="text-[16px] font-bold text-textcolor tabular-nums">
            {formatINR(totalMaterialValue)}
          </p>
        </div>
      </div>

      <div className="mb-8 print-avoid-break">
        <div className="flex items-center justify-between bg-primary px-4 py-2.5">
          <p className="text-[13px] font-bold text-white tracking-wide">
            Material Summary
          </p>
          <p className="text-[10px] text-white/70">
            Deduped by material, specification and unit
          </p>
        </div>
        {takeoff.length === 0 ? (
          <p className="text-[10.5px] text-text-muted italic px-3 py-3 border border-t-0 border-bordergray">
            No materials are attached to this BOQ yet.
          </p>
        ) : (
          <table className="w-full border-collapse text-[10px] border border-t-0 border-bordergray">
            <thead>
              <tr className="border-b border-bordergray bg-bg-soft text-[9px] font-bold uppercase tracking-wider text-text-muted">
                <th className="px-2 py-1.5 text-left w-8">#</th>
                <th className="px-2 py-1.5 text-left">Material</th>
                <th className="px-2 py-1.5 text-left">Specification</th>
                <th className="px-2 py-1.5 text-right w-20">Takeoff Qty</th>
                <th className="px-2 py-1.5 text-left w-14">Unit</th>
                <th className="px-2 py-1.5 text-right w-20">Rate</th>
                <th className="px-2 py-1.5 text-right w-20">Value</th>
                <th className="px-2 py-1.5 text-left">Used In</th>
              </tr>
            </thead>
            <tbody>
              {takeoff.map((row, idx) => (
                <tr key={`${row.name}-${row.spec}-${idx}`} className="border-b border-bordergray/60 align-top">
                  <td className="px-2 py-1.5 tabular-nums text-text-muted">{idx + 1}</td>
                  <td className="px-2 py-1.5 font-semibold text-textcolor">{row.name || "-"}</td>
                  <td className="px-2 py-1.5 text-text-muted">{row.spec || "-"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-textcolor">
                    {fmtQty(Number(row.estimatedQty) || 0)}
                  </td>
                  <td className="px-2 py-1.5 text-text-muted">{unitLabelOf(row.unit)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-text-muted">
                    {Number(row.rate) > 0 ? formatINR(row.rate) : "-"}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-textcolor">
                    {Number(row.estimatedAmount) > 0
                      ? formatINR(row.estimatedAmount)
                      : "-"}
                  </td>
                  <td className="px-2 py-1.5 text-text-muted">
                    {(row.usedIn || []).join(", ") || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detailRows.length > 0 && (
        <div className="print-avoid-break">
          <p className="text-[11px] font-bold text-textcolor mb-2 border-b border-bordergray pb-1">
            Source Line Details
          </p>
          <table className="w-full border-collapse text-[8.8px]">
            <thead>
              <tr className="border-b-2 border-text-muted/40 text-[8px] font-bold uppercase tracking-wider text-text-muted">
                <th className="px-1.5 py-1.5 text-left w-8">#</th>
                <th className="px-1.5 py-1.5 text-left">Room / Area</th>
                <th className="px-1.5 py-1.5 text-left">Scope of Work</th>
                <th className="px-1.5 py-1.5 text-left">Material</th>
                <th className="px-1.5 py-1.5 text-right w-14">BOQ Qty</th>
                <th className="px-1.5 py-1.5 text-right w-14">Per Unit</th>
                <th className="px-1.5 py-1.5 text-right w-12">Waste</th>
                <th className="px-1.5 py-1.5 text-right w-16">Takeoff</th>
                <th className="px-1.5 py-1.5 text-right w-16">Rate</th>
                <th className="px-1.5 py-1.5 text-right w-20">Value</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map((row, idx) => (
                <tr key={`${row.room}-${row.item}-${row.name}-${idx}`} className="border-b border-bordergray">
                  <td className="px-1.5 py-1.5 tabular-nums text-text-muted">{idx + 1}</td>
                  <td className="px-1.5 py-1.5 font-semibold">{row.room}</td>
                  <td className="px-1.5 py-1.5 text-textcolor">{row.item}</td>
                  <td className="px-1.5 py-1.5">
                    <p className="font-semibold text-textcolor">{row.name || "-"}</p>
                    {row.spec && <p className="text-[8.5px] text-text-subtle">{row.spec}</p>}
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums">
                    {fmtQty(row.itemQty)}
                    <span className="text-text-subtle"> {unitLabelOf(row.itemUnit)}</span>
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums">
                    {fmtQty(row.perUnitQty)}
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums">
                    {Number(row.wastagePct) > 0 ? `${fmtQty(row.wastagePct)}%` : "-"}
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums font-semibold text-textcolor">
                    {fmtQty(row.qty)}
                    <span className="text-text-subtle"> {unitLabelOf(row.unit)}</span>
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums">
                    {row.rate > 0 ? formatINR(row.rate) : "-"}
                  </td>
                  <td className="px-1.5 py-1.5 text-right tabular-nums">
                    {row.amount > 0 ? formatINR(row.amount) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-10 pt-4 border-t border-bordergray text-center text-[9px] text-text-subtle print-avoid-break">
        <p>
          For BOQ material review only. Procurement quantities, vendor rates and
          purchase commitments are finalized in the Procurement module.
        </p>
        <p className="mt-1">
          {company.name} - Generated {formatDate(new Date().toISOString())}
        </p>
      </div>
    </div>
  );
};

export const MaterialSheetPreview = ({ boq, onClose }) => {
  const company = useMemo(() => resolveCompany(boq), [boq]);
  const materialCount = useMemo(
    () => buildTakeoffFromBoq(boq).filter((row) => row.name || row.spec).length,
    [boq],
  );
  const referenceCount = useMemo(
    () => buildMaterialDetailRows(boq).length,
    [boq],
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-800/60 overflow-y-auto modal-no-print">
      <div className="sticky top-0 z-10 bg-white border-b border-bordergray shadow-sm">
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-select-blue" />
            <h2 className="text-[14px] font-bold text-textcolor">Material Sheet</h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-select-blue bg-select-blue/10 px-2 py-0.5 rounded border border-select-blue/20">
              {boq.id}
            </span>
            <span className="text-[10.5px] text-text-muted ml-2">
              {materialCount} materials - {referenceCount} references
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-bordergray rounded-lg text-[11.5px] font-semibold text-textcolor hover:bg-bg-soft"
              title="Save as PDF via print dialog"
            >
              <Download size={12} /> Save as PDF
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-linear-to-br from-select-blue to-primary text-white rounded-lg text-[11.5px] font-semibold shadow-md hover:scale-[1.02] transition-all"
            >
              <Printer size={12} /> Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="py-8 px-4 flex justify-center">
        <div className="boq-print-area bg-white shadow-xl w-full max-w-[210mm] text-textcolor">
          <MaterialDocument boq={boq} company={company} />
        </div>
      </div>
    </div>
  );
};

export default BOQPreview;
