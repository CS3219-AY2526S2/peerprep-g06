const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8080';

export const USER_ENDPOINTS = {
  getProfile: `${GATEWAY_URL}/users/profile`,
  requestAdmin: (userId: string) => `${GATEWAY_URL}/users/${userId}/admin-request`,
  requestDemote: (userId: string) => `${GATEWAY_URL}/users/${userId}/demote-request`,
  health: `${GATEWAY_URL}/users/health`,
  getAdminRequests: `${GATEWAY_URL}/users/admin-requests`,
  getDemoteRequests: `${GATEWAY_URL}/users/demote-requests`,
  approveAdmin: (requestId: string) => `${GATEWAY_URL}/users/admin-requests/${requestId}/approve`,
  rejectAdmin: (requestId: string) => `${GATEWAY_URL}/users/admin-requests/${requestId}/reject`,
  approveDemote: (requestId: string) => `${GATEWAY_URL}/users/demote-requests/${requestId}/approve`,
  rejectDemote: (requestId: string) => `${GATEWAY_URL}/users/demote-requests/${requestId}/reject`,
};

export const QUESTION_ENDPOINTS = {
  health: `${GATEWAY_URL}/questions/health`,
  getAllQuestions: `${GATEWAY_URL}/questions`,
  getRandomQuestion: `${GATEWAY_URL}/questions/random`,
  addQuestion: `${GATEWAY_URL}/questions/add`,
  updateQuestion: (questionId: string) => `${GATEWAY_URL}/questions/${questionId}/update`,
  deleteQuestion: (questionId: string) => `${GATEWAY_URL}/questions/${questionId}/delete`,
};
