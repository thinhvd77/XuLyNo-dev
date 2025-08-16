const express = require('express');
const router = express.Router();
const caseTimelineController = require('../controllers/caseTimeline.controller');
const { protect, authorizeByAnyPermissionOrRole } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(protect);

/**
 * @route GET /api/case-timeline/:caseId
 * @desc Get unified timeline (notes + activities) for a specific case
 * @access Private
 */
router.get('/:caseId', authorizeByAnyPermissionOrRole(['view_own_cases', 'view_department_cases', 'view_all_cases'], 'employee', 'deputy_manager', 'manager', 'administrator', 'deputy_director', 'director'), caseTimelineController.getCaseTimeline);

module.exports = router;
