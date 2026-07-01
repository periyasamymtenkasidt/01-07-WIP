import React from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { LogOut } from "lucide-react";
import { clientLogout } from "../../auth/clientAuth";

const ClientSignout = () => {
  const navigate = useNavigate();
  const { client } = useOutletContext();
  const clientId = client?.clientID || "";

  const handleConfirmSignout = () => {
    clientLogout();
    navigate("/client/login", { replace: true });
  };

  const handleCancel = () => {
    if (clientId) {
      navigate(`/client-portal/${clientId}/dashboard`);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-slate-50/50">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-100/50 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.08)] p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500">
          <LogOut size={32} />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-darkgray">Confirm Sign Out</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Are you sure you want to sign out of the WIP Client Portal? You will need to enter your client credentials to access your dashboard again.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={handleCancel}
            className="w-full py-3 px-4 rounded-xl text-sm font-bold text-gray-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmSignout}
            className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 transition-colors cursor-pointer"
          >
            Yes, Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientSignout;
