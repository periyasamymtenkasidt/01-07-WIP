const CLIENT_AUTH_KEY = "client_auth_token";
const ACTIVE_CLIENT_ID_KEY = "active_client_id";

export function clientLogin(clientId = "CL0001", token = "client_session") {
  localStorage.setItem(CLIENT_AUTH_KEY, token);
  localStorage.setItem(ACTIVE_CLIENT_ID_KEY, clientId);
}

export function clientLogout() {
  localStorage.removeItem(CLIENT_AUTH_KEY);
  localStorage.removeItem(ACTIVE_CLIENT_ID_KEY);
}

export function isClientAuthenticated() {
  return Boolean(localStorage.getItem(CLIENT_AUTH_KEY));
}

export function getActiveClientId() {
  return localStorage.getItem(ACTIVE_CLIENT_ID_KEY) || "CL0001";
}
