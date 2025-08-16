const caseTimelineService = require('../services/caseTimeline.service');
const { param, query, validationResult } = require('express-validator');
const logger = require('../config/logger');

/**
 * Get unified timeline for a case (notes + activities)
 */
const getCaseTimeline = [
  // Validation
  param('caseId').isUUID().withMessage('Valid case ID is required'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('type')
    .optional()
    .isIn(['all', 'notes', 'activities'])
    .withMessage('Type must be: all, notes, or activities'),

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
      const { page = 1, limit = 10, type = 'all' } = req.query;

      const result = await caseTimelineService.getCaseTimeline(caseId, {
        page: parseInt(page),
        limit: parseInt(limit),
        type,
        userRole: req.user.role,
        fullname: req.user.fullname,
      });

      logger.info('Case timeline fetched successfully', {
        caseId,
        page,
        limit,
        type,
        totalItems: result.timeline.length,
      });

      res.json({
        success: true,
        message: 'Lấy timeline thành công',
        data: result.timeline,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  },
];

module.exports = {
  getCaseTimeline,
};
