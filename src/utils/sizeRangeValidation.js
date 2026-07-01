// Size Range field validation and utility functions

/**
 * Clean a size range string by removing all units ("sq ft", "sqft"),
 * spaces, alphabetic characters, and unsupported special characters,
 * normalizes hyphens, and returns only digits, a single hyphen, or a single plus.
 */
export const cleanSizeRange = (val) => {
  if (val === undefined || val === null) return "";
  let clean = String(val);
  // Replace U+2010 to U+2015, and en-dash (U+2013), em-dash (U+2014) with standard hyphen U+002D
  clean = clean.replace(/[\u2010-\u2015\u2013\u2014]/g, "-");
  // Remove "sq ft", "sqft" etc. case insensitively
  clean = clean.replace(/\s*(sq\s*ft|sqft)\b/gi, "");
  // Keep only digits, hyphens, and plus signs
  clean = clean.replace(/[^0-9-+]/g, "");
  // Replace multiple consecutive hyphens with a single hyphen
  clean = clean.replace(/-+/g, "-");
  // Replace multiple consecutive plus signs with a single plus sign
  clean = clean.replace(/\++/g, "+");
  return clean.trim();
};

/**
 * Validate a cleaned or raw size range input.
 * Returns an error message string if invalid, or an empty string if valid.
 */
export const validateSizeRangeInput = (val) => {
  if (!val) return "";
  
  // If there's any alphabetical character or unsupported special characters
  if (/[a-zA-Z]/.test(val)) {
    return "Alphabetic characters are not allowed.";
  }
  
  if (/[^0-9-+]/.test(val)) {
    return "Special characters other than '-' and '+' are not permitted.";
  }

  // Count hyphens
  const hyphenCount = (val.match(/-/g) || []).length;
  if (hyphenCount > 1) {
    return "Multiple hyphens are not allowed.";
  }

  // Count pluses
  const plusCount = (val.match(/\+/g) || []).length;
  if (plusCount > 1) {
    return "Multiple '+' symbols are not allowed.";
  }

  // If both hyphen and plus exist, it's invalid
  if (hyphenCount > 0 && plusCount > 0) {
    return "Cannot have both a hyphen and a '+' symbol.";
  }

  // If '+' exists, it must be at the end only
  if (plusCount === 1 && !/\+$/.test(val)) {
    return "The '+' symbol must only be at the end.";
  }

  // Valid formats: e.g. "500", "100-200", "500+", "100-" (transient)
  const isValid = /^\d+$/.test(val) || /^\d+-$/.test(val) || /^\d+-\d+$/.test(val) || /^\d+\+$/.test(val);
  if (!isValid) {
    return "Please enter a valid format (e.g. 1000-1500 or 2490+).";
  }

  return "";
};

/**
 * Format a size range with the static "Sq Ft" unit for UI display and PDFs.
 * If input is null/empty, returns "—".
 */
export const formatSizeRange = (val) => {
  if (!val) return "—";
  const cleaned = cleanSizeRange(val);
  if (!cleaned) return "—";
  return `${cleaned} Sq Ft`;
};
