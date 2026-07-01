import { MdOutlineDashboard, MdOutlineSettings, MdOutlineReceiptLong } from "react-icons/md";
import { HiOutlineUsers } from "react-icons/hi";
import { PiSuitcaseSimpleBold, PiBriefcaseDuotone,PiUsersThreeBold  } from "react-icons/pi";
import { MdOutlineAnalytics } from "react-icons/md";
import { FaRegFileLines, FaRegHandshake } from "react-icons/fa6";
import { TbDeviceDesktopAnalytics } from "react-icons/tb";
import { MdOutlineContactSupport } from "react-icons/md";
import { PiSignOut } from "react-icons/pi";
import { LuLayers, LuMapPin, LuShoppingCart } from "react-icons/lu";

export const Menus = [
    { name: "Dashboard", icon: MdOutlineDashboard, path: "/dashboard" },
    { name: "Leads", icon: HiOutlineUsers, path: "/leads" },
    { name: "Projects", icon: PiBriefcaseDuotone, path: "/projects" },
    { name: "Site Visit", icon: LuMapPin, path: "/sitevisit" },
    { name: "Client", icon: PiUsersThreeBold, path: "/clients" },
    { name: "Deals", icon: FaRegHandshake, path: "/deals" },
    { name: "BOQ", icon: MdOutlineReceiptLong, path: "/boq" },
    { name: "Procurement", icon: LuShoppingCart, path: "/procurement" },
    { name: "Master", icon: LuLayers, path: "/master" },
    { name: "Accounts", icon: PiSuitcaseSimpleBold, path: "/accounts" },
    { name: "Pipeline", icon: TbDeviceDesktopAnalytics, path: "/pipeline" },
    { name: "Analytics", icon: MdOutlineAnalytics, path: "/analytics" },
    { name: "Reports", icon: FaRegFileLines, path: "/reports" },
];

export const SupportMenu = [
    { name: "Settings", icon: MdOutlineSettings, path: "/settings" },
    { name: "Support", icon: MdOutlineContactSupport, path: "/support" },
    { name: "Sign Out", icon: PiSignOut, path: "/signout" },
];


// Property types — shared between lead capture (dropdown) and conversion (read-only mapping)
// Now reads from the global localStorage registry so newly added types
// (from Proposal Master) are instantly available in every module.
import { getGlobalPropertyTypes } from "../data/propertyTypeStorage";

// Kept as a getter-backed constant for backwards compatibility. Every access
// returns the latest list from localStorage.
export const PROPERTY_TYPES = new Proxy([], {
    get(target, prop) {
        const live = getGlobalPropertyTypes();
        if (prop === Symbol.iterator) return live[Symbol.iterator].bind(live);
        if (prop === "length") return live.length;
        if (typeof prop === "string" && !isNaN(prop)) return live[Number(prop)];
        if (typeof live[prop] === "function") return live[prop].bind(live);
        return live[prop];
    },
});
