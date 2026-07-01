import { useMemo, useState } from "react";
import {
  CalendarClock,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  AlertTriangle,
  Home,
  ListChecks,
  Clock,
} from "lucide-react";
import {
  DEFAULT_CONFIG,
  getScheduleConfig,
  saveScheduleConfig,
} from "../../../data/scheduleConfig";

// Small card shell shared by every config section.
const Card = ({ title, icon, badge, children }) => (
  <div className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
    <div className="px-4 py-3 border-b border-bordergray bg-linear-to-r from-select-blue/5 to-white flex items-center gap-2">
      {icon}
      <h3 className="text-[12px] font-bold text-textcolor">{title}</h3>
      {badge != null && (
        <span className="text-[10px] font-semibold text-text-muted bg-white/70 px-1.5 py-0.5 rounded-md border border-bordergray">
          {badge}
        </span>
      )}
    </div>
    <div className="p-3">{children}</div>
  </div>
);

// Editable scope list — each row has a default-days field (drives the timeline)
// and a shifts/day rate (drives execution planning / team allocation / progress).
// Total Planned Shifts = days × shifts/day is shown read-only per row.
const RoomDaysList = ({ items, onChange }) => {
  const update = (idx, key, value) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));
  const add = () => {
    if (items.some((it) => !it.name.trim())) return;
    onChange([{ name: "", days: "", shiftsPerDay: "" }, ...items]);
  };

  const plannedShifts = (it) =>
    (Math.max(0, Number(it.days) || 0)) * (Math.max(0, Number(it.shiftsPerDay) || 0));

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-[11px] text-text-muted">
          <span className="font-semibold">Days</span> set the timeline &amp;
          possession;{" "}
          <span className="font-semibold">shifts/day</span> give Total Planned
          Shifts (days × shifts/day) for allocation &amp; progress.
        </p>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-[11px] font-semibold text-select-blue hover:text-primary shrink-0"
        >
          <Plus size={12} /> Add
        </button>
      </div>
      {/* Column captions for the numeric fields */}
      {items.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <span className="w-full" />
          <span className="w-[52px] shrink-0 text-center text-[9.5px] font-semibold uppercase tracking-wider text-text-subtle">
            Days
          </span>
          <span className="w-[52px] shrink-0 text-center text-[9.5px] font-semibold uppercase tracking-wider text-text-subtle">
            Shifts/day
          </span>
          <span className="w-[64px] shrink-0 text-center text-[9.5px] font-semibold uppercase tracking-wider text-text-subtle">
            Planned
          </span>
          <span className="w-6 shrink-0" />
        </div>
      )}
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2 group">
          <input
            type="text"
            value={item.name}
            onChange={(e) => update(idx, "name", e.target.value)}
            placeholder="e.g. Living Room"
            className="bg-bg-soft border border-transparent text-[11.5px] text-textcolor rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:bg-white focus:border-select-blue/40 placeholder:text-text-subtle"
          />
          <div className="flex items-center gap-1 bg-bg-soft rounded-lg px-2 py-1 shrink-0 w-[52px] justify-center">
            <input
              type="number"
              min={0}
              value={item.days}
              onChange={(e) => update(idx, "days", e.target.value)}
              placeholder="0"
              title="Default duration in days — seeds the proposal & timeline"
              className="w-9 bg-white border border-bordergray rounded-md px-1 py-1 text-[11.5px] text-textcolor text-center focus:outline-none focus:border-select-blue/40"
            />
          </div>
          <div className="flex items-center gap-1 bg-bg-soft rounded-lg px-2 py-1 shrink-0 w-[52px] justify-center">
            <input
              type="number"
              min={0}
              value={item.shiftsPerDay}
              onChange={(e) => update(idx, "shiftsPerDay", e.target.value)}
              placeholder="0"
              title="Shifts worked per day — Total Planned Shifts = days × shifts/day"
              className="w-9 bg-white border border-bordergray rounded-md px-1 py-1 text-[11.5px] text-textcolor text-center focus:outline-none focus:border-select-blue/40"
            />
          </div>
          <div
            className="shrink-0 w-[64px] text-center text-[11.5px] font-semibold text-select-blue tabular-nums"
            title="Total Planned Shifts = days × shifts/day"
          >
            {plannedShifts(item) || "—"}
          </div>
          <button
            type="button"
            onClick={() => remove(idx)}
            className="h-7 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
            title="Remove"
          >
            <Trash2 size={11} />
          </button>
        </div>
      ))}
      {items.length === 0 && (
        <button
          type="button"
          onClick={add}
          className="w-full text-[11px] text-text-subtle border border-dashed border-bordergray rounded-lg py-3 hover:border-select-blue hover:text-select-blue transition-colors"
        >
          + Add your first room
        </button>
      )}
    </div>
  );
};

// Generic editable string-list (statuses).
const StringList = ({ items, onChange, placeholder }) => {
  const update = (idx, value) =>
    onChange(items.map((it, i) => (i === idx ? value : it)));
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));
  const add = () => {
    if (items.some((it) => it.trim() === "")) return;
    onChange(["", ...items]);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-[11px] font-semibold text-select-blue hover:text-primary"
        >
          <Plus size={12} /> Add
        </button>
      </div>
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2 group">
          <input
            type="text"
            value={item}
            onChange={(e) => update(idx, e.target.value)}
            placeholder={placeholder}
            className="bg-bg-soft border border-transparent text-[11.5px] text-textcolor rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:bg-white focus:border-select-blue/40 placeholder:text-text-subtle"
          />
          <button
            type="button"
            onClick={() => remove(idx)}
            className="h-7 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
            title="Remove"
          >
            <Trash2 size={11} />
          </button>
        </div>
      ))}
      {items.length === 0 && (
        <button
          type="button"
          onClick={add}
          className="w-full text-[11px] text-text-subtle border border-dashed border-bordergray rounded-lg py-3 hover:border-select-blue hover:text-select-blue transition-colors"
        >
          + Add your first entry
        </button>
      )}
    </div>
  );
};

const ScheduleConfig = () => {
  const [saved, setSaved] = useState(() => getScheduleConfig());
  const [config, setConfig] = useState(saved);

  const isDirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(saved),
    [config, saved],
  );

  const patch = (partial) => setConfig((c) => ({ ...c, ...partial }));

  // ── Escalation tiers ───────────────────────────────────────────────────────
  const updateTier = (idx, key, value) =>
    patch({
      escalationTiers: config.escalationTiers.map((t, i) =>
        i === idx ? { ...t, [key]: value } : t,
      ),
    });
  const addTier = () =>
    patch({
      escalationTiers: [
        ...config.escalationTiers,
        { minDaysOverdue: 1, role: "" },
      ],
    });
  const removeTier = (idx) =>
    patch({
      escalationTiers: config.escalationTiers.filter((_, i) => i !== idx),
    });

  const handleSave = () => {
    // Normalise: drop blank rooms/statuses/roles/headings, coerce numbers, sort tiers.
    const cleaned = {
      ...config,
      amberWindowDays: Math.max(0, Number(config.amberWindowDays) || 0),
      escalationTiers: config.escalationTiers
        .filter((t) => t.role.trim() !== "")
        .map((t) => ({
          minDaysOverdue: Math.max(1, Number(t.minDaysOverdue) || 1),
          role: t.role.trim(),
        }))
        .sort((a, b) => a.minDaysOverdue - b.minDaysOverdue),
      rooms: config.rooms
        .map((r) => ({
          name: r.name.trim(),
          days: r.days === "" ? "" : Math.max(0, Number(r.days) || 0),
          shiftsPerDay:
            r.shiftsPerDay === "" ? "" : Math.max(0, Number(r.shiftsPerDay) || 0),
        }))
        .filter((r) => r.name),

      statuses: config.statuses.map((s) => s.trim()).filter(Boolean),
    };
    saveScheduleConfig(cleaned);
    setSaved(cleaned);
    setConfig(cleaned);
  };

  const handleReset = () => setConfig(DEFAULT_CONFIG);

  return (
    <div className="bg-overallbg font-sans h-full overflow-y-auto pb-28 scroll-hidden-bar">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-overallbg/80 backdrop-blur-xl border-b border-bordergray/70">
        <div className="px-6 py-4 flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 rounded-xl bg-linear-to-br from-select-blue to-primary text-white flex items-center justify-center shadow-lg shadow-select-blue/20">
              <CalendarClock size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[20px] font-bold text-textcolor leading-tight">
                  Schedule
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Config
                </span>
              </div>
              <p className="text-[12px] text-text-muted mt-0.5">
                Escalation tiers, scope durations &amp; shift requirements used
                by every project schedule
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted hover:text-textcolor px-3 py-2 rounded-lg hover:bg-bg-soft transition-colors"
            >
              <RotateCcw size={12} /> Reset to defaults
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-linear-to-br from-select-blue to-primary px-4 py-2 rounded-lg shadow-sm transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save size={12} /> {isDirty ? "Save changes" : "Saved"}
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Escalation tiers */}
        <Card
          title="Escalation tiers"
          icon={<AlertTriangle size={13} className="text-amber-500" />}
          badge={config.escalationTiers.length}
        >
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-[11px] text-text-muted">
                A task this many days past its planned end escalates to the role
                below. Highest matching tier wins.
              </p>
              <button
                type="button"
                onClick={addTier}
                className="flex items-center gap-1 text-[11px] font-semibold text-select-blue hover:text-primary shrink-0"
              >
                <Plus size={12} /> Add tier
              </button>
            </div>
            {config.escalationTiers.map((tier, idx) => (
              <div key={idx} className="flex items-center gap-2 group">
                <div className="flex items-center gap-1.5 bg-bg-soft rounded-lg px-2.5 py-1.5">
                  <span className="text-[11px] text-text-muted">Overdue ≥</span>
                  <input
                    type="number"
                    min={1}
                    value={tier.minDaysOverdue}
                    onChange={(e) =>
                      updateTier(idx, "minDaysOverdue", e.target.value)
                    }
                    className="w-12 bg-white border border-bordergray rounded-md px-1.5 py-1 text-[11.5px] text-textcolor text-center focus:outline-none focus:border-select-blue/40"
                  />
                  <span className="text-[11px] text-text-muted">days →</span>
                </div>
                <input
                  type="text"
                  value={tier.role}
                  onChange={(e) => updateTier(idx, "role", e.target.value)}
                  placeholder="e.g. Project Manager"
                  className="bg-bg-soft border border-transparent text-[11.5px] text-textcolor rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:bg-white focus:border-select-blue/40 placeholder:text-text-subtle"
                />
                <button
                  type="button"
                  onClick={() => removeTier(idx)}
                  className="h-7 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                  title="Remove tier"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* Amber window */}
        <Card
          title="Amber window"
          icon={<Clock size={13} className="text-amber-500" />}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <label
              htmlFor="amber-window"
              className="text-[11.5px] text-textcolor"
            >
              Flag a task amber when it's due within
            </label>
            <input
              id="amber-window"
              type="number"
              min={0}
              value={config.amberWindowDays}
              onChange={(e) => patch({ amberWindowDays: e.target.value })}
              className="w-16 bg-bg-soft border border-bordergray rounded-lg px-2.5 py-1.5 text-[11.5px] text-textcolor text-center focus:outline-none focus:bg-white focus:border-select-blue/40"
            />
            <span className="text-[11.5px] text-textcolor">
              day(s) of its planned end.
            </span>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-5 items-start">
          {/* Rooms */}
          <Card
            title="Scope presets — days & shifts/day"
            icon={<Home size={13} className="text-select-blue" />}
            badge={config.rooms.filter((r) => r.name.trim()).length}
          >
            <RoomDaysList
              items={config.rooms}
              onChange={(rooms) => patch({ rooms })}
            />
          </Card>

          {/* Statuses
          <Card
            title="Task statuses"
            icon={<ListChecks size={13} className="text-select-blue" />}
            badge={config.statuses.filter((s) => s.trim()).length}
          >
            <StringList
              items={config.statuses}
              onChange={(statuses) => patch({ statuses })}
              placeholder="e.g. In Progress"
            />
          </Card>
          */}
        </div>
      </div>
    </div>
  );
};

export default ScheduleConfig;
