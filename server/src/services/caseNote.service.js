const AppDataSource = require('../config/dataSource');
const logger = require('../config/logger');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

class CaseNoteService {
  constructor() {
    this.caseNoteRepository = AppDataSource.getRepository('CaseNote');
    this.debtCaseRepository = AppDataSource.getRepository('DebtCase');
  }

  /**
   * Create a new case note
   * @param {Object} noteData - Note data
   * @param {string} noteData.case_id - Case ID
   * @param {string} noteData.note_content - Note content
   * @param {string} noteData.created_by_fullname - Fullname of creator
   * @param {boolean} noteData.is_private - Whether note is private
   * @returns {Promise<Object>} Created note
   */
  async createNote(noteData) {
    try {
      const { case_id, note_content, created_by_fullname, is_private = false } = noteData;

      // Validate required fields
      if (!case_id || !note_content || !created_by_fullname) {
        throw new ValidationError('Case ID, note content, and creator name are required');
      }

      // Verify case exists
      const caseExists = await this.debtCaseRepository.findOne({
        where: { case_id },
      });

      if (!caseExists) {
        throw new NotFoundError('Case not found');
      }

      // Create note
      const note = this.caseNoteRepository.create({
        case_id,
        note_content: note_content.trim(),
        created_by_fullname,
        is_private,
      });

      const savedNote = await this.caseNoteRepository.save(note);

      logger.info('Case note created', {
        noteId: savedNote.note_id,
        caseId: case_id,
        createdBy: created_by_fullname,
        isPrivate: is_private,
      });

      return savedNote;
    } catch (error) {
      logger.error('Error creating case note:', error);
      throw error;
    }
  }

  /**
   * Get notes for a case
   * @param {string} caseId - Case ID
   * @param {string} requestingFullname - Fullname requesting the notes
   * @param {boolean} includePrivate - Whether to include private notes
   * @returns {Promise<Array>} Array of notes
   */
  async getNotesByCase(caseId, requestingFullname, includePrivate = false) {
    try {
      const queryBuilder = this.caseNoteRepository
        .createQueryBuilder('note')
        .where('note.case_id = :caseId', { caseId })
        .orderBy('note.created_date', 'DESC');

      // Handle private notes visibility
      if (!includePrivate) {
        queryBuilder.andWhere('note.is_private = false');
      } else if (requestingFullname) {
        queryBuilder.andWhere('(note.is_private = false OR note.created_by_fullname = :fullname)', {
          fullname: requestingFullname,
        });
      }

      const notes = await queryBuilder.getMany();

      logger.debug('Retrieved case notes', {
        caseId,
        noteCount: notes.length,
        requestingFullname,
      });

      return notes;
    } catch (error) {
      logger.error('Error retrieving case notes:', error);
      throw error;
    }
  }

  /**
   * Update a note
   * @param {string} noteId - Note ID
   * @param {Object} updateData - Update data
   * @param {string} requestingFullname - Fullname requesting the update
   * @returns {Promise<Object>} Updated note
   */
  async updateNote(noteId, updateData, requestingFullname) {
    try {
      const note = await this.caseNoteRepository.findOne({
        where: { note_id: noteId },
      });

      if (!note) {
        throw new NotFoundError('Note not found');
      }

      // Only creator can update their notes
      if (note.created_by_fullname !== requestingFullname) {
        throw new ValidationError('You can only update your own notes');
      }

      // Update allowed fields
      if (updateData.note_content) {
        note.note_content = updateData.note_content.trim();
      }
      if (typeof updateData.is_private === 'boolean') {
        note.is_private = updateData.is_private;
      }

      const updatedNote = await this.caseNoteRepository.save(note);

      logger.info('Case note updated', {
        noteId,
        updatedBy: requestingFullname,
      });

      return updatedNote;
    } catch (error) {
      logger.error('Error updating case note:', error);
      throw error;
    }
  }

  /**
   * Delete a note
   * @param {string} noteId - Note ID
   * @param {string} requestingFullname - Fullname requesting the deletion
   * @returns {Promise<boolean>} Success status
   */
  async deleteNote(noteId, requestingFullname) {
    try {
      const note = await this.caseNoteRepository.findOne({
        where: { note_id: noteId },
      });

      if (!note) {
        throw new NotFoundError('Note not found');
      }

      // Only creator can delete their notes
      if (note.created_by_fullname !== requestingFullname) {
        throw new ValidationError('You can only delete your own notes');
      }

      await this.caseNoteRepository.remove(note);

      logger.info('Case note deleted', {
        noteId,
        deletedBy: requestingFullname,
      });

      return true;
    } catch (error) {
      logger.error('Error deleting case note:', error);
      throw error;
    }
  }
}

module.exports = new CaseNoteService();
