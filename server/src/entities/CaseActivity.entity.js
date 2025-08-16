const { EntitySchema } = require('typeorm');

const CaseActivity = new EntitySchema({
  name: 'CaseActivity',
  tableName: 'case_activities',
  columns: {
    activity_id: {
      primary: true,
      type: 'uuid',
      generated: 'uuid',
    },
    case_id: {
      type: 'uuid',
      nullable: false,
    },
    activity_type: {
      type: 'varchar',
      length: 50,
      nullable: false,
      comment: 'Type of activity: status_change, file_upload, file_delete, case_assignment, etc.',
    },
    activity_description: {
      type: 'text',
      nullable: false,
      comment: 'Description of the activity performed',
    },
    old_value: {
      type: 'text',
      nullable: true,
      comment: 'Previous value before the change (for status changes, etc.)',
    },
    new_value: {
      type: 'text',
      nullable: true,
      comment: 'New value after the change (for status changes, etc.)',
    },
    metadata: {
      type: 'jsonb',
      nullable: true,
      comment: 'Additional metadata related to the activity (file info, etc.)',
    },
    performed_by_fullname: {
      type: 'varchar',
      length: 255,
      nullable: false,
      comment: 'Display name of the performer at the time of activity',
    },
    performed_date: {
      type: 'timestamptz',
      createDate: true,
    },
    is_system_activity: {
      type: 'boolean',
      default: false,
      comment: 'Whether this activity was performed by the system automatically',
    },
  },
  relations: {
    debtCase: {
      target: 'DebtCase',
      type: 'many-to-one',
      joinColumn: { name: 'case_id', referencedColumnName: 'case_id' },
      onDelete: 'CASCADE',
    },
  },
  indices: [
    {
      name: 'IDX_case_activities_case_id',
      columns: ['case_id'],
    },
    {
      name: 'IDX_case_activities_type',
      columns: ['activity_type'],
    },
    {
      name: 'IDX_case_activities_performed_date',
      columns: ['performed_date'],
    },
    {
      name: 'IDX_case_activities_system',
      columns: ['is_system_activity'],
    },
  ],
});

module.exports = { CaseActivity };
