const AppDataSource = require('../config/dataSource');
const logger = require('../config/logger');
const { CASE_ACTIVITY_TYPES, ACTIVITY_DESCRIPTIONS } = require('../constants/activityConstants');
const { ValidationError } = require('../middleware/errorHandler');

class CaseActivityService {
  constructor() {
    this.caseActivityRepository = AppDataSource.getRepository('CaseActivity');
    this.debtCaseRepository = AppDataSource.getRepository('DebtCase');
  }

  /**
   * Log a case activity
   * @param {Object} activityData - Activity data
   * @param {string} activityData.case_id - Case ID
   * @param {string} activityData.activity_type - Activity type
   * @param {string} activityData.activity_description - Activity description
   * @param {string} activityData.old_value - Previous value (optional)
   * @param {string} activityData.new_value - New value (optional)
   * @param {Object} activityData.metadata - Additional metadata (optional)
   * @param {string} activityData.performed_by_fullname - Fullname of performer
   * @param {boolean} activityData.is_system_activity - Whether it's a system activity
   * @returns {Promise<Object>} Created activity
   */
  async logActivity(activityData) {
    try {
      const {
        case_id,
        activity_type,
        activity_description,
        old_value = null,
        new_value = null,
        metadata = null,
        performed_by_fullname,
        is_system_activity = false,
      } = activityData;

      // Validate required fields
      if (!case_id || !activity_type || !activity_description) {
        throw new ValidationError('Case ID, activity type, and description are required');
      }

      // Validate activity type
      if (!Object.values(CASE_ACTIVITY_TYPES).includes(activity_type)) {
        throw new ValidationError('Invalid activity type');
      }

      // Create activity
      const activity = this.caseActivityRepository.create({
        case_id,
        activity_type,
        activity_description,
        old_value,
        new_value,
        metadata,
        performed_by_fullname: is_system_activity ? 'System' : performed_by_fullname,
        is_system_activity,
      });

      const savedActivity = await this.caseActivityRepository.save(activity);

      logger.info('Case activity logged', {
        activityId: savedActivity.activity_id,
        caseId: case_id,
        activityType: activity_type,
        performedBy: is_system_activity ? 'System' : performed_by_fullname,
        isSystem: is_system_activity,
      });

      return savedActivity;
    } catch (error) {
      logger.error('Error logging case activity:', error);
      throw error;
    }
  }

  /**
   * Log status change activity
   */
  async logStatusChange(caseId, oldStatus, newStatus, performerFullname) {
    return this.logActivity({
      case_id: caseId,
      activity_type: CASE_ACTIVITY_TYPES.STATUS_CHANGE,
      activity_description: `Thay đổi trạng thái từ "${oldStatus}" thành "${newStatus}"`,
      old_value: oldStatus,
      new_value: newStatus,
      performed_by_fullname: performerFullname,
      is_system_activity: false,
    });
  }

  /**
   * Log file upload activity
   */
  async logFileUpload(caseId, fileInfo, performerFullname) {
    return this.logActivity({
      case_id: caseId,
      activity_type: CASE_ACTIVITY_TYPES.FILE_UPLOAD,
      activity_description: `Tải lên tài liệu: ${fileInfo.original_filename}`,
      new_value: fileInfo.original_filename,
      metadata: {
        document_id: fileInfo.document_id,
        file_size: fileInfo.file_size,
        mime_type: fileInfo.mime_type,
      },
      performed_by_fullname: performerFullname,
      is_system_activity: false,
    });
  }

  /**
   * Log file deletion activity
   */
  async logFileDelete(caseId, fileInfo, performerFullname) {
    return this.logActivity({
      case_id: caseId,
      activity_type: CASE_ACTIVITY_TYPES.FILE_DELETE,
      activity_description: `Xóa tài liệu: ${fileInfo.original_filename}`,
      old_value: fileInfo.original_filename,
      metadata: {
        document_id: fileInfo.document_id,
        file_size: fileInfo.file_size,
        mime_type: fileInfo.mime_type,
      },
      performed_by_fullname: performerFullname,
      is_system_activity: false,
    });
  }

  /**
   * Log case assignment activity
   */
  async logCaseAssignment(caseId, oldEmployee, newEmployee, performerFullname) {
    const activityType = oldEmployee
      ? CASE_ACTIVITY_TYPES.CASE_REASSIGNMENT
      : CASE_ACTIVITY_TYPES.CASE_ASSIGNMENT;
    const description = oldEmployee
      ? `Chuyển giao hồ sơ từ ${oldEmployee} cho ${newEmployee}`
      : `Gán hồ sơ cho ${newEmployee}`;

    return this.logActivity({
      case_id: caseId,
      activity_type: activityType,
      activity_description: description,
      old_value: oldEmployee,
      new_value: newEmployee,
      performed_by_fullname: performerFullname,
      is_system_activity: false,
    });
  }

  /**
   * Get activities for a case
   */
  async getActivitiesByCase(caseId, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        activityType = null,
        includeSystemActivities = true,
      } = options;

      const queryBuilder = this.caseActivityRepository
        .createQueryBuilder('activity')
        .where('activity.case_id = :caseId', { caseId })
        .orderBy('activity.performed_date', 'DESC')
        .skip(offset)
        .take(limit);

      if (activityType) {
        queryBuilder.andWhere('activity.activity_type = :activityType', { activityType });
      }

      if (!includeSystemActivities) {
        queryBuilder.andWhere('activity.is_system_activity = false');
      }

      const activities = await queryBuilder.getMany();

      logger.debug('Retrieved case activities', {
        caseId,
        activityCount: activities.length,
        activityType,
        includeSystemActivities,
      });

      return activities;
    } catch (error) {
      logger.error('Error retrieving case activities:', error);
      throw error;
    }
  }

  /**
   * Get activity statistics for a case
   */
  async getCaseActivityStats(caseId) {
    try {
      const stats = await this.caseActivityRepository
        .createQueryBuilder('activity')
        .select('activity.activity_type', 'activity_type')
        .addSelect('COUNT(*)', 'count')
        .where('activity.case_id = :caseId', { caseId })
        .groupBy('activity.activity_type')
        .getRawMany();

      const totalActivities = await this.caseActivityRepository.count({
        where: { case_id: caseId },
      });

      logger.debug('Retrieved case activity statistics', {
        caseId,
        totalActivities,
        typeBreakdown: stats,
      });

      return {
        totalActivities,
        typeBreakdown: stats.reduce((acc, stat) => {
          acc[stat.activity_type] = parseInt(stat.count);
          return acc;
        }, {}),
      };
    } catch (error) {
      logger.error('Error retrieving case activity statistics:', error);
      throw error;
    }
  }
}

module.exports = new CaseActivityService();
