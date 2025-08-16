/**
 * Case Activity Type Constants
 * Defines the different types of activities that can be performed on a case
 */
const CASE_ACTIVITY_TYPES = {
  // Status-related activities
  STATUS_CHANGE: 'status_change',
  CASE_ASSIGNMENT: 'case_assignment',
  CASE_REASSIGNMENT: 'case_reassignment',

  // File-related activities
  FILE_UPLOAD: 'file_upload',
  FILE_DELETE: 'file_delete',
  FILE_DOWNLOAD: 'file_download',

  // Case lifecycle activities
  CASE_CREATED: 'case_created',
  CASE_UPDATED: 'case_updated',
  CASE_CLOSED: 'case_closed',
  CASE_REOPENED: 'case_reopened',

  // System activities
  SYSTEM_UPDATE: 'system_update',
  DATA_IMPORT: 'data_import',
  DATA_EXPORT: 'data_export',

  // User interactions
  CASE_VIEWED: 'case_viewed',
  REPORT_GENERATED: 'report_generated',
};

/**
 * Activity descriptions for different activity types
 */
const ACTIVITY_DESCRIPTIONS = {
  [CASE_ACTIVITY_TYPES.STATUS_CHANGE]: 'Thay đổi trạng thái hồ sơ',
  [CASE_ACTIVITY_TYPES.CASE_ASSIGNMENT]: 'Gán hồ sơ cho CBTD',
  [CASE_ACTIVITY_TYPES.CASE_REASSIGNMENT]: 'Chuyển giao hồ sơ',
  [CASE_ACTIVITY_TYPES.FILE_UPLOAD]: 'Tải lên tài liệu',
  [CASE_ACTIVITY_TYPES.FILE_DELETE]: 'Xóa tài liệu',
  [CASE_ACTIVITY_TYPES.FILE_DOWNLOAD]: 'Tải xuống tài liệu',
  [CASE_ACTIVITY_TYPES.CASE_CREATED]: 'Tạo hồ sơ mới',
  [CASE_ACTIVITY_TYPES.CASE_UPDATED]: 'Cập nhật thông tin hồ sơ',
  [CASE_ACTIVITY_TYPES.CASE_CLOSED]: 'Đóng hồ sơ',
  [CASE_ACTIVITY_TYPES.CASE_REOPENED]: 'Mở lại hồ sơ',
  [CASE_ACTIVITY_TYPES.SYSTEM_UPDATE]: 'Cập nhật hệ thống',
  [CASE_ACTIVITY_TYPES.DATA_IMPORT]: 'Import dữ liệu',
  [CASE_ACTIVITY_TYPES.DATA_EXPORT]: 'Export dữ liệu',
  [CASE_ACTIVITY_TYPES.CASE_VIEWED]: 'Xem hồ sơ',
  [CASE_ACTIVITY_TYPES.REPORT_GENERATED]: 'Tạo báo cáo',
};

// Array of all activity types for validation
const ALL_ACTIVITY_TYPES = Object.values(CASE_ACTIVITY_TYPES);

module.exports = {
  CASE_ACTIVITY_TYPES,
  ACTIVITY_DESCRIPTIONS,
  ALL_ACTIVITY_TYPES,
};
