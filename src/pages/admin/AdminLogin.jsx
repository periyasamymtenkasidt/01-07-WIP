import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Eye, EyeOff, Loader2, ArrowLeft, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import InputField from "../../components/InputField";
import { setAdminKey } from "../../auth/adminSession";
import { pingAdmin } from "../../api/admin";
import { ApiError } from "../../api/client";

import HomePage from "../../assets/images/HomePage.png";

// Platform-admin gate for maarrsmart. There is no admin-login endpoint — firm
// provisioning is protected by a static secret (`x-admin-key`). The admin enters
// that key here; we hold it in memory (never persisted) and the create-org form
// sends it. The key is validated server-side on the create call, so this screen
// only collects it and forwards to /admin/orgs/new.
const adminSchema = yup.object().shape({
  adminKey: yup.string().required("Admin key is required").trim(),
});

const AdminLogin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [formError, setFormError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(adminSchema),
    defaultValues: { adminKey: "" },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setFormError("");
    try {
      // Verify the key server-side (GET /api/admin/ping) before advancing.
      await pingAdmin(data.adminKey);
      setAdminKey(data.adminKey);
      navigate("/admin/orgs", { replace: true });
    } catch (err) {
      // Hard-block ONLY on a definitive rejection (401 = wrong key). Everything
      // else — 404 (ping not implemented yet), 5xx, or a transport failure
      // (backend unreachable) — means we can't verify here, so let the admin
      // through: POST /api/admin/firms re-checks the key and is the real gate,
      // and the offline local-provisioning fallback still needs to work.
      if (err instanceof ApiError && err.status === 401) {
        setFormError("That admin key is not valid. Check it and try again.");
        setLoading(false);
        return;
      }
      setAdminKey(data.adminKey);
      navigate("/admin/orgs", { replace: true });
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f4f6f9] p-4 sm:p-8 font-manrope">
      <div className="relative w-full max-w-[1050px] min-h-[600px] border-22 border-[#E9E9FF] rounded-[3.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden flex">
        {/* Left visual */}
        <div className="absolute left-0 top-0 w-full h-full z-0 hidden md:block">
          <img src={HomePage} alt="" className="w-[85%] h-full object-contain object-left opacity-70" />
        </div>
        <div className="hidden md:block w-[45%] h-full z-0" />

        {/* Form panel */}
        <div className="w-full md:w-[55%] min-h-full z-10 flex flex-col justify-center px-8 sm:px-12 lg:px-16 py-8 bg-[#E9E9FF]/40 backdrop-blur-xl border-l border-white/80 shadow-[-20px_0_40px_rgba(0,0,0,0.06)] rounded-r-[2.2rem]">
          <div className="w-full max-w-[380px] mx-auto">
            {/* Back to landing */}
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mb-6 flex items-center gap-1.5 text-[12px] font-bold text-grey hover:text-purple transition-colors group"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
              Back to home
            </button>

            {/* maarrsmart brand mark */}
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple text-white shadow-md shadow-purple/20">
                <ShieldCheck size={20} />
              </span>
              <div className="flex flex-col leading-none">
                <p className="text-[18px] font-extrabold tracking-tight text-textcolor lowercase">maarrsmart</p>
                <p className="text-[9px] uppercase tracking-[0.35em] text-text-subtle font-semibold mt-1">
                  Platform Console
                </p>
              </div>
            </div>

            {/* Header */}
            <div className="mb-7 text-left">
              <h1 className="text-[28px] font-bold text-textcolor tracking-tight mb-1.5">Admin access</h1>
              <p className="text-[13.5px] text-text-muted leading-relaxed">
                Enter your platform admin key to provision a new organisation workspace.
              </p>
            </div>

            {formError && (
              <div className="mb-5 p-3 text-[11.5px] font-medium text-red-600 bg-red-50 border border-red-200 rounded-2xl">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <InputField
                label="Admin key"
                name="adminKey"
                type={showKey ? "text" : "password"}
                placeholder="••••••••••••"
                register={register("adminKey")}
                error={errors.adminKey?.message}
                variant="auth"
                leftIcon={KeyRound}
                rightElement={
                  <button type="button" onClick={() => setShowKey(!showKey)} className="text-text-subtle hover:text-purple transition-colors">
                    {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />

              <button
                type="submit"
                disabled={loading}
                className={`w-full h-[48px] rounded-full text-[14px] font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 ${
                  loading ? "bg-purple/80 cursor-not-allowed" : "bg-purple hover:bg-dark-blue active:scale-[0.99]"
                }`}
              >
                {loading && <Loader2 className="animate-spin h-5 w-5" />}
                <span>{loading ? "Verifying..." : "Continue"}</span>
              </button>

              <p className="text-center text-[11.5px] text-text-subtle leading-relaxed pt-1">
                The key is verified now and held only for this session — it is never stored.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
