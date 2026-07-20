import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Menus, SupportMenu } from "../helperConfigData/helperData";
import { logout } from "../auth/auth";
import { FiLogOut, FiX } from "react-icons/fi";
import { PiSignOut } from "react-icons/pi";

const linkClass = ({ isActive }) =>
  `flex flex-col md:flex-row items-center md:items-center gap-1 md:gap-3
   px-2 md:px-3 py-2 rounded-lg mb-1 md:mb-2 transition-colors
   ${
     isActive
       ? "bg-active-bg text-select-blue md:border-r-4 md:border-select-blue"
       : "text-grey hover:bg-active-bg"
   }`;

const SignOutConfirmModal = ({ onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
    <div className="bg-white rounded-[20px] font-manrope shadow-2xl w-full max-w-[400px] p-8 relative text-center">
      <button
        onClick={onCancel}
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors cursor-pointer"
      >
        <FiX size={16} />
      </button>

      <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-5">
        <FiLogOut size={24} />
      </div>

      <h2 className="text-[20px] font-bold text-darkgray mb-2">Sign Out</h2>
      <p className="text-[13px] text-text-muted mb-8">
        Are you sure you want to sign out? Your data will be saved.
      </p>

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-bordergray text-[13px] font-semibold text-grey hover:bg-gray-50 transition-all cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition-all cursor-pointer shadow-sm"
        >
          Sign Out
        </button>
      </div>
    </div>
  </div>
);

const Sidebar = () => {
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  const handleConfirm = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const renderItem = (item) => {
    const Icon = item.icon;

    if (item.path === "/signout") {
      return (
        <button
          key={item.path}
          onClick={() => setShowConfirm(true)}
          title={item.name}
          className="flex flex-col md:flex-row items-center md:items-center gap-1 md:gap-3 px-2 md:px-3 py-2 rounded-lg mb-1 md:mb-2 transition-colors text-grey hover:bg-active-bg w-full text-left cursor-pointer"
        >
          <PiSignOut size={20} />
          <span className="text-[9px] leading-tight text-center md:text-sm md:leading-normal md:text-left">
            {item.name}
          </span>
        </button>
      );
    }

    return (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.path === "/dashboard"}
        title={item.name}
        className={linkClass}
      >
        <Icon size={20} />
        <span className="text-[9px] leading-tight text-center md:text-sm md:leading-normal md:text-left">
          {item.name}
        </span>
      </NavLink>
    );
  };

  return (
    <>
      <div className="flex flex-col justify-between min-h-full p-3 md:p-4 w-20 md:w-64">
        <div>{Menus.map(renderItem)}</div>
        <div>{SupportMenu.map(renderItem)}</div>
      </div>

      {showConfirm && (
        <SignOutConfirmModal
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
};

export default Sidebar;
