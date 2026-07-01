// Vendor master — suppliers used on purchase orders. Lives inside the
// Procurement module (its own tab). Global list, not per-contract.

const KEY = "vendor_master";

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

const genId = () =>
  `ven_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const DEFAULT_VENDORS = [
  {
    id: "ven_default_1",
    name: "Greenply Distributors",
    category: "Plywood & Laminates",
    contactPerson: "Ravi Kumar",
    email: "accounts@greenplydist.example",
    gstin: "29ABCDE1234F1Z5",
    pan: "ABCDE1234F",
    phone: "98450 11223",
    address: "Peenya, Bengaluru",
    msmeRegistered: true,
    msmeCategory: "Small",
    udyamNumber: "UDYAM-KR-03-0012345",
    tdsSection: "194Q",
    tdsRate: 0.1,
    bankName: "HDFC Bank",
    bankAccountNumber: "50100123456789",
    bankIfsc: "HDFC0001234",
    bankAccountHolder: "Greenply Distributors",
    creditDays: 30,
    deliveryLeadDays: 7,
    qualityTerms: "Material must match approved sample/spec sheet; defective batches replaced at vendor cost.",
    penaltyTerms: "0.5% of PO value per week of delay, capped at 5%.",
    contractValidTill: "",
    materialIds: ["mat_default_0", "mat_default_1"],
  },
  {
    id: "ven_default_2",
    name: "Hafele India",
    category: "Hardware & Fittings",
    contactPerson: "Sandeep Shah",
    email: "sales@hafele.example",
    gstin: "27HAFEL5678H1Z2",
    pan: "HAFEL5678H",
    phone: "98670 44556",
    address: "Andheri, Mumbai",
    msmeRegistered: false,
    msmeCategory: "",
    udyamNumber: "",
    tdsSection: "194Q",
    tdsRate: 0.1,
    bankName: "ICICI Bank",
    bankAccountNumber: "00201234567",
    bankIfsc: "ICIC0000020",
    bankAccountHolder: "Hafele India Pvt Ltd",
    creditDays: 45,
    deliveryLeadDays: 14,
    qualityTerms: "All hardware carries manufacturer warranty; non-conforming items returned within 30 days.",
    penaltyTerms: "1% of PO value per week of delay, capped at 10%.",
    contractValidTill: "",
    materialIds: ["mat_default_6"],
  },
  {
    id: "ven_default_3",
    name: "Jaquar Sanitaryware",
    category: "Bath & Sanitary",
    contactPerson: "Anita Verma",
    email: "orders@jaquar.example",
    gstin: "06JAQUA9012J1Z9",
    pan: "JAQUA9012J",
    phone: "99100 77889",
    address: "Manesar, Gurugram",
    msmeRegistered: true,
    msmeCategory: "Medium",
    udyamNumber: "UDYAM-HR-12-0067890",
    tdsSection: "194Q",
    tdsRate: 0.1,
    bankName: "Axis Bank",
    bankAccountNumber: "91201234567890",
    bankIfsc: "UTIB0000091",
    bankAccountHolder: "Jaquar Sanitaryware Ltd",
    creditDays: 30,
    deliveryLeadDays: 10,
    qualityTerms: "ISI-marked fittings only; on-site replacement for any leak/defect within warranty.",
    penaltyTerms: "0.5% of PO value per week of delay, capped at 5%.",
    contractValidTill: "",
    materialIds: [],
  },
];

export const TDS_SECTIONS = [
  { code: "", label: "Not applicable" },
  { code: "194C", label: "194C — Contractors" },
  { code: "194J", label: "194J — Professional / Technical fees" },
  { code: "194Q", label: "194Q — Purchase of goods" },
  { code: "194I", label: "194I — Rent" },
];

export const MSME_CATEGORIES = ["Micro", "Small", "Medium"];

export const listVendors = () => {
  const stored = localStorage.getItem(KEY);
  if (!stored) {
    localStorage.setItem(KEY, JSON.stringify(DEFAULT_VENDORS));
    return DEFAULT_VENDORS;
  }
  return readJson(KEY, DEFAULT_VENDORS);
};

export const getVendor = (id) => listVendors().find((v) => v.id === id) || null;

const writeAll = (list) => {
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
};

export const addVendor = (vendor) => {
  const v = {
    id: genId(),
    name: vendor.name || "",
    category: vendor.category || "",
    contactPerson: vendor.contactPerson || "",
    email: vendor.email || "",
    gstin: vendor.gstin || "",
    pan: vendor.pan || "",
    phone: vendor.phone || "",
    address: vendor.address || "",
    msmeRegistered: !!vendor.msmeRegistered,
    msmeCategory: vendor.msmeRegistered ? vendor.msmeCategory || "" : "",
    udyamNumber: vendor.msmeRegistered ? vendor.udyamNumber || "" : "",
    tdsSection: vendor.tdsSection || "",
    tdsRate: Number(vendor.tdsRate) || 0,
    bankName: vendor.bankName || "",
    bankAccountNumber: vendor.bankAccountNumber || "",
    bankIfsc: vendor.bankIfsc || "",
    bankAccountHolder: vendor.bankAccountHolder || "",
    creditDays: Number(vendor.creditDays) || 0,
    deliveryLeadDays: Number(vendor.deliveryLeadDays) || 0,
    qualityTerms: vendor.qualityTerms || "",
    penaltyTerms: vendor.penaltyTerms || "",
    contractValidTill: vendor.contractValidTill || "",
    materialIds: Array.isArray(vendor.materialIds) ? vendor.materialIds : [],
    createdAt: new Date().toISOString(),
  };
  writeAll([v, ...listVendors()]);
  return v;
};

export const updateVendor = (id, changes) => {
  const next = listVendors().map((v) => (v.id === id ? { ...v, ...changes } : v));
  writeAll(next);
  return next.find((v) => v.id === id) || null;
};

export const deleteVendor = (id) => writeAll(listVendors().filter((v) => v.id !== id));
