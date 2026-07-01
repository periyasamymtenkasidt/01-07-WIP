import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../auth/auth";

const Signout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Sign out clears only the auth token — all app data (leads, clients,
    // master presets, sites, BOQs, etc.) persists so an accidental sign-out
    // never wipes work. logout() removes the token; nothing else is touched.
    logout();
    navigate("/login", { replace: true });
  }, [navigate]);

  return null;
};

export default Signout;
