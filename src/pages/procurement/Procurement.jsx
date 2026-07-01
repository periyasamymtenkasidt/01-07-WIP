import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FileBox, Package, Truck, Users, ShoppingCart, Send } from "lucide-react";
import Takeoff from "./tabs/Takeoff";
import RFQs from "./tabs/RFQs";
import PurchaseOrders from "./tabs/PurchaseOrders";
import GRN from "./tabs/GRN";
import Vendors from "./tabs/Vendors";

// Procurement — the material supply chain for won projects. Take-off rolls a
// BOQ's materials into a requisition → RFQ (invite vendors to quote) →
// Purchase Orders → goods receipt (GRN). Vendors are the supplier master,
// managed here in their own tab.
const TABS = [
  {
    id: "takeoff",
    label: "Take-off",
    icon: FileBox,
    description: "Roll a BOQ's materials into a requisition",
    component: Takeoff,
  },
  {
    id: "rfqs",
    label: "RFQs",
    icon: Send,
    description: "Invite vendors to quote a take-off before committing a PO",
    component: RFQs,
  },
  {
    id: "purchase-orders",
    label: "Purchase Orders",
    icon: Package,
    description: "POs raised against project contracts — material actuals",
    component: PurchaseOrders,
  },
  {
    id: "grn",
    label: "GRN",
    icon: Truck,
    description: "Goods received against open purchase orders",
    component: GRN,
  },
  {
    id: "vendors",
    label: "Vendors",
    icon: Users,
    description: "Supplier master — names, GSTIN, categories",
    component: Vendors,
  },
];

const Procurement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    TABS.find((t) => t.id === tabFromUrl)?.id || "takeoff",
  );

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) setActiveTab(tabFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl]);

  const setTab = (id) => {
    setActiveTab(id);
    setSearchParams({ tab: id });
  };

  const activeMeta = TABS.find((t) => t.id === activeTab) || TABS[0];
  const ActiveComponent = activeMeta.component;

  return (
    <div className="h-full flex flex-col bg-overallbg">
      <div className="bg-white border-b rounded-xl border-bordergray shrink-0">
        <div className="px-6 pt-4 pb-2 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-select-blue/10 text-select-blue flex items-center justify-center">
            <ShoppingCart size={14} />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-textcolor leading-tight">
              Procurement
            </h1>
            <p className="text-[11px] text-text-muted">
              Material supply chain — take-off, purchase orders, receipts &
              vendors
            </p>
          </div>
        </div>
        <div className="px-6 flex items-center gap-1 -mb-px">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-3.5 py-2.5 text-[12px] font-semibold border-b-2 transition-all ${
                  isActive
                    ? "text-select-blue border-select-blue"
                    : "text-text-muted border-transparent hover:text-textcolor hover:bg-bg-soft/50"
                }`}
                title={tab.description}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-6 py-2 bg-bg-soft/60 border-b border-bordergray/70 text-[11px] text-text-muted shrink-0">
        {activeMeta.description}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <ActiveComponent />
      </div>
    </div>
  );
};

export default Procurement;
