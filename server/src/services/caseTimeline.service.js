const AppDataSource = require('../config/dataSource');
const logger = require('../config/logger');

/**
 * Get unified timeline combining case notes and activities
 */
const getCaseTimeline = async (caseId, options = {}) => {
  const { page = 1, limit = 10, type = 'all', userRole, employeeCode, fullname } = options;

  try {
    const offset = (page - 1) * limit;

    const caseNoteRepo = AppDataSource.getRepository('CaseNote');
    const caseActivityRepo = AppDataSource.getRepository('CaseActivity');

    let timeline = [];
    let total = 0;

    if (type === 'all' || type === 'notes') {
      const notesQueryBuilder = caseNoteRepo
        .createQueryBuilder('note')
        .where('note.case_id = :caseId', { caseId })
        .orderBy('note.created_date', 'DESC');

      try {
        if (
          userRole !== 'administrator' &&
          userRole !== 'director' &&
          userRole !== 'deputy_director'
        ) {
          notesQueryBuilder.andWhere(
            '(note.is_private = false OR note.is_private IS NULL OR note.created_by_fullname = :fullname)',
            { fullname },
          );
        }
      } catch (error) {
        logger.warn('is_private column not found in case_notes, skipping private note filtering');
      }

      if (type === 'notes') {
        notesQueryBuilder.skip(offset).take(limit);
      }

      const notes = await notesQueryBuilder.getMany();

      const noteItems = notes.map((note) => ({
        id: note.note_id,
        type: 'note',
        caseId: note.case_id,
        content: note.note_content,
        isPrivate: note.is_private || false,
        performedBy: {
          employeeCode: undefined,
          fullname: note.created_by_fullname,
          department: '',
          role: '',
        },
        performedDate: note.created_date,
        updatedDate: note.updated_date,
      }));

      timeline = timeline.concat(noteItems);
    }

    if (type === 'all' || type === 'activities') {
      const activitiesQueryBuilder = caseActivityRepo
        .createQueryBuilder('activity')
        .where('activity.case_id = :caseId', { caseId })
        .orderBy('activity.performed_date', 'DESC');

      if (type === 'activities') {
        activitiesQueryBuilder.skip(offset).take(limit);
      }

      const activities = await activitiesQueryBuilder.getMany();

      const activityItems = activities.map((activity) => ({
        id: activity.activity_id,
        type: 'activity',
        caseId: activity.case_id,
        content: activity.activity_description,
        activityType: activity.activity_type,
        activityDescription: activity.activity_description,
        oldValue: activity.old_value || null,
        newValue: activity.new_value || null,
        metadata: activity.metadata,
        performedBy: {
          employeeCode: undefined,
          fullname: activity.is_system_activity ? 'System' : activity.performed_by_fullname,
          department: '',
          role: '',
        },
        // For status change, if description contains pattern, attempt to extract old/new when fields missing
        ...(activity.activity_type === 'status_change' &&
        (!activity.old_value || !activity.new_value)
          ? (() => {
              const match = /Thay đổi trạng thái từ "(.+?)" thành "(.+?)"/.exec(
                activity.activity_description || '',
              );
              if (match) {
                return { oldValue: match[1], newValue: match[2] };
              }
              return {};
            })()
          : {}),
        performedDate: activity.performed_date,
        updatedDate: null,
      }));

      timeline = timeline.concat(activityItems);
    }

    timeline.sort((a, b) => new Date(b.performedDate) - new Date(a.performedDate));

    if (type === 'all') {
      total = timeline.length;
      timeline = timeline.slice(offset, offset + limit);
    } else {
      if (type === 'notes') {
        total = await caseNoteRepo.count({ where: { case_id: caseId } });
      } else if (type === 'activities') {
        total = await caseActivityRepo.count({ where: { case_id: caseId } });
      }
    }

    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return {
      timeline,
      pagination: {
        currentPage: page,
        totalPages,
        total,
        limit,
        hasMore,
        offset,
      },
    };
  } catch (error) {
    logger.error('Error fetching case timeline:', {
      caseId,
      options,
      error: error.message,
      stack: error.stack,
    });
    throw new Error('Không thể lấy timeline của case');
  }
};

module.exports = {
  getCaseTimeline,
};
