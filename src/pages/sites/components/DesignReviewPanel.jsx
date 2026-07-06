import { useState } from "react";
import {
  FiCheckCircle,
  FiRotateCcw,
  FiClock,
  FiPlus,
  FiTrash2,
  FiCheck,
  FiX,
  FiUserCheck,
  FiClipboard,
  FiMessageSquare,
} from "react-icons/fi";
import {
  INTERNAL_ROLES,
  DESIGN_REVIEW_CHECKLIST,
  checklistComplete,
  openCommentsCount,
  canFinalizeInternal,
  internalApprove,
  internalRequestChanges,
  setChecklistItem,
  markAllChecklistYes,
  addDesignComment,
  setDesignCommentStatus,
  removeDesignComment,
} from "../../../data/designFlowStorage";

const SectionTitle = ({ children }) => (
  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-subtle">
    {children}
  </p>
);

const COMMENT_STATUS = {
  Open: "bg-rose-50 text-rose-600 border-rose-200",
  "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
  Closed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

// The internal sign-off chain: Intern → … → Principal Architect.
const ApprovalChain = ({ step, signoffs }) => (
  <div className="flex items-center gap-1 overflow-x-auto">
    {INTERNAL_ROLES.map((role, i) => {
      const done = i < step;
      const active = i === step;
      return (
        <div key={role} className="flex shrink-0 items-center gap-1">
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${
              done
                ? "border-emerald-200 bg-emerald-50"
                : active
                  ? "border-violet-300 bg-violet-50 ring-1 ring-violet-200"
                  : "border-bg-soft bg-palewhite/50"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                done
                  ? "bg-emerald-500 text-white"
                  : active
                    ? "bg-violet-600 text-white"
                    : "bg-slate-200 text-slate-500"
              }`}
            >
              {done ? <FiCheck size={11} /> : i + 1}
            </span>
            <span
              className={`whitespace-nowrap text-[11.5px] font-bold ${
                done
                  ? "text-emerald-700"
                  : active
                    ? "text-violet-700"
                    : "text-text-subtle"
              }`}
            >
              {role}
            </span>
          </div>
          {i < INTERNAL_ROLES.length - 1 && (
            <span
              className={`text-[12px] ${done ? "text-emerald-400" : "text-bordergray"}`}
            >
              →
            </span>
          )}
        </div>
      );
    })}
    {signoffs?.length > 0 && (
      <span className="ml-2 shrink-0 text-[11px] text-text-subtle">
        {signoffs.length} sign-off{signoffs.length > 1 ? "s" : ""}
      </span>
    )}
  </div>
);

const DesignReviewPanel = ({ siteID, stage, stageKey, onChange }) => {
  const internal = stage.internal || { step: 0, signoffs: [], checklist: [] };
  const checklist = Array.isArray(internal.checklist) ? internal.checklist : [];
  const comments = stage.comments || [];

  const isReview = stage.reviewState === "INTERNAL_REVIEW";
  const isDraft =
    stage.reviewState === "DRAFTING" ||
    stage.reviewState === "REVISION_REQUESTED";
  // Reviewers raise comments / tick the checklist while drafting or reviewing;
  // once it's with the client or approved, the record is read-only.
  const editable = isReview || isDraft;

  const step = internal.step || 0;
  const isFinalStep = step >= INTERNAL_ROLES.length - 1;
  const expectedRole = INTERNAL_ROLES[Math.min(step, INTERNAL_ROLES.length - 1)];

  const [decisionNote, setDecisionNote] = useState("");
  const [newComment, setNewComment] = useState({
    drawingRef: "",
    comment: "",
    raisedBy: expectedRole,
  });
  // Which comment is mid-close, plus the resolution note being typed.
  const [closing, setClosing] = useState({ id: null, note: "" });
  // "Confirm checklist & proceed" modal shown before an approve/authorise step.
  const [confirmProceed, setConfirmProceed] = useState(false);

  const done = checklistComplete(stage);
  const openCount = openCommentsCount(stage);
  const canFinalize = canFinalizeInternal(stage);
  const answered = checklist.filter((c) => c && c.value).length;
  // Readable breakdown for the confirmation modal.
  const yesItems = DESIGN_REVIEW_CHECKLIST.filter(
    (_, i) => checklist[i]?.value === "yes",
  );
  const noItems = DESIGN_REVIEW_CHECKLIST.filter(
    (_, i) => checklist[i]?.value === "no",
  );
  const pendingItems = DESIGN_REVIEW_CHECKLIST.filter(
    (_, i) => checklist[i]?.value !== "yes" && checklist[i]?.value !== "no",
  );
  // The final step (Principal) may only authorise once the stage is ready:
  // checklist complete and every comment closed.
  const canProceed = !isFinalStep || canFinalize;

  // The acting role is bound to whichever step is current — the sequence
  // (Intern → Principal) is enforced, so the log can't claim a role out of turn.
  const approve = () => {
    onChange(internalApprove(siteID, stageKey, { role: expectedRole, comment: decisionNote }));
    setDecisionNote("");
    setConfirmProceed(false);
  };
  const markAllYes = () => onChange(markAllChecklistYes(siteID, stageKey));
  const requestChanges = () => {
    if (!decisionNote.trim()) return;
    onChange(
      internalRequestChanges(siteID, stageKey, {
        role: expectedRole,
        comment: decisionNote,
      }),
    );
    setDecisionNote("");
  };

  const addComment = () => {
    if (!newComment.comment.trim()) return;
    onChange(addDesignComment(siteID, stageKey, newComment));
    setNewComment({ drawingRef: "", comment: "", raisedBy: expectedRole });
  };

  const confirmClose = () => {
    if (!closing.note.trim()) return;
    onChange(
      setDesignCommentStatus(siteID, stageKey, closing.id, "Closed", closing.note),
    );
    setClosing({ id: null, note: "" });
  };

  return (
    <div className="mt-6 space-y-5 border-t border-bg-soft pt-5">
      {/* ── Internal approval chain ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-violet-100 bg-violet-50/30 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FiUserCheck size={15} className="text-violet-600" />
            <SectionTitle>Internal design review</SectionTitle>
          </div>
          {!isReview && !isDraft && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-700">
              Internal approval complete
            </span>
          )}
        </div>

        <ApprovalChain step={step} signoffs={internal.signoffs} />

        {isReview && (
          <div className="mt-4 rounded-xl border border-bordergray bg-white p-3.5">
            {isFinalStep && !canFinalize && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
                <FiClock size={14} className="mt-0.5 shrink-0" />
                <span>
                  Principal Architect can authorise once the checklist is
                  complete ({answered}/{DESIGN_REVIEW_CHECKLIST.length}) and all
                  comments are closed ({openCount} open).
                </span>
              </div>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <div className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-subtle">
                  This step
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[12px] font-bold text-violet-700">
                  <FiUserCheck size={13} /> {expectedRole}
                </span>
              </div>
              <input
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder="Remarks (required to return)…"
                className="min-w-0 flex-1 rounded-lg border border-bordergray bg-white px-3 py-2 text-[12px] focus:outline-none focus:border-select-blue"
              />
              <button
                type="button"
                onClick={requestChanges}
                disabled={!decisionNote.trim()}
                className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-[12px] font-bold text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FiRotateCcw size={13} /> Return to team
              </button>
              <button
                type="button"
                onClick={() => setConfirmProceed(true)}
                disabled={!canProceed}
                className="flex items-center gap-1.5 rounded-lg bg-linear-to-br from-violet-600 to-violet-800 px-4 py-2 text-[12px] font-bold text-white shadow-sm hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                <FiCheckCircle size={13} />
                {isFinalStep ? "Authorise & send to client" : `Approve as ${expectedRole}`}
              </button>
            </div>
          </div>
        )}

        {/* Internal sign-off log */}
        {internal.signoffs?.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {internal.signoffs.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px]">
                {s.decision === "APPROVED" ? (
                  <FiCheckCircle size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                ) : (
                  <FiRotateCcw size={13} className="mt-0.5 shrink-0 text-rose-500" />
                )}
                <span className="text-grey">
                  <span className="font-semibold text-darkgray">{s.role}</span>{" "}
                  {s.decision === "APPROVED" ? "approved" : "returned to team"} · R
                  {s.round} · {s.at}
                  {s.comment ? ` — “${s.comment}”` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Design review checklist ──────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FiClipboard size={15} className="text-select-blue" />
            <SectionTitle>Design review checklist</SectionTitle>
          </div>
          <div className="flex items-center gap-2">
            {editable && (
              <button
                type="button"
                onClick={markAllYes}
                title="Set every checklist item to Yes"
                className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
              >
                <FiCheck size={11} /> Yes to all
              </button>
            )}
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                done
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {answered}/{DESIGN_REVIEW_CHECKLIST.length} answered
            </span>
          </div>
        </div>
        <div className="divide-y divide-bg-soft">
          {DESIGN_REVIEW_CHECKLIST.map((label, i) => {
            const row = checklist[i] || { value: null, comment: "" };
            return (
              <div key={i} className="flex flex-wrap items-center gap-3 py-2">
                <span className="min-w-0 flex-1 text-[12.5px] text-darkgray">
                  {label}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {["yes", "no"].map((v) => {
                    const sel = row.value === v;
                    const yes = v === "yes";
                    return (
                      <button
                        key={v}
                        type="button"
                        disabled={!editable}
                        onClick={() =>
                          onChange(setChecklistItem(siteID, stageKey, i, { value: v }))
                        }
                        className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors disabled:cursor-not-allowed ${
                          sel
                            ? yes
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border-rose-300 bg-rose-50 text-rose-600"
                            : "border-bordergray bg-white text-text-subtle hover:bg-bg-soft"
                        }`}
                      >
                        {yes ? <FiCheck size={11} /> : <FiX size={11} />}
                        {yes ? "Yes" : "No"}
                      </button>
                    );
                  })}
                </div>
                {row.value === "no" && (
                  <input
                    value={row.comment || ""}
                    disabled={!editable}
                    onChange={(e) =>
                      onChange(
                        setChecklistItem(siteID, stageKey, i, {
                          comment: e.target.value,
                        }),
                      )
                    }
                    placeholder="Note…"
                    className="w-full rounded-lg border border-rose-200 bg-rose-50/40 px-2.5 py-1 text-[11.5px] focus:outline-none sm:w-48"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Design comments register (DC-###) ────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FiMessageSquare size={15} className="text-select-blue" />
            <SectionTitle>Design comments register</SectionTitle>
          </div>
          {openCount > 0 && (
            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10.5px] font-bold text-rose-600">
              {openCount} open
            </span>
          )}
        </div>

        {comments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-bordergray py-5 text-center text-[12px] text-text-subtle">
            No comments raised.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-bg-soft">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-palewhite text-left text-[10.5px] uppercase tracking-wider text-text-subtle">
                  <th className="px-3 py-2 font-bold">No.</th>
                  <th className="px-3 py-2 font-bold">Drawing/Ref</th>
                  <th className="px-3 py-2 font-bold">Comment</th>
                  <th className="px-3 py-2 font-bold">Raised by</th>
                  <th className="px-3 py-2 font-bold">Status</th>
                  {editable && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody>
                {comments.map((c) => (
                  <tr key={c.id} className="border-t border-bg-soft align-top">
                    <td className="whitespace-nowrap px-3 py-2 font-bold text-darkgray">
                      {c.no}
                    </td>
                    <td className="px-3 py-2 text-grey">{c.drawingRef || "—"}</td>
                    <td className="px-3 py-2 text-darkgray">
                      {c.comment}
                      <span className="ml-1 block text-[10px] text-text-subtle">
                        {c.at}
                      </span>
                      {c.status === "Closed" && c.resolution && (
                        <span className="mt-1 block text-[10.5px] font-medium text-emerald-700">
                          ✓ Resolved: {c.resolution}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-grey">
                      {c.raisedBy || "—"}
                    </td>
                    <td className="px-3 py-2">
                      {!editable ? (
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${
                            COMMENT_STATUS[c.status] || COMMENT_STATUS.Open
                          }`}
                        >
                          {c.status}
                        </span>
                      ) : c.status === "Closed" ? (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700">
                            Closed
                          </span>
                          <button
                            type="button"
                            title="Reopen"
                            onClick={() =>
                              onChange(
                                setDesignCommentStatus(siteID, stageKey, c.id, "Open"),
                              )
                            }
                            className="rounded p-1 text-text-muted hover:bg-bg-soft hover:text-grey"
                          >
                            <FiRotateCcw size={12} />
                          </button>
                        </div>
                      ) : closing.id === c.id ? (
                        <div className="min-w-[180px] space-y-1.5">
                          <input
                            autoFocus
                            value={closing.note}
                            onChange={(e) =>
                              setClosing({ ...closing, note: e.target.value })
                            }
                            onKeyDown={(e) => e.key === "Enter" && confirmClose()}
                            placeholder="How was it resolved?"
                            className="w-full rounded-lg border border-emerald-200 bg-emerald-50/40 px-2 py-1 text-[11.5px] focus:outline-none"
                          />
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={confirmClose}
                              disabled={!closing.note.trim()}
                              className="flex-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Close
                            </button>
                            <button
                              type="button"
                              onClick={() => setClosing({ id: null, note: "" })}
                              className="rounded-lg border border-bordergray px-2 py-1 text-[11px] font-semibold text-grey hover:bg-bg-soft"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <select
                            value={c.status}
                            onChange={(e) =>
                              onChange(
                                setDesignCommentStatus(
                                  siteID,
                                  stageKey,
                                  c.id,
                                  e.target.value,
                                ),
                              )
                            }
                            className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold focus:outline-none ${
                              COMMENT_STATUS[c.status] || COMMENT_STATUS.Open
                            }`}
                          >
                            <option>Open</option>
                            <option>In Progress</option>
                          </select>
                          <button
                            type="button"
                            title="Close with resolution"
                            onClick={() => setClosing({ id: c.id, note: "" })}
                            className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 hover:bg-emerald-100"
                          >
                            Close…
                          </button>
                        </div>
                      )}
                    </td>
                    {editable && (
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            onChange(removeDesignComment(siteID, stageKey, c.id))
                          }
                          className="rounded p-1 text-text-muted hover:bg-red-50 hover:text-red-500"
                        >
                          <FiTrash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editable && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={newComment.drawingRef}
              onChange={(e) =>
                setNewComment({ ...newComment, drawingRef: e.target.value })
              }
              placeholder="Drawing / sheet ref"
              className="w-40 rounded-lg border border-bordergray bg-white px-3 py-1.5 text-[12px] focus:outline-none focus:border-select-blue"
            />
            <input
              value={newComment.comment}
              onChange={(e) =>
                setNewComment({ ...newComment, comment: e.target.value })
              }
              placeholder="Comment"
              className="min-w-0 flex-1 rounded-lg border border-bordergray bg-white px-3 py-1.5 text-[12px] focus:outline-none focus:border-select-blue"
            />
            <select
              value={newComment.raisedBy}
              onChange={(e) =>
                setNewComment({ ...newComment, raisedBy: e.target.value })
              }
              className="rounded-lg border border-bordergray bg-white px-2.5 py-1.5 text-[12px] font-medium text-textcolor focus:outline-none"
            >
              {INTERNAL_ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
              <option>Design Head</option>
              <option>Client</option>
            </select>
            <button
              type="button"
              onClick={addComment}
              disabled={!newComment.comment.trim()}
              className="flex items-center gap-1 rounded-lg bg-bg-soft px-3 py-1.5 text-[12px] font-semibold text-grey hover:bg-bordergray disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FiPlus size={13} /> Add
            </button>
          </div>
        )}
      </div>

      {/* ── Confirm checklist & proceed ──────────────────────────────────────
          Lists every item marked "Yes" in readable form, flags any No / pending,
          and confirms before advancing the review to the next step. */}
      {confirmProceed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmProceed(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <FiUserCheck size={18} className="text-violet-600" />
              <h3 className="text-[15px] font-bold text-darkgray">
                {isFinalStep
                  ? "Confirm checklist & send to client"
                  : `Confirm checklist & approve as ${expectedRole}`}
              </h3>
            </div>
            <p className="mb-3 text-[12.5px] leading-relaxed text-grey">
              These design-review items are marked{" "}
              <span className="font-bold text-emerald-700">Yes</span>. Review them
              before you proceed to the next step
              {isFinalStep ? " and release the stage to the client" : ""}.
            </p>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-bg-soft bg-palewhite/50 p-3">
              {yesItems.length === 0 ? (
                <p className="text-[12px] italic text-text-subtle">
                  No items are marked Yes yet.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {yesItems.map((label, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-[12.5px] text-darkgray"
                    >
                      <FiCheck
                        size={13}
                        className="mt-0.5 shrink-0 text-emerald-600"
                      />
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-[11.5px]">
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-700">
                {yesItems.length} Yes
              </span>
              {noItems.length > 0 && (
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 font-bold text-rose-600">
                  {noItems.length} No
                </span>
              )}
              {pendingItems.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-bold text-slate-500">
                  {pendingItems.length} unanswered
                </span>
              )}
              {openCount > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-bold text-amber-700">
                  {openCount} open comment{openCount > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {(noItems.length > 0 || pendingItems.length > 0) && (
              <p className="mt-2 flex items-start gap-1.5 text-[11.5px] text-amber-800">
                <FiClock size={13} className="mt-0.5 shrink-0" />
                {noItems.length > 0 &&
                  `${noItems.length} item${noItems.length > 1 ? "s are" : " is"} marked No`}
                {noItems.length > 0 && pendingItems.length > 0 && " and "}
                {pendingItems.length > 0 &&
                  `${pendingItems.length} still unanswered`}
                . Confirm this is acceptable before proceeding.
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmProceed(false)}
                className="rounded-lg border border-bordergray px-3.5 py-2 text-[12px] font-semibold text-grey hover:bg-bg-soft"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={approve}
                disabled={!canProceed}
                className="flex items-center gap-1.5 rounded-lg bg-linear-to-br from-violet-600 to-violet-800 px-4 py-2 text-[12px] font-bold text-white shadow-sm hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FiCheckCircle size={13} />
                {isFinalStep ? "Confirm & send to client" : "Confirm & proceed"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesignReviewPanel;
