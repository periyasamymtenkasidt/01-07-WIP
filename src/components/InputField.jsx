import React from "react";

const InputField = ({
  label,
  name,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  options = [],
  icon: Icon,
  leftIcon: LeftIcon,
  rightElement,
  suffix,
  className = "",
  rows = 3,
  register,
  variant = "default",
  ...rest
}) => {
  const hasError = !!error;

  // When react-hook-form's register is provided, spread it onto the element.
  // Otherwise, fall back to the legacy value + onChange controlled pattern.
  const controlProps = register
    ? {
        ...register,
        onChange: (e) => {
          register.onChange?.(e);
          onChange?.(e);
        },
      }
    : { name, value, onChange };

  // Style presets per variant
  const styles = {
    default: {
      label: "mb-1 text-[11px] font-semibold text-darkgray",
      input: `bg-light-gray border border-bordergray text-[11px] text-darkgray rounded-md px-3 py-2 w-full focus:outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-300 placeholder-gray-400`,
      select: `bg-light-gray border border-bordergray text-[11px] text-darkgray rounded-md px-3 py-2 w-full focus:outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-300 appearance-none`,
      textarea: `bg-light-gray border border-bordergray text-[11px] text-darkgray rounded-md px-3 py-2 w-full focus:outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-300 placeholder-gray-400 resize-none`,
      error: "text-red-500 text-[10px] mt-1",
      errorInput: "border-red-500 focus:border-red-500 focus:ring-red-500",
      iconRight: "absolute right-2.5 text-gray-400",
      iconLeft: "",
    },
    auth: {
      label: "block text-[13px] font-bold text-midgray ml-1",
      input: `box-border w-full border border-x-3 border-y-0 bg-white text-midgray text-[14px] rounded-full h-[48px] px-4 focus:outline-none focus:ring-2 transition-all placeholder-placeholder`,
      select: `box-border w-full border border-x-3 border-y-0 bg-white text-midgray text-[14px] rounded-full h-[48px] px-4 focus:outline-none focus:ring-2 transition-all appearance-none`,
      textarea: `box-border w-full border border-x-3 border-y-0 bg-white text-midgray text-[14px] rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 transition-all placeholder-placeholder resize-none`,
      error: "text-red-500 text-[11px] pl-4",
      errorInput: "border-red-300 focus:ring-red-100",
      noErrorInput: "border-border focus:border-purple focus:ring-purple/10",
      iconRight: "absolute right-4 top-1/2 -translate-y-1/2 text-text-subtle",
      iconLeft:
        "absolute left-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-text-subtle",
    },
  };

  const s = styles[variant] || styles.default;

  const getInputErrorClass = () => {
    if (variant === "auth") {
      return hasError ? s.errorInput : s.noErrorInput;
    }
    return hasError ? s.errorInput : "";
  };

  // Padding adjustments for icons and suffixes
  const getInputPadding = () => {
    let padding = "";
    if (variant === "auth") {
      const left = LeftIcon ? "pl-11" : "";
      const right = rightElement || Icon ? "pr-12" : "";
      padding = `${left} ${right}`;
    } else {
      padding = Icon ? "pr-8" : "";
    }
    if (suffix) {
      padding += " pr-14";
    }
    return padding;
  };

  return (
    <div className={`flex flex-col ${className}`}>
      {label && <label className={s.label}>{label}</label>}

      <div className="relative flex items-center">
        {/* Left icon (auth variant) */}
        {variant === "auth" && LeftIcon && (
          <div className={s.iconLeft}>
            <LeftIcon size={18} strokeWidth={2} />
          </div>
        )}

        {type === "select" ? (
          <select
            {...controlProps}
            className={`${s.select} ${getInputErrorClass()}`}
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: "right 0.5rem center",
              backgroundRepeat: "no-repeat",
              backgroundSize: "1.2em 1.2em",
              paddingRight: "1.5rem",
            }}
            {...rest}
          >
            <option value="" disabled className="text-gray-400">
              {placeholder || `Select ${label}`}
            </option>
            {options.map((opt, idx) => (
              <option key={idx} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : type === "textarea" ? (
          <textarea
            {...controlProps}
            rows={rows}
            placeholder={placeholder}
            className={`${s.textarea} ${getInputErrorClass()}`}
            {...rest}
          />
        ) : (
          <input
            type={type}
            {...controlProps}
            placeholder={placeholder}
            className={`${s.input} ${getInputErrorClass()} ${getInputPadding()}`}
            {...rest}
          />
        )}

        {/* Right icon (default variant) */}
        {variant === "default" &&
          type !== "textarea" &&
          type !== "select" &&
          Icon && <Icon className={s.iconRight} size={14} />}

        {/* Suffix unit */}
        {suffix && (
          <span className="absolute right-3 text-[10px] font-bold text-gray-400 pointer-events-none uppercase">
            {suffix}
          </span>
        )}

        {/* Right element (auth variant) — e.g. password toggle button */}
        {variant === "auth" && rightElement && (
          <div className={s.iconRight}>{rightElement}</div>
        )}
      </div>

      {hasError && <p className={s.error}>{error}</p>}
    </div>
  );
};

export default InputField;
