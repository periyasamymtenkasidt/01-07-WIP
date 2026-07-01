// Format an INR amount into a compact display string.
//   ≥ 1 Cr → "₹1.20 Cr"
//   ≥ 1 L  → "₹7.5L"
//   else   → "₹75,000"
// Returns "—" for 0 / null / negative inputs.
export const formatAmount = (amount) => {
  if (!amount || amount <= 0) return "—";
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  return `₹${amount.toLocaleString("en-IN")}`;
};
