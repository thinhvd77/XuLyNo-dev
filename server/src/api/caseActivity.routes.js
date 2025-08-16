const express = require('express');
const router = express.Router();
const caseActivityController = require('../controllers/caseActivity.controller');
const { protect, authorizeByAnyPermissionOrRole } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(protect);

/**
 * @route GET /api/case-activities/case/:caseId
 * @desc Get activities for a specific case
 * @access Private
 */
router.get('/case/:caseId', authorizeByAnyPermissionOrRole(['view_own_cases', 'view_department_cases', 'view_all_cases'], 'employee', 'deputy_manager', 'manager', 'administrator', 'deputy_director', 'director'), caseActivityController.getActivitiesByCase);

/**
 * @route GET /api/case-activities/case/:caseId/stats
 * @desc Get activity statistics for a specific case
 * @access Private
 */
router.get('/case/:caseId/stats', authorizeByAnyPermissionOrRole(['view_own_cases', 'view_department_cases', 'view_all_cases'], 'employee', 'deputy_manager', 'manager', 'administrator', 'deputy_director', 'director'), caseActivityController.getCaseActivityStats);

/**
 * @route GET /api/case-activities/types
 * @desc Get available activity types and descriptions
 * @access Private
 */
router.get('/types', authorizeByAnyPermissionOrRole(['view_own_cases', 'view_department_cases', 'view_all_cases'], 'employee', 'deputy_manager', 'manager', 'administrator', 'deputy_director', 'director'), caseActivityController.getActivityTypes);

module.exports = router;
