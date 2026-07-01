import React from "react";
import { useOutletContext } from "react-router-dom";
import { Mail, Phone, MapPin, User, ShieldCheck } from "lucide-react";
import { RiMoneyRupeeCircleFill } from "react-icons/ri";
import { FaWhatsapp } from "react-icons/fa6";
import ClientAvatar from "../../assets/images/Client_avatar.png";

const ClientProfilePage = () => {
  const { client, associatedLead } = useOutletContext();

  const getStatusStyle = (status) => {
    const s = status?.toLowerCase();
    if (s === "pending") return "bg-[#FFF4E5] text-pending border-[#FFEDD5]";
    if (s === "completed") return "bg-[#E6F4EA] text-[#16A34A] border-[#DCFCE7]";
    return "bg-gray-100 text-gray-600 border-gray-200";
  };

  const isConverted = !!client.sourceLeadId;

  // Map values robustly checking both formats (Admin Portal & Client Portal schema)
  const phoneVal = client.clientPhone || client.phone || "—";
  const emailVal = client.clientEmail || client.email || "—";
  const presetVal = client.quotePreset || associatedLead?.quotePreset || "2BHK";
  const typeVal = client.propertyType || associatedLead?.propertyType || client.location || "Apartment";
  const locationVal = client.locationSecondary || client.siteAddress || "—";
  const budgetVal = client.budget || "—";

  return (
    <div className="p-6 sm:p-10 text-left flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-8">
        {/* Left Card: Profile Image & Actions */}
        <div className="w-full md:w-2/5 shrink-0">
          <div className="bg-white rounded-3xl p-8 border border-bordergray shadow-sm flex flex-col items-center text-center">
            <div className="relative mb-6">
              <img
                src={ClientAvatar}
                alt="Client Avatar"
                className="w-32 h-32 rounded-full border-4 border-white shadow-lg object-cover"
              />
              <span className="absolute bottom-2 right-2 w-4 h-4 bg-emerald-500 border-4 border-white rounded-full" />
            </div>

            <h2 className="text-2xl font-bold text-darkgray tracking-tight mb-1">
              {client.clientName}
            </h2>
            <p className="text-xs text-text-subtle mb-4 font-mono font-semibold">
              ID: {client.clientID}
            </p>

            <span
              className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusStyle(
                client.paymentStatus || "pending"
              )}`}
            >
              {client.paymentStatus || "PENDING"}
            </span>

            {isConverted && (
              <span className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-select-blue justify-center">
                <ShieldCheck size={14} /> Converted from Lead
              </span>
            )}

            {client.joinDate && (
              <p className="mt-2 text-xs text-text-muted">
                Client since {client.joinDate}
              </p>
            )}

            {/* Quick Contacts */}
            <div className="w-full mt-8 pt-6 border-t border-bordergray flex flex-col gap-3">
              <a
                href={`tel:${phoneVal.replace(/\s+/g, "")}`}
                className="w-full py-3 bg-white border border-bordergray hover:border-select-blue hover:text-select-blue text-gray-500 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                <Phone size={16} /> Call Client
              </a>
              <div className="flex gap-3 w-full">
                <a
                  href={`https://wa.me/${phoneVal.replace(/\s+/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-3 bg-palewhite hover:bg-bg-soft text-gray-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-transparent hover:border-gray-200"
                >
                  <FaWhatsapp size={15} /> WhatsApp
                </a>
                <a
                  href={`mailto:${emailVal}`}
                  className="flex-1 py-3 bg-palewhite hover:bg-bg-soft text-gray-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-transparent hover:border-gray-200"
                >
                  <Mail size={15} /> Email
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Profile Details */}
        <div className="flex-1">
          <div className="bg-white rounded-3xl p-8 border border-bordergray shadow-sm h-full">
            <h3 className="text-lg font-bold text-darkgray border-b border-bordergray pb-4 mb-6">
              Profile Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                { label: "Phone Number", value: phoneVal, icon: Phone },
                { label: "Email Address", value: emailVal, icon: Mail },
                { label: "Property Preset", value: presetVal, icon: User },
                { label: "Property Type", value: typeVal, icon: User },
                { label: "Location / City", value: locationVal, icon: MapPin },
                { label: "Budget", value: budgetVal, icon: RiMoneyRupeeCircleFill },
              ].map(({ label, value, icon: Icon }, idx) => (
                <div key={idx} className="p-4 bg-bg-soft rounded-2xl border border-bordergray/30 flex flex-col text-left">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                    {Icon && <Icon size={11} />}
                    {label}
                  </span>
                  <p className="text-sm font-bold text-darkgray truncate">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientProfilePage;
