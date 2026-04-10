const USER_BASE_URL = import.meta.env.VITE_USER_SERVICE_URL;
const QUESTION_BANK_URL = import.meta.env.VITE_QUESTION_SERVICE_URL;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export const USER_ENDPOINTS = {
  getProfile: `${USER_BASE_URL}/users/profile`,
  getNameById: (userId: string) => `${USER_BASE_URL}/users/profile/${userId}`,
  requestAdmin: (userId: string) => `${USER_BASE_URL}/users/${userId}/admin-request`,
  requestDemote: (userId: string) => `${USER_BASE_URL}/users/${userId}/demote-request`,
  health: `${USER_BASE_URL}/users/health`,
  getAdminRequests: `${USER_BASE_URL}/users/admin-requests`,
  getDemoteRequests: `${USER_BASE_URL}/users/demote-requests`,
  approveAdmin: (requestId: string) => `${USER_BASE_URL}/users/admin-requests/${requestId}/approve`,
  rejectAdmin: (requestId: string) => `${USER_BASE_URL}/users/admin-requests/${requestId}/reject`,
  approveDemote: (requestId: string) =>
    `${USER_BASE_URL}/users/demote-requests/${requestId}/approve`,
  rejectDemote: (requestId: string) => `${USER_BASE_URL}/users/demote-requests/${requestId}/reject`,
};

export const QUESTION_ENDPOINTS = {
  health: `${QUESTION_BANK_URL}/health`,
  getAllQuestions: `${QUESTION_BANK_URL}/questions`,
  getQuestionById: (questionId: string) => `${QUESTION_BANK_URL}/questions/${questionId}`,
  addQuestion: `${QUESTION_BANK_URL}/questions/add`,
  updateQuestion: (questionId: string) => `${QUESTION_BANK_URL}/questions/${questionId}/update`,
  deleteQuestion: (questionId: string) => `${QUESTION_BANK_URL}/questions/${questionId}/delete`,
};

export const SUPABASE_ENDPOINTS = {
  getHistory: (userId: string) =>
    `${SUPABASE_URL}/rest/v1/history?user_id=eq.${userId}&order=created_at.desc`,
};
