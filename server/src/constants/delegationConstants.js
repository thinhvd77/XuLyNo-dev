/**
 * Delegation Status Constants
 */
const DELEGATION_STATUS = {
  ACTIVE: 'active',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
};

/**
 * Default delegation duration in days
 */
const DEFAULT_DELEGATION_DAYS = 30;

/**
 * Maximum delegation duration in days
 */
const MAX_DELEGATION_DAYS = 365;

/**
 * Minimum delegation duration in days
 */
const MIN_DELEGATION_DAYS = 1;

module.exports = {
  DELEGATION_STATUS,
  DEFAULT_DELEGATION_DAYS,
  MAX_DELEGATION_DAYS,
  MIN_DELEGATION_DAYS,
};
