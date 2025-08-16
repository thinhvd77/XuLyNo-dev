/**
 * Hằng số cho trạng thái và loại case trong hệ thống
 * Sử dụng tiếng Việt làm chuẩn cho tất cả dữ liệu trong database
 */

// Trạng thái case
const CASE_STATUS = {
  NEW: 'Mới',
  PROCESSING: 'Đang xử lý',
  BEING_FOLLOWED_UP: 'Đang đôn đốc',
  BEING_SUED: 'Đang khởi kiện',
  AWAITING_JUDGMENT_EFFECT: 'Chờ hiệu lực án',
  BEING_EXECUTED: 'Đang thi hành án',
  PROACTIVELY_SETTLED: 'Chủ động XLTS',
  DEBT_SOLD: 'Bán nợ',
  AMC_HIRED: 'Thuê AMC XLN',
};

// Loại case
const CASE_TYPE = {
  INTERNAL: 'internal', // Nội bảng
  EXTERNAL: 'external', // Ngoại bảng
};

// Mapping từ các giá trị cũ sang giá trị chuẩn (tiếng Việt)
const STATUS_MAPPING = {
  // English values -> Vietnamese
  beingFollowedUp: CASE_STATUS.BEING_FOLLOWED_UP,
  beingSued: CASE_STATUS.BEING_SUED,
  awaitingJudgmentEffect: CASE_STATUS.AWAITING_JUDGMENT_EFFECT,
  beingExecuted: CASE_STATUS.BEING_EXECUTED,
  proactivelySettled: CASE_STATUS.PROACTIVELY_SETTLED,
  debtSold: CASE_STATUS.DEBT_SOLD,
  amcHired: CASE_STATUS.AMC_HIRED,

  // Vietnamese values (keep as is)
  [CASE_STATUS.NEW]: CASE_STATUS.NEW,
  [CASE_STATUS.PROCESSING]: CASE_STATUS.PROCESSING,
  [CASE_STATUS.BEING_FOLLOWED_UP]: CASE_STATUS.BEING_FOLLOWED_UP,
  [CASE_STATUS.BEING_SUED]: CASE_STATUS.BEING_SUED,
  [CASE_STATUS.AWAITING_JUDGMENT_EFFECT]: CASE_STATUS.AWAITING_JUDGMENT_EFFECT,
  [CASE_STATUS.BEING_EXECUTED]: CASE_STATUS.BEING_EXECUTED,
  [CASE_STATUS.PROACTIVELY_SETTLED]: CASE_STATUS.PROACTIVELY_SETTLED,
  [CASE_STATUS.DEBT_SOLD]: CASE_STATUS.DEBT_SOLD,
  [CASE_STATUS.AMC_HIRED]: CASE_STATUS.AMC_HIRED,
};

const CASE_TYPE_MAPPING = {
  // English values -> Vietnamese
  internal: 'NỘI BẢNG',
  external: 'NGOẠI BẢNG',
};

/**
 * Chuyển đổi status về chuẩn tiếng Việt
 */
const normalizeStatus = (status) => {
  return STATUS_MAPPING[status] || status;
};

/**
 * Chuyển đổi case type về chuẩn tiếng Việt
 */
const normalizeCaseType = (caseType) => {
  return CASE_TYPE_MAPPING[caseType] || caseType;
};

module.exports = {
  CASE_STATUS,
  CASE_TYPE,
  STATUS_MAPPING,
  CASE_TYPE_MAPPING,
  normalizeStatus,
  normalizeCaseType,
};
