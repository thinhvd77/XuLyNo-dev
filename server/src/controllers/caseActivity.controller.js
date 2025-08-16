const caseActivityService = require('../services/caseActivity.service');
const { param, query, validationResult } = require('express-validator');
const logger = require('../config/logger');
const { CASE_ACTIVITY_TYPES } = require('../constants/activityConstants');

/**
 * Get activities for a case
 */
const getActivitiesByCase = [
  // Validation
  param('caseId').isUUID().withMessage('Valid case ID is required'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  query('activityType')
    .optional()
    .isIn(Object.values(CASE_ACTIVITY_TYPES))
    .withMessage('Invalid activity type'),
  query('includeSystemActivities')
    .optional()
    .isBoolean()
    .withMessage('includeSystemActivities must be a boolean'),

  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array(),
        });
      }

      const { caseId } = req.params;
      const {
        limit = 50,
        offset = 0,
        activityType = null,
        includeSystemActivities = true,
      } = req.query;

      const activities = await caseActivityService.getActivitiesByCase(caseId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        activityType,
        includeSystemActivities: includeSystemActivities === 'true',
      });

      res.json({
        success: true,
        message: 'Lấy lịch sử hoạt động thành công',
        data: activities,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
        },
      });
    } catch (error) {
      next(error);
    }
  },
];

/**
 * Get activity statistics for a case
 */
const getCaseActivityStats = [
  // Validation
  param('caseId').isUUID().withMessage('Valid case ID is required'),

  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array(),
        });
      }

      const { caseId } = req.params;

      const stats = await caseActivityService.getCaseActivityStats(caseId);

      res.json({
        success: true,
        message: 'Lấy thống kê hoạt động thành công',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  },
];

/**
 * Get available activity types
 */
const getActivityTypes = async (req, res, next) => {
  try {
    res.json({
      success: true,
      message: 'Lấy danh sách loại hoạt động thành công',
      data: {
        activityTypes: CASE_ACTIVITY_TYPES,
        descriptions: require('../constants/activityConstants').ACTIVITY_DESCRIPTIONS,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActivitiesByCase,
  getCaseActivityStats,
  getActivityTypes,
};
