import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, Loader2, Check, ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import InputField from "../../components/InputField";
import { loginStaff } from "../../auth/auth";
import { clientLogin } from "../../auth/clientAuth";
import { getAllClients } from "../../data/clientStorage";
// Keep your existing asset paths
import Google from "../../assets/images/Google.png";
import HomePage from "../../assets/images/HomePage.png";
import wipLogo from "../../assets/images/Logo.png";

// Validation schema for admin login
const adminLoginSchema = yup.object().shape({
  email: yup
    .string()
    .required("Email Address is required")
    .trim()
    .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"),
  // Backend is the source of truth for credentials now — keep client-side
  // validation to "present" so any valid backend password is accepted.
  password: yup.string().required("Password is required"),
});

// Validation schema for client login
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

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Detect initial login type from path
  const isClientPath = location.pathname.startsWith("/client");
  const [loginType, setLoginType] = useState(isClientPath ? "client" : "admin");

  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [keepSigned, setKeepSigned] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Admin form hook
  const {
    register: registerAdmin,
    handleSubmit: handleSubmitAdmin,
    formState: { errors: errorsAdmin },
  } = useForm({
    resolver: yupResolver(adminLoginSchema),
    defaultValues: {
      // Prefill the email when arriving fresh from organisation provisioning.
      email: location.state?.email || "",
      password: "",
    },
  });

  // Success note shown after a new organisation is provisioned (redirect from
  // the admin console /admin/orgs/new).
  const justProvisioned = Boolean(location.state?.justProvisioned);
  const provisionedOrgName = location.state?.orgName || "";

  // Client form hook
  const {
    register: registerClient,
    handleSubmit: handleSubmitClient,
    formState: { errors: errorsClient },
  } = useForm({
    resolver: yupResolver(clientLoginSchema),
    defaultValues: {
      email: "",
      password: "password123",
    },
  });

  const activeClients = getAllClients();

  const handleToggle = (type) => {
    setLoginType(type);
    setLoginError("");
    setShowPass(false);
    if (type === "admin") {
      navigate("/login", { replace: true });
    } else {
      navigate("/client/login", { replace: true });
    }
  };

  const onSubmitAdmin = async (data) => {
    setLoading(true);
    setLoginError("");
    const from = location.state?.from?.pathname || "/dashboard";

    try {
      // Credentials-only: the email resolves the firm server-side and the issued
      // token carries firmId. We never send or manage firmId/x-firm-id here.
      await loginStaff({ email: data.email, password: data.password });
      navigate(from, { replace: true });
    } catch (err) {
      setLoginError(
        err?.message ||
          "We couldn't sign you in. Check your email and password and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const onSubmitClient = (data) => {
    setLoading(true);
    setLoginError("");

    setTimeout(() => {
      const foundClient = activeClients.find(
        (c) => c.clientEmail.toLowerCase() === data.email.toLowerCase()
      );

      if (foundClient) {
        setLoading(false);
        clientLogin(foundClient.clientID);
        navigate("/client/dashboard", { replace: true });
      } else {
        setLoading(false);
        setLoginError(
          "We couldn't find a client matching this email address. Please click one of the quick-login client cards below."
        );
      }
    }, 1200);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f4f6f9] p-4 sm:p-8 font-sans">
      {/* Main Container */}
      <div className="relative w-full max-w-[1050px] min-h-[660px] border-22 border-[#E9E9FF] rounded-[3.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden flex">
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
        <div className="w-full md:w-[55%] min-h-full z-10 flex flex-col justify-center px-8 sm:px-12 lg:px-16 py-8 bg-[#E9E9FF]/40 backdrop-blur-xl border-l border-white/80 shadow-[-20px_0_40px_rgba(0,0,0,0.06)] rounded-r-[2.2rem]">
          <div className="w-full max-w-[380px] mx-auto">
            {/* Brand mark — the maarrsmart platform. Login is credentials-only;
                the firm is resolved from the email server-side, so the sign-in
                screen is not branded to any one org. */}
            <div className="mb-6 flex items-center gap-3">
              <img
                src={wipLogo}
                alt="maarrsmart"
                className="h-9 w-auto object-contain"
                style={{
                  filter:
                    "contrast(1.2) saturate(1.1) drop-shadow(0 1px 1px rgba(139, 105, 20, 0.15))",
                }}
              />
              <div className="flex flex-col leading-none border-l border-paleorange/40 pl-3">
                <p className="text-[15px] font-extrabold tracking-tight text-textcolor lowercase leading-none">
                  maarrsmart
                </p>
                <p className="text-[9px] uppercase tracking-[0.4em] text-text-subtle font-semibold mt-1.5 leading-none">
                  Interiors Platform
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <div className="flex bg-[#E9E9FF] p-1.5 rounded-full mb-6 w-full max-w-[300px] mx-auto border border-purple/5 shadow-inner">
              <button
                type="button"
                onClick={() => handleToggle("admin")}
                className={`flex-1 py-2 text-[12px] font-bold rounded-full transition-all duration-300 ${
                  loginType === "admin"
                    ? "bg-purple text-white shadow-md shadow-purple/20"
                    : "text-text-subtle hover:text-textcolor"
                }`}
              >
                Admin / Studio
              </button>
              <button
                type="button"
                onClick={() => handleToggle("client")}
                className={`flex-1 py-2 text-[12px] font-bold rounded-full transition-all duration-300 ${
                  loginType === "client"
                    ? "bg-purple text-white shadow-md shadow-purple/20"
                    : "text-text-subtle hover:text-textcolor"
                }`}
              >
                Client Portal
              </button>
            </div>

            {/* Header */}
            <div className="mb-6 text-left">
              <h1 className="text-[30px] font-bold text-textcolor tracking-tight mb-2">
                {loginType === "admin" ? "Welcome back" : "Your Workspace"}
              </h1>
              <p className="text-[14px] text-text-muted leading-relaxed">
                {loginType === "admin"
                  ? "Enter your credentials to access your studio dashboard."
                  : "Enter your credentials to access your Workspace."}
              </p>
            </div>

            {/* Provisioning success note */}
            {justProvisioned && loginType === "admin" && !loginError && (
              <div className="mb-5 p-3 text-[11.5px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-2xl">
                {provisionedOrgName ? `${provisionedOrgName} is ready. ` : "Organisation created. "}
                Sign in with the admin email and password you set to continue.
              </div>
            )}

            {/* Form Error Alert */}
            {loginError && (
              <div className="mb-5 p-3 text-[11.5px] font-medium text-red-600 bg-red-50 border border-red-200 rounded-2xl">
                {loginError}
              </div>
            )}

            {loginType === "admin" ? (
              <>
                {/* Google Button */}
                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-1 bg-white border border-x-3 border-y-0 rounded-full py-3 text-[14px] font-semibold text-textcolor hover:bg-gray-50 transition-all mb-6 shadow-sm"
                >
                  <img
                    src={Google}
                    alt="Google"
                    className="w-7 h-7 object-contain"
                  />
                  Continue with Google
                </button>

                {/* Divider */}
                <div className="flex items-center gap-4 mb-6 w-full">
                  <div className="flex-1 h-px bg-border"></div>
                  <span className="text-[10px] font-bold text-text-subtle uppercase tracking-widest leading-none">
                    Or Login With Email
                  </span>
                  <div className="flex-1 h-px bg-border"></div>
                </div>

                {/* Admin Form */}
                <form onSubmit={handleSubmitAdmin(onSubmitAdmin)} className="space-y-4">
                  <InputField
                    label="Email Address"
                    name="email"
                    type="email"
                    placeholder="name@atelier.com"
                    register={registerAdmin("email")}
                    error={errorsAdmin.email?.message}
                    variant="auth"
                    leftIcon={Mail}
                  />

                  <div className="space-y-1">
                    <InputField
                      label="Password"
                      name="password"
                      type={showPass ? "text" : "password"}
                      placeholder="••••••••"
                      register={registerAdmin("password")}
                      error={errorsAdmin.password?.message}
                      variant="auth"
                      leftIcon={Lock}
                      rightElement={
                        <button
                          type="button"
                          onClick={() => setShowPass(!showPass)}
                          className="text-text-subtle hover:text-purple transition-colors"
                        >
                          {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      }
                    />
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => navigate("/forgot-password")}
                        className="text-[12px] font-semibold text-grey hover:text-purple"
                      >
                        Forgot password?
                      </button>
                    </div>
                  </div>

                  {/* Keep signed in */}
                  <div className="pt-1 pb-1">
                    <label className="flex items-center gap-2.5 cursor-pointer w-fit group">
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
                      <span className="text-[13px] font-semibold text-text-muted select-none">
                        Keep me signed in
                      </span>
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full h-[48px] rounded-full text-[14px] font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 ${
                      loading
                        ? "bg-purple/80 cursor-not-allowed"
                        : "bg-purple hover:bg-dark-blue active:scale-[0.99]"
                    }`}
                  >
                    {loading && <Loader2 className="animate-spin h-5 w-5" />}
                    <span>{loading ? "Signing in..." : "Sign In"}</span>
                  </button>
                </form>
              </>
            ) : (
              <>
                {/* Google Button */}
                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-1 bg-white border border-x-3 border-y-0 rounded-full py-3 text-[14px] font-semibold text-textcolor hover:bg-gray-50 transition-all mb-6 shadow-sm"
                >
                  <img
                    src={Google}
                    alt="Google"
                    className="w-7 h-7 object-contain"
                  />
                  Continue with Google
                </button>

                {/* Divider */}
                <div className="flex items-center gap-4 mb-6 w-full">
                  <div className="flex-1 h-px bg-border"></div>
                  <span className="text-[10px] font-bold text-text-subtle uppercase tracking-widest leading-none">
                    Or Login With Email
                  </span>
                  <div className="flex-1 h-px bg-border"></div>
                </div>

                {/* Client Form */}
                <form onSubmit={handleSubmitClient(onSubmitClient)} className="space-y-4">
                  <InputField
                    label="Email Address"
                    name="email"
                    type="email"
                    placeholder="name@atelier.com"
                    register={registerClient("email")}
                    error={errorsClient.email?.message}
                    variant="auth"
                    leftIcon={Mail}
                  />

                  <div className="space-y-1">
                    <InputField
                      label="Password"
                      name="password"
                      type={showPass ? "text" : "password"}
                      placeholder="••••••••"
                      register={registerClient("password")}
                      error={errorsClient.password?.message}
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
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => navigate("/client/forgot-password")}
                        className="text-[12px] font-semibold text-grey hover:text-purple cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                  </div>

                  {/* Keep signed in */}
                  <div className="pt-1 pb-1">
                    <label className="flex items-center gap-2.5 cursor-pointer w-fit group">
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
                      <span className="text-[13px] font-semibold text-text-muted select-none">
                        Keep me signed in
                      </span>
                    </label>
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
                    <span>{loading ? "Signing in..." : "Sign In"}</span>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
