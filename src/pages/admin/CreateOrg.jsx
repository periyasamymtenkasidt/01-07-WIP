import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, MapPin, User, Mail, Lock, Eye, EyeOff, Loader2, ArrowLeft,
  Link2, ShieldCheck, Check,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import InputField from "../../components/InputField";
import { createOrganisation } from "../../auth/auth";
import { hasAdminKey, clearAdminKey } from "../../auth/adminSession";

import HomePage from "../../assets/images/HomePage.png";

// slugify — lowercase, spaces/punctuation → single hyphens, trim edges.
// Matches the backend rule: a-z 0-9 and hyphens only (becomes subdomain + db name).
const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Provision a new firm (tenant). Admin-gated back-office screen — POSTs to
// /api/admin/firms with the in-memory x-admin-key, then routes to that org's
// branded /login. Falls back to a local org when the backend is offline.
const PLANS = ["standard", "professional", "enterprise"];

const orgSchema = yup.object().shape({
  name: yup.string().required("Organisation name is required").trim(),
  slug: yup
    .string()
    .required("Slug is required")
    .trim()
    .matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only"),
  gstin: yup
    .string()
    .trim()
    .transform((v) => (v ? v.toUpperCase() : v))
    .matches(/^[0-9A-Z]{15}$/, { message: "GSTIN must be 15 characters", excludeEmptyString: true }),
  city: yup.string().trim(),
  state: yup.string().trim(),
  phone: yup.string().trim(),
  plan: yup.string().required(),
  adminName: yup.string().required("Admin name is required").trim(),
  adminEmail: yup
    .string()
    .required("Admin email is required")
    .trim()
    .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"),
  adminPassword: yup
    .string()
    .required("Password is required")
    .min(6, "Password must be at least 6 characters"),
});

const CreateOrg = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [formError, setFormError] = useState("");
  const slugEdited = useRef(false);

  // Guard: the create call needs the admin key. If it isn't in memory (fresh
  // load / refresh cleared it), bounce back to the gate.
  useEffect(() => {
    if (!hasAdminKey()) navigate("/admin/login", { replace: true });
  }, [navigate]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(orgSchema),
    defaultValues: {
      name: "", slug: "", gstin: "", city: "", state: "", phone: "",
      plan: "standard", adminName: "", adminEmail: "", adminPassword: "",
    },
  });

  // Auto-derive the slug from the org name until the operator edits it by hand.
  const nameValue = watch("name");
  useEffect(() => {
    if (!slugEdited.current) setValue("slug", slugify(nameValue));
  }, [nameValue, setValue]);

  const onSubmit = async (data) => {
    setLoading(true);
    setFormError("");
    try {
      const { firm } = await createOrganisation({
        firm: {
          name: data.name,
          slug: data.slug,
          gstin: data.gstin,
          city: data.city,
          state: data.state,
          phone: data.phone,
          plan: data.plan,
        },
        admin: { name: data.adminName, email: data.adminEmail, password: data.adminPassword },
      });
      // Org created — return to the console so the admin sees the updated list.
      navigate("/admin/orgs", { replace: true });
    } catch (err) {
      // 401 → the admin key was wrong; drop it and send them back to the gate.
      if (err?.status === 401) {
        clearAdminKey();
        navigate("/admin/login", { replace: true });
        return;
      }
      setFormError(err?.message || "We couldn't create the organisation. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f4f6f9] p-4 sm:p-8 font-manrope">
      <div className="relative w-full max-w-[1050px] min-h-[680px] border-22 border-[#E9E9FF] rounded-[3.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden flex">
        {/* Left visual */}
        <div className="absolute left-0 top-0 w-full h-full z-0 hidden md:block">
          <img src={HomePage} alt="" className="w-[85%] h-full object-contain object-left opacity-70" />
        </div>
        <div className="hidden md:block w-[45%] h-full z-0" />

        {/* Form panel */}
        <div className="w-full md:w-[55%] min-h-full z-10 flex flex-col justify-center px-8 sm:px-12 lg:px-14 py-8 bg-[#E9E9FF]/40 backdrop-blur-xl border-l border-white/80 shadow-[-20px_0_40px_rgba(0,0,0,0.06)] rounded-r-[2.2rem] overflow-y-auto custom-scrollbar">
          <div className="w-full max-w-[400px] mx-auto">
            {/* Back to gate */}
            <button
              type="button"
              onClick={() => navigate("/admin/orgs")}
              className="mb-5 flex items-center gap-1.5 text-[12px] font-bold text-grey hover:text-purple transition-colors group"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
              Organisations
            </button>

            {/* maarrsmart brand mark */}
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-purple text-white shadow-md shadow-purple/20">
                <ShieldCheck size={18} />
              </span>
              <div className="flex flex-col leading-none">
                <p className="text-[16px] font-extrabold tracking-tight text-textcolor lowercase">maarrsmart</p>
                <p className="text-[9px] uppercase tracking-[0.35em] text-text-subtle font-semibold mt-1">
                  Provision Organisation
                </p>
              </div>
            </div>

            {/* Header */}
            <div className="mb-5 text-left">
              <h1 className="text-[26px] font-bold text-textcolor tracking-tight mb-1.5">Create organisation</h1>
              <p className="text-[13.5px] text-text-muted leading-relaxed">
                Provision a new firm workspace and its first admin. They&apos;ll sign in with the credentials you set here.
              </p>
            </div>

            {formError && (
              <div className="mb-5 p-3 text-[11.5px] font-medium text-red-600 bg-red-50 border border-red-200 rounded-2xl">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
              {/* Organisation */}
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-text-subtle">Organisation</p>
              <InputField
                label="Organisation name"
                name="name"
                type="text"
                placeholder="ARCHITECTURE WIP"
                register={register("name")}
                error={errors.name?.message}
                variant="auth"
                leftIcon={Building2}
              />
              <InputField
                label="Slug (subdomain)"
                name="slug"
                type="text"
                placeholder="architecture-wip"
                register={register("slug", { onChange: () => (slugEdited.current = true) })}
                error={errors.slug?.message}
                variant="auth"
                leftIcon={Link2}
              />
              <div className="grid grid-cols-2 gap-3">
                <InputField
                  label="City"
                  name="city"
                  type="text"
                  placeholder="Chennai"
                  register={register("city")}
                  error={errors.city?.message}
                  variant="auth"
                  leftIcon={MapPin}
                />
                <InputField
                  label="State"
                  name="state"
                  type="text"
                  placeholder="Tamil Nadu"
                  register={register("state")}
                  error={errors.state?.message}
                  variant="auth"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InputField
                  label="GSTIN (optional)"
                  name="gstin"
                  type="text"
                  placeholder="33ABCDE1234F1Z5"
                  register={register("gstin")}
                  error={errors.gstin?.message}
                  variant="auth"
                />
                <InputField
                  label="Plan"
                  name="plan"
                  type="select"
                  options={PLANS}
                  register={register("plan")}
                  error={errors.plan?.message}
                  variant="auth"
                />
              </div>
              <InputField
                label="Phone (optional)"
                name="phone"
                type="text"
                placeholder="+91 ..."
                register={register("phone")}
                error={errors.phone?.message}
                variant="auth"
              />

              {/* First admin */}
              <p className="pt-1 text-[10px] font-bold uppercase tracking-[0.25em] text-text-subtle">First admin</p>
              <InputField
                label="Admin name"
                name="adminName"
                type="text"
                placeholder="Full name"
                register={register("adminName")}
                error={errors.adminName?.message}
                variant="auth"
                leftIcon={User}
              />
              <InputField
                label="Admin email"
                name="adminEmail"
                type="email"
                placeholder="admin@studio.com"
                register={register("adminEmail")}
                error={errors.adminEmail?.message}
                variant="auth"
                leftIcon={Mail}
              />
              <InputField
                label="Temp password"
                name="adminPassword"
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                register={register("adminPassword")}
                error={errors.adminPassword?.message}
                variant="auth"
                leftIcon={Lock}
                rightElement={
                  <button type="button" onClick={() => setShowPass(!showPass)} className="text-text-subtle hover:text-purple transition-colors">
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className={`w-full h-[48px] rounded-full text-[14px] font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 ${
                  loading ? "bg-purple/80 cursor-not-allowed" : "bg-purple hover:bg-dark-blue active:scale-[0.99]"
                }`}
              >
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Check size={18} strokeWidth={3} />}
                <span>{loading ? "Creating..." : "Create organisation"}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateOrg;
