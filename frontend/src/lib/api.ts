const USER_BASE_URL = import.meta.env.VITE_USER_SERVICE_URL;
const QUESTION_BANK_URL = import.meta.env.VITE_QUESTION_SERVICE_URL;

export const USER_ENDPOINTS = {
  requestAdmin: (userId: string) => `${USER_BASE_URL}/users/${userId}/admin-request`,
  health: `${USER_BASE_URL}/users/health`,
  getAdminRequests: `${USER_BASE_URL}/users/admin-requests`,
  approveAdmin: (requestId: string) => `${USER_BASE_URL}/users/admin-requests/${requestId}/approve`,
  rejectAdmin: (requestId: string) => `${USER_BASE_URL}/users/admin-requests/${requestId}/reject`,
};

export const QUESTION_ENDPOINTS = {
  health: `${QUESTION_BANK_URL}/health`,
  getAllQuestions: `${QUESTION_BANK_URL}/questions`,
  getRandomQuestion: `${QUESTION_BANK_URL}/questions/random`,
  addQuestion: `${QUESTION_BANK_URL}/questions/add`,
  updateQuestion: (questionId: string) => `${QUESTION_BANK_URL}/questions/${questionId}/update`,
  deleteQuestion: (questionId: string) => `${QUESTION_BANK_URL}/questions/${questionId}/delete`,
};
