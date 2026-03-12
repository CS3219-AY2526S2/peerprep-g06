const USER_BASE_URL = import.meta.env.VITE_USER_SERVICE_URL;

export const USER_ENDPOINTS = {
  requestAdmin: `${USER_BASE_URL}/users/request-admin`,
  health: `${USER_BASE_URL}/users/health`,
  getAdminRequests: `${USER_BASE_URL}/users/admin-requests`,
};
