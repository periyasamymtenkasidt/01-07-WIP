import { Fragment, useMemo } from "react";
import { formatAmount } from "../utils/formatAmount";
import { formatSizeRange } from "../utils/sizeRangeValidation";
import { GST_RATE, computeTotals } from "../data/QuotePresets";
import { assignCategoryNames, refreshScopeItemsFromMaster } from "../utils/scopeNaming";
import { getGlobalTerms, getTermsCategories } from "../data/termsStorage";
import wipLogo from "../assets/images/Logo.png";

const formatDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Pure presentational component — renders the quote in print-ready form.
// Wrap callers in <div className="quote-print-area">…</div> so the print
// stylesheet in index.css can target it.
const QuotePreview = ({ quote }) => {
  if (!quote) return null;

  const refreshedScopeItems = useMemo(() => {
    return refreshScopeItemsFromMaster(
      quote.scopeItems || [],
      quote.presetKey,
      quote.propertyType
    );
  }, [quote.scopeItems, quote.presetKey, quote.propertyType]);

  const { subtotal, gst, grandTotal } = computeTotals(refreshedScopeItems);
  const namedItems = assignCategoryNames(refreshedScopeItems);

  // Group named items by base category (item.area)
  const groupedPreviewItems = useMemo(() => {
    const groups = [];
    const byBaseCat = new Map();
    namedItems.forEach((item) => {
      const baseCat = item.area || "Unassigned";
      if (!byBaseCat.has(baseCat)) {
        const g = { baseCat, items: [] };
        byBaseCat.set(baseCat, g);
        groups.push(g);
      }
      byBaseCat.get(baseCat).items.push(item);
    });
    return groups;
  }, [namedItems]);

  return (
    <div className="bg-white text-text font-manrope text-[13px] leading-relaxed">
      {/* Branding Header — minimalist architectural */}
      <div className="flex justify-between items-end mb-12 pb-6 border-b border-black/15">
        {/* Logo — luxury stationery treatment */}
        <div className="flex flex-col items-start">
          <img
            src={wipLogo}
            alt="WIP"
            className="h-32 w-auto object-contain"
            style={{
              filter:
                "contrast(1.2) saturate(1.15) drop-shadow(0 1px 2px rgba(139, 105, 20, 0.12))",
            }}
          />
          <div className="flex items-center gap-2.5 mt-4">
            <div className="w-5 h-px bg-paleorange" />
            <p className="text-[9px] uppercase tracking-[0.5em] text-dark-yellow font-semibold leading-none">
              Architecture · Interiors
            </p>
            <div className="w-5 h-px bg-paleorange" />
          </div>
          <p className="text-[8px] uppercase tracking-[0.4em] text-gray-400 mt-2 leading-none ml-1">
            Chennai · Est. 2018
          </p>
        </div>

        {/* Document meta */}
        <div className="text-right leading-none">
          <h1 className="text-[22px] font-light tracking-[0.22em] uppercase text-black leading-none">
            Estimate
          </h1>
          <p className="text-[15px] font-bold tracking-[0.18em] text-black mt-4 pb-1.5 border-b border-paleorange inline-block">
            {quote.quoteId}
          </p>
        </div>
      </div>

      {/* Contact & Meta Info */}
      <div className="flex justify-between mb-12 text-[11px]">
        <div className="space-y-1">
          <p className="font-bold uppercase tracking-wider text-[13px] text-black">
            WIP Architecture
          </p>
          <p className="text-gray-600 leading-snug">
            303, Manickam Avenue, TTK road,
            <br />
            Alwarpet, Chennai-600018
          </p>
          <p className="text-gray-400 italic text-[10px]">
            GSTIN - 33AVZPV7602H1ZX
          </p>
          <div className="mt-8">
            <span className="text-[9px] uppercase text-gray-400 block mb-0.5 tracking-widest">
              BILL TO
            </span>
            <p className="font-semibold text-[14px] uppercase text-black">
              {quote.recipientName || "—"}
            </p>
            {quote.recipientEmail && (
              <p className="text-gray-600 text-[10px] normal-case">
                {quote.recipientEmail}
              </p>
            )}
            {quote.recipientPhone && (
              <p className="text-gray-600 text-[10px]">
                {quote.recipientPhone}
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-right self-end">
          <span className="text-gray-400 uppercase text-[9px] tracking-widest">
            Estimate Date :
          </span>
          <span className="font-medium text-black">
            {formatDate(quote.createdAt).toUpperCase()}
          </span>
          <span className="text-gray-400 uppercase text-[9px] tracking-widest">
            Validity :
          </span>
          <span className="font-medium text-black">
            {quote.validityDays || 30} Days
          </span>
          <span className="text-gray-400 uppercase text-[9px] tracking-widest">
            Project Type :
          </span>
          <span className="font-medium text-black">
            {quote.propertyType || "—"}
          </span>
          <span className="text-gray-400 uppercase text-[9px] tracking-widest">
            Size :
          </span>
          <span className="font-medium text-black">
            {formatSizeRange(quote.sizeRange)}
          </span>
        </div>
      </div>

      {/* Architectural Items Table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-black text-white uppercase text-[8px] tracking-[0.15em]">
            <th className="py-3 px-2 text-left w-8">#</th>
            <th className="py-3 px-2 text-left">OBJECTS</th>
            <th className="py-3 px-2 text-left">DESCRIPTION</th>
            <th className="py-3 px-2 text-center">RATE/SQ.FT.</th>
            <th className="py-3 px-2 text-center">QTY</th>
            <th className="py-3 px-2 text-right">AMOUNT (INR)</th>
          </tr>
        </thead>
        <tbody>
          {groupedPreviewItems.length > 0 ? (
            (() => {
              let globalIndex = 0;
              return groupedPreviewItems.map((group) => (
                <Fragment key={group.baseCat}>
                  {/* Base category section header */}
                  <tr className="bg-slate-50/50">
                    <td
                      colSpan={6}
                      className="py-2 px-2 font-bold uppercase tracking-wider text-[9px] text-gray-800 bg-paleorange/10 border-b border-black/10"
                    >
                      {group.baseCat}
                    </td>
                  </tr>
                  {/* Items in this group */}
                  {group.items.map((item, itemIdx) => {
                    globalIndex++;
                    const qty = Number(item.qty) || 1;
                    const amount = Number(item.amount) || 0;
                    const rate =
                      Number(item.rate) || (qty ? amount / qty : amount);
                    return (
                      <tr
                        key={`${globalIndex}`}
                        className="border-b border-black align-top"
                      >
                        <td className="py-4 px-2 font-bold">{globalIndex}</td>
                        <td className="py-4 px-2 font-bold uppercase text-[9px] leading-tight w-1/4">
                          {item._displayCategory || item.area || "—"}
                        </td>
                        <td className="py-4 px-2 text-[11px] leading-snug">
                          <p className="text-gray-700">
                            {item.description || "—"}
                          </p>
                          {item.materials?.length > 0 && (
                            <ul className="mt-2 space-y-1 pl-2 border-l border-paleorange/40">
                              {item.materials.map((m, mIdx) => (
                                <li
                                  key={mIdx}
                                  className="text-[10px] text-gray-500 leading-snug"
                                >
                                  <span className="font-semibold text-gray-700 uppercase tracking-wide text-[9px]">
                                    {m.name}
                                  </span>
                                  <span className="text-gray-400 mx-1">
                                    /
                                  </span>
                                  <span>{m.spec}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="py-4 px-2 text-center whitespace-nowrap">
                          {formatAmount(rate)}/{item.unit || "sqft"}
                        </td>
                        <td className="py-4 px-2 text-center whitespace-nowrap">
                          {qty.toFixed(1)} {item.unit || "sqft"}
                        </td>
                        <td className="py-4 px-2 text-right font-bold">
                          {formatAmount(amount)}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ));
            })()
          ) : (
            <tr className="border-b border-black">
              <td
                colSpan={6}
                className="py-10 text-center text-gray-300 italic uppercase tracking-widest"
              >
                No Items Added
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Summary */}
      <div className="mt-12 flex justify-end">
        <div className="w-64 space-y-2 border-t-2 border-black pt-4">
          <div className="flex justify-between text-gray-500 uppercase text-[9px] tracking-widest">
            <span>Sub Total</span>
            <span>{formatAmount(subtotal)}</span>
          </div>
          <div className="flex justify-between text-gray-500 uppercase text-[9px] tracking-widest">
            <span>GST ({GST_RATE}%)</span>
            <span>{formatAmount(gst)}</span>
          </div>
          <div className="flex justify-between font-bold text-[15px] pt-2 border-t border-black/20">
            <span>GRAND TOTAL</span>
            <span>{formatAmount(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Category-wise Terms & Conditions display */}
      {(() => {
        const categoriesList = getTermsCategories().map((c) => ({
          id: c.id,
          label: c.label,
        }));

        const categoriesToRender = categoriesList
          .map((cat) => {
            let incs = quote.categoryInclusions?.[cat.id] || [];
            let excs = quote.categoryExclusions?.[cat.id] || [];

            // Fallback if categoryInclusions/Exclusions are not present (legacy quotes)
            if (!quote.categoryInclusions && !quote.categoryExclusions) {
              try {
                const global = getGlobalTerms(cat.id);
                const catGlobalIntexts = (global.inclusions || []).map(
                  (t) => t.text,
                );
                const catGlobalExtexts = (global.exclusions || []).map(
                  (t) => t.text,
                );
                incs = (quote.inclusions || []).filter((text) =>
                  catGlobalIntexts.includes(text),
                );
                excs = (quote.exclusions || []).filter((text) =>
                  catGlobalExtexts.includes(text),
                );
              } catch (err) {
                // fallback
              }
            }
            return { ...cat, inclusions: incs, exclusions: excs };
          })
          .filter(
            (cat) => cat.inclusions.length > 0 || cat.exclusions.length > 0,
          );

        if (categoriesToRender.length === 0) return null;

        return (
          <div className="mt-8 space-y-6 break-inside-avoid">
            <div>
              <h2 className="text-[12px] font-extrabold tracking-widest text-black uppercase border-b-2 border-black pb-1.5 mb-4">
                TERMS & CONDITIONS
              </h2>
            </div>
            {categoriesToRender.map((cat) => (
              <div key={cat.id} className="break-inside-avoid">
                <h3 className="text-[10.5px] font-bold tracking-widest text-black uppercase border-b border-black/10 pb-1 mb-3">
                  {cat.label}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    {cat.inclusions.length > 0 && (
                      <>
                        <p className="text-[9.5px] tracking-wider text-emerald-700 font-bold mb-1.5 uppercase">
                          Included
                        </p>
                        <ul className="space-y-1 text-[11px] text-text-muted">
                          {cat.inclusions.map((line, i) => (
                            <li key={i} className="flex gap-2 items-start">
                              <span className="text-emerald-600 font-bold shrink-0">
                                ✓
                              </span>
                              <span>{line}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                  <div>
                    {cat.exclusions.length > 0 && (
                      <>
                        <p className="text-[9.5px] tracking-wider text-red-600 font-bold mb-1.5 uppercase">
                          Not Included
                        </p>
                        <ul className="space-y-1 text-[11px] text-text-muted">
                          {cat.exclusions.map((line, i) => (
                            <li key={i} className="flex gap-2 items-start">
                              <span className="text-red-500 font-bold shrink-0">
                                ✕
                              </span>
                              <span>{line}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Notes */}
      {quote.notes && (
        <div className="mt-6">
          <p className="text-[10px] uppercase tracking-widest text-text-subtle font-bold mb-2">
            Notes
          </p>
          <p className="text-[12px] text-text-muted whitespace-pre-line">
            {quote.notes}
          </p>
        </div>
      )}

      {/* Signature */}
      <div className="grid grid-cols-2 gap-6 mt-10 pt-6 border-t border-border">
        <div>
          <div className="border-b border-text-subtle h-10" />
          <p className="text-[10px] uppercase tracking-widest text-text-subtle font-bold mt-1.5">
            Authorized Signatory
          </p>
          <p className="text-[11px] text-text-muted">Digital Atelier</p>
        </div>
        <div>
          <div className="border-b border-text-subtle h-10" />
          <p className="text-[10px] uppercase tracking-widest text-text-subtle font-bold mt-1.5">
            Client Acceptance
          </p>
          <p className="text-[11px] text-text-muted">
            {quote.recipientName || "—"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default QuotePreview;
