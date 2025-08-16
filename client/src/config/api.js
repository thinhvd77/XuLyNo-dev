// API Configuration
// Có thể override bằng VITE_API_BASE_URL environment variable
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : `http://${window.location.hostname}:3000`);

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/api/auth/login`,
  },
  REPORT: {
    CAN_EXPORT: `${API_BASE_URL}/api/report/can-export`,
    EXPORT_WHITELIST: `${API_BASE_URL}/api/report/export-whitelist`,
  },
  USERS: {
    LIST: `${API_BASE_URL}/api/users`,
    CREATE: `${API_BASE_URL}/api/users/create`,
    UPDATE: (id) => `${API_BASE_URL}/api/users/${id}`,
    TOGGLE_STATUS: (id) => `${API_BASE_URL}/api/users/${id}/status`,
    DELETE: (id) => `${API_BASE_URL}/api/users/${id}`,
    CHANGE_PASSWORD: (id) => `${API_BASE_URL}/api/users/${id}/change-password`,
    CHANGE_MY_PASSWORD: `${API_BASE_URL}/api/users/change-my-password`,
    EMPLOYEES_FOR_FILTER: `${API_BASE_URL}/api/users/employees-for-filter`,
    BRANCHES_FOR_FILTER: `${API_BASE_URL}/api/users/branches-for-filter`,
    DEPARTMENTS_FOR_FILTER: `${API_BASE_URL}/api/users/departments-for-filter`,
  },
  CASES: {
    MY_CASES: `${API_BASE_URL}/api/cases/my-cases`,
    ALL_CASES: `${API_BASE_URL}/api/cases/all-cases`,
    DEPARTMENT_CASES: `${API_BASE_URL}/api/cases/department-cases`,
    BY_EMPLOYEE: (employeeCode) => `${API_BASE_URL}/api/cases/by-employee/${employeeCode}`,
    IMPORT_INTERNAL: `${API_BASE_URL}/api/cases/import-internal`,
    IMPORT_EXTERNAL: `${API_BASE_URL}/api/cases/import-external`,
    DOCUMENTS: (caseId) => `${API_BASE_URL}/api/cases/${caseId}/documents`,
    DOCUMENT_PREVIEW: (documentId) => `${API_BASE_URL}/api/cases/documents/${documentId}/preview`,
    DOCUMENT_DOWNLOAD: (documentId) => `${API_BASE_URL}/api/cases/documents/${documentId}/download`,
    CASE_DETAIL: (caseId) => `${API_BASE_URL}/api/cases/${caseId}`,
    CASE_OVERVIEW: (caseId) => `${API_BASE_URL}/api/cases/${caseId}/overview`,
    CASE_CONTENTS: (caseId) => `${API_BASE_URL}/api/cases/contents/${caseId}`,
    CASE_UPDATES: (caseId) => `${API_BASE_URL}/api/cases/${caseId}/updates`,
    CASE_TIMELINE: (caseId) => `${API_BASE_URL}/api/case-timeline/${caseId}`,
    CASE_NOTES: `${API_BASE_URL}/api/case-notes`,
    CASE_STATUS: (caseId) => `${API_BASE_URL}/api/cases/${caseId}/status`,
    DELETE_DOCUMENT: (documentId) => `${API_BASE_URL}/api/cases/documents/${documentId}`,
  },
  DELEGATIONS: {
    LIST: `${API_BASE_URL}/api/delegations`,
    CREATE: `${API_BASE_URL}/api/delegations`,
    REVOKE: (id) => `${API_BASE_URL}/api/delegations/${id}/revoke`,
    BY_CASE: (caseId) => `${API_BASE_URL}/api/delegations/case/${caseId}`,
    EXPIRE_OVERDUE: `${API_BASE_URL}/api/delegations/expire-overdue`,
  },
  DASHBOARD: {
    STATS: `${API_BASE_URL}/api/dashboard/stats`,
    DIRECTOR_STATS: `${API_BASE_URL}/api/dashboard/director-stats`,
  },
  PERMISSIONS: {
    LIST: `${API_BASE_URL}/api/permissions`,
    USER_PERMISSIONS: (userId) => `${API_BASE_URL}/api/users/${userId}/permissions`,
  },
};

export default API_BASE_URL;
