const caseNoteService = require('../services/caseNote.service');
const delegationService = require('../services/delegation.service');
const { body, param, query, validationResult } = require('express-validator');
const logger = require('../config/logger');

/**
 * Create a new case note
 */
const createNote = [
  // Validation
  body('case_id').isUUID().withMessage('Valid case ID is required'),
  body('note_content')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Note content must be between 1 and 5000 characters'),
  body('is_private').isBoolean().optional().withMessage('is_private must be a boolean'),

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

      const { case_id, note_content, is_private = false } = req.body;
      const fullname = req.user.fullname;

      // SECURITY: Check if user has permission to create notes for this case (including delegation)
      const canUpdate = await delegationService.canPerformActionOnCase(case_id, req.user);

      if (!canUpdate) {
        logger.warn('🚫 SECURITY: Unauthorized case note creation attempt', {
          user: req.user.employee_code,
          role: req.user.role,
          dept: req.user.dept,
          caseId: case_id,
        });

        return res.status(403).json({
          success: false,
          message:
            'Bạn không có quyền tạo ghi chú cho hồ sơ này. Chỉ có thể tạo ghi chú cho hồ sơ được giao cho bạn hoặc được ủy quyền.',
        });
      }

      const note = await caseNoteService.createNote({
        case_id,
        note_content,
        is_private,
        created_by_fullname: fullname,
      });

      logger.info('Case note created successfully', {
        noteId: note.note_id,
        caseId: case_id,
        createdBy: fullname,
      });

      res.status(201).json({
        success: true,
        message: 'Ghi chú được tạo thành công',
        data: note,
      });
    } catch (error) {
      next(error);
    }
  },
];

/**
 * Get notes for a case
 */
const getNotesByCase = [
  // Validation
  param('caseId').isUUID().withMessage('Valid case ID is required'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  query('includePrivate').optional().isBoolean().withMessage('includePrivate must be a boolean'),

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
      const { limit = 20, offset = 0, includePrivate = false } = req.query;
      const currentFullname = req.user.fullname;

      const notes = await caseNoteService.getNotesByCase(
        caseId,
        currentFullname,
        includePrivate === 'true' || includePrivate === true,
      );

      res.json({
        success: true,
        message: 'Lấy danh sách ghi chú thành công',
        data: notes,
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
 * Update a case note
 */
const updateNote = [
  // Validation
  param('noteId').isUUID().withMessage('Valid note ID is required'),
  body('note_content')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Note content must be between 1 and 5000 characters'),
  body('is_private').isBoolean().optional().withMessage('is_private must be a boolean'),

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

      const { noteId } = req.params;
      const { note_content, is_private } = req.body;
      const fullname = req.user.fullname;

      const updatedNote = await caseNoteService.updateNote(
        noteId,
        {
          note_content,
          is_private,
        },
        fullname,
      );

      logger.info('Case note updated successfully', {
        noteId,
        updatedBy: fullname,
      });

      res.json({
        success: true,
        message: 'Ghi chú được cập nhật thành công',
        data: updatedNote,
      });
    } catch (error) {
      next(error);
    }
  },
];

/**
 * Delete a case note
 */
const deleteNote = [
  // Validation
  param('noteId').isUUID().withMessage('Valid note ID is required'),

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

      const { noteId } = req.params;
      const fullname = req.user.fullname;

      await caseNoteService.deleteNote(noteId, fullname);

      logger.info('Case note deleted successfully', {
        noteId,
        deletedBy: fullname,
      });

      res.json({
        success: true,
        message: 'Ghi chú được xóa thành công',
      });
    } catch (error) {
      next(error);
    }
  },
];

/**
 * Get a specific note by ID
 */
const getNoteById = [
  // Validation
  param('noteId').isUUID().withMessage('Valid note ID is required'),

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

      const { noteId } = req.params;
      const currentFullname = req.user.fullname;

      const note = await caseNoteService.getNoteById(noteId, currentFullname);

      res.json({
        success: true,
        message: 'Lấy thông tin ghi chú thành công',
        data: note,
      });
    } catch (error) {
      next(error);
    }
  },
];

module.exports = {
  createNote,
  getNotesByCase,
  updateNote,
  deleteNote,
  getNoteById,
};
