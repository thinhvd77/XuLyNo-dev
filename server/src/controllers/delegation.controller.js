const delegationService = require('../services/delegation.service');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');

/**
 * Create new delegations for multiple cases
 * POST /api/delegations
 */
exports.createDelegations = asyncHandler(async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { case_ids, delegated_to_employee_code, expiry_date, notes } = req.body;
  const currentUser = req.user;

  // Validate input
  if (!Array.isArray(case_ids) || case_ids.length === 0) {
    throw new ValidationError('Case IDs array is required and cannot be empty');
  }

  if (!delegated_to_employee_code) {
    throw new ValidationError('Delegatee employee code is required');
  }

  if (!expiry_date) {
    throw new ValidationError('Expiry date is required');
  }

  // Validate expiry date is in the future
  const expiryDateTime = new Date(expiry_date);
  const now = new Date();
  if (expiryDateTime <= now) {
    throw new ValidationError('Expiry date must be in the future');
  }

  try {
    const AppDataSource = require('../config/dataSource');
    const caseRepository = AppDataSource.getRepository('DebtCase');

    // Verify all cases exist and get delegator information
    const cases = await caseRepository.find({
      where: case_ids.map((id) => ({ case_id: id })),
      relations: ['officer'],
    });

    if (cases.length !== case_ids.length) {
      throw new ValidationError('Some cases were not found');
    }

    // Check if user has permission to delegate these cases
    const userRole = currentUser.role;
    const userEmployeeCode = currentUser.employee_code;
    const userDept = currentUser.dept;
    const userBranchCode = currentUser.branch_code;

    // Access control logic
    for (const caseItem of cases) {
      let hasAccess = false;

      if (userRole === 'administrator') {
        hasAccess = true;
      } else if (userRole === 'director' || userRole === 'deputy_director') {
        hasAccess = true; // Directors can delegate any case in their scope
      } else if (userRole === 'manager' || userRole === 'deputy_manager') {
        // Managers can delegate cases in their department and branch
        if (
          caseItem.officer &&
          caseItem.officer.dept === userDept &&
          caseItem.officer.branch_code === userBranchCode
        ) {
          hasAccess = true;
        }
      } else if (userRole === 'employee') {
        // Employees can only delegate their own cases
        if (caseItem.assigned_employee_code === userEmployeeCode) {
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        throw new ValidationError(`You don't have permission to delegate case ${caseItem.case_id}`);
      }
    }

    // Use the current user as delegator for their own cases, or the case owner for others
    const delegatorCode =
      userRole === 'employee' ? userEmployeeCode : cases[0].assigned_employee_code;

    // Use the expiry date directly from frontend
    const delegations = await delegationService.createDelegations(
      case_ids,
      delegatorCode,
      delegated_to_employee_code,
      expiryDateTime,
      notes,
    );

    logger.info('Delegations created successfully', {
      user: currentUser.employee_code,
      role: userRole,
      delegator: delegatorCode,
      delegatee: delegated_to_employee_code,
      caseCount: case_ids.length,
      expiryDate: expiry_date,
      notes: notes || 'No notes',
    });

    res.status(201).json({
      success: true,
      message: `Successfully delegated ${case_ids.length} cases until ${expiry_date}`,
      data: {
        delegations: delegations.map((d) => ({
          delegation_id: d.delegation_id,
          case_id: d.case_id,
          delegated_by_employee_code: d.delegated_by_employee_code,
          delegated_to_employee_code: d.delegated_to_employee_code,
          delegation_date: d.delegation_date,
          expiry_date: d.expiry_date,
          status: d.status,
          notes: d.notes,
        })),
        summary: {
          totalDelegated: delegations.length,
          delegatorCode,
          delegateeCode: delegated_to_employee_code,
          expiryDate: expiry_date,
          notes: notes || null,
        },
      },
    });
  } catch (error) {
    logger.error('Error creating delegations:', {
      error: error.message,
      user: currentUser.employee_code,
      case_ids,
      delegated_to_employee_code,
      expiry_date,
      notes,
    });

    throw error;
  }
});

/**
 * Get all active delegations with pagination and filtering
 * GET /api/delegations
 */
exports.getDelegations = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, delegatorCode, delegateeCode, caseId } = req.query;

  const filters = {};
  if (delegatorCode) {filters.delegatorCode = delegatorCode;}
  if (delegateeCode) {filters.delegateeCode = delegateeCode;}
  if (caseId) {filters.caseId = caseId;}

  const pagination = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const result = await delegationService.getActiveDelegationsForAdmin(filters, pagination);

  res.status(200).json({
    success: true,
    message: 'Active delegations retrieved successfully',
    data: result,
  });
});

/**
 * Revoke a specific delegation
 * PATCH /api/delegations/:delegationId/revoke
 */
exports.revokeDelegation = asyncHandler(async (req, res) => {
  const { delegationId } = req.params;
  const revokerUser = req.user;

  if (!delegationId) {
    throw new ValidationError('Delegation ID is required');
  }

  const updatedDelegation = await delegationService.revokeDelegation(delegationId, revokerUser);

  logger.info('Delegation revoked successfully', {
    delegationId,
    revoker: revokerUser.employee_code,
    revokerRole: revokerUser.role,
  });

  res.status(200).json({
    success: true,
    message: 'Delegation revoked successfully',
    data: {
      delegation_id: updatedDelegation.delegation_id,
      case_id: updatedDelegation.case_id,
      delegated_by_employee_code: updatedDelegation.delegated_by_employee_code,
      delegated_to_employee_code: updatedDelegation.delegated_to_employee_code,
      delegation_date: updatedDelegation.delegation_date,
      expiry_date: updatedDelegation.expiry_date,
      status: updatedDelegation.status,
    },
  });
});

/**
 * Get delegations for a specific case
 * GET /api/delegations/case/:caseId
 */
exports.getDelegationsByCase = asyncHandler(async (req, res) => {
  const { caseId } = req.params;

  if (!caseId) {
    throw new ValidationError('Case ID is required');
  }

  const delegations = await delegationService.getDelegationsByCase(caseId);

  res.status(200).json({
    success: true,
    message: 'Case delegations retrieved successfully',
    data: delegations,
  });
});

/**
 * Expire overdue delegations immediately (admin only)
 * POST /api/delegations/expire-overdue
 */
exports.expireOverdueDelegations = asyncHandler(async (req, res) => {
  const result = await delegationService.expireOverdueDelegationsWithNotification();

  res.status(200).json({
    success: true,
    message: `Expired ${result.expiredCount} delegations; sent ${result.notificationsSent} notifications`,
    data: result,
  });
});
