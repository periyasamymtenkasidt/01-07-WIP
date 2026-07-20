import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../auth/auth";

const Signout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    logout();
    navigate("/login", { replace: true });
  }, [navigate]);

  return null;
};

export default Signout;
