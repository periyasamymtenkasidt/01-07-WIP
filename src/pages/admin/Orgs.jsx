import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Plus, ArrowLeft, ShieldCheck, Loader2, MapPin, RefreshCw,
} from "lucide-react";

import { listFirms } from "../../api/admin";
import { hasAdminKey, getAdminKey, clearAdminKey } from "../../auth/adminSession";
import { ApiError } from "../../api/client";
import { getOrgs, rememberOrg } from "../../data/orgDirectory";

import HomePage from "../../assets/images/HomePage.png";

// Coerce a backend firm row into the shape this page renders.
const normalize = (row = {}) => ({
  firmId: String(row.firmId || row.firm_id || row.id || ""),
  name: (row.name || "").trim(),
  slug: (row.slug || "").trim(),
  status: (row.status || "").trim(),
  plan: (row.plan || "").trim(),
  city: (row.city || "").trim(),
  state: (row.state || "").trim(),
});

// Platform-admin organisation directory. Lists every provisioned firm from
// GET /api/admin/firms (x-admin-key), with a shortcut to provision a new one and
// to jump to a firm's branded sign-in. Admin-gated — bounces to /admin/login if
// the in-memory key was cleared (refresh). Falls back to the local org cache
// when the backend is unreachable so the console stays usable offline.
const Orgs = () => {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState(() => getOrgs().map(normalize));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    listFirms(getAdminKey())
      .then((rows) => {
        const list = rows.map(normalize).filter((o) => o.name || o.slug);
        setOrgs(list);
        // Keep the login picker's local directory in sync with the backend.
        list.forEach((o) => rememberOrg(o));
      })
      .catch((err) => {
        // 401 → the admin key is wrong/expired; drop it and re-gate.
        if (err instanceof ApiError && err.status === 401) {
          clearAdminKey();
          navigate("/admin/login", { replace: true });
          return;
        }
        // Anything else (no endpoint yet, offline) → show the local cache.
        setOrgs(getOrgs().map(normalize));
        setError(
          "Showing locally-known organisations — the backend firm list is unavailable.",
        );
      })
      .finally(() => setLoading(false));
  };

  // Guard: the list call needs the admin key. If it isn't in memory (fresh
  // load / refresh cleared it), bounce back to the gate. Otherwise load.
  useEffect(() => {
    if (!hasAdminKey()) {
      navigate("/admin/login", { replace: true });
      return;
    }
    load();
    // load reads stable module state; running once on mount is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f4f6f9] p-4 sm:p-8 font-manrope">
      <div className="relative w-full max-w-[1050px] min-h-[640px] border-22 border-[#E9E9FF] rounded-[3.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden flex">
        {/* Left visual */}
        <div className="absolute left-0 top-0 w-full h-full z-0 hidden md:block">
          <img src={HomePage} alt="" className="w-[85%] h-full object-contain object-left opacity-70" />
        </div>
        <div className="hidden md:block w-[40%] h-full z-0" />

        {/* Panel */}
        <div className="w-full md:w-[60%] min-h-full z-10 flex flex-col px-8 sm:px-12 lg:px-14 py-8 bg-[#E9E9FF]/40 backdrop-blur-xl border-l border-white/80 shadow-[-20px_0_40px_rgba(0,0,0,0.06)] rounded-r-[2.2rem] overflow-y-auto custom-scrollbar">
          {/* Back to gate */}
          <button
            type="button"
            onClick={() => navigate("/admin/login")}
            className="mb-5 flex items-center gap-1.5 text-[12px] font-bold text-grey hover:text-purple transition-colors group w-fit"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            Admin console
          </button>

          {/* maarrsmart brand mark */}
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-purple text-white shadow-md shadow-purple/20">
              <ShieldCheck size={18} />
            </span>
            <div className="flex flex-col leading-none">
              <p className="text-[16px] font-extrabold tracking-tight text-textcolor lowercase">maarrsmart</p>
              <p className="text-[9px] uppercase tracking-[0.35em] text-text-subtle font-semibold mt-1">
                Organisations
              </p>
            </div>
          </div>

          {/* Header + actions */}
          <div className="mb-5 flex items-end justify-between gap-3">
            <div className="text-left">
              <h1 className="text-[26px] font-bold text-textcolor tracking-tight mb-1.5">Organisations</h1>
              <p className="text-[13.5px] text-text-muted leading-relaxed">
                Every firm workspace provisioned on the platform.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={load}
                disabled={loading}
                title="Refresh"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-x-3 border-y-0 bg-white text-grey hover:text-purple transition-colors disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>
              <button
                type="button"
                onClick={() => navigate("/admin/orgs/new")}
                className="flex h-10 items-center gap-1.5 rounded-full bg-purple px-4 text-[13px] font-bold text-white shadow-md shadow-purple/20 hover:bg-dark-blue active:scale-[0.99] transition-all"
              >
                <Plus size={16} strokeWidth={3} />
                New organisation
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 text-[11.5px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl">
              {error}
            </div>
          )}

          {/* List */}
          {loading && !orgs.length ? (
            <div className="flex flex-1 items-center justify-center text-text-subtle">
              <Loader2 className="animate-spin h-6 w-6" />
            </div>
          ) : orgs.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center gap-3 py-10">
              <Building2 size={32} className="text-text-subtle" />
              <p className="text-[13.5px] text-text-muted">
                No organisations yet. Provision the first firm to get started.
              </p>
              <button
                type="button"
                onClick={() => navigate("/admin/orgs/new")}
                className="flex h-10 items-center gap-1.5 rounded-full bg-purple px-4 text-[13px] font-bold text-white shadow-md shadow-purple/20 hover:bg-dark-blue transition-all"
              >
                <Plus size={16} strokeWidth={3} />
                Create organisation
              </button>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {orgs.map((o) => (
                <li
                  key={o.firmId || o.slug || o.name}
                  className="flex items-center gap-3 rounded-2xl border border-x-3 border-y-0 bg-white px-4 py-3 shadow-sm"
                >
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-purple/10 text-[15px] font-extrabold text-purple">
                    {(o.name || o.slug || "?").trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-textcolor leading-tight">
                      {o.name || o.slug}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-subtle">
                      {o.firmId && <span className="font-semibold text-text-muted">{o.firmId}</span>}
                      {o.slug && <span>· {o.slug}</span>}
                      {(o.city || o.state) && (
                        <span className="inline-flex items-center gap-0.5">
                          · <MapPin size={11} /> {[o.city, o.state].filter(Boolean).join(", ")}
                        </span>
                      )}
                      {o.plan && <span>· {o.plan}</span>}
                    </div>
                  </div>
                  {o.status && (
                    <span
                      className={`hidden sm:inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        o.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-grey"
                      }`}
                    >
                      {o.status}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default Orgs;
