import { forwardRef } from "react";

// Strip everything that isn't a digit or a decimal point, and keep at most one
// decimal point. Used to sanitise amount / rate / qty entry.
const sanitizeNumeric = (raw) => {
  let s = String(raw ?? "").replace(/[^0-9.]/g, "");
  const dot = s.indexOf(".");
  if (dot !== -1) {
    // drop any further dots after the first
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
  }
  return s;
};

// A number-only TEXT box — a drop-in replacement for <input type="number"> on
// amount / rate / qty fields. It avoids the number-input quirks (spinner arrows,
// accepting "e"/"+"/"-"/scientific notation, scroll-to-change) and rejects any
// non-numeric character as it's typed, allowing digits and a single decimal
// point only. `onChange` receives the already-sanitised string value (not the
// DOM event), so call sites store `val` directly.
const NumericInput = forwardRef(function NumericInput(
  { value, onChange, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      {...props}
      value={value ?? ""}
      onChange={(e) => onChange?.(sanitizeNumeric(e.target.value))}
    />
  );
});

export default NumericInput;
