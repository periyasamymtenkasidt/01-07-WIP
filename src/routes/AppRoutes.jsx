import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import ProtectedRoute from "./ProtectedRoute";
import ErrorBoundary from "../components/ErrorBoundary";

// Eagerly loaded routes
import Landing from "../pages/landing/Landing";
import Login from "../pages/auth/Login";
import AdminLogin from "../pages/admin/AdminLogin";
import AdminOrgs from "../pages/admin/Orgs";
import CreateOrg from "../pages/admin/CreateOrg";
import ForgotPassword from "../pages/auth/ForgotPassword";
import Dashboard from "../pages/dashboard/Dashboard";
import Signout from "../pages/Signout";
import NotFound from "../pages/NotFound";
import VendorQuoteForm from "../pages/procurement/VendorQuoteForm";

// Client Portal eagerly loaded routes
import ClientForgotPassword from "../clientportal/auth/ClientForgotPassword";
import ClientDashboard from "../pages/clients/ClientDashboard";
import ClientProtectedRoute from "./ClientProtectedRoute";

// Lazy loaded routes
const Leads = lazy(() => import("../pages/leads/Leads"));
const LeadEdit = lazy(() => import("../pages/leads/LeadEdit"));
const Client = lazy(() => import("../pages/clients/Client"));
const ClientProfile = lazy(() => import("../pages/clients/ClientProfile"));
const Accounts = lazy(() => import("../pages/Accounts"));
const Pipeline = lazy(() => import("../pages/Pipeline"));
const Analytics = lazy(() => import("../pages/Analytics"));
const Reports = lazy(() => import("../pages/Reports"));
const Support = lazy(() => import("../pages/Support"));
const Deals = lazy(() => import("../pages/deals/Deals"));
const Projects = lazy(() => import("../pages/projects/Projects"));
const ProjectDetail = lazy(() => import("../pages/projects/ProjectDetail"));
const Sites = lazy(() => import("../pages/sites/Sites"));
const SiteDetail = lazy(() => import("../pages/sites/SiteDetail"));
const Master=lazy(()=>import("../pages/master/Master"));
const BOQList = lazy(() => import("../pages/boq/BOQList"));
const Procurement = lazy(() => import("../pages/procurement/Procurement"));
const PoDetail = lazy(() => import("../pages/procurement/PoDetail"));
const RfqDetail = lazy(() => import("../pages/procurement/RfqDetail"));
const VendorProfile = lazy(() => import("../pages/procurement/VendorProfile"));
const Settings = lazy(() => import("../pages/settings/Settings"));
const BOQEditor = lazy(() => import("../pages/boq/BOQEditor"));

// Client Portal Eagerly Loaded Routes
const ClientPortalLayout = lazy(() => import("../clientportal/layouts/MainLayout"));
const PortalDashboard = lazy(() => import("../clientportal/pages/PortalDashboard"));
const PaymentMilestones = lazy(() => import("../clientportal/pages/PaymentMilestones"));
const ProjectQuotes = lazy(() => import("../clientportal/pages/ProjectQuotes"));
const DesignsRenders = lazy(() => import("../clientportal/pages/DesignsRenders"));
const GSTInvoice = lazy(() => import("../clientportal/pages/GSTInvoice"));
const ClientProfilePage = lazy(() => import("../clientportal/pages/ClientProfilePage"));
const ClientSignout = lazy(() => import("../clientportal/pages/ClientSignout"));

const LoadingFallback = () => (
  <div className="flex justify-center items-center h-screen">
  <div className="w-10 h-10 border-4 border-black/10 border-t-blue-500 rounded-full animate-spin"></div>
  </div>
);

const AppRoutes = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Platform back-office — admin-gated organisation provisioning */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/orgs" element={<AdminOrgs />} />
          <Route path="/admin/orgs/new" element={<CreateOrg />} />

          {/* Public, no-login vendor quote submission — reached via a shared link */}
          <Route path="/vendor-quote/:rfqId" element={<VendorQuoteForm />} />
          
          {/* Client Portal Public Routes */}
          <Route path="/client/login" element={<Login />} />
          <Route path="/client/forgot-password" element={<ClientForgotPassword />} />

          {/* Client Portal Private Routes */}
          <Route element={<ClientProtectedRoute />}>
            <Route path="/client/dashboard/:clientId?" element={<ClientDashboard />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="leads">
                <Route index element={<Leads />} />
                <Route path=":id" element={<LeadEdit />} />
              </Route>
              <Route path="clients">
                <Route index element={<Client />} />
                <Route path=":id" element={<ClientProfile />} />
              </Route>
              <Route path="projects">
                <Route index element={<Projects />} />
                <Route path=":id" element={<ProjectDetail />} />
              </Route>
              <Route path="sitevisit">
                <Route index element={<Sites />} />
                <Route path=":id" element={<SiteDetail />} />
              </Route>
              <Route path="boq">
                <Route index element={<BOQList />} />
                <Route path=":id" element={<BOQEditor />} />
              </Route>
              <Route path="master" element={<Master />} />
              <Route path="procurement">
                <Route index element={<Procurement />} />
                <Route path="po/:id" element={<PoDetail />} />
                <Route path="rfq/:id" element={<RfqDetail />} />
                <Route path="vendors/:id" element={<VendorProfile />} />
              </Route>
              <Route path="deals" element={<Deals />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="pipeline" element={<Pipeline />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="reports" element={<Reports />} />
              <Route path="support" element={<Support />} />
              <Route path="settings" element={<Settings />} />
              <Route path="signout" element={<Signout />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>

          {/* Refactored Client Portal Routes */}
          <Route element={<ClientProtectedRoute />}>
            <Route path="/client-portal/:clientId?" element={<ClientPortalLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<PortalDashboard />} />
              <Route path="payment-milestones" element={<PaymentMilestones />} />
              <Route path="project-quotes" element={<ProjectQuotes />} />
              <Route path="designs-renders" element={<DesignsRenders />} />
              <Route path="gst-invoice" element={<GSTInvoice />} />
              <Route path="profile" element={<ClientProfilePage />} />
              <Route path="signout" element={<ClientSignout />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

export default AppRoutes;
