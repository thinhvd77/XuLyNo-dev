const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.routes');
const caseRoutes = require('./case.routes');
const userRoutes = require('./user.routes');
const dashboardRoutes = require('./dashboard.routes');
const reportRoutes = require('./report.routes');
const caseNoteRoutes = require('./caseNote.routes');
const caseActivityRoutes = require('./caseActivity.routes');
const caseTimelineRoutes = require('./caseTimeline.routes');
const delegationRoutes = require('./delegation.routes');
const healthRoutes = require('./health.routes');
const permissionRoutes = require('./permission.routes');

router.use('/auth', authRoutes);
router.use('/cases', caseRoutes);
router.use('/users', userRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/report', reportRoutes);
router.use('/case-notes', caseNoteRoutes);
router.use('/case-activities', caseActivityRoutes);
router.use('/case-timeline', caseTimelineRoutes);
router.use('/delegations', delegationRoutes);
router.use('/health', healthRoutes);
router.use('/permissions', permissionRoutes);

module.exports = router;
