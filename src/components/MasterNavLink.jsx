import React from "react";
import { useNavigate } from "react-router-dom";

/**
 * Reusable helper component to navigate to Master Module.
 * Style requirements:
 * - Primary theme color (text-primary or text-select-blue)
 * - Underlined text
 * - Pointer cursor
 * - Hover effect
 */
const MasterNavLink = ({ text = "Master Module", tab = "terms", sub }) => {
  const navigate = useNavigate();

  const handleClick = (e) => {
    e.preventDefault();
    // Navigate to /master using useNavigate.
    // If a tab is specified, e.g. "terms", go straight there!
    let targetPath = tab ? `/master?tab=${tab}` : "/master";
    if (tab === "terms" && sub) {
      targetPath += `&sub=${sub}`;
    }
    navigate(targetPath);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-select-blue hover:text-primary underline cursor-pointer font-semibold transition-all inline-block hover:opacity-85"
      style={{ background: "none", border: "none", padding: 0 }}
    >
      {text}
    </button>
  );
};

export default MasterNavLink;
