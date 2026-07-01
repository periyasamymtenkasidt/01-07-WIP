import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Check,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import InputField from "../../components/InputField";
import { clientLogin } from "../../auth/clientAuth";
import { getAllClients } from "../../data/clientStorage";
// Keep existing asset paths
import Google from "../../assets/images/Google.png";
import HomePage from "../../assets/images/HomePage.png";
import wipLogo from "../../assets/images/Logo.png";

const clientLoginSchema = yup.object().shape({
  email: yup
    .string()
    .required("Email Address is required")
    .trim()
    .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"),
  password: yup
    .string()
    .required("Password is required")
    .min(6, "Password must be at least 6 characters"),
});

const ClientLogin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [keepSigned, setKeepSigned] = useState(false);
  const [loginError, setLoginError] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(clientLoginSchema),
    defaultValues: {
      email: "",
      password: "password123", // default password for ease
    },
  });

  const activeClients = getAllClients();

  const handleSelectDemo = (client) => {
    setValue("email", client.clientEmail);
    setValue("password", "password123");
    setLoginError("");
  };

  const onSubmit = (data) => {
    setLoading(true);
    setLoginError("");

    setTimeout(() => {
      const foundClient = activeClients.find(
        (c) => c.clientEmail.toLowerCase() === data.email.toLowerCase(),
      );

      if (foundClient) {
        setLoading(false);
        clientLogin(foundClient.clientID);
        navigate("/client/dashboard", { replace: true });
      } else {
        setLoading(false);
        setLoginError(
          "We couldn't find a client matching this email address. Please click one of the quick-login client cards below.",
        );
      }
    }, 1200);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f4f6f9] p-4 sm:p-8 font-sans">
      {/* Main Container */}
      <div className="relative w-full max-w-[1050px] min-h-[680px] border-22 border-[#E9E9FF] rounded-[3.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden flex">
        {/* Left Side - Image (Using object-cover for better fit) */}
        <div className="absolute left-0 top-0 w-full h-full z-0 hidden md:block">
          <img
            src={HomePage}
            alt="Abstract 3D Art"
            className="w-[85%] h-full object-contain object-left opacity-70"
          />
        </div>

        {/* Structural Spacer */}
        <div className="hidden md:block w-[45%] h-full z-0"></div>

        {/* Right Side - Form Panel */}
        <div className="w-full md:w-[55%] min-h-full z-10 flex flex-col justify-center px-8 sm:px-12 lg:px-16 py-10 bg-[#E9E9FF]/40 backdrop-blur-xl border-l border-white/80 shadow-[-20px_0_40px_rgba(0,0,0,0.06)] rounded-r-[2.2rem]">
          <div className="w-full max-w-[380px] mx-auto">
            {/* Back to Studio Login Link */}
            <button
              onClick={() => navigate("/login")}
              className="mb-5 flex items-center gap-1.5 text-[12px] font-bold text-grey hover:text-purple transition-colors cursor-pointer group"
            >
              <ArrowLeft
                size={14}
                className="group-hover:-translate-x-0.5 transition-transform"
              />
              Go back to Studio Portal
            </button>

            {/* WIP editorial mark */}
            <div className="mb-6 flex items-center gap-3">
              <img
                src={wipLogo}
                alt="WIP"
                className="h-9 w-auto object-contain"
                style={{
                  filter:
                    "contrast(1.2) saturate(1.1) drop-shadow(0 1px 1px rgba(139, 105, 20, 0.15))",
                }}
              />
              <div className="flex flex-col leading-none border-l border-paleorange/40 pl-3">
                <p className="text-[9px] uppercase tracking-[0.4em] text-dark-yellow font-bold leading-none">
                  Client Portal
                </p>
                <p className="text-[9px] uppercase tracking-[0.4em] text-text-subtle font-semibold mt-1.5 leading-none">
                  Interiors · Chennai
                </p>
              </div>
            </div>

            {/* Header */}
            <div className="mb-6 text-left">
              <h1 className="text-[28px] font-bold text-textcolor tracking-tight mb-1">
                Your Workspace
              </h1>
              <p className="text-[13.5px] text-text-muted leading-relaxed">
                Log in to view project milestones, 3D renders, drawings, and pay
                invoices.
              </p>
            </div>

            {/* Form Error Alert */}
            {loginError && (
              <div className="mb-5 p-3 text-[12px] font-medium text-red-600 bg-red-50 border border-red-200 rounded-2xl">
                {loginError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Email Input */}
              <InputField
                label="Client Registered Email"
                name="email"
                type="email"
                placeholder="name@gmail.com"
                register={register("email")}
                error={errors.email?.message}
                variant="auth"
                leftIcon={Mail}
              />

              {/* Password Input */}
              <div className="space-y-1">
                <InputField
                  label="Password"
                  name="password"
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  register={register("password")}
                  error={errors.password?.message}
                  variant="auth"
                  leftIcon={Lock}
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="text-text-subtle hover:text-purple transition-colors cursor-pointer"
                    >
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  }
                />
                <div className="flex justify-between items-center pt-1 px-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={keepSigned}
                        onChange={(e) => setKeepSigned(e.target.checked)}
                        className="peer appearance-none w-4 h-4 border border-placeholder rounded-[4px] checked:bg-purple checked:border-purple transition-all bg-white"
                      />
                      <Check
                        className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
                        strokeWidth={4}
                      />
                    </div>
                    <span className="text-[12px] font-semibold text-text-muted select-none">
                      Remember me
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => navigate("/client/forgot-password")}
                    className="text-[12px] font-bold text-grey hover:text-purple cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full h-[48px] rounded-full text-[14px] font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  loading
                    ? "bg-purple/80 cursor-not-allowed"
                    : "bg-purple hover:bg-dark-blue active:scale-[0.99]"
                }`}
              >
                {loading && <Loader2 className="animate-spin h-5 w-5" />}
                <span>{loading ? "Verifying access..." : "Access Portal"}</span>
              </button>
            </form>

            {/* Quick Demo Clients Select */}
            <div className="mt-6 border-t border-border/60 pt-5">
              <p className="text-[10px] uppercase font-bold tracking-widest text-text-subtle mb-3 text-center">
                Demo Accounts for Testing
              </p>
              <div className="grid grid-cols-2 gap-2">
                {activeClients.slice(0, 2).map((c) => (
                  <button
                    key={c.clientID}
                    type="button"
                    onClick={() => handleSelectDemo(c)}
                    className="p-2.5 rounded-2xl bg-white border border-border/60 hover:border-paleorange hover:bg-palewhite transition-all text-left flex flex-col justify-between cursor-pointer group shadow-sm"
                  >
                    <span className="text-[11.5px] font-bold text-darkgray group-hover:text-purple truncate w-full">
                      {c.clientName}
                    </span>
                    <span className="text-[9.5px] text-text-muted truncate w-full mt-0.5">
                      {c.clientEmail}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientLogin;
