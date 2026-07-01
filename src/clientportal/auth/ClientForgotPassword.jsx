import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import InputField from "../../components/InputField";
import HomePage from "../../assets/images/HomePage.png";

const clientForgotPasswordSchema = yup.object().shape({
  email: yup
    .string()
    .required("Email Address is required")
    .trim()
    .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"),
});

export default function ClientForgotPassword() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [apiError, setApiError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(clientForgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data) => {
    try {
      setLoading(true);
      setApiError("");
      setMessage("");
      console.log("Client forgot password email request:", data.email);

      // Simulated API CALL
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setMessage("Reset instructions have been sent to your registered email.");
      reset();
    } catch (err) {
      console.log(err);
      setApiError("Failed to request reset instructions.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f4f6f9] p-4 sm:p-8 font-sans">
      {/* Main Container */}
      <div className="relative w-full max-w-[1050px] min-h-[650px] border-22 border-[#E9E9FF] rounded-[3.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden flex ">
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
            {/* Back to Client Login Link */}
            <button
              onClick={() => navigate("/client/login")}
              className="mb-6 flex items-center gap-1.5 text-[12px] font-bold text-grey hover:text-purple transition-colors cursor-pointer group"
            >
              <ArrowLeft
                size={14}
                className="group-hover:-translate-x-0.5 transition-transform"
              />
              Back to Client Login
            </button>

            {/* Header */}
            <div className="mb-10 text-left">
              <h1 className="text-[32px] font-bold text-textcolor tracking-tight mb-2">
                Reset Client Access
              </h1>
              <p className="text-[14.5px] text-text-muted">
                Enter your client email and we'll send you
                <br className="hidden sm:block" />a link to restore your portal
                password.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Email Input */}
              <div className="space-y-1.5">
                <InputField
                  label="Registered Email ID"
                  name="email"
                  type="email"
                  placeholder="client@gmail.com"
                  register={register("email")}
                  error={errors.email?.message || apiError}
                  variant="auth"
                />
              </div>

              {/* Send Button */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full h-[50px] rounded-full text-[14.5px] font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  loading
                    ? "bg-purple/80 cursor-not-allowed"
                    : "bg-purple hover:bg-dark-blue active:scale-[0.99]"
                }`}
              >
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : null}
                <span>{loading ? "Sending..." : "Request Reset Link"}</span>
              </button>

              {/* Success Message */}
              {message && (
                <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-center mt-4">
                  <p className="text-green-600 text-[13px] font-medium">
                    {message}
                  </p>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
