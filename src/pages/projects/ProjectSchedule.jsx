import { useMemo, useState } from "react";
import {
  FiCalendar,
  FiUser,
  FiAlertTriangle,
  FiChevronUp,
  FiChevronDown,
  FiCheckCircle,
} from "react-icons/fi";
import Modal from "../../components/Modal";
import { appendActivity } from "../../data/LeadStatusConfig";
import { getScheduleConfig } from "../../data/scheduleConfig";
import {
  getOrSeedSchedule,
  saveSchedule,
  resolveAnchor,
  computeChain,
  getRoomHealth,
  deriveStatus,
  getProjectEnd,
  getPossessionDate,
  getBreachDays,
  RAG_CHIP,
  seedRoomsFromProposal,
  getRoomShiftPlan,
  getRoomShiftProgress,
  getProjectShiftSummary,
} from "../../data/scheduleStorage";
import { FiRefreshCw } from "react-icons/fi";

const fmt = (date) =>
  date
    ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    : "—";

const RAG_DOT = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  none: "bg-gray-300",
};

// ── Room update modal — scope is planned (from the proposal); only status,
// owner and notes are editable here. ─────────────────────────────────────────
const RoomModal = ({ room, started, onSave, onClose }) => {
  const [form, setForm] = useState(room);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // A room can only be marked done once its work has actually started:
  // the booking must be paid AND today must be on/after this room's start date.
  const roomStart =
    room.start instanceof Date
      ? room.start
      : room.start
        ? new Date(room.start)
        : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const canMarkDone = started && !!roomStart && roomStart <= today;

  // Shift-based execution planning & progress (kept separate from the timeline).
  const plan = getRoomShiftPlan(form);
  const progress = getRoomShiftProgress(form);
  const setShiftsDone = (value) => {
    const n = Math.max(
      0,
      Math.min(plan.totalPlanned, Math.round(Number(value) || 0)),
    );
    set("shiftsDone", n);
  };

  const handleSave = () => {
    // start/end are derived in computeChain — never persist them.
    const { _existing, start: _start, end: _end, ...clean } = form;
    onSave(clean);
  };

  return (
    <Modal
      title={form.room || "Room"}
      subtitle="Update status, assignee and notes — scope is planned"
      onClose={onClose}
      maxWidth="max-w-[480px]"
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full text-sm font-semibold text-grey hover:bg-bg-soft transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-full text-sm font-bold text-white bg-primary hover:opacity-90 transition-opacity"
          >
            Save
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Planned scope — read-only (comes from the proposal) */}
        <div className="rounded-lg border border-bordergray bg-bg-soft px-3 py-2.5">
          <p className="text-[10.5px] font-semibold text-text-subtle uppercase tracking-wider mb-1">
            Planned scope
          </p>
          <p className="text-sm font-bold text-textcolor">
            {form.room || "Untitled room"}
            {form.days ? (
              <span className="ml-2 text-[12px] font-medium text-text-muted">
                {form.days} working day{Number(form.days) === 1 ? "" : "s"}
              </span>
            ) : null}
            {plan.totalPlanned > 0 ? (
              <span className="ml-2 text-[12px] font-medium text-select-blue">
                · {plan.totalPlanned} planned shift
                {plan.totalPlanned === 1 ? "" : "s"}
              </span>
            ) : null}
          </p>
          {form.description && (
            <p className="text-[12px] text-text-muted mt-0.5">
              {form.description}
            </p>
          )}
          {plan.totalPlanned > 0 && (
            <p className="text-[11px] text-text-muted mt-1">
              Team allocation:{" "}
              <span className="font-semibold text-textcolor">
                {plan.shiftsPerDay} shift{plan.shiftsPerDay === 1 ? "" : "s"}/day
              </span>{" "}
              × {plan.days} day{plan.days === 1 ? "" : "s"} ={" "}
              <span className="font-semibold text-textcolor">
                {plan.totalPlanned} planned shift
                {plan.totalPlanned === 1 ? "" : "s"}
              </span>
              .
            </p>
          )}
          <p className="text-[10.5px] text-text-subtle mt-1.5">
            Scope, duration &amp; shifts/day come from the proposal / Schedule
            Master and aren&apos;t edited here.
          </p>
        </div>

        {/* Execution progress — completed shifts ÷ total planned (timeline-free) */}
        {plan.totalPlanned > 0 && (
          <div className="rounded-lg border border-bordergray px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[12px] font-semibold text-textcolor">
                Shift progress
              </p>
              <span className="text-[11px] font-semibold text-text-muted tabular-nums">
                {progress.done} / {progress.total} · {progress.pct}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-bg-soft overflow-hidden">
              <div
                className="h-full rounded-full bg-select-blue transition-all"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShiftsDone(progress.done - 1)}
                disabled={!!form.done || progress.done <= 0}
                className="h-7 w-7 flex items-center justify-center rounded-lg border border-bordergray text-textcolor hover:bg-bg-soft disabled:opacity-40 disabled:cursor-not-allowed"
              >
                −
              </button>
              <input
                type="number"
                min={0}
                max={plan.totalPlanned}
                value={form.done ? plan.totalPlanned : form.shiftsDone || 0}
                disabled={!!form.done}
                onChange={(e) => setShiftsDone(e.target.value)}
                className="w-16 rounded-lg border border-bordergray px-2 py-1.5 text-[12px] text-textcolor text-center focus:outline-none focus:border-select-blue disabled:bg-bg-soft disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShiftsDone(progress.done + 1)}
                disabled={!!form.done || progress.done >= plan.totalPlanned}
                className="h-7 w-7 flex items-center justify-center rounded-lg border border-bordergray text-textcolor hover:bg-bg-soft disabled:opacity-40 disabled:cursor-not-allowed"
              >
                +
              </button>
              <span className="text-[11px] text-text-subtle">
                of {plan.totalPlanned} shifts completed
                {form.done ? " · room marked done" : ""}
              </span>
            </div>
          </div>
        )}

        <label
          className={`flex items-center gap-3 rounded-lg border border-bordergray px-3 py-2.5 select-none transition-colors ${
            canMarkDone
              ? "cursor-pointer hover:bg-bg-soft"
              : "opacity-60 cursor-not-allowed"
          }`}
        >
          <input
            type="checkbox"
            checked={!!form.done}
            disabled={!canMarkDone}
            onChange={(e) => set("done", e.target.checked)}
            className="h-4 w-4 accent-emerald-600 disabled:cursor-not-allowed"
          />
          <span className="text-sm text-textcolor">
            Mark this room as <span className="font-semibold">done</span>
            <span className="block text-[11px] text-text-subtle">
              {canMarkDone
                ? "Overrides the auto status and stops overdue alerts for this room."
                : !started
                  ? "Available once work starts (Booking Token paid)."
                  : "Available once this room's start date is reached."}
            </span>
          </span>
        </label>

        <Labelled label="Assigned to">
          <input
            value={form.owner}
            onChange={(e) => set("owner", e.target.value)}
            placeholder="Owner / team responsible"
            className="w-full rounded-lg border border-bordergray px-3 py-2.5 text-sm text-textcolor focus:outline-none focus:border-select-blue"
          />
        </Labelled>

        <Labelled label="Note (optional)">
          <textarea
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
            rows={2}
            placeholder="Blockers, site notes…"
            className="w-full rounded-lg border border-bordergray px-3 py-2.5 text-sm text-textcolor resize-none focus:outline-none focus:border-select-blue"
          />
        </Labelled>
      </div>
    </Modal>
  );
};

const Labelled = ({ label, children }) => (
  <div>
    <label className="block text-[12px] font-semibold text-textcolor mb-1.5">
      {label}
    </label>
    {children}
  </div>
);

// ── Section ──────────────────────────────────────────────────────────────────
const ProjectSchedule = ({ lead }) => {
  const config = useMemo(() => getScheduleConfig(), []);
  const [schedule, setSchedule] = useState(() => getOrSeedSchedule(lead));
  const [editing, setEditing] = useState(null);

  const persist = (next) => {
    setSchedule(next);
    saveSchedule(lead.proposalId, next);
  };

  const setRooms = (rooms) => persist({ ...schedule, rooms });

  // Rebuild the room list from the current proposal scope, keeping the
  // work-start / confirmation state intact. Use after changing a client's scope.
  const resyncFromProposal = () => {
    if (!window.confirm("Rebuild rooms from the current proposal? Manual room edits will be replaced; the work-start date is kept.")) return;
    setRooms(seedRoomsFromProposal(lead));
  };

  const anchor = useMemo(() => resolveAnchor(lead, schedule), [lead, schedule]);
  // Work is "started" only once the Booking Token is paid — before that we don't
  // surface progress or overdue (project isn't Won/booked yet).
  const started = anchor.source === "booking";
  const chain = useMemo(
    () => computeChain(schedule.rooms, anchor.date),
    [schedule.rooms, anchor.date],
  );

  const overdue = started
    ? chain.filter(
        (r) =>
          getRoomHealth(r.end, deriveStatus(r, started), config).state ===
          "overdue",
      ).length
    : 0;
  const projectEnd = useMemo(() => getProjectEnd(chain), [chain]);
  // Shift roll-up for progress tracking (independent of the day-based timeline).
  const shiftSummary = useMemo(
    () => getProjectShiftSummary(schedule.rooms),
    [schedule.rooms],
  );

  // ── Confirm work-start (explicit save + activity log) ──────────────────────
  // The schedule anchors to the *saved* workStart; edits stay in draft state
  // until "Confirm start" commits them. A delay reason is required once the gap
  // between booking payment and the chosen start exceeds a week.
  const toISO = (d) =>
    d
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
          d.getDate(),
        ).padStart(2, "0")}`
      : "";
  const [draftStart, setDraftStart] = useState(schedule.workStart || "");
  const [draftNote, setDraftNote] = useState(schedule.delayNote || "");
  // 7-day post-payment delay attribution — "client" or "our".
  const [delayAttributionDraft, setDelayAttributionDraft] = useState(
    schedule.delayAttribution || "",
  );
  // Two-sided confirmation: client approval + (when breaching) the delay
  // attribution — "client" (client requested) or "our" (our delay).
  const [clientApprovedDraft, setClientApprovedDraft] = useState(
    !!schedule.clientApproved,
  );
  const [breachReasonDraft, setBreachReasonDraft] = useState(
    schedule.breachReason || "",
  );
  // Once confirmed the start is locked and cannot be changed.
  const locked = !!schedule.confirmedAt;

  const bookingISO = toISO(anchor.bookingDate);
  const effectiveDraftStart = draftStart || bookingISO;
  const draftStartDate = effectiveDraftStart
    ? new Date(`${effectiveDraftStart}T00:00:00`)
    : null;
  const draftDelay =
    anchor.bookingDate && draftStartDate
      ? Math.round((draftStartDate - anchor.bookingDate) / 86400000)
      : 0;
  const draftNeedsNote = draftDelay > 7;
  const draftNoteMissing = draftNeedsNote && !draftNote.trim();
  const draftAttributionMissing = draftNeedsNote && !delayAttributionDraft;

  // Possession breach: does the plan (for this draft start) finish past handover?
  const possession = getPossessionDate(lead);
  const draftPlannedEnd = useMemo(
    () =>
      getProjectEnd(
        computeChain(
          schedule.rooms,
          effectiveDraftStart
            ? new Date(`${effectiveDraftStart}T00:00:00`)
            : null,
        ),
      ),
    [schedule.rooms, effectiveDraftStart],
  );
  const draftBreachDays = getBreachDays(possession, draftPlannedEnd);
  const draftBreach = draftBreachDays > 0;
  // Current (committed) breach — what's actually driving the schedule now.
  const currentBreachDays = getBreachDays(possession, projectEnd);
  const currentBreach = currentBreachDays > 0;

  const startDirty =
    started &&
    !locked &&
    (effectiveDraftStart !== (schedule.workStart || bookingISO) ||
      draftNote !== (schedule.delayNote || "") ||
      delayAttributionDraft !== (schedule.delayAttribution || "") ||
      clientApprovedDraft !== !!schedule.clientApproved ||
      breachReasonDraft !== (schedule.breachReason || ""));
  const canConfirm =
    started &&
    !locked && // can't re-confirm once locked
    !draftNoteMissing &&
    (!draftAttributionMissing || draftBreach) && // 7-day attribution not needed when possession breach is active
    clientApprovedDraft && // client must sign off on the date
    (!draftBreach || !!breachReasonDraft) && // breach needs an attributed reason
    (startDirty || !schedule.workStart);

  const confirmStart = () => {
    if (!canConfirm) return;
    const note = draftNeedsNote ? draftNote.trim() : "";
    const attribution = draftNeedsNote ? delayAttributionDraft : "";
    const reason = draftBreach ? breachReasonDraft : "";
    const at = new Date().toISOString();
    persist({
      ...schedule,
      workStart: effectiveDraftStart,
      delayNote: note,
      delayAttribution: attribution,
      clientApproved: clientApprovedDraft,
      breachReason: reason,
      confirmedAt: at, // locks the start
    });
    appendActivity(lead.proposalId, {
      type: "schedule",
      event: "start-confirmed",
      at,
      startDate: effectiveDraftStart,
      delayDays: draftDelay,
      note,
      delayAttribution: attribution,
      clientApproved: clientApprovedDraft,
      breachDays: draftBreach ? draftBreachDays : 0,
      reason,
    });
    // A breach is communicated to the client either way — as a client-requested
    // change, or as our delay we're conveying to them.
    if (draftBreach) {
      const message =
        reason === "client"
          ? `At the client's request, the start date moves completion to ${fmt(draftPlannedEnd)} — ${draftBreachDays} day${draftBreachDays === 1 ? "" : "s"} past possession (${fmt(possession)}).`
          : `Our schedule moves completion to ${fmt(draftPlannedEnd)} — ${draftBreachDays} day${draftBreachDays === 1 ? "" : "s"} past the agreed possession date (${fmt(possession)}). Informing the client.`;
      appendActivity(lead.proposalId, {
        type: "schedule",
        event: "client-notified",
        at,
        reason: reason === "client" ? "client" : "execution",
        message,
        breachDays: draftBreachDays,
      });
    }
  };

  // ── Notify client of a timeline issue ──────────────────────────────────────
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyReason, setNotifyReason] = useState("client");
  const [notifyMsg, setNotifyMsg] = useState("");

  const sendNotification = () => {
    appendActivity(lead.proposalId, {
      type: "schedule",
      event: "client-notified",
      at: new Date().toISOString(),
      reason: notifyReason, // "client" (client-requested) | "execution" (our delay)
      message: notifyMsg.trim(),
      breachDays: currentBreachDays,
    });
    setNotifyOpen(false);
    setNotifyMsg("");
  };

  // ── Amend a locked start ───────────────────────────────────────────────────
  // Unlocks the confirmed start for editing; re-confirmation needs fresh client
  // approval (and re-attribution if it still breaches). Logged for the trail.
  const [amendOpen, setAmendOpen] = useState(false);
  const [amendReason, setAmendReason] = useState("");

  const amendStart = () => {
    persist({
      ...schedule,
      confirmedAt: "",
      clientApproved: false,
      delayAttribution: "",
      breachReason: "",
    });
    appendActivity(lead.proposalId, {
      type: "schedule",
      event: "start-amended",
      at: new Date().toISOString(),
      note: amendReason.trim(),
    });
    setClientApprovedDraft(false); // force re-approval
    setDelayAttributionDraft(""); // force re-attribution
    setBreachReasonDraft("");
    setAmendOpen(false);
    setAmendReason("");
  };

  const handleSaveRoom = (room) => {
    const prev = schedule.rooms.find((r) => r.id === room.id);
    setRooms(
      prev
        ? schedule.rooms.map((r) => (r.id === room.id ? room : r))
        : [...schedule.rooms, room],
    );
    // Log a completion event to the project activity timeline.
    if (room.done && !prev?.done) {
      appendActivity(lead.proposalId, {
        type: "schedule",
        event: "room-done",
        at: new Date().toISOString(),
        room: room.room,
      });
    }
    setEditing(null);
  };

  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= schedule.rooms.length) return;
    const next = [...schedule.rooms];
    [next[idx], next[j]] = [next[j], next[idx]];
    setRooms(next);
  };

  return (
    <div className="bg-white rounded-[20px] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] overflow-hidden shrink-0">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-[16px] font-bold text-darkgray">
            <FiCalendar size={18} className="text-gray-500" /> Schedule
            <button
              type="button"
              onClick={resyncFromProposal}
              title="Rebuild rooms from the current proposal scope"
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-bordergray text-[11px] font-semibold text-text-muted hover:text-select-blue hover:border-select-blue/40 transition-colors"
            >
              <FiRefreshCw size={11} /> Re-sync
            </button>
          </h3>
          <p className="text-[12px] text-text-muted mt-0.5">
            All rooms run in parallel from the start
            {projectEnd && (
              <span className="ml-1">
                · plan ends{" "}
                <span className="font-semibold text-darkgray">
                  {fmt(projectEnd)}
                </span>
              </span>
            )}
            {shiftSummary.total > 0 && (
              <span className="ml-1">
                · {shiftSummary.done}/{shiftSummary.total} shifts done
              </span>
            )}
            {overdue > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-red-600 font-semibold">
                <FiAlertTriangle size={12} /> {overdue} overdue
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Work-start anchor */}
      <div className="px-6 pb-3">
        {anchor.source === "booking" ? (
          <div
            className={`rounded-xl border px-3.5 py-2.5 ${
              draftBreach || draftNeedsNote
                ? "bg-red-50 border-red-200"
                : "bg-emerald-50 border-emerald-100"
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <FiCheckCircle
                size={15}
                className={`shrink-0 ${draftBreach || draftNeedsNote ? "text-red-600" : "text-emerald-600"}`}
              />
              <p className="text-[12px] text-emerald-800">
                Booking Token paid{" "}
                <span className="font-bold">{fmt(anchor.bookingDate)}</span>.
              </p>
              <label className="flex items-center gap-2 ml-auto text-[11px] text-text-muted">
                Work start
                <input
                  type="date"
                  value={effectiveDraftStart}
                  min={bookingISO}
                  disabled={locked}
                  onChange={(e) => setDraftStart(e.target.value)}
                  className="rounded-lg border border-bordergray px-2.5 py-1.5 text-[12px] text-textcolor focus:outline-none focus:border-select-blue disabled:bg-bg-soft disabled:cursor-not-allowed"
                />
              </label>
              <button
                type="button"
                onClick={confirmStart}
                disabled={!canConfirm}
                className="px-3 py-1.5 rounded-lg bg-select-blue text-white text-[11px] font-semibold hover:bg-blue-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {locked
                  ? "Locked"
                  : startDirty || !schedule.workStart
                    ? "Confirm start"
                    : "Confirmed"}
              </button>
            </div>

            {/* Section 1 – Delay Information Message */}
            {draftDelay > 0 && (
              <p
                className={`text-[11.5px] mt-1.5 ${
                  draftNeedsNote
                    ? "text-red-700 font-semibold"
                    : "text-emerald-700"
                }`}
              >
                Work starts {fmt(draftStartDate)} — {draftDelay} day
                {draftDelay === 1 ? "" : "s"} after payment
                {draftNeedsNote
                  ? " · a reason is required to confirm."
                  : " (within tolerance)."}
              </p>
            )}

            {/* Section 2 – Delay Reason Text Area */}
            {draftNeedsNote && (
              <div className="mt-2">
                <textarea
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  rows={2}
                  placeholder="Why is work starting more than a week after payment? (e.g. material lead time, site handover delay)"
                  className={`w-full rounded-lg border px-3 py-2 text-[12px] text-textcolor resize-none focus:outline-none ${
                    draftNoteMissing
                      ? "border-red-400 focus:border-red-500 bg-red-50/40"
                      : "border-bordergray focus:border-select-blue"
                  }`}
                />
                {draftNoteMissing && (
                  <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                    <FiAlertTriangle size={11} /> Add a reason before
                    confirming.
                  </p>
                )}
              </div>
            )}

            {/* Section 3 – Delay Attribution Warning Card (hidden when possession-date breach is active) */}
            {draftNeedsNote && !draftBreach && (
              <div className="mt-2 rounded-lg bg-white/60 border border-red-200 px-3 py-2">
                <p className="text-[11.5px] text-red-700 font-semibold flex items-center gap-1.5">
                  <FiAlertTriangle size={12} className="shrink-0" />
                  Work has not started within 7 days of receiving the advance
                  payment.
                </p>
                {locked ? (
                  <p className="text-[11px] text-red-700 mt-1">
                    Delay attributed to:{" "}
                    <span className="font-semibold">
                      {schedule.delayAttribution === "client"
                        ? "Client requested this date"
                        : "Our Delay"}
                    </span>{" "}
                    · client informed.
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] text-red-700 mt-1.5 mb-1">
                      Whose delay is this? (confirming will inform the client)
                    </p>
                    <div className="flex items-center gap-4 text-[11px] text-red-700">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="delayAttribution"
                          checked={delayAttributionDraft === "client"}
                          onChange={() => setDelayAttributionDraft("client")}
                          className="accent-red-600"
                        />
                        Client requested this date
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="delayAttribution"
                          checked={delayAttributionDraft === "our"}
                          onChange={() => setDelayAttributionDraft("our")}
                          className="accent-red-600"
                        />
                        Our Delay
                      </label>
                    </div>
                    {draftAttributionMissing && (
                      <p className="text-[11px] text-red-600 mt-1.5 flex items-center gap-1">
                        <FiAlertTriangle size={11} /> Select who caused the
                        delay before confirming.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Possession-breach guard — attribute the delay before confirming */}
            {draftBreach && (
              <div className="mt-2 rounded-lg bg-white/60 border border-red-200 px-3 py-2">
                <p className="text-[11.5px] text-red-700 font-semibold flex items-center gap-1.5">
                  <FiAlertTriangle size={12} className="shrink-0" />
                  Plan finishes {fmt(draftPlannedEnd)} — {draftBreachDays} day
                  {draftBreachDays === 1 ? "" : "s"} past possession (
                  {fmt(possession)}).
                </p>
                {locked ? (
                  <p className="text-[11px] text-red-700 mt-1">
                    Delay attributed to:{" "}
                    <span className="font-semibold">
                      {schedule.breachReason === "client"
                        ? "Client-requested"
                        : "Our side"}
                    </span>{" "}
                    · client informed.
                  </p>
                ) : (
                  <>
                    <p className="text-[11px] text-red-700 mt-1.5 mb-1">
                      Whose delay is this? (confirming will inform the client)
                    </p>
                    <div className="flex items-center gap-4 text-[11px] text-red-700">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="breachReason"
                          checked={breachReasonDraft === "client"}
                          onChange={() => setBreachReasonDraft("client")}
                          className="accent-red-600"
                        />
                        Client requested this date
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="breachReason"
                          checked={breachReasonDraft === "our"}
                          onChange={() => setBreachReasonDraft("our")}
                          className="accent-red-600"
                        />
                        Our delay
                      </label>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Two-sided confirmation: client approval */}
            <label
              className={`flex items-center gap-2 mt-2 text-[11.5px] text-textcolor select-none ${
                locked ? "cursor-not-allowed opacity-80" : "cursor-pointer"
              }`}
            >
              <input
                type="checkbox"
                checked={clientApprovedDraft}
                disabled={locked}
                onChange={(e) => setClientApprovedDraft(e.target.checked)}
                className="h-3.5 w-3.5 accent-select-blue disabled:cursor-not-allowed"
              />
              Client has approved this work-start date
              {!clientApprovedDraft && !locked && (
                <span className="text-[10.5px] text-text-subtle">
                  — required to confirm
                </span>
              )}
            </label>

            {locked && (
              <div className="mt-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[11px] text-emerald-700 flex items-center gap-1.5">
                    <FiCheckCircle size={11} className="shrink-0" />
                    Start confirmed &amp; locked{" "}
                    {fmt(new Date(schedule.confirmedAt))}
                    {schedule.clientApproved ? " · client approved" : ""}
                    {currentBreach
                      ? ` · ${currentBreachDays}d past possession`
                      : ""}
                    .
                  </p>
                  {!amendOpen && (
                    <button
                      type="button"
                      onClick={() => setAmendOpen(true)}
                      className="text-[11px] font-semibold text-select-blue hover:underline shrink-0"
                    >
                      Amend
                    </button>
                  )}
                </div>
                {amendOpen && (
                  <div className="mt-2 rounded-lg border border-bordergray bg-white px-3 py-2 space-y-2">
                    <p className="text-[11px] text-text-muted">
                      Amending unlocks the start for editing and needs fresh
                      client approval before re-confirming. This is logged.
                    </p>
                    <textarea
                      value={amendReason}
                      onChange={(e) => setAmendReason(e.target.value)}
                      rows={2}
                      placeholder="Reason for amending the confirmed start (optional)"
                      className="w-full rounded-lg border border-bordergray px-3 py-2 text-[12px] text-textcolor resize-none focus:outline-none focus:border-select-blue"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAmendOpen(false);
                          setAmendReason("");
                        }}
                        className="px-3 py-1.5 text-[11px] font-semibold text-grey hover:bg-bg-soft rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={amendStart}
                        className="px-3 py-1.5 rounded-lg bg-select-blue text-white text-[11px] font-semibold hover:bg-blue-950 transition-colors"
                      >
                        Unlock to edit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Client notification */}
            <div className="mt-2 border-t border-red-200 pt-2">
              {!notifyOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    const baseMsg = projectEnd
                      ? `Heads up: projected completion is ${fmt(projectEnd)}`
                      : "Heads up: schedule update";
                    const breachMsg = currentBreach
                      ? `, which is ${currentBreachDays} day${currentBreachDays === 1 ? "" : "s"} past the agreed possession date (${fmt(possession)}).`
                      : ".";
                    setNotifyMsg(`${baseMsg}${breachMsg}`);
                    setNotifyOpen(true);
                  }}
                  className="text-[11px] font-semibold text-red-600 hover:underline flex items-center gap-1"
                >
                  <FiAlertTriangle size={11} /> Notify client of timeline
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-text-muted">Reason:</span>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="notifyReason"
                        checked={notifyReason === "client"}
                        onChange={() => setNotifyReason("client")}
                        className="accent-select-blue"
                      />
                      Client-requested
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="notifyReason"
                        checked={notifyReason === "execution"}
                        onChange={() => setNotifyReason("execution")}
                        className="accent-select-blue"
                      />
                      Execution delay
                    </label>
                  </div>
                  <textarea
                    value={notifyMsg}
                    onChange={(e) => setNotifyMsg(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-bordergray px-3 py-2 text-[12px] text-textcolor resize-none focus:outline-none focus:border-select-blue"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setNotifyOpen(false)}
                      className="px-3 py-1.5 text-[11px] font-semibold text-grey hover:bg-bg-soft rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={sendNotification}
                      disabled={!notifyMsg.trim()}
                      className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Log notification
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-bg-soft border border-bordergray rounded-xl px-3.5 py-2.5 flex-wrap">
            <p className="text-[12px] text-text-muted">
              Booking not paid yet. Provisional work start:
            </p>
            <input
              type="date"
              value={schedule.workStart}
              onChange={(e) =>
                persist({ ...schedule, workStart: e.target.value })
              }
              className="rounded-lg border border-bordergray px-2.5 py-1.5 text-[12px] text-textcolor focus:outline-none focus:border-select-blue"
            />
            <span className="text-[11px] text-text-subtle">
              (Booking payment will override this.)
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-bg-soft">
        {chain.length === 0 ? (
          <div className="text-center py-12 px-8">
            <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
              <FiCalendar size={20} />
            </div>
            <p className="text-[13px] text-gray-500">
              No rooms yet. Send a proposal so rooms seed automatically with
              their durations.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-bg-soft">
            {chain.map((r, idx) => {
              const status = deriveStatus(r, started);
              const h =
                started || status === "Done"
                  ? getRoomHealth(r.end, status, config)
                  : { rag: "none", label: "Awaiting booking" };
              const plan = getRoomShiftPlan(r);
              const prog = getRoomShiftProgress(r);
              return (
                <div
                  key={r.id}
                  className="px-6 py-3.5 flex items-center gap-3 hover:bg-bg-soft/50 transition-colors group"
                >
                  {/* Reorder */}
                  <div className="flex flex-col -my-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      className="text-text-subtle hover:text-select-blue disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <FiChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, 1)}
                      disabled={idx === chain.length - 1}
                      className="text-text-subtle hover:text-select-blue disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <FiChevronDown size={14} />
                    </button>
                  </div>

                  <span
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${RAG_DOT[h.rag]}`}
                  />

                  <button
                    type="button"
                    onClick={() => setEditing({ ...r, _existing: true })}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-[13.5px] font-bold text-darkgray truncate">
                      {r.room || "Untitled room"}
                      {r.days ? (
                        <span className="ml-2 text-[11px] font-medium text-text-subtle">
                          {r.days}d
                        </span>
                      ) : (
                        <span className="ml-2 text-[11px] font-medium text-amber-600">
                          set duration
                        </span>
                      )}
                      {plan.totalPlanned > 0 && (
                        <span className="ml-2 text-[11px] font-medium text-select-blue">
                          {plan.totalPlanned} shift
                          {plan.totalPlanned === 1 ? "" : "s"}
                          {plan.shiftsPerDay > 1
                            ? ` · ${plan.shiftsPerDay}/day`
                            : ""}
                        </span>
                      )}
                    </p>
                    {plan.totalPlanned > 0 && (
                      <div className="mt-1 flex items-center gap-1.5 max-w-[200px]">
                        <div className="h-1 flex-1 rounded-full bg-bg-soft overflow-hidden">
                          <div
                            className="h-full rounded-full bg-select-blue"
                            style={{ width: `${prog.pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-text-subtle tabular-nums shrink-0">
                          {prog.done}/{prog.total}
                        </span>
                      </div>
                    )}
                    {r.works?.length ? (
                      <div className="mt-1 space-y-0.5">
                        {r.works.map((w, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-3 max-w-[280px] text-[11.5px] text-text-muted"
                          >
                            <span className="truncate">• {w.name}</span>
                            {w.days ? (
                              <span className="text-text-subtle shrink-0 tabular-nums">
                                {w.days}d
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : r.description ? (
                      <p className="text-[11.5px] text-text-muted truncate">
                        {r.description}
                      </p>
                    ) : null}
                  </button>

                  <div className="hidden sm:block text-[11.5px] text-text-muted shrink-0 w-[150px] text-right tabular-nums">
                    {r.start ? (
                      <>
                        {fmt(r.start)} → {fmt(r.end)}
                      </>
                    ) : anchor.date ? (
                      <span className="text-text-subtle">—</span>
                    ) : (
                      <span className="text-text-subtle">awaiting start</span>
                    )}
                  </div>

                  {r.owner && (
                    <div className="hidden md:flex items-center gap-1.5 text-[11.5px] text-text-muted shrink-0 w-[100px] truncate">
                      <FiUser size={12} className="text-text-subtle" />
                      <span className="truncate">{r.owner}</span>
                    </div>
                  )}

                  <span className="text-[10px] font-semibold text-text-muted bg-bg-soft px-2 py-1 rounded-md shrink-0 hidden lg:inline">
                    {status}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold shrink-0 ${RAG_CHIP[h.rag]}`}
                  >
                    {h.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editing && (
        <RoomModal
          room={editing}
          started={started}
          onSave={handleSaveRoom}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};

export default ProjectSchedule;
