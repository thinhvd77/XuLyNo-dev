const express = require('express');
const router = express.Router();
const { protect, authorizeByAnyPermissionOrRole } = require('../middleware/auth.middleware');
const permissionController = require('../controllers/permission.controller');

/**
 * @route   GET /api/permissions
 * @desc    Get all permissions
 * @access  Private (Admin only)
 */
router.get('/', protect, authorizeByAnyPermissionOrRole(['view_permissions', 'manage_permissions'], 'administrator'), permissionController.getAllPermissions);

module.exports = router;
