// Convert a numeric amount to its Indian-numbering-system word form
// (Crore / Lakh / Thousand / Hundred). Used in BOQ / invoice prints where
// "Amount in words" is a contractual requirement.

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

// Convert a 0–99 number to words.
const twoDigits = (n) => {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o === 0 ? TENS[t] : `${TENS[t]} ${ONES[o]}`;
};

// Convert a 0–999 number to words.
const threeDigits = (n) => {
  if (n < 100) return twoDigits(n);
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return rest === 0 ? `${ONES[h]} Hundred` : `${ONES[h]} Hundred ${twoDigits(rest)}`;
};

// Main entry: amount → "Rupees ... Only" (with paise if non-zero).
export const inrToWords = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value === 0) return "Zero Rupees Only";
  if (value < 0) return `Minus ${inrToWords(-value)}`;

  const rupees = Math.floor(value);
  const paise = Math.round((value - rupees) * 100);

  const parts = [];
  let n = rupees;

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = n;

  if (crore > 0) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh > 0) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred > 0) parts.push(threeDigits(hundred));

  let result = `Rupees ${parts.join(" ")}`;
  if (paise > 0) {
    result += ` and ${twoDigits(paise)} Paise`;
  }
  return `${result} Only`;
};
