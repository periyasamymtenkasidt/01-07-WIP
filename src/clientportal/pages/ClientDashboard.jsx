import React from "react";
import { Navigate, useParams } from "react-router-dom";
import { getActiveClientId } from "../../auth/clientAuth";

const ClientDashboard = () => {
  const { clientId } = useParams();
  const activeId = clientId || getActiveClientId();
  const target = activeId ? `/client-portal/${activeId}/dashboard` : "/client-portal/dashboard";
  return <Navigate to={target} replace />;
};

export default ClientDashboard;
