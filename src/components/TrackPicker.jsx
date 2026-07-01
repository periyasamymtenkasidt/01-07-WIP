import { SERVICE_TRACK_OPTIONS } from "../data/serviceTrack";

// The one decision that branches the whole project: Interiors vs Architecture.
// Two plain-language cards instead of abstract dropdowns.
const TrackPicker = ({ value, onChange }) => (
  <div className="grid grid-cols-2 gap-3">
    {SERVICE_TRACK_OPTIONS.map((opt) => {
      const active = value === opt.value;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`text-left rounded-xl border p-3 transition-all ${
            active
              ? "border-select-blue bg-select-blue/5 ring-1 ring-select-blue/30"
              : "border-bordergray bg-white hover:bg-bg-soft"
          }`}
        >
          <p
            className={`text-[13px] font-bold ${
              active ? "text-select-blue" : "text-darkgray"
            }`}
          >
            {opt.title}
          </p>
          <p className="text-[10.5px] text-text-muted mt-0.5 leading-snug">
            {opt.desc}
          </p>
        </button>
      );
    })}
  </div>
);

export default TrackPicker;
