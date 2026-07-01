import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  PenTool,
  Ruler,
  Building2,
  Sofa,
  Package,
  ClipboardCheck,
  Phone,
  Mail,
  MapPin,
  Menu,
  X,
  Star,
  Check,
} from "lucide-react";

import wipLogo from "../../assets/images/Logo.png";
import HomePage from "../../assets/images/HomePage.png";

// ─────────────────────────────────────────────────────────────────────────────
// Public marketing landing page for ARCHITECTURE WIP (Digital Atelier) — the
// architecture & interior design studio in Chennai. Lives at the public `/`
// route; the studio login moved to `/login`, the client portal to `/client/login`.
//
// Visual language matches the app: Manrope, deep navy (`purple`/`primary`) with a
// gold (`paleorange`) accent, glassmorphism, editorial uppercase tracking. Section
// copy is tied to the real business — the 5 operational modules and the 10-stage
// design lifecycle described in the requirements spec.
//
// Portfolio tiles use gradient placeholders (no project photography in the repo
// yet) — swap the `tone` blocks for real imagery when available.
// ─────────────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: "Work", href: "#work" },
  { label: "Services", href: "#services" },
  { label: "Process", href: "#process" },
  { label: "Studio", href: "#studio" },
  { label: "Contact", href: "#contact" },
];

const STATS = [
  { value: "120+", label: "Projects delivered" },
  { value: "14", label: "Years in practice" },
  { value: "₹0", label: "Hidden costs — every BOQ itemised" },
  { value: "100%", label: "GST-compliant invoicing" },
];

const SERVICES = [
  {
    icon: PenTool,
    title: "Architectural Design",
    body: "Ground-up architecture from site analysis and concept through schematic design, detailed development and construction documentation.",
  },
  {
    icon: Sofa,
    title: "Interior Design",
    body: "Space planning, materials, lighting, ceiling and furniture — composed room by room with renders that match the drawings.",
  },
  {
    icon: Building2,
    title: "Turnkey Execution",
    body: "We carry the design to site: construction documentation, BOQ, execution and a defect-liability handover you can hold us to.",
  },
  {
    icon: Package,
    title: "Procurement",
    body: "Vetted vendor network, side-by-side quotation comparison and purchase tracking — sanitaryware to carpentry, sourced right.",
  },
  {
    icon: Ruler,
    title: "Bill of Quantities",
    body: "Category- and room-wise BOQs with rates validated against live vendor quotes. Transparent subtotal, discount, GST and grand total.",
  },
  {
    icon: ClipboardCheck,
    title: "Project Management",
    body: "A single thread from inquiry to handover — milestones, approvals and a client portal where you sign off every stage.",
  },
];

const PROCESS = [
  {
    no: "01",
    title: "Initiation & Brief",
    body: "We listen first. Requirements, budget and site context become a clear, shared brief.",
  },
  {
    no: "02",
    title: "Concept & Schematic",
    body: "Direction takes shape — concepts, moodboards and schematic layouts reviewed with you.",
  },
  {
    no: "03",
    title: "Design Development",
    body: "Detailed design, A/S/MEP coordination and visualisation, signed off by our Principal Architect.",
  },
  {
    no: "04",
    title: "Documentation & BOQ",
    body: "Construction drawings and an itemised Bill of Quantities, issued for tendering and procurement.",
  },
  {
    no: "05",
    title: "Execution",
    body: "On-site delivery with scheduled milestones and a transparent activity trail at every step.",
  },
  {
    no: "06",
    title: "Handover & Support",
    body: "A clean handover, GST invoicing through your portal, and post-completion defect-liability support.",
  },
];

const WORK = [
  { tag: "Residential", title: "Boat Club Villa", meta: "Chennai · Turnkey Interiors", tone: "from-[#0a1b49] to-[#1a2b4d]" },
  { tag: "Commercial", title: "Nungambakkam Studio", meta: "Workspace · 9,400 sq ft", tone: "from-[#1a2b4d] to-[#334155]" },
  { tag: "Hospitality", title: "ECR Retreat", meta: "Boutique Stay · Architecture", tone: "from-[#001552] to-[#0a1b49]" },
  { tag: "Residential", title: "Adyar Apartment", meta: "Interior Design · 3 BHK", tone: "from-[#334155] to-[#1a2b4d]" },
];

const TESTIMONIALS = [
  {
    quote:
      "They priced every line of the BOQ against real vendor quotes. For the first time we knew exactly where the budget went.",
    name: "Priya Raghunathan",
    role: "Homeowner · Boat Club",
  },
  {
    quote:
      "The portal made approvals painless — renders, milestones and invoices in one place. Handover was on time and on spec.",
    name: "Arvind Menon",
    role: "Director · Nungambakkam Studio",
  },
];

const WHY = [
  "Principal Architect signs off every final design",
  "Room-wise BOQ — no lump sums, no surprises",
  "CGST/SGST split, GST-compliant invoicing",
  "Client portal for approvals, renders & payments",
];

const Landing = () => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // "Sign In" goes straight to the sign-in screen. We deliberately do NOT list
  // organisations on this public page — exposing tenant names is a security leak.
  // Login is credentials-only: the firm is resolved at /login from the email.
  const handleSignIn = () => {
    setMenuOpen(false);
    navigate("/login");
  };

  return (
    <div className="font-manrope bg-overallbg text-textcolor antialiased">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/60 bg-white/70 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="#top" className="flex items-center gap-3">
            <img src={wipLogo} alt="maarrsmart" className="h-8 w-auto object-contain" />
            <span className="flex flex-col leading-none border-l border-paleorange/40 pl-3">
              <span className="text-[13px] font-extrabold tracking-tight text-textcolor lowercase">
                maarrsmart
              </span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.35em] text-text-subtle">
                Interiors Platform
              </span>
            </span>
          </a>

          {/* Desktop links */}
          <div className="hidden items-center gap-9 lg:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-[13px] font-semibold text-grey transition-colors hover:text-purple"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSignIn}
              className="hidden text-[13px] font-semibold text-grey transition-colors hover:text-purple sm:block"
            >
              Sign In
            </button>
            <Link
              to="/admin/login"
              className="hidden rounded-full bg-purple px-5 py-2.5 text-[13px] font-bold text-white shadow-md shadow-purple/20 transition-all hover:bg-primary sm:block"
            >
              Admin Console
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded-full border border-bordergray bg-white p-2 text-purple lg:hidden"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="border-t border-bordergray bg-white px-5 py-4 lg:hidden">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-[14px] font-semibold text-grey hover:bg-bg-soft"
                >
                  {l.label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-1 gap-3 px-3">
                <button type="button" onClick={handleSignIn} className="rounded-full border border-bordergray py-2.5 text-center text-[13px] font-bold text-purple">
                  Sign In
                </button>
                <Link to="/admin/login" className="rounded-full bg-purple py-2.5 text-center text-[13px] font-bold text-white">
                  Admin Console
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section id="top" className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-paleorange/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 -left-40 h-[480px] w-[480px] rounded-full bg-purple/10 blur-3xl" />

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-paleorange/40 bg-white/70 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-dark-yellow backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-paleorange" />
              Design · Build · Handover
            </span>

            <h1 className="mt-6 text-[40px] font-extrabold leading-[1.05] tracking-tight text-textcolor sm:text-[56px]">
              Spaces composed with
              <span className="relative whitespace-nowrap text-purple">
                {" "}intent
                <svg className="absolute -bottom-2 left-0 w-full" height="10" viewBox="0 0 200 10" fill="none" preserveAspectRatio="none">
                  <path d="M2 7C50 2 150 2 198 7" stroke="#c5a367" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
              , delivered with proof.
            </h1>

            <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-text-muted">
              ARCHITECTURE WIP is a Chennai architecture &amp; interior design studio.
              We take a project from first inquiry to defect-liability handover — with
              an itemised BOQ, vetted procurement and a client portal that keeps every
              approval, render and invoice in one place.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/admin/login"
                className="inline-flex items-center gap-2 rounded-full bg-purple px-7 py-3.5 text-[14px] font-bold text-white shadow-lg shadow-purple/25 transition-all hover:bg-primary"
              >
                Create a workspace
                <ArrowRight size={17} />
              </Link>
              <a
                href="#work"
                className="inline-flex items-center gap-2 rounded-full border border-bordergray bg-white px-7 py-3.5 text-[14px] font-bold text-purple transition-all hover:bg-bg-soft"
              >
                View our work
              </a>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.label}>
                  <p className="text-[26px] font-extrabold text-purple">{s.value}</p>
                  <p className="mt-1 text-[11px] font-medium leading-tight text-text-subtle">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative">
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/80 bg-gradient-to-br from-[#E9E9FF]/60 to-white/40 p-3 shadow-[0_20px_60px_rgba(10,27,73,0.18)] backdrop-blur-xl">
              <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0a1b49] to-[#1a2b4d]">
                <img
                  src={HomePage}
                  alt="Architectural visualisation"
                  className="h-[360px] w-full object-contain object-center opacity-95 sm:h-[440px]"
                />
              </div>
            </div>
            {/* Floating spec card */}
            <div className="absolute -bottom-5 -left-3 hidden rounded-2xl border border-bordergray bg-white/90 px-5 py-4 shadow-xl backdrop-blur sm:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-dark-yellow">Now in studio</p>
              <p className="mt-1 text-[14px] font-bold text-textcolor">10-stage design lifecycle</p>
              <p className="text-[12px] text-text-muted">Concept → Documentation → Handover</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Services ────────────────────────────────────────────────────── */}
      <section id="services" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
        <SectionHead
          eyebrow="What we do"
          title="One studio, the whole lifecycle"
          sub="Design and delivery under one roof — so the intent in the concept survives all the way to site."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <article
              key={service.title}
              className="group rounded-3xl border border-bordergray bg-surface p-7 transition-all hover:-translate-y-1 hover:border-paleorange/50 hover:shadow-[0_18px_40px_rgba(10,27,73,0.10)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-active-bg text-purple transition-colors group-hover:bg-purple group-hover:text-white">
                <service.icon size={22} />
              </div>
              <h3 className="mt-5 text-[18px] font-bold text-textcolor">{service.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-text-muted">{service.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Process ─────────────────────────────────────────────────────── */}
      <section id="process" className="relative overflow-hidden bg-purple py-16 lg:py-24">
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-paleorange/10 blur-3xl" />
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHead
            dark
            eyebrow="How we work"
            title="A process you can follow, stage by stage"
            sub="Every milestone is logged, approved and visible to you — from the first brief to post-completion support."
          />
          <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {PROCESS.map((p) => (
              <div key={p.no} className="border-t border-white/15 pt-5">
                <span className="text-[13px] font-bold tracking-[0.3em] text-paleorange">{p.no}</span>
                <h3 className="mt-3 text-[18px] font-bold text-white">{p.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-white/65">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Work ────────────────────────────────────────────────────────── */}
      <section id="work" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHead
            align="left"
            eyebrow="Selected work"
            title="Recent projects"
            sub="Residential, commercial and hospitality — across Chennai and the coast."
          />
          <a href="#contact" className="inline-flex items-center gap-2 text-[13px] font-bold text-purple hover:text-primary">
            Start your project <ArrowUpRight size={16} />
          </a>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {WORK.map((w) => (
            <article key={w.title} className="group cursor-pointer">
              <div className={`relative h-64 overflow-hidden rounded-3xl bg-gradient-to-br ${w.tone}`}>
                <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: "radial-gradient(circle at 30% 20%, rgba(197,163,103,0.25), transparent 60%)" }} />
                <span className="absolute left-4 top-4 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur">
                  {w.tag}
                </span>
                <ArrowUpRight className="absolute right-4 top-4 text-white/70 transition-all group-hover:right-3 group-hover:top-3 group-hover:text-paleorange" size={20} />
              </div>
              <h3 className="mt-4 text-[16px] font-bold text-textcolor">{w.title}</h3>
              <p className="text-[12.5px] text-text-muted">{w.meta}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Studio / Why us ─────────────────────────────────────────────── */}
      <section id="studio" className="bg-bg-soft py-16 lg:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
          <div>
            <SectionHead
              align="left"
              eyebrow="The studio"
              title="Design with discipline, costed with honesty"
              sub="We believe a beautiful space and an accountable budget aren't a trade-off. Our practice is built so you see both — clearly."
            />
            <ul className="mt-8 space-y-3.5">
              {WHY.map((w) => (
                <li key={w} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-purple text-white">
                    <Check size={13} strokeWidth={3} />
                  </span>
                  <span className="text-[14.5px] font-medium text-grey">{w}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Testimonials */}
          <div className="space-y-5">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="rounded-3xl border border-bordergray bg-surface p-7 shadow-sm">
                <div className="flex gap-0.5 text-paleorange">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={15} fill="currentColor" />
                  ))}
                </div>
                <blockquote className="mt-4 text-[15px] leading-relaxed text-textcolor">“{t.quote}”</blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-purple text-[13px] font-bold text-white">
                    {t.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </span>
                  <span>
                    <p className="text-[13.5px] font-bold text-textcolor">{t.name}</p>
                    <p className="text-[12px] text-text-muted">{t.role}</p>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact / CTA ───────────────────────────────────────────────── */}
      <section id="contact" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#0a1b49] to-[#001552] px-7 py-14 sm:px-14">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-paleorange/15 blur-3xl" />
          <div className="relative grid gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-[32px] font-extrabold leading-tight text-white sm:text-[40px]">
                Let&apos;s start your
                <span className="text-paleorange"> project</span>.
              </h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/70">
                Tell us about your space and timeline. We&apos;ll set up an initial
                consultation and walk you through how we design, cost and deliver.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/admin/login" className="inline-flex items-center gap-2 rounded-full bg-paleorange px-7 py-3.5 text-[14px] font-bold text-purple shadow-lg transition-all hover:brightness-105">
                  Create a workspace <ArrowRight size={16} />
                </Link>
                <button type="button" onClick={handleSignIn} className="inline-flex items-center gap-2 rounded-full border border-white/25 px-7 py-3.5 text-[14px] font-bold text-white transition-all hover:bg-white/10">
                  Sign In
                </button>
              </div>
            </div>

            <div className="grid content-center gap-5">
              <ContactRow icon={MapPin} label="Studio" value="Nungambakkam, Chennai 600034, Tamil Nadu" />
              <ContactRow icon={Mail} label="Email" value="studio@architecturewip.in" />
              <ContactRow icon={Phone} label="Phone" value="+91 44 4000 0000" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-bordergray bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-5 py-8 sm:flex-row sm:px-8">
          <div className="flex items-center gap-3">
            <img src={wipLogo} alt="maarrsmart" className="h-7 w-auto object-contain" />
            <span className="text-[13px] font-extrabold lowercase tracking-tight text-textcolor">
              maarrsmart
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[12.5px] font-semibold text-text-muted">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-purple">{l.label}</a>
            ))}
          </div>
          <p className="text-[11.5px] text-text-subtle">© 2026 ARCHITECTURE WIP · Chennai · GSTIN 33XXXXX</p>
        </div>
      </footer>
    </div>
  );
};

// Shared section heading — light by default, `dark` for navy backgrounds.
function SectionHead({ eyebrow, title, sub, dark = false, align = "center" }) {
  const alignment = align === "left" ? "text-left" : "text-center mx-auto";
  return (
    <div className={`${alignment} ${align === "center" ? "max-w-2xl" : "max-w-xl"}`}>
      <span className={`text-[11px] font-bold uppercase tracking-[0.3em] ${dark ? "text-paleorange" : "text-dark-yellow"}`}>
        {eyebrow}
      </span>
      <h2 className={`mt-3 text-[28px] font-extrabold leading-tight tracking-tight sm:text-[34px] ${dark ? "text-white" : "text-textcolor"}`}>
        {title}
      </h2>
      {sub && (
        <p className={`mt-3 text-[15px] leading-relaxed ${dark ? "text-white/65" : "text-text-muted"}`}>{sub}</p>
      )}
    </div>
  );
}

function ContactRow({ icon, label, value }) {
  const Icon = icon;
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-white/10 text-paleorange">
        <Icon size={18} />
      </span>
      <span>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">{label}</p>
        <p className="mt-0.5 text-[14px] font-semibold text-white">{value}</p>
      </span>
    </div>
  );
}

export default Landing;
