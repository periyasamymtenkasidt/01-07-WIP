import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAuthenticated } from "../auth/auth";

// Guards every nested route. Unauthenticated visits redirect to the
// login page (`/login` — `/` is the public landing) and remember where they
// were headed via `state.from`.
const ProtectedRoute = () => {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
