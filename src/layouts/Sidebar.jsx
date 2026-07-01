import { NavLink } from "react-router-dom";
import { Menus, SupportMenu } from "../helperConfigData/helperData";

const linkClass = ({ isActive }) =>
  `flex flex-col md:flex-row items-center md:items-center gap-1 md:gap-3
   px-2 md:px-3 py-2 rounded-lg mb-1 md:mb-2 transition-colors
   ${
     isActive
       ? "bg-active-bg text-select-blue md:border-r-4 md:border-select-blue"
       : "text-grey hover:bg-active-bg"
   }`;

const renderItem = (item) => {
  const Icon = item.icon;
  return (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.path === "/dashboard"}
      title={item.name}
      className={linkClass}
    >
      <Icon size={20} />
      <span className="text-[9px] leading-tight text-center md:text-sm md:leading-normal md:text-left">
        {item.name}
      </span>
    </NavLink>
  );
};

const Sidebar = () => (
  <div className="flex flex-col justify-between min-h-full p-3 md:p-4 w-20 md:w-64">
    <div>{Menus.map(renderItem)}</div>
    <div>{SupportMenu.map(renderItem)}</div>
  </div>
);

export default Sidebar;
