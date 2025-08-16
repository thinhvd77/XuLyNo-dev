const express = require('express');
const router = express.Router();
const caseNoteController = require('../controllers/caseNote.controller');
const { protect, authorizeByAnyPermissionOrRole } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(protect);

/**
 * @route POST /api/case-notes
 * @desc Create a new case note
 * @access Private
 */
router.post('/', authorizeByAnyPermissionOrRole(['add_case_notes', 'edit_department_cases', 'edit_all_cases'], 'employee', 'deputy_manager', 'manager', 'administrator'), caseNoteController.createNote);

/**
 * @route GET /api/case-notes/case/:caseId
 * @desc Get all notes for a specific case
 * @access Private
 */
router.get('/case/:caseId', authorizeByAnyPermissionOrRole(['view_own_cases', 'view_department_cases', 'view_all_cases'], 'employee', 'deputy_manager', 'manager', 'administrator', 'deputy_director', 'director'), caseNoteController.getNotesByCase);

/**
 * @route GET /api/case-notes/:noteId
 * @desc Get a specific note by ID
 * @access Private
 */
router.get('/:noteId', authorizeByAnyPermissionOrRole(['view_own_cases', 'view_department_cases', 'view_all_cases'], 'employee', 'deputy_manager', 'manager', 'administrator', 'deputy_director', 'director'), caseNoteController.getNoteById);

/**
 * @route PUT /api/case-notes/:noteId
 * @desc Update a case note
 * @access Private
 */
router.put('/:noteId', authorizeByAnyPermissionOrRole(['add_case_notes', 'edit_department_cases', 'edit_all_cases'], 'employee', 'deputy_manager', 'manager', 'administrator'), caseNoteController.updateNote);

/**
 * @route DELETE /api/case-notes/:noteId
 * @desc Delete a case note
 * @access Private
 */
router.delete('/:noteId', authorizeByAnyPermissionOrRole(['add_case_notes', 'edit_department_cases', 'edit_all_cases'], 'employee', 'deputy_manager', 'manager', 'administrator'), caseNoteController.deleteNote);

module.exports = router;
