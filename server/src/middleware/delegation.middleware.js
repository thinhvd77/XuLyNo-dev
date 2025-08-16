const delegationService = require('../services/delegation.service');
const logger = require('../config/logger');

/**
 * Middleware to check if user can perform actions on a case
 * This includes checking for delegations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.checkCasePermission = async (req, res, next) => {
  try {
    const caseId = req.params.caseId;
    const user = req.user;

    if (!caseId) {
      return res.status(400).json({
        success: false,
        message: 'Case ID is required',
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required',
      });
    }

    // Check if user can perform action on case (includes delegation check)
    const canPerformAction = await delegationService.canPerformActionOnCase(caseId, user);

    if (!canPerformAction) {
      logger.warn('Unauthorized case access attempt via delegation check', {
        user: user.employee_code,
        role: user.role,
        caseId,
        url: req.originalUrl,
        method: req.method,
      });

      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this case',
      });
    }

    // User has permission, continue to next middleware
    next();
  } catch (error) {
    logger.error('Error in checkCasePermission middleware:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking case permissions',
    });
  }
};

/**
 * Middleware to enhance user permissions with delegation info
 * This adds delegation context to the request for logging/audit purposes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.enhanceUserPermissions = async (req, res, next) => {
  try {
    const caseId = req.params.caseId;
    const user = req.user;

    if (caseId && user) {
      // Check if user is accessing via delegation
      const delegations = await delegationService.getDelegationsByCase(caseId);
      const userDelegation = delegations.find(
        (d) => d.delegated_to_employee_code === user.employee_code,
      );

      if (userDelegation) {
        // Add delegation context to request for logging
        req.delegationContext = {
          isDelegatedAccess: true,
          delegationId: userDelegation.delegation_id,
          delegatedBy: userDelegation.delegated_by_employee_code,
          expiryDate: userDelegation.expiry_date,
        };

        logger.info('Case accessed via delegation', {
          user: user.employee_code,
          caseId,
          delegationId: userDelegation.delegation_id,
          delegatedBy: userDelegation.delegated_by_employee_code,
          expiryDate: userDelegation.expiry_date,
          url: req.originalUrl,
          method: req.method,
        });
      }
    }

    next();
  } catch (error) {
    logger.error('Error in enhanceUserPermissions middleware:', error);
    // Don't block the request, just continue without delegation context
    next();
  }
};
