import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { IoMdNotificationsOutline } from "react-icons/io";
import wipLogo from "../../assets/images/Logo.png";
import ClientAvatar from "../../assets/images/Client_avatar.png";

const Header = ({
  client,
  clientId,
  notifications,
  markAllNotificationsAsRead,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center bg-surface mx-4 my-2 rounded-lg shadow-xs">
      <div className="wip-glass relative overflow-hidden rounded-xl px-4 py-2 flex gap-3.5 items-center transition-transform duration-300 hover:scale-[1.02]">
        {/* Animated shimmer sweep */}
        <span
          aria-hidden="true"
          className="wip-shimmer pointer-events-none absolute inset-y-0 left-0 w-2/3 -skew-x-12"
        />
        <img
          src={wipLogo}
          alt="WIP"
          className="relative h-13 w-auto object-contain shrink-0"
          style={{
            height: "52px",
            filter:
              "contrast(1.25) saturate(1.15) drop-shadow(0 1px 1.5px rgba(139, 105, 20, 0.18))",
          }}
        />
        <div className="relative hidden sm:flex flex-col leading-none border-l border-paleorange/50 pl-3 py-1">
          <p className="text-[9px] uppercase tracking-[0.45em] text-dark-yellow font-bold leading-none">
            Architecture
          </p>
          <p className="text-[9px] uppercase tracking-[0.45em] text-dark-yellow font-bold mt-1.5 leading-none">
            Interiors
          </p>
          <p className="text-[7px] uppercase tracking-[0.35em] text-text-subtle mt-2 leading-none">
            Chennai
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Notification Bell Dropdown */}
        <div className="relative">
          <IoMdNotificationsOutline
            size={30}
            className="bg-bg-soft rounded-full p-1 text-textcolor cursor-pointer"
            onClick={() => setShowNotifications(!showNotifications)}
          />
          {notifications.some((n) => !n.read) && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
          )}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-bordergray rounded-2xl shadow-xl z-50 p-4 text-left max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 mb-3">
                <h4 className="text-xs font-bold text-darkgray uppercase tracking-wider">Notifications</h4>
                {notifications.some((n) => !n.read) && (
                  <button
                    onClick={() => markAllNotificationsAsRead()}
                    className="text-[10px] font-bold text-purple hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No notifications yet</p>
              ) : (
                <div className="space-y-3">
                  {notifications.map((n) => (
                    <div key={n.id} className={`flex gap-3 p-2 rounded-xl transition-colors hover:bg-slate-50 ${!n.read ? "bg-blue-50/30" : ""}`}>
                      <div className="mt-0.5 shrink-0">
                        {n.type === "success" && <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />}
                        {n.type === "upload" && <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />}
                        {n.type === "approval" && <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5" />}
                        {n.type === "info" && <div className="w-2 h-2 rounded-full bg-slate-400 mt-1.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-darkgray truncate">{n.title}</p>
                        <p className="text-[11px] text-gray-500 leading-snug mt-0.5 whitespace-pre-wrap">{n.text}</p>
                        <p className="text-[9px] text-gray-400 mt-1 font-semibold">{n.timestamp}</p>
                      </div>
                      {!n.read && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 self-start shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-l border-border h-7.5" />

        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-textcolor">{client.clientName}</p>
          <p className="text-xs text-text-muted">Client ID: {client.clientID}</p>
        </div>

        {/* Profile Dropdown */}
        <div className="relative">
          <img
            src={ClientAvatar}
            alt="Client Avatar"
            className="h-9 w-9 sm:h-10 sm:w-10 cursor-pointer rounded-full object-cover"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          />
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-bordergray rounded-xl shadow-lg py-1 z-50 animate-fade-in text-left">
              <NavLink
                to={`/client-portal/${clientId}/profile`}
                className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-bg-soft font-semibold"
                onClick={() => setShowProfileMenu(false)}
              >
                View Profile
              </NavLink>
              <NavLink
                to={`/client-portal/${clientId}/signout`}
                onClick={() => setShowProfileMenu(false)}
                className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2 cursor-pointer font-semibold block"
              >
                Sign Out
              </NavLink>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;
