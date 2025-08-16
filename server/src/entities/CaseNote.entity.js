const { EntitySchema } = require('typeorm');

const CaseNote = new EntitySchema({
  name: 'CaseNote',
  tableName: 'case_notes',
  columns: {
    note_id: {
      primary: true,
      type: 'uuid',
      generated: 'uuid',
    },
    case_id: {
      type: 'uuid',
      nullable: false,
    },
    note_content: {
      type: 'text',
      nullable: false,
      comment: 'User-entered notes and comments for the case',
    },
    is_private: {
      type: 'boolean',
      default: false,
      comment: 'Whether the note is private (only visible to creator and admins)',
    },
    created_by_fullname: {
      type: 'varchar',
      length: 255,
      nullable: false,
      comment: 'Display name of the creator at creation time',
    },
    created_date: {
      type: 'timestamptz',
      createDate: true,
    },
    updated_date: {
      type: 'timestamptz',
      updateDate: true,
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
      name: 'IDX_case_notes_case_id',
      columns: ['case_id'],
    },
    {
      name: 'IDX_case_notes_created_date',
      columns: ['created_date'],
    },
  ],
});

module.exports = { CaseNote };
