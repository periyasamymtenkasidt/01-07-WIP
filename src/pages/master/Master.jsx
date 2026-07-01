import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, BookOpen, FileCheck, Layers } from "lucide-react";
import ProposalMaster from "./proposalMaster/ProposalMaster";
import ItemLibrary from "./itemMaster/ItemLibrary";
import MaterialMaster from "./materialMaster/MaterialMaster";
import TermsAndConditions from "./termsAndConditions/TermsAndConditions";
// Schedule Master tab commented out — reserved for future use.
// import { CalendarClock } from "lucide-react";
// import ScheduleConfig from "./scheduleConfig/ScheduleConfig";

// Settings is the hub for all "master" data — anything that's a reusable
// template / catalog rather than transactional record. Each tab is itself a
// full page that manages its own scrolling and sticky header.
const TABS = [
  {
    id: "proposals",
    label: "Proposal Master",
    icon: FileText,
    description: "Quotation templates per property preset",
    component: ProposalMaster,
  },
  {
    id: "items",
    label: "Item Master",
    icon: BookOpen,
    description: "Reusable BOQ line items, rates & specs",
    component: ItemLibrary,
  },
  {
    id: "materials",
    label: "Material Master",
    icon: Layers,
    description: "Catalog of raw construction materials, bulk pricing, and HSN codes",
    component: MaterialMaster,
  },
  {
    id: "terms",
    label: "Terms & Conditions",
    icon: FileCheck,
    description: "Reusable T&C templates per property preset",
    component: TermsAndConditions,
  },
  // Schedule Master tab commented out — reserved for future use.
  // {
  //   id: "schedule",
  //   label: "Schedule",
  //   icon: CalendarClock,
  //   description: "Escalation tiers, rooms & statuses for project schedules",
  //   component: ScheduleConfig,
  // },
];

const Master = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    TABS.find((t) => t.id === tabFromUrl)?.id || "proposals",
  );

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabFromUrl]);

  const setTab = (id) => {
    setActiveTab(id);
    setSearchParams({ tab: id });
  };

  const ActiveComponent = TABS.find((t) => t.id === activeTab)?.component || ProposalMaster;

  return (
    <div className="h-full flex flex-col bg-overallbg">
      {/* Master tab bar — a contained card (margins on the sides) so it has a
          clear right/left boundary instead of stretching to the screen edge. */}
      <div className="relative z-10 mx-3 mt-3 bg-white border border-bordergray rounded-xl shrink-0">
        <div className="px-6 pt-4 pb-2 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-select-blue/10 text-select-blue flex items-center justify-center">
            <Layers size={14} />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-textcolor leading-tight">
              Master
            </h1>
            <p className="text-[11px] text-text-muted">
              Manage master data, templates, and firm-wide configuration
            </p>
          </div>
        </div>
        <div className="px-6 flex items-center gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTab(tab.id)}
                className={`relative z-10 flex items-center gap-1.5 px-3.5 py-2.5 text-[12px] font-semibold transition-all after:absolute after:left-0 after:right-0 after:-bottom-px after:h-0.5 after:rounded-full ${
                  isActive
                    ? "text-select-blue after:bg-select-blue"
                    : "text-text-muted after:bg-transparent hover:text-textcolor hover:bg-bg-soft/50"
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

      {/* Active tab content — solid bg so the strip directly under the tab bar
          is identical for every tab (some tab pages don't fill the height). */}
      <div className="flex-1 min-h-0 overflow-hidden bg-overallbg">
        <ActiveComponent />
      </div>
    </div>
  );
};

export default Master;