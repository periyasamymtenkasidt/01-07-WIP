import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isClientAuthenticated } from "../auth/clientAuth";
import { isAuthenticated } from "../auth/auth";

const ClientProtectedRoute = () => {
  const location = useLocation();

  if (!isClientAuthenticated() && !isAuthenticated()) {
    return <Navigate to="/client/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default ClientProtectedRoute;
