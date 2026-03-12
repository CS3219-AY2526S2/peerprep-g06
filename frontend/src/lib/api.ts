const USER_BASE_URL = import.meta.env.VITE_USER_SERVICE_URL;

export const USER_ENDPOINTS = {
  requestAdmin: (userId: string) => `${USER_BASE_URL}/users/${userId}/admin-request`,
  health: `${USER_BASE_URL}/users/health`,
  getAdminRequests: `${USER_BASE_URL}/users/admin-requests`,
  approveAdmin: (requestId: string) => `${USER_BASE_URL}/users/admin-requests/${requestId}/approve`,
  rejectAdmin: (requestId: string) => `${USER_BASE_URL}/users/admin-requests/${requestId}/reject`,
};
