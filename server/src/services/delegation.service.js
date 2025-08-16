const AppDataSource = require('../config/dataSource');
const logger = require('../config/logger');
const {
  DELEGATION_STATUS,
  MIN_DELEGATION_DAYS,
  MAX_DELEGATION_DAYS,
} = require('../constants/delegationConstants');
const { In, LessThan } = require('typeorm');

/**
 * Create delegations for multiple cases
 * @param {string[]} caseIds - Array of case IDs to delegate
 * @param {string} delegatorCode - Employee code of the delegator
 * @param {string} delegateeCode - Employee code of the delegatee
 * @param {Date} expiryDate - Absolute expiry date for delegation
 * @param {string} notes - Optional notes for the delegation
 * @returns {Promise<Object[]>} Created delegation records
 */
exports.createDelegations = async (
  caseIds,
  delegatorCode,
  delegateeCode,
  expiryDate,
  notes = null,
) => {
  if (!Array.isArray(caseIds) || caseIds.length === 0) {
    throw new Error('Case IDs array is required and cannot be empty');
  }

  if (!delegatorCode || !delegateeCode) {
    throw new Error('Delegator and delegatee employee codes are required');
  }

  if (!expiryDate || !(expiryDate instanceof Date)) {
    throw new Error('Valid expiry date is required');
  }

  // Validate expiry date is in the future
  const now = new Date();
  if (expiryDate <= now) {
    throw new Error('Expiry date must be in the future');
  }

  if (delegatorCode === delegateeCode) {
    throw new Error('Cannot delegate to yourself');
  }

  const caseRepository = AppDataSource.getRepository('DebtCase');
  const userRepository = AppDataSource.getRepository('User');
  const delegationRepository = AppDataSource.getRepository('CaseDelegation');

  // Validate delegatee exists and is active
  const delegatee = await userRepository.findOne({
    where: { employee_code: delegateeCode, status: 'active' },
  });

  if (!delegatee) {
    throw new Error('Delegatee not found or inactive');
  }

  // Validate delegator exists
  const delegator = await userRepository.findOne({
    where: { employee_code: delegatorCode, status: 'active' },
  });

  if (!delegator) {
    throw new Error('Delegator not found or inactive');
  }

  // Validate all cases exist and are assigned to delegator
  const cases = await caseRepository.find({
    where: caseIds.map((caseId) => ({ case_id: caseId })),
    relations: ['officer'],
  });

  if (cases.length !== caseIds.length) {
    throw new Error('Some cases not found');
  }

  // Check ownership for all cases
  const invalidCases = cases.filter(
    (caseItem) => caseItem.assigned_employee_code !== delegatorCode,
  );
  if (invalidCases.length > 0) {
    throw new Error(
      `Cases ${invalidCases.map((c) => c.case_id).join(', ')} are not assigned to delegator`,
    );
  }

  // Check for existing active delegations
  const existingDelegations = await delegationRepository.find({
    where: {
      case_id: In(caseIds),
      status: DELEGATION_STATUS.ACTIVE,
    },
  });

  if (existingDelegations.length > 0) {
    const delegatedCaseIds = existingDelegations.map((d) => d.case_id);
    throw new Error(`Cases ${delegatedCaseIds.join(', ')} already have active delegations`);
  }

  // Calculate expiry date - use the provided absolute date
  // Note: expiryDate parameter is already a Date object passed from controller

  // Create delegations
  const delegations = caseIds.map((caseId) => {
    return delegationRepository.create({
      case_id: caseId,
      delegated_by_employee_code: delegatorCode,
      delegated_to_employee_code: delegateeCode,
      expiry_date: expiryDate,
      status: DELEGATION_STATUS.ACTIVE,
      notes,
    });
  });

  const savedDelegations = await delegationRepository.save(delegations);

  logger.info('Delegations created successfully', {
    delegator: delegatorCode,
    delegatee: delegateeCode,
    caseCount: caseIds.length,
    expiryDate: expiryDate.toISOString(),
  });

  return savedDelegations;
};

/**
 * Revoke a delegation
 * @param {string} delegationId - ID of delegation to revoke
 * @param {Object} revokerUser - User performing the revocation
 * @returns {Promise<Object>} Updated delegation record
 */
exports.revokeDelegation = async (delegationId, revokerUser) => {
  if (!delegationId) {
    throw new Error('Delegation ID is required');
  }

  if (!revokerUser || !revokerUser.employee_code) {
    throw new Error('Revoker user information is required');
  }

  const delegationRepository = AppDataSource.getRepository('CaseDelegation');

  const delegation = await delegationRepository.findOne({
    where: { delegation_id: delegationId },
    relations: ['delegator', 'delegatee', 'case'],
  });

  if (!delegation) {
    throw new Error('Delegation not found');
  }

  if (delegation.status !== DELEGATION_STATUS.ACTIVE) {
    throw new Error('Only active delegations can be revoked');
  }

  // Check authorization - only delegator or administrator can revoke
  const canRevoke =
    revokerUser.employee_code === delegation.delegated_by_employee_code ||
    revokerUser.role === 'administrator';

  if (!canRevoke) {
    throw new Error('Unauthorized to revoke this delegation');
  }

  // Update delegation status
  delegation.status = DELEGATION_STATUS.REVOKED;
  const updatedDelegation = await delegationRepository.save(delegation);

  logger.info('Delegation revoked', {
    delegationId,
    revoker: revokerUser.employee_code,
    delegator: delegation.delegated_by_employee_code,
    delegatee: delegation.delegated_to_employee_code,
    caseId: delegation.case_id,
  });

  return updatedDelegation;
};

/**
 * Get delegations by case ID
 * @param {string} caseId - Case ID to get delegations for
 * @returns {Promise<Object[]>} Active delegations for the case
 */
exports.getDelegationsByCase = async (caseId) => {
  if (!caseId) {
    throw new Error('Case ID is required');
  }

  const delegationRepository = AppDataSource.getRepository('CaseDelegation');

  const delegations = await delegationRepository.find({
    where: {
      case_id: caseId,
      status: DELEGATION_STATUS.ACTIVE,
    },
    relations: ['delegator', 'delegatee', 'case'],
    order: { delegation_date: 'DESC' },
  });

  return delegations;
};

/**
 * Get active delegations for admin dashboard with pagination and filtering
 * @param {Object} filters - Filter criteria
 * @param {Object} pagination - Pagination parameters
 * @returns {Promise<Object>} Paginated delegation results
 */
exports.getActiveDelegationsForAdmin = async (filters = {}, pagination = {}) => {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  const delegationRepository = AppDataSource.getRepository('CaseDelegation');

  const queryBuilder = delegationRepository
    .createQueryBuilder('delegation')
    .leftJoinAndSelect('delegation.delegator', 'delegator')
    .leftJoinAndSelect('delegation.delegatee', 'delegatee')
    .leftJoinAndSelect('delegation.case', 'case')
    .where('delegation.status = :status', { status: DELEGATION_STATUS.ACTIVE });

  // Apply filters
  if (filters.delegatorCode) {
    queryBuilder.andWhere('delegation.delegated_by_employee_code = :delegatorCode', {
      delegatorCode: filters.delegatorCode,
    });
  }

  if (filters.delegateeCode) {
    queryBuilder.andWhere('delegation.delegated_to_employee_code = :delegateeCode', {
      delegateeCode: filters.delegateeCode,
    });
  }

  if (filters.caseId) {
    queryBuilder.andWhere('delegation.case_id = :caseId', { caseId: filters.caseId });
  }

  // Add ordering
  queryBuilder.orderBy('delegation.delegation_date', 'DESC');

  try {
    const [delegations, totalCount] = await Promise.all([
      queryBuilder.skip(offset).take(limit).getMany(),
      queryBuilder.getCount(),
    ]);

    // Map to DTO: replace case_id with customer_code at top level
    const delegationsDto = (delegations || []).map((d) => ({
      delegation_id: d.delegation_id,
      customer_code: d.case ? d.case.customer_code : null,
      delegated_by_employee_code: d.delegated_by_employee_code,
      delegated_to_employee_code: d.delegated_to_employee_code,
      delegation_date: d.delegation_date,
      expiry_date: d.expiry_date,
      status: d.status,
      notes: d.notes,
      // keep related user objects for UI
      delegator: d.delegator || null,
      delegatee: d.delegatee || null,
    }));

    return {
      delegations: delegationsDto,
      total: totalCount,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalCount / limit),
    };
  } catch (error) {
    logger.error('Error fetching active delegations:', error);
    throw new Error('Failed to retrieve active delegations');
  }
};

/**
 * Check if user can perform action on case (includes delegation check)
 * @param {string} caseId - Case ID to check
 * @param {Object} user - User object
 * @returns {Promise<boolean>} Whether user can perform action
 */
exports.canPerformActionOnCase = async (caseId, user) => {
  if (!caseId || !user) {
    return false;
  }

  // Administrator always has access
  if (user.role === 'administrator') {
    return true;
  }

  const caseRepository = AppDataSource.getRepository('DebtCase');
  const delegationRepository = AppDataSource.getRepository('CaseDelegation');

  // Get case details
  const caseDetail = await caseRepository.findOne({
    where: { case_id: caseId },
    relations: ['officer'],
  });

  if (!caseDetail) {
    return false;
  }

  // Check if user is the assigned officer
  if (caseDetail.assigned_employee_code === user.employee_code) {
    return true;
  }

  // Check if user has active delegation for this case
  const activeDelegation = await delegationRepository.findOne({
    where: {
      case_id: caseId,
      delegated_to_employee_code: user.employee_code,
      status: DELEGATION_STATUS.ACTIVE,
    },
  });

  if (activeDelegation) {
    // Check if delegation hasn't expired
    return new Date() <= new Date(activeDelegation.expiry_date);
  }

  return false;
};

/**
 * Automatically expire delegations that have passed their expiry date
 * This should be called by a scheduled job
 * @returns {Promise<number>} Number of delegations expired
 */
exports.expireOverdueDelegations = async () => {
  const delegationRepository = AppDataSource.getRepository('CaseDelegation');

  try {
    const result = await delegationRepository
      .createQueryBuilder()
      .update()
      .set({ status: DELEGATION_STATUS.EXPIRED })
      .where('status = :activeStatus', { activeStatus: DELEGATION_STATUS.ACTIVE })
      .andWhere('expiry_date < :currentDate', { currentDate: new Date() })
      .execute();

    const expiredCount = result.affected || 0;

    if (expiredCount > 0) {
      logger.info(`Expired ${expiredCount} overdue delegations`);
    }

    return expiredCount;
  } catch (error) {
    logger.error('Error expiring overdue delegations:', error);
    throw error;
  }
};

/**
 * Expire overdue delegations and send WebSocket notifications to affected users
 * @returns {Promise<Object>} Object with expiredCount and notificationsSent
 */
exports.expireOverdueDelegationsWithNotification = async () => {
  const delegationRepository = AppDataSource.getRepository('CaseDelegation');

  try {
    // First, get all delegations that will be expired
    const expiredDelegations = await delegationRepository.find({
      where: {
        status: DELEGATION_STATUS.ACTIVE,
        expiry_date: LessThan(new Date()),
      },
      relations: ['case', 'delegatee'],
    });

    if (expiredDelegations.length === 0) {
      return { expiredCount: 0, notificationsSent: 0 };
    }

    // Update delegations to expired status
    const result = await delegationRepository
      .createQueryBuilder()
      .update()
      .set({ status: DELEGATION_STATUS.EXPIRED })
      .where('status = :activeStatus', { activeStatus: DELEGATION_STATUS.ACTIVE })
      .andWhere('expiry_date < :currentDate', { currentDate: new Date() })
      .execute();

    const expiredCount = result.affected || 0;
    let notificationsSent = 0;

    // Send WebSocket notifications to affected users
    if (global.io && expiredDelegations.length > 0) {
      // Group delegations by delegatee
      const delegationsByUser = {};
      expiredDelegations.forEach((delegation) => {
        const userCode = delegation.delegated_to_employee_code;
        if (!delegationsByUser[userCode]) {
          delegationsByUser[userCode] = [];
        }
        delegationsByUser[userCode].push(delegation);
      });

      // Send notifications to each affected user
      for (const [userCode, userDelegations] of Object.entries(delegationsByUser)) {
        const caseCount = userDelegations.length;
        const caseIds = userDelegations.map((d) => d.case_id);

        const notification = {
          type: 'DELEGATION_EXPIRED',
          title: 'Ủy quyền đã hết hạn',
          message: `${caseCount} hồ sơ ủy quyền của bạn đã hết hạn và không còn quyền truy cập`,
          data: {
            expiredCaseCount: caseCount,
            caseIds,
            expiredAt: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
          action: {
            type: 'REDIRECT_TO_MYCASES',
            url: '/mycases',
          },
        };

        // Send to user's personal room
        global.io.to(`user_${userCode}`).emit('notification', notification);

        logger.info(`Sent delegation expiry notification to user ${userCode}`, {
          userCode,
          expiredCaseCount: caseCount,
          caseIds,
        });

        notificationsSent++;
      }
    }

    if (expiredCount > 0) {
      logger.info(
        `Expired ${expiredCount} overdue delegations and sent ${notificationsSent} notifications`,
      );
    }

    return { expiredCount, notificationsSent };
  } catch (error) {
    logger.error('Error expiring overdue delegations with notifications:', error);
    throw error;
  }
};
