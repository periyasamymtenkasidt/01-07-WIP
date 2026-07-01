import React from "react";
import { NavLink } from "react-router-dom";
import { MdOutlineDashboard, MdOutlineReceiptLong, MdOutlineContactSupport } from "react-icons/md";
import { RiMoneyRupeeCircleFill } from "react-icons/ri";
import { LuMapPin } from "react-icons/lu";
import { PiUsersThreeBold, PiSignOut } from "react-icons/pi";
import { FileText, Image as ImageIcon } from "lucide-react";

const Sidebar = ({ clientId }) => {
  // Define client sidebar module menus
  const clientModules = [
    { id: "dashboard", label: "Dashboard", icon: MdOutlineDashboard, path: "dashboard" },
    { id: "milestones", label: "Payment Milestones", icon: RiMoneyRupeeCircleFill, path: "payment-milestones" },
    { id: "quotes", label: "Project Quotes", icon: MdOutlineReceiptLong, path: "project-quotes" },
    { id: "appointments", label: "Site Visit and Calendar", icon: LuMapPin, path: "site-visits-calendar" },
    { id: "gallery", label: "Designs and Renders", icon: ImageIcon, path: "designs-renders" },
    { id: "invoices", label: "Invoice", icon: FileText, path: "gst-invoice" },
    { id: "profile", label: "Profile", icon: PiUsersThreeBold, path: "profile" },
  ];

  const supportModules = [
    { id: "support", label: "Support", icon: MdOutlineContactSupport, path: "support-chat" },
    { id: "signout", label: "Sign Out", icon: PiSignOut, path: "signout" },
  ];

  const renderItem = (item) => {
    const Icon = item.icon;
    const isButton = !!item.onClick;

    const classStr = (isActive) =>
      `flex flex-col md:flex-row items-center gap-1 md:gap-3 px-2 md:px-3 py-2 rounded-lg mb-1 md:mb-2 transition-colors cursor-pointer w-full text-left ${
        isActive
          ? "bg-active-bg text-select-blue md:border-r-4 md:border-select-blue font-semibold"
          : "text-grey hover:bg-active-bg hover:text-darkgray"
      }`;

    if (isButton) {
      return (
        <button
          key={item.id}
          onClick={item.onClick}
          className={classStr(false)}
          title={item.label}
        >
          <Icon size={20} className="shrink-0" />
          <span className="text-[9px] leading-tight text-center md:text-sm md:leading-normal md:text-left whitespace-nowrap">
            {item.label}
          </span>
        </button>
      );
    }

    return (
      <NavLink
        key={item.id}
        to={`/client-portal/${clientId}/${item.path}`}
        className={({ isActive }) => classStr(isActive)}
        title={item.label}
      >
        <Icon size={20} className="shrink-0" />
        <span className="text-[9px] leading-tight text-center md:text-sm md:leading-normal md:text-left whitespace-nowrap">
          {item.label}
        </span>
      </NavLink>
    );
  };

  return (
    <div className="flex flex-col justify-between min-h-full p-3 md:p-4 w-20 md:w-64">
      <div>
        {clientModules.map(renderItem)}
      </div>
      <div>
        {supportModules.map(renderItem)}
      </div>
    </div>
  );
};

export default Sidebar;
