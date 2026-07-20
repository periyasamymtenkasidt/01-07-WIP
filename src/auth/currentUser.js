// Lightweight current-user store for the staff session.
// Populated at login by startLocalStaffSession (orgAccounts.js) and cleared at
// logout. Read anywhere in the app to get the authenticated user's display name
// for audit trail entries, signoffs, and activity logs.

const KEY = "current_user";

export const setCurrentUser = (user) => {
  if (!user) {
    localStorage.removeItem(KEY);
    return;
  }
  localStorage.setItem(
    KEY,
    JSON.stringify({
      name: user.name || "",
      email: user.email || "",
      role: user.role || "",
    }),
  );
};

export const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearCurrentUser = () => localStorage.removeItem(KEY);
