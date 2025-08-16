const express = require('express');
const { body, param, query } = require('express-validator');
const { protect, authorize, authorizeByAnyPermissionOrRole } = require('../middleware/auth.middleware');
const delegationController = require('../controllers/delegation.controller');

const router = express.Router();

/**
 * POST /api/delegations
 * Create new delegations (bulk operation)
 * Allow all authenticated users to create delegations (with proper access control in controller)
 */
router.post(
  '/',
  protect,
  authorizeByAnyPermissionOrRole(['create_delegation', 'manage_delegations'], 'employee', 'deputy_manager', 'manager', 'administrator', 'deputy_director', 'director'),
  [
    body('case_ids').isArray({ min: 1 }).withMessage('Case IDs must be a non-empty array'),
    body('case_ids.*').isUUID().withMessage('Each case ID must be a valid UUID'),
    body('delegated_to_employee_code')
      .notEmpty()
      .isLength({ min: 1, max: 50 })
      .withMessage('Delegatee employee code is required and must be 1-50 characters'),
    body('expiry_date').isISO8601().withMessage('Expiry date must be a valid ISO date'),
    body('notes').optional().isLength({ max: 500 }).withMessage('Notes must be max 500 characters'),
  ],
  delegationController.createDelegations,
);

/**
 * GET /api/delegations
 * Get all active delegations with pagination and filtering
 * Only administrators can view all delegations
 */
router.get(
  '/',
  protect,
  authorizeByAnyPermissionOrRole(['manage_delegations', 'view_delegations'], 'administrator'),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('delegatorCode')
      .optional()
      .isLength({ max: 50 })
      .withMessage('Delegator code must be max 50 characters'),
    query('delegateeCode')
      .optional()
      .isLength({ max: 50 })
      .withMessage('Delegatee code must be max 50 characters'),
    query('caseId').optional().isUUID().withMessage('Case ID must be a valid UUID'),
  ],
  delegationController.getDelegations,
);

/**
 * PATCH /api/delegations/:delegationId/revoke
 * Revoke a specific delegation
 * Only administrators can revoke delegations
 */
router.patch(
  '/:delegationId/revoke',
  protect,
  authorizeByAnyPermissionOrRole(['manage_delegations'], 'administrator'),
  [param('delegationId').isUUID().withMessage('Delegation ID must be a valid UUID')],
  delegationController.revokeDelegation,
);

/**
 * GET /api/delegations/case/:caseId
 * Get delegations for a specific case
 * Accessible by administrators and users who can access the case
 */
router.get(
  '/case/:caseId',
  protect,
  authorizeByAnyPermissionOrRole(['view_delegations', 'manage_delegations'], 'employee', 'deputy_manager', 'manager', 'administrator', 'deputy_director', 'director'),
  [param('caseId').isUUID().withMessage('Case ID must be a valid UUID')],
  delegationController.getDelegationsByCase,
);

/**
 * POST /api/delegations/expire-overdue
 * Expire overdue delegations immediately (admin only)
 */
router.post(
  '/expire-overdue',
  protect,
  authorizeByAnyPermissionOrRole(['manage_delegations'], 'administrator'),
  delegationController.expireOverdueDelegations,
);

module.exports = router;
