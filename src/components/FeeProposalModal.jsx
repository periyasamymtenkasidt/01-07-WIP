import { useState } from "react";
import { FiX, FiSend } from "react-icons/fi";
import { ARCHITECTURE_PIPELINE } from "../data/designFlowStorage";

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const parseNum = (s) => Number(String(s ?? "").replace(/[^\d.]/g, "")) || 0;

const numInput =
  "w-full rounded-lg border border-bordergray bg-white px-3 py-2 text-[13px] text-textcolor focus:outline-none focus:border-select-blue focus:ring-2 focus:ring-select-blue/15";

// Architecture's proposal = a staged DESIGN FEE (not a package quote). Priced
// either by built-up area (₹/sqft) or as a % of estimated project cost, then
// split across the RIBA-style stages by their fee weights.
const FeeProposalModal = ({ recipient, lead, initial, onClose, onSent }) => {
  const [basis, setBasis] = useState(initial?.basis || "area");
  const [builtUpArea, setBuiltUpArea] = useState(
    initial?.builtUpArea ?? parseNum(lead?.plotArea),
  );
  const [feeRatePerSqft, setFeeRatePerSqft] = useState(
    initial?.feeRatePerSqft ?? 150,
  );
  const [projectCost, setProjectCost] = useState(initial?.projectCost ?? 0);
  const [feePercent, setFeePercent] = useState(initial?.feePercent ?? 8);

  const total =
    basis === "area"
      ? builtUpArea * feeRatePerSqft
      : (projectCost * feePercent) / 100;

  const stages = ARCHITECTURE_PIPELINE.map((s) => ({
    key: s.key,
    label: s.label,
    weight: s.feeWeight || 0,
    amount: (total * (s.feeWeight || 0)) / 100,
  }));

  const send = () =>
    onSent({
      total,
      fee: { basis, builtUpArea, feeRatePerSqft, projectCost, feePercent, total },
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-bordergray px-6 py-4">
          <div>
            <h3 className="text-[16px] font-bold text-darkgray">
              Design Fee Proposal
            </h3>
            <p className="mt-0.5 text-[12px] text-text-muted">
              {recipient?.name ? `For ${recipient.name} · ` : ""}
              {lead?.projectIntent || lead?.scope || "Architecture project"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted hover:bg-bg-soft"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {/* Preliminary visit context — informs the fee */}
          {lead?.prelimVisit?.done && (
            <div className="rounded-lg border border-bordergray bg-bg-soft px-3 py-2 text-[11px] text-text-muted">
              <span className="font-semibold text-grey">Site visit:</span>{" "}
              {[
                lead.prelimVisit.plotRead,
                lead.prelimVisit.approxFSI && `FSI ${lead.prelimVisit.approxFSI}`,
                lead.prelimVisit.condition,
              ]
                .filter(Boolean)
                .join(" · ") || "recorded"}
            </div>
          )}

          {/* Basis toggle */}
          <div className="flex gap-2">
            {[
              ["area", "By built-up area"],
              ["cost", "By project cost"],
            ].map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setBasis(val)}
                className={`flex-1 rounded-lg border px-3 py-2 text-[12px] font-bold transition-all ${
                  basis === val
                    ? "border-select-blue bg-select-blue/5 text-select-blue"
                    : "border-bordergray bg-white text-grey hover:bg-bg-soft"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {basis === "area" ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">
                  Built-up area (sqft)
                </span>
                <input
                  type="number"
                  value={builtUpArea}
                  onChange={(e) => setBuiltUpArea(Number(e.target.value) || 0)}
                  className={numInput}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">
                  Fee rate (₹/sqft)
                </span>
                <input
                  type="number"
                  value={feeRatePerSqft}
                  onChange={(e) => setFeeRatePerSqft(Number(e.target.value) || 0)}
                  className={numInput}
                />
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">
                  Est. project cost (₹)
                </span>
                <input
                  type="number"
                  value={projectCost}
                  onChange={(e) => setProjectCost(Number(e.target.value) || 0)}
                  className={numInput}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">
                  Fee (% of cost)
                </span>
                <input
                  type="number"
                  value={feePercent}
                  onChange={(e) => setFeePercent(Number(e.target.value) || 0)}
                  className={numInput}
                />
              </label>
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl bg-violet-50 px-4 py-3">
            <span className="text-[12px] font-bold uppercase tracking-wider text-violet-700/80">
              Total design fee
            </span>
            <span className="text-[18px] font-black tabular-nums text-violet-700">
              {inr(total)}
            </span>
          </div>

          {/* Staged breakdown */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-subtle">
              Billed by stage
            </p>
            <div className="overflow-hidden rounded-xl border border-bg-soft">
              {stages.map((s, i) => (
                <div
                  key={s.key}
                  className={`flex items-center justify-between px-4 py-2 text-[12.5px] ${
                    i ? "border-t border-bg-soft" : ""
                  }`}
                >
                  <span className="text-darkgray">
                    {s.label}{" "}
                    <span className="text-[10.5px] text-text-subtle">
                      · {s.weight}%
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums text-grey">
                    {inr(s.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-bordergray px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-[13px] font-semibold text-grey hover:bg-bg-soft"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={total <= 0}
            className="flex items-center gap-1.5 rounded-lg bg-linear-to-br from-violet-600 to-violet-800 px-5 py-2 text-[13px] font-bold text-white shadow-sm hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FiSend size={14} /> Send Fee Proposal
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeeProposalModal;
