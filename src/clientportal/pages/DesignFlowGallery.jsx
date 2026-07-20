import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Layers } from "lucide-react";
import { getFile } from "../../utils/fileStorage";
import { getPipeline, getDesignFlow } from "../../data/designFlowStorage";

// Client-facing gallery of design deliverables (images & files) — mapped to the
// NEW design flow. Instead of the old standalone `site.drawings` mock, it reads
// every stage's `deliverables` from the design flow, so what the firm submits
// per stage is exactly what the client sees here.
const stateBadge = (reviewState) => {
  switch (reviewState) {
    case "APPROVED":
      return { label: "Approved", cls: "bg-emerald-500 border-emerald-600 text-white" };
    case "AWAITING_CLIENT":
      return { label: "Awaiting You", cls: "bg-amber-500 border-amber-600 text-white" };
    case "REVISION_REQUESTED":
      return { label: "In Revision", cls: "bg-rose-500 border-rose-600 text-white" };
    case "LOCKED":
      return { label: "Locked", cls: "bg-slate-300 border-slate-400 text-white" };
    default:
      return { label: "In Progress", cls: "bg-slate-700 border-slate-800 text-white" };
  }
};

const DesignFlowGallery = ({ site }) => {
  const siteID = site?.siteID;
  const [flow, setFlow] = useState(() => (siteID ? getDesignFlow(siteID) : null));
  const [urls, setUrls] = useState({}); // fileId → object URL
  const [filter, setFilter] = useState("all"); // all | images | files | approved

  useEffect(() => {
    if (!siteID) return;
    const refresh = () => setFlow(getDesignFlow(siteID));
    const onStorage = (e) => {
      if (e.key === `designFlow_${siteID}`) refresh();
    };
    window.addEventListener("designFlowChanged", refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("designFlowChanged", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [siteID]);

  // Flatten every stage's deliverables, tagged with their stage + review state.
  const items = useMemo(() => {
    if (!flow) return [];
    const pipeline = getPipeline(flow.track);
    const label = (k) => pipeline.find((s) => s.key === k)?.label || k;
    const out = [];
    for (const st of flow.stages || []) {
      for (const d of st.deliverables || []) {
        out.push({
          ...d,
          stageKey: st.key,
          stageLabel: label(st.key),
          reviewState: st.reviewState,
          isImage: (d.mime || "").startsWith("image/"),
        });
      }
    }
    return out;
  }, [flow]);

  // Resolve uploaded files (deliverables carrying a fileId) to object URLs.
  // Inline SVG mockups carry `src` directly and need no lookup.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const d of items) {
        if (!d.fileId || urls[d.fileId]) continue;
        const file = await getFile(d.fileId);
        if (file && !cancelled) {
          const u = URL.createObjectURL(file);
          setUrls((prev) => (prev[d.fileId] ? prev : { ...prev, [d.fileId]: u }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const urlFor = (d) => d.src || (d.fileId ? urls[d.fileId] : null);

  const filtered = items.filter((d) => {
    if (filter === "images") return d.isImage;
    if (filter === "files") return !d.isImage;
    if (filter === "approved") return d.reviewState === "APPROVED";
    return true;
  });

  // Nothing to show until the design flow has produced deliverables.
  if (!flow || items.length === 0) return null;

  const TABS = [
    { id: "all", label: "All Files" },
    { id: "images", label: "Images" },
    { id: "files", label: "Documents" },
    { id: "approved", label: "Approved" },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-4">
      {/* Navigation categories */}
      <div className="flex justify-between items-center border-b border-gray-150 pb-2 shrink-0 flex-wrap gap-2">
        <div className="flex gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filter === t.id ? "bg-purple text-white" : "text-gray-500 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
          {filtered.length} deliverables visible
        </span>
      </div>

      {/* Deliverables grid */}
      <div className="w-full py-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
            <p className="text-xs font-bold text-slate-400">
              No deliverables found under this filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((d) => {
              const url = urlFor(d);
              const badge = stateBadge(d.reviewState);
              return (
                <div
                  key={`${d.stageKey}-${d.id}`}
                  className="border border-bordergray/60 rounded-[20px] overflow-hidden shadow-xs hover:shadow-md transition-all bg-white flex flex-col group text-left"
                >
                  {/* Preview */}
                  <div className="relative aspect-video overflow-hidden bg-slate-100 flex items-center justify-center">
                    {d.isImage && url ? (
                      <img
                        src={url}
                        alt={d.name}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                      />
                    ) : (
                      <FileText size={34} className="text-slate-300" />
                    )}
                    <div className="absolute top-2.5 left-2.5 flex gap-1.5">
                      <span className="px-2 py-0.5 text-[9px] uppercase font-extrabold bg-slate-950/80 text-white rounded-md tracking-wider">
                        {d.type || "File"}
                      </span>
                    </div>
                    <div className="absolute top-2.5 right-2.5">
                      <span className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded-md border ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="text-xs font-bold text-darkgray leading-tight break-words whitespace-normal">
                        {d.name}
                      </h4>
                      <p className="text-[10px] text-gray-400 font-semibold mt-1.5 flex items-center gap-1">
                        <Layers size={11} /> {d.stageLabel}
                      </p>
                    </div>
                    <div className="flex justify-end border-t border-slate-100 pt-3">
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          download={d.name}
                          className="text-[11px] font-bold text-purple hover:text-dark-blue flex items-center gap-1 transition-colors"
                        >
                          <Download size={12} /> View / Download
                        </a>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-300">
                          Preparing…
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DesignFlowGallery;
